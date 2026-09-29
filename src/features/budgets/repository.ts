import { db } from "@/db";
import { budgets, categories, transactions, type Budget, type Category } from "@/db/schema";
import { newId } from "@/lib/id";
import { monthEnd, monthStart } from "@/lib/date";
import { and, between, eq, sql } from "drizzle-orm";
import { syncBudgetToCloud, deleteBudgetFromCloud } from "@/services/sync";

// ── Types ────────────────────────────────────────────────────────────

export interface BudgetWithCategory extends Budget {
    category: Category | null;
}

export interface BudgetProgress {
    id: string;
    period: string;
    scope: "global" | "category";
    categoryId: string | null;
    categoryName?: string;
    categoryIcon?: string;
    categoryColor?: string;
    limitAmount: number; // in cents
    spentAmount: number; // in cents
    remainingAmount: number; // limitAmount - spentAmount (can be negative)
    percentage: number; // 0..100+
    status: "ok" | "warn" | "over";
}

export interface MonthBudgetsOverview {
    period: string;
    globalBudget: BudgetProgress | null;
    categoryBudgets: BudgetProgress[];
    totalBudgeted: number; // sum of category envelopes (or global limit)
    totalSpent: number;
}

// ── Queries ──────────────────────────────────────────────────────────

export async function getBudgetsForPeriod(
    period: string,
): Promise<BudgetWithCategory[]> {
    const rows = await db
        .select({
            id: budgets.id,
            period: budgets.period,
            scope: budgets.scope,
            categoryId: budgets.categoryId,
            amount: budgets.amount,
            createdAt: budgets.createdAt,
            catId: categories.id,
            catName: categories.name,
            catIcon: categories.icon,
            catColor: categories.color,
            catType: categories.type,
            catCreatedAt: categories.createdAt,
        })
        .from(budgets)
        .leftJoin(categories, eq(budgets.categoryId, categories.id))
        .where(eq(budgets.period, period));

    return rows.map((r) => ({
        id: r.id,
        period: r.period,
        scope: r.scope,
        categoryId: r.categoryId,
        amount: r.amount,
        createdAt: r.createdAt,
        category: r.catId
            ? {
                  id: r.catId,
                  name: r.catName!,
                  icon: r.catIcon!,
                  color: r.catColor!,
                  type: r.catType!,
                  createdAt: r.catCreatedAt!,
              }
            : null,
    }));
}

export async function getBudgetById(
    id: string,
): Promise<BudgetWithCategory | undefined> {
    const [row] = await db
        .select({
            id: budgets.id,
            period: budgets.period,
            scope: budgets.scope,
            categoryId: budgets.categoryId,
            amount: budgets.amount,
            createdAt: budgets.createdAt,
            catId: categories.id,
            catName: categories.name,
            catIcon: categories.icon,
            catColor: categories.color,
            catType: categories.type,
            catCreatedAt: categories.createdAt,
        })
        .from(budgets)
        .leftJoin(categories, eq(budgets.categoryId, categories.id))
        .where(eq(budgets.id, id))
        .limit(1);

    if (!row) return undefined;

    return {
        id: row.id,
        period: row.period,
        scope: row.scope,
        categoryId: row.categoryId,
        amount: row.amount,
        createdAt: row.createdAt,
        category: row.catId
            ? {
                  id: row.catId,
                  name: row.catName!,
                  icon: row.catIcon!,
                  color: row.catColor!,
                  type: row.catType!,
                  createdAt: row.catCreatedAt!,
              }
            : null,
    };
}

/**
 * Calculates real-time progress for all budgets in a given period.
 * Aggregates actual expenses from transactions and compares against limits.
 */
