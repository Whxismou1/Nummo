import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { monthEnd, monthStart } from "@/lib/date";
import { getMonthSummary, type TransactionWithCategory } from "@/features/transactions/repository";
import { getMonthBudgetsOverview, type BudgetProgress } from "@/features/budgets/repository";
import { getGoalsWithProgress, type GoalProgress } from "@/features/goals/repository";
import { and, between, desc, eq } from "drizzle-orm";

export interface DashboardData {
    period: string;
    availableBalance: number; // totalIncome - totalExpenses
    totalIncome: number;
    totalExpenses: number;
    topBudgets: BudgetProgress[];
    featuredGoal: GoalProgress | null;
    recentTransactions: TransactionWithCategory[];
}

export async function getDashboardData(period: string): Promise<DashboardData> {
    const start = monthStart(period);
    const end = monthEnd(period);

    // 1. Month summary (income, expenses, balance)
    const summaryPromise = getMonthSummary(period);

    // 2. Budget envelopes
    const budgetsOverviewPromise = getMonthBudgetsOverview(period);

    // 3. Savings goals
    const goalsPromise = getGoalsWithProgress();

    // 4. Recent transactions (last 4 of the month)
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

    // Top 3 category budgets by percentage of usage
    const topBudgets = budgetsOverview.categoryBudgets.slice(0, 3);

    // Featured goal: the first one with target or active savings
    const featuredGoal = allGoals.length > 0 ? allGoals[0] : null;

    return {
        period,
        availableBalance: summary.balance,
        totalIncome: summary.totalIncome,
        totalExpenses: summary.totalExpenses,
        topBudgets,
        featuredGoal,
        recentTransactions,
    };
}
