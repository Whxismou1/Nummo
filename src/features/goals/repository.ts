import { db } from "@/db";
import {
    savingsGoals,
    transactions,
    type SavingsGoal,
    type Transaction,
} from "@/db/schema";
import { newId } from "@/lib/id";
import { desc, eq, sql } from "drizzle-orm";
import { syncGoalToCloud, deleteGoalFromCloud, syncTransactionToCloud } from "@/services/sync";

// ── Types ────────────────────────────────────────────────────────────

export interface GoalProgress extends SavingsGoal {
    savedAmount: number; // in cents
    percentage: number | null; // null if no target amount, otherwise 0..100+
    remainingAmount: number | null; // targetAmount - savedAmount (null if no target)
    isCompleted: boolean;
}

export interface ContributionInput {
    goalId: string;
    amount: number; // in cents (always positive)
    note?: string;
    isWithdrawal?: boolean; // false = deposit, true = withdrawal
    date?: number;
}

// ── Queries ──────────────────────────────────────────────────────────

export async function getGoalsWithProgress(): Promise<GoalProgress[]> {
    const allGoals = await db
        .select()
        .from(savingsGoals)
        .orderBy(desc(savingsGoals.createdAt));

    // Aggregate contributions: expense = money put into goal, income = money taken out of goal
    const contributions = await db
        .select({
            goalId: transactions.savingsGoalId,
            total: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE -${transactions.amount} END), 0)`,
        })
        .from(transactions)
        .where(sql`${transactions.savingsGoalId} IS NOT NULL`)
        .groupBy(transactions.savingsGoalId);

    const savedMap = new Map<string, number>();
    for (const row of contributions) {
        if (row.goalId) {
            savedMap.set(row.goalId, Number(row.total));
        }
    }

    return allGoals.map((g) => {
        const savedAmount = Math.max(savedMap.get(g.id) ?? 0, 0);
        const target = g.targetAmount;
        const percentage =
            target && target > 0 ? (savedAmount / target) * 100 : null;
        const remainingAmount =
            target && target > 0 ? Math.max(target - savedAmount, 0) : null;
        const isCompleted = target !== null && target > 0 && savedAmount >= target;

        return {
            ...g,
            savedAmount,
            percentage,
            remainingAmount,
            isCompleted,
        };
    });
}

export async function getGoalByIdWithProgress(
    id: string,
): Promise<GoalProgress | undefined> {
    const [goal] = await db
        .select()
        .from(savingsGoals)
        .where(eq(savingsGoals.id, id))
        .limit(1);

    if (!goal) return undefined;

    const [contrib] = await db
        .select({
            total: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE -${transactions.amount} END), 0)`,
        })
        .from(transactions)
        .where(eq(transactions.savingsGoalId, id));

    const savedAmount = Math.max(Number(contrib?.total ?? 0), 0);
    const target = goal.targetAmount;
    const percentage =
        target && target > 0 ? (savedAmount / target) * 100 : null;
    const remainingAmount =
        target && target > 0 ? Math.max(target - savedAmount, 0) : null;
    const isCompleted = target !== null && target > 0 && savedAmount >= target;

    return {
        ...goal,
        savedAmount,
        percentage,
        remainingAmount,
        isCompleted,
    };
}

export async function getGoalTransactions(
    goalId: string,
): Promise<Transaction[]> {
    return db
        .select()
        .from(transactions)
        .where(eq(transactions.savingsGoalId, goalId))
        .orderBy(desc(transactions.date), desc(transactions.createdAt));
}

// ── Mutations ────────────────────────────────────────────────────────

export async function createGoal(data: {
    name: string;
    targetAmount?: number | null;
    icon: string;
    color: string;
}): Promise<SavingsGoal> {
    const id = newId();
    const [created] = await db
        .insert(savingsGoals)
        .values({
            id,
            name: data.name,
            targetAmount: data.targetAmount ?? null,
            icon: data.icon,
            color: data.color,
            createdAt: Date.now(),
        })
        .returning();
    void syncGoalToCloud(created);
    return created;
}

