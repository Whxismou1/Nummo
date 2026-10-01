import { db, conn } from "@/db";
import { categories, Category, NewTransaction, Transaction, transactions } from "@/db/schema";
import { monthEnd, monthStart } from "@/lib/date";
import { newId } from "@/lib/id";
import { and, between, desc, eq, sql } from "drizzle-orm";
import { syncTransactionToCloud, deleteTransactionFromCloud } from "@/services/sync";


type TransactionInput = Omit<NewTransaction, "id">;

export type TransactionWithCategory = Transaction & {
    category: Category | null;
};

export type MonthSummary = {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
};


export const createTransaction = async (
    trans: TransactionInput,
): Promise<Transaction> => {
    const now = Date.now();
    const [saved] = await db
        .insert(transactions)
        .values({
            ...trans,
            id: newId(),
            createdAt: now,
            updatedAt: now,
        })
        .returning();
    void syncTransactionToCloud(saved);
    return saved;
};

export const getTransactionByIdSync = (
    id: string,
): TransactionWithCategory | null => {
    try {
        const row = conn.getFirstSync<any>(
            `SELECT 
                t.id, t.amount, t.type, t.category_id as categoryId, t.savings_goal_id as savingsGoalId,
                t.date, t.note, t.created_at as createdAt, t.updated_at as updatedAt,
                c.id as catId, c.name as catName, c.icon as catIcon, c.color as catColor, c.type as catType, c.created_at as catCreatedAt
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.id = ?
            LIMIT 1`,
            [id]
        );
        if (!row) return null;
        return mapRowToTransactionWithCategory(row);
    } catch {
        return null;
    }
};

export const getTransactionById = async (
    id: string,
): Promise<TransactionWithCategory | null> => {
    return getTransactionByIdSync(id);
};

export const updateTransaction = async (
    id: string,
    data: Partial<TransactionInput>,
): Promise<Transaction> => {
    const [updated] = await db
        .update(transactions)
        .set({ ...data, updatedAt: Date.now() })
        .where(eq(transactions.id, id))
        .returning();
    if (updated) {
        void syncTransactionToCloud(updated);
    }
    return updated;
};

export const deleteTransaction = async (id: string): Promise<void> => {
    await db.delete(transactions).where(eq(transactions.id, id));
    void deleteTransactionFromCloud(id);
};


export const getTransactionsForPeriod = async (
    period: string,
): Promise<TransactionWithCategory[]> => {
    const start = monthStart(period);
    const end = monthEnd(period);

    const rows = await db
        .select({
            id: transactions.id,
            amount: transactions.amount,
            type: transactions.type,
            categoryId: transactions.categoryId,
            savingsGoalId: transactions.savingsGoalId,
            date: transactions.date,
            note: transactions.note,
            createdAt: transactions.createdAt,
            updatedAt: transactions.updatedAt,
            catId: categories.id,
            catName: categories.name,
            catIcon: categories.icon,
            catColor: categories.color,
            catType: categories.type,
            catCreatedAt: categories.createdAt,
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(between(transactions.date, start, end))
        .orderBy(desc(transactions.date));

    return rows.map(mapRowToTransactionWithCategory);
};

export const getTransactionsForPeriodSync = (
    period: string,
): TransactionWithCategory[] => {
    try {
        const start = monthStart(period);
        const end = monthEnd(period);
        const rows = conn.getAllSync<any>(
            `SELECT 
                t.id, t.amount, t.type, t.category_id as categoryId, t.savings_goal_id as savingsGoalId,
                t.date, t.note, t.created_at as createdAt, t.updated_at as updatedAt,
                c.id as catId, c.name as catName, c.icon as catIcon, c.color as catColor, c.type as catType, c.created_at as catCreatedAt
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.date BETWEEN ? AND ?
            ORDER BY t.date DESC`,
            [start, end]
        );
        return rows.map(mapRowToTransactionWithCategory);
    } catch {
        return [];
    }
};

export const getMonthSummary = async (
    period: string,
): Promise<MonthSummary> => {
    const start = monthStart(period);
    const end = monthEnd(period);

    const [result] = await db
        .select({
            totalIncome: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'income' THEN ${transactions.amount} ELSE 0 END), 0)`,
            totalExpenses: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`,
        })
        .from(transactions)
        .where(between(transactions.date, start, end));

    const totalIncome = Number(result.totalIncome);
    const totalExpenses = Number(result.totalExpenses);

    return {
        totalIncome,
        totalExpenses,
        balance: totalIncome - totalExpenses,
    };
};

export const getMonthSummarySync = (
    period: string,
): MonthSummary => {
    try {
        const start = monthStart(period);
        const end = monthEnd(period);
        const row = conn.getFirstSync<any>(
            `SELECT 
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as totalIncome,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as totalExpenses
            FROM transactions
            WHERE date BETWEEN ? AND ?`,
            [start, end]
        );
        const totalIncome = Number(row?.totalIncome ?? 0);
        const totalExpenses = Number(row?.totalExpenses ?? 0);
        return {
            totalIncome,
            totalExpenses,
            balance: totalIncome - totalExpenses,
        };
    } catch {
        return { totalIncome: 0, totalExpenses: 0, balance: 0 };
    }
};

export const getCarryOverBalance = (period: string): number => {
    try {
        const start = monthStart(period);
        const row = conn.getFirstSync<{ balance: number }>(
            `SELECT COALESCE(
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) -
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END),
                0
            ) as balance FROM transactions WHERE date < ?`,
            [start]
        );
        return Number(row?.balance ?? 0);
    } catch {
        return 0;
    }
};

export const getAllTransactionsForExport = async (): Promise<TransactionWithCategory[]> => {
    const rows = await db
        .select({
            id: transactions.id,
            amount: transactions.amount,
            type: transactions.type,
            categoryId: transactions.categoryId,
            savingsGoalId: transactions.savingsGoalId,
            date: transactions.date,
            note: transactions.note,
            createdAt: transactions.createdAt,
            updatedAt: transactions.updatedAt,
            catId: categories.id,
            catName: categories.name,
            catIcon: categories.icon,
            catColor: categories.color,
            catType: categories.type,
            catCreatedAt: categories.createdAt,
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .orderBy(desc(transactions.date));

    return rows.map(mapRowToTransactionWithCategory);
};


/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRowToTransactionWithCategory(row: any): TransactionWithCategory {
    return {
        id: row.id,
        amount: row.amount,
        type: row.type,
        categoryId: row.categoryId,
        savingsGoalId: row.savingsGoalId,
        date: row.date,
        note: row.note,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        category: row.catId
            ? {
                  id: row.catId,
                  name: row.catName,
                  icon: row.catIcon,
                  color: row.catColor,
                  type: row.catType,
                  createdAt: row.catCreatedAt,
              }
            : null,
    };
}