export async function getMonthBudgetsOverview(
    period: string,
): Promise<MonthBudgetsOverview> {
    const start = monthStart(period);
    const end = monthEnd(period);

    // 1. Fetch all budgets configured for this month
    const configuredBudgets = await getBudgetsForPeriod(period);

    // 2. Aggregate expenses for the whole month (for global budget)
    const [totalExpenseResult] = await db
        .select({
            total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
        })
        .from(transactions)
        .where(
            and(
                eq(transactions.type, "expense"),
                between(transactions.date, start, end),
            ),
        );
    const totalSpentMonth = Number(totalExpenseResult?.total ?? 0);

    // 3. Aggregate expenses grouped by category
    const categoryExpenses = await db
        .select({
            categoryId: transactions.categoryId,
            total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
        })
        .from(transactions)
        .where(
            and(
                eq(transactions.type, "expense"),
                between(transactions.date, start, end),
            ),
        )
        .groupBy(transactions.categoryId);

    const expenseMap = new Map<string, number>();
    for (const row of categoryExpenses) {
        if (row.categoryId) {
            expenseMap.set(row.categoryId, Number(row.total));
        }
    }

    // 4. Map into BudgetProgress objects
    let globalBudget: BudgetProgress | null = null;
    const categoryBudgets: BudgetProgress[] = [];

    for (const b of configuredBudgets) {
        if (b.scope === "global") {
            const spent = totalSpentMonth;
            const remaining = b.amount - spent;
            const percentage = b.amount > 0 ? (spent / b.amount) * 100 : 0;
            const status: BudgetProgress["status"] =
                percentage >= 100 ? "over" : percentage >= 80 ? "warn" : "ok";

            globalBudget = {
                id: b.id,
                period: b.period,
                scope: "global",
                categoryId: null,
                categoryName: "Presupuesto global",
                categoryIcon: "🌐",
                limitAmount: b.amount,
                spentAmount: spent,
                remainingAmount: remaining,
                percentage,
                status,
            };
        } else {
            const spent = b.categoryId ? (expenseMap.get(b.categoryId) ?? 0) : 0;
            const remaining = b.amount - spent;
            const percentage = b.amount > 0 ? (spent / b.amount) * 100 : 0;
            const status: BudgetProgress["status"] =
                percentage >= 100 ? "over" : percentage >= 80 ? "warn" : "ok";

            categoryBudgets.push({
                id: b.id,
                period: b.period,
                scope: "category",
                categoryId: b.categoryId,
                categoryName: b.category?.name ?? "Categoría eliminada",
                categoryIcon: b.category?.icon ?? "📦",
                categoryColor: b.category?.color,
                limitAmount: b.amount,
                spentAmount: spent,
                remainingAmount: remaining,
                percentage,
                status,
            });
        }
    }

    // Sort category budgets: over-budget first, then warn, then ok
    categoryBudgets.sort((a, b) => b.percentage - a.percentage);

    const totalBudgeted = categoryBudgets.reduce(
        (sum, b) => sum + b.limitAmount,
        0,
    );

    return {
        period,
        globalBudget,
        categoryBudgets,
        totalBudgeted,
        totalSpent: totalSpentMonth,
    };
}

// ── Mutations ────────────────────────────────────────────────────────

export async function createBudget(data: {
    period: string;
    scope: "global" | "category";
    categoryId?: string | null;
    amount: number;
}): Promise<Budget> {
    const categoryId = data.scope === "category" ? (data.categoryId ?? null) : null;

    // Check if a budget already exists for this scope/category/period
    const existing = await db
        .select()
        .from(budgets)
        .where(
            and(
                eq(budgets.period, data.period),
                eq(budgets.scope, data.scope),
                categoryId
                    ? eq(budgets.categoryId, categoryId)
                    : sql`${budgets.categoryId} IS NULL`,
            ),
        )
        .limit(1);

    if (existing.length > 0) {
        // Update existing instead of creating duplicate
        const [updated] = await db
            .update(budgets)
            .set({ amount: data.amount })
            .where(eq(budgets.id, existing[0].id))
            .returning();
        if (updated) {
            void syncBudgetToCloud(updated);
        }
        return updated;
    }

    const [created] = await db
        .insert(budgets)
        .values({
            id: newId(),
            period: data.period,
            scope: data.scope,
            categoryId,
            amount: data.amount,
            createdAt: Date.now(),
        })
        .returning();

    void syncBudgetToCloud(created);
    return created;
}

export async function updateBudget(
    id: string,
    data: { amount: number },
): Promise<Budget> {
    const [updated] = await db
        .update(budgets)
        .set({ amount: data.amount })
        .where(eq(budgets.id, id))
        .returning();
    if (updated) {
        void syncBudgetToCloud(updated);
    }
    return updated;
}

export async function deleteBudget(id: string): Promise<void> {
    await db.delete(budgets).where(eq(budgets.id, id));
    void deleteBudgetFromCloud(id);
}
