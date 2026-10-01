import { db, conn } from "@/db";
import { categories, transactions } from "@/db/schema";
import { monthEnd, monthStart } from "@/lib/date";
import { getCarryOverBalance, getMonthSummary, getMonthSummarySync, type TransactionWithCategory } from "@/features/transactions/repository";
import { getMonthBudgetsOverview, type BudgetProgress } from "@/features/budgets/repository";
import { getGoalsWithProgress, type GoalProgress } from "@/features/goals/repository";
import { and, between, desc, eq } from "drizzle-orm";

export interface DashboardData {
    period: string;
    carryOver: number;
    availableBalance: number;
    totalIncome: number;
    totalExpenses: number;
    topBudgets: BudgetProgress[];
    featuredGoal: GoalProgress | null;
    recentTransactions: TransactionWithCategory[];
}

export async function getDashboardData(period: string): Promise<DashboardData> {
    const start = monthStart(period);
    const end = monthEnd(period);

    const summaryPromise = getMonthSummary(period);
    const budgetsOverviewPromise = getMonthBudgetsOverview(period);
    const goalsPromise = getGoalsWithProgress();
    const recentTxRowsPromise = db
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
        .where(
            and(
                between(transactions.date, start, end),
            ),
        )
        .orderBy(desc(transactions.date), desc(transactions.createdAt))
        .limit(4);

    const [summary, budgetsOverview, allGoals, recentRows] = await Promise.all([
        summaryPromise,
        budgetsOverviewPromise,
        goalsPromise,
        recentTxRowsPromise,
    ]);

    const recentTransactions: TransactionWithCategory[] = recentRows.map((r) => ({
        id: r.id,
        amount: r.amount,
        type: r.type,
        categoryId: r.categoryId,
        savingsGoalId: r.savingsGoalId,
        date: r.date,
        note: r.note,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
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

    const topBudgets = budgetsOverview.categoryBudgets.slice(0, 3);

    const featuredGoal = allGoals.length > 0 ? allGoals[0] : null;

    const carryOver = getCarryOverBalance(period);

    return {
        period,
        carryOver,
        availableBalance: carryOver + summary.totalIncome - summary.totalExpenses,
        totalIncome: summary.totalIncome,
        totalExpenses: summary.totalExpenses,
        topBudgets,
        featuredGoal,
        recentTransactions,
    };
}

export function getDashboardDataSync(period: string): DashboardData | null {
    try {
        const start = monthStart(period);
        const end = monthEnd(period);

        const summary = getMonthSummarySync(period);
        const carryOver = getCarryOverBalance(period);

        const rows = conn.getAllSync<any>(
            `SELECT 
                t.id, t.amount, t.type, t.category_id as categoryId, t.savings_goal_id as savingsGoalId,
                t.date, t.note, t.created_at as createdAt, t.updated_at as updatedAt,
                c.id as catId, c.name as catName, c.icon as catIcon, c.color as catColor, c.type as catType, c.created_at as catCreatedAt
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.date BETWEEN ? AND ?
            ORDER BY t.date DESC, t.created_at DESC
            LIMIT 4`,
            [start, end]
        );

        const recentTransactions: TransactionWithCategory[] = rows.map((r) => ({
            id: r.id,
            amount: r.amount,
            type: r.type,
            categoryId: r.categoryId,
            savingsGoalId: r.savingsGoalId,
            date: r.date,
            note: r.note,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            category: r.catId
                ? {
                      id: r.catId,
                      name: r.catName,
                      icon: r.catIcon,
                      color: r.catColor,
                      type: r.catType,
                      createdAt: r.catCreatedAt,
                  }
                : null,
        }));

        return {
            period,
            carryOver,
            availableBalance: carryOver + summary.totalIncome - summary.totalExpenses,
            totalIncome: summary.totalIncome,
            totalExpenses: summary.totalExpenses,
            topBudgets: [],
            featuredGoal: null,
            recentTransactions,
        };
    } catch {
        return null;
    }
}