export async function updateGoal(
    id: string,
    data: {
        name: string;
        targetAmount?: number | null;
        icon: string;
        color: string;
    },
): Promise<SavingsGoal> {
    const [updated] = await db
        .update(savingsGoals)
        .set({
            name: data.name,
            targetAmount: data.targetAmount ?? null,
            icon: data.icon,
            color: data.color,
        })
        .where(eq(savingsGoals.id, id))
        .returning();
    if (updated) {
        void syncGoalToCloud(updated);
    }
    return updated;
}

export async function deleteGoal(id: string): Promise<void> {
    // Unlink any transactions associated with this savings goal
    await db
        .update(transactions)
        .set({ savingsGoalId: null })
        .where(eq(transactions.savingsGoalId, id));

    await db.delete(savingsGoals).where(eq(savingsGoals.id, id));
    void deleteGoalFromCloud(id);
}

export async function addContribution(
    input: ContributionInput,
): Promise<Transaction> {
    if (input.amount <= 0) {
        throw new Error("El importe debe ser mayor que cero");
    }

    if (input.isWithdrawal) {
        const currentGoal = await getGoalByIdWithProgress(input.goalId);
        if (!currentGoal || currentGoal.savedAmount < input.amount) {
            throw new Error("Saldo insuficiente en la hucha para retirar");
        }
    }

    const now = Date.now();
    const [created] = await db
        .insert(transactions)
        .values({
            id: newId(),
            amount: input.amount,
            type: input.isWithdrawal ? "income" : "expense",
            savingsGoalId: input.goalId,
            categoryId: null,
            date: input.date ?? now,
            note:
                input.note && input.note.trim() !== ""
                    ? input.note
                    : input.isWithdrawal
                      ? "Retirada de hucha"
                      : "Aportación a hucha",
            createdAt: now,
            updatedAt: now,
        })
        .returning();
    void syncTransactionToCloud(created);
    return created;
}

export async function transferBetweenGoals(input: {
    fromGoalId: string;
    toGoalId: string;
    amount: number;
    note?: string;
}): Promise<{ withdrawal: Transaction; deposit: Transaction }> {
    if (input.fromGoalId === input.toGoalId) {
        throw new Error("No puedes transferir dinero a la misma hucha");
    }
    if (input.amount <= 0) {
        throw new Error("El importe a transferir debe ser mayor que cero");
    }

    const [fromGoal, toGoal] = await Promise.all([
        getGoalByIdWithProgress(input.fromGoalId),
        getGoalByIdWithProgress(input.toGoalId),
    ]);

    if (!fromGoal) throw new Error("Hucha de origen no encontrada");
    if (!toGoal) throw new Error("Hucha de destino no encontrada");

    if (fromGoal.savedAmount < input.amount) {
        throw new Error("Saldo insuficiente en la hucha de origen");
    }

    const now = Date.now();

    // 1. Withdrawal from origin goal
    const [withdrawal] = await db
        .insert(transactions)
        .values({
            id: newId(),
            amount: input.amount,
            type: "income",
            savingsGoalId: input.fromGoalId,
            categoryId: null,
            date: now,
            note: input.note?.trim() || `Transferencia a "${toGoal.name}"`,
            createdAt: now,
            updatedAt: now,
        })
        .returning();

    // 2. Deposit into destination goal
    const [deposit] = await db
        .insert(transactions)
        .values({
            id: newId(),
            amount: input.amount,
            type: "expense",
            savingsGoalId: input.toGoalId,
            categoryId: null,
            date: now + 1,
            note: input.note?.trim() || `Transferencia desde "${fromGoal.name}"`,
            createdAt: now + 1,
            updatedAt: now + 1,
        })
        .returning();

    void syncTransactionToCloud(withdrawal);
    void syncTransactionToCloud(deposit);

    return { withdrawal, deposit };
}
