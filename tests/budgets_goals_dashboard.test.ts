import { test, describe } from "node:test";
import assert from "node:assert/strict";

// ── Domain Types & Helper Interfaces ──────────────────────────────────

export interface Category {
    id: string;
    name: string;
    icon: string;
    color: string;
}

export interface Budget {
    id: string;
    period: string; // "YYYY-MM"
    scope: "global" | "category";
    categoryId: string | null;
    amount: number; // in cents
    createdAt?: number;
}

export interface Transaction {
    id: string;
    amount: number; // in cents (always positive)
    type: "income" | "expense";
    categoryId?: string | null;
    savingsGoalId?: string | null;
    date: number; // timestamp in ms
    note?: string;
    createdAt?: number;
}

export interface BudgetProgress {
    id: string;
    period: string;
    scope: "global" | "category";
    categoryId: string | null;
    limitAmount: number; // in cents
    spentAmount: number; // in cents
    remainingAmount: number; // limitAmount - spentAmount
    percentage: number;
    status: "ok" | "warn" | "over";
}

export interface MonthBudgetsOverview {
    period: string;
    globalBudget: BudgetProgress | null;
    categoryBudgets: BudgetProgress[];
    totalBudgeted: number;
    totalSpent: number;
}

export interface SavingsGoal {
    id: string;
    name: string;
    targetAmount: number | null; // in cents (null = sin meta)
    icon: string;
    color: string;
    createdAt: number;
}

export interface GoalProgress extends SavingsGoal {
    savedAmount: number; // in cents
    percentage: number | null;
    remainingAmount: number | null;
    isCompleted: boolean;
}

export interface DashboardData {
    period: string;
    availableBalance: number;
    totalIncome: number;
    totalExpenses: number;
    topBudgets: BudgetProgress[];
    featuredGoal: GoalProgress | null;
    recentTransactions: Transaction[];
}

// ── Pure Domain Calculation Logic ────────────────────────────────────

/**
 * Calculates budget envelope metrics (spent, remaining, percentage, status).
 */
export function calculateBudgetStatus(spent: number, limit: number): {
    spentAmount: number;
    remainingAmount: number;
    percentage: number;
    status: "ok" | "warn" | "over";
} {
    const percentage = limit > 0 ? (spent / limit) * 100 : 0;
    const remainingAmount = limit - spent;
    const status: "ok" | "warn" | "over" =
        percentage >= 100 ? "over" : percentage >= 80 ? "warn" : "ok";

    return {
        spentAmount: spent,
        remainingAmount,
        percentage,
        status,
    };
}

/**
 * Calculates month budget overview given budgets and transactions.
 */
export function calculateMonthBudgetsOverview(
    period: string,
    allBudgets: Budget[],
    allTransactions: Transaction[],
    periodRange?: { start: number; end: number },
): MonthBudgetsOverview {
    const periodBudgets = allBudgets.filter((b) => b.period === period);

    // Filter transactions to expense type and period date range (if range provided)
    const periodExpenses = allTransactions.filter((t) => {
        if (t.type !== "expense") return false;
        if (periodRange && (t.date < periodRange.start || t.date > periodRange.end)) {
            return false;
        }
        return true;
    });

    const totalSpentMonth = periodExpenses.reduce((sum, t) => sum + t.amount, 0);

    const expenseByCategory = new Map<string, number>();
    for (const t of periodExpenses) {
        if (t.categoryId) {
            const current = expenseByCategory.get(t.categoryId) ?? 0;
            expenseByCategory.set(t.categoryId, current + t.amount);
        }
    }

    let globalBudget: BudgetProgress | null = null;
    const categoryBudgets: BudgetProgress[] = [];

    for (const b of periodBudgets) {
        if (b.scope === "global") {
            const { remainingAmount, percentage, status } = calculateBudgetStatus(
                totalSpentMonth,
                b.amount,
            );
            globalBudget = {
                id: b.id,
                period: b.period,
                scope: "global",
                categoryId: null,
                limitAmount: b.amount,
                spentAmount: totalSpentMonth,
                remainingAmount,
                percentage,
                status,
            };
        } else {
            const spent = b.categoryId ? (expenseByCategory.get(b.categoryId) ?? 0) : 0;
            const { remainingAmount, percentage, status } = calculateBudgetStatus(
                spent,
                b.amount,
            );
            categoryBudgets.push({
                id: b.id,
                period: b.period,
                scope: "category",
                categoryId: b.categoryId,
                limitAmount: b.amount,
                spentAmount: spent,
                remainingAmount,
                percentage,
                status,
            });
        }
    }

    // Sort category budgets descending by consumption percentage
    categoryBudgets.sort((a, b) => b.percentage - a.percentage);

    const totalBudgeted = categoryBudgets.reduce((sum, b) => sum + b.limitAmount, 0);

    return {
        period,
        globalBudget,
        categoryBudgets,
        totalBudgeted,
        totalSpent: totalSpentMonth,
    };
}

/**
 * Calculates savings goal progress including contributions, remaining amount, and completion flag.
 */
export function calculateGoalProgress(
    goal: SavingsGoal,
    transactions: Transaction[],
): GoalProgress {
    // Deposit: expense transaction linked to goal (+ saved)
    // Withdrawal: income transaction linked to goal (- saved)
    const goalTx = transactions.filter((t) => t.savingsGoalId === goal.id);
    const netSaved = goalTx.reduce((sum, t) => {
        if (t.type === "expense") return sum + t.amount;
        if (t.type === "income") return sum - t.amount;
        return sum;
    }, 0);

    const savedAmount = Math.max(0, netSaved);
    const target = goal.targetAmount;

    if (target === null || target <= 0) {
        return {
            ...goal,
            savedAmount,
            percentage: null,
            remainingAmount: null,
            isCompleted: false,
        };
    }

    const percentage = (savedAmount / target) * 100;
    const remainingAmount = Math.max(0, target - savedAmount);
    const isCompleted = savedAmount >= target;

    return {
        ...goal,
        savedAmount,
        percentage,
        remainingAmount,
        isCompleted,
    };
}

/**
 * Aggregates dashboard data:
 * - availableBalance = income - expenses
 * - top 3 category budgets sorted by percentage descending
 * - featuredGoal = first active goal
 * - recent transactions = top 4 sorted by date desc, createdAt desc
 */
export function aggregateDashboardData(params: {
    period: string;
    budgetsOverview: MonthBudgetsOverview;
    goals: GoalProgress[];
    periodTransactions: Transaction[];
}): DashboardData {
    const { period, budgetsOverview, goals, periodTransactions } = params;

    const totalIncome = periodTransactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = periodTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

    const availableBalance = totalIncome - totalExpenses;

    // Top 3 category envelopes sorted by percentage desc
    const topBudgets = budgetsOverview.categoryBudgets.slice(0, 3);

    // Featured goal: first active goal (or null if none)
    const featuredGoal = goals.length > 0 ? goals[0] : null;

    // Recent transactions: top 4 sorted by date desc, createdAt desc
    const sortedTx = [...periodTransactions].sort((a, b) => {
        if (b.date !== a.date) {
            return b.date - a.date;
        }
        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });
    const recentTransactions = sortedTx.slice(0, 4);

    return {
        period,
        availableBalance,
        totalIncome,
        totalExpenses,
        topBudgets,
        featuredGoal,
        recentTransactions,
    };
}

// ══════════════════════════════════════════════════════════════════════
// TEST SUITES
// ══════════════════════════════════════════════════════════════════════

describe("1. Budgets / Sobres Logic", () => {
    describe("Category Envelopes & Threshold Calculations", () => {
        test("calculates spentAmount, remainingAmount and percentage for normal spending (<80%)", () => {
            // Limit: 200€ (20,000 cents), Spent: 50€ (5,000 cents) -> 25%
            const res = calculateBudgetStatus(5000, 20000);
            assert.strictEqual(res.spentAmount, 5000);
            assert.strictEqual(res.remainingAmount, 15000);
            assert.strictEqual(res.percentage, 25);
            assert.strictEqual(res.status, "ok");
        });

        test("marks status as 'warn' when consumption exactly hits the 80% boundary", () => {
            // Limit: 100€ (10,000 cents), Spent: 80€ (8,000 cents) -> 80%
            const res = calculateBudgetStatus(8000, 10000);
            assert.strictEqual(res.spentAmount, 8000);
            assert.strictEqual(res.remainingAmount, 2000);
            assert.strictEqual(res.percentage, 80);
            assert.strictEqual(res.status, "warn");
        });

        test("marks status as 'warn' when consumption is between 80% and 99.9%", () => {
            // Limit: 300€ (30,000 cents), Spent: 297€ (29,700 cents) -> 99%
            const res = calculateBudgetStatus(29700, 30000);
            assert.strictEqual(res.spentAmount, 29700);
            assert.strictEqual(res.remainingAmount, 300);
            assert.strictEqual(res.percentage, 99);
            assert.strictEqual(res.status, "warn");
        });

        test("marks status as 'over' when consumption exactly reaches 100% with 0 remaining", () => {
            // Limit: 150€ (15,000 cents), Spent: 150€ (15,000 cents) -> 100%
            const res = calculateBudgetStatus(15000, 15000);
            assert.strictEqual(res.spentAmount, 15000);
            assert.strictEqual(res.remainingAmount, 0);
            assert.strictEqual(res.percentage, 100);
            assert.strictEqual(res.status, "over");
        });

        test("marks status as 'over' and remainingAmount as negative when overspending (>100%)", () => {
            // Limit: 100€ (10,000 cents), Spent: 135€ (13,500 cents) -> 135%
            const res = calculateBudgetStatus(13500, 10000);
            assert.strictEqual(res.spentAmount, 13500);
            assert.strictEqual(res.remainingAmount, -3500); // 35€ deficit
            assert.strictEqual(res.percentage, 135);
            assert.strictEqual(res.status, "over");
        });

        test("handles zero limit gracefully without division by zero errors", () => {
            const res = calculateBudgetStatus(1000, 0);
            assert.strictEqual(res.spentAmount, 1000);
            assert.strictEqual(res.remainingAmount, -1000);
            assert.strictEqual(res.percentage, 0);
            assert.strictEqual(res.status, "ok");
        });

        test("handles zero spending (0% consumed, full limit remaining)", () => {
            const res = calculateBudgetStatus(0, 25000);
            assert.strictEqual(res.spentAmount, 0);
            assert.strictEqual(res.remainingAmount, 25000);
            assert.strictEqual(res.percentage, 0);
            assert.strictEqual(res.status, "ok");
        });
    });

    describe("Category Spending Aggregation & Filtering", () => {
        const period = "2026-09";
        const catFood = "cat-food";
        const catTransport = "cat-transport";

        const budgets: Budget[] = [
            { id: "b-food", period, scope: "category", categoryId: catFood, amount: 20000 },
            { id: "b-trans", period, scope: "category", categoryId: catTransport, amount: 10000 },
        ];

        test("aggregates multiple expenses for the corresponding category envelope", () => {
            const txs: Transaction[] = [
                { id: "t1", amount: 4500, type: "expense", categoryId: catFood, date: 1727260000000 },
                { id: "t2", amount: 3500, type: "expense", categoryId: catFood, date: 1727261000000 },
                { id: "t3", amount: 2000, type: "expense", categoryId: catTransport, date: 1727262000000 },
            ];

            const overview = calculateMonthBudgetsOverview(period, budgets, txs);
            const foodBudget = overview.categoryBudgets.find((b) => b.categoryId === catFood);
            const transBudget = overview.categoryBudgets.find((b) => b.categoryId === catTransport);

            assert.ok(foodBudget);
            assert.strictEqual(foodBudget.spentAmount, 8000); // 4500 + 3500
            assert.strictEqual(foodBudget.remainingAmount, 12000);
            assert.strictEqual(foodBudget.percentage, 40);
            assert.strictEqual(foodBudget.status, "ok");

            assert.ok(transBudget);
            assert.strictEqual(transBudget.spentAmount, 2000);
            assert.strictEqual(transBudget.remainingAmount, 8000);
            assert.strictEqual(transBudget.percentage, 20);
            assert.strictEqual(transBudget.status, "ok");
        });

        test("ignores income transactions when calculating category budget consumption", () => {
            const txs: Transaction[] = [
                { id: "t1", amount: 5000, type: "expense", categoryId: catFood, date: 1727260000000 },
                { id: "t2", amount: 10000, type: "income", categoryId: catFood, date: 1727261000000 }, // income refund/payroll
            ];

            const overview = calculateMonthBudgetsOverview(period, budgets, txs);
            const foodBudget = overview.categoryBudgets.find((b) => b.categoryId === catFood);

            assert.ok(foodBudget);
            assert.strictEqual(foodBudget.spentAmount, 5000);
            assert.strictEqual(foodBudget.remainingAmount, 15000);
        });

        test("ignores transactions belonging to different periods", () => {
            const periodRange = {
                start: 1725148800000, // 2026-09-01
                end: 1727740799000,   // 2026-09-30
            };

            const txs: Transaction[] = [
                { id: "t1", amount: 6000, type: "expense", categoryId: catFood, date: 1726000000000 }, // inside Sept
                { id: "t2", amount: 9000, type: "expense", categoryId: catFood, date: 1728000000000 }, // outside (Oct)
            ];

            const overview = calculateMonthBudgetsOverview(period, budgets, txs, periodRange);
            const foodBudget = overview.categoryBudgets.find((b) => b.categoryId === catFood);

            assert.ok(foodBudget);
            assert.strictEqual(foodBudget.spentAmount, 6000);
            assert.strictEqual(foodBudget.remainingAmount, 14000);
        });
    });

    describe("Global Budget vs Category Budgets", () => {
        const period = "2026-09";

        test("aggregates all expenses across all categories (and uncategorized) into global budget", () => {
            const allBudgets: Budget[] = [
                { id: "b-global", period, scope: "global", categoryId: null, amount: 50000 },
                { id: "b-cat1", period, scope: "category", categoryId: "c1", amount: 20000 },
                { id: "b-cat2", period, scope: "category", categoryId: "c2", amount: 10000 },
            ];

            const txs: Transaction[] = [
                { id: "t1", amount: 15000, type: "expense", categoryId: "c1", date: 1726000000000 },
                { id: "t2", amount: 8000, type: "expense", categoryId: "c2", date: 1726000000000 },
                { id: "t3", amount: 7000, type: "expense", categoryId: null, date: 1726000000000 }, // uncategorized
            ];

            const overview = calculateMonthBudgetsOverview(period, allBudgets, txs);

            assert.ok(overview.globalBudget);
            // Global spent = 15000 + 8000 + 7000 = 30000
            assert.strictEqual(overview.globalBudget.spentAmount, 30000);
            assert.strictEqual(overview.globalBudget.limitAmount, 50000);
            assert.strictEqual(overview.globalBudget.remainingAmount, 20000);
            assert.strictEqual(overview.globalBudget.percentage, 60);
            assert.strictEqual(overview.globalBudget.status, "ok");

            // Total budgeted = sum of category envelopes (20000 + 10000)
            assert.strictEqual(overview.totalBudgeted, 30000);
            assert.strictEqual(overview.totalSpent, 30000);
        });

        test("allows category envelope to be 'over' while global budget remains 'ok'", () => {
            const allBudgets: Budget[] = [
                { id: "b-global", period, scope: "global", categoryId: null, amount: 100000 }, // 1000€
                { id: "b-cat1", period, scope: "category", categoryId: "c1", amount: 10000 },  // 100€
            ];

            const txs: Transaction[] = [
                { id: "t1", amount: 12000, type: "expense", categoryId: "c1", date: 1726000000000 }, // 120€ spent in c1
            ];

            const overview = calculateMonthBudgetsOverview(period, allBudgets, txs);

            // Category budget is over (120%)
            const cat1 = overview.categoryBudgets.find((b) => b.categoryId === "c1");
            assert.ok(cat1);
            assert.strictEqual(cat1.status, "over");
            assert.strictEqual(cat1.remainingAmount, -2000);

            // Global budget is ok (12%)
            assert.ok(overview.globalBudget);
            assert.strictEqual(overview.globalBudget.status, "ok");
            assert.strictEqual(overview.globalBudget.percentage, 12);
            assert.strictEqual(overview.globalBudget.remainingAmount, 88000);
        });

        test("allows global budget to be 'over' while category envelopes are within limits (uncategorized leak)", () => {
            const allBudgets: Budget[] = [
                { id: "b-global", period, scope: "global", categoryId: null, amount: 20000 }, // 200€
                { id: "b-cat1", period, scope: "category", categoryId: "c1", amount: 15000 }, // 150€
            ];

            const txs: Transaction[] = [
                { id: "t1", amount: 5000, type: "expense", categoryId: "c1", date: 1726000000000 }, // 50€ (ok)
                { id: "t2", amount: 20000, type: "expense", categoryId: null, date: 1726000000000 }, // 200€ uncategorized
            ];

            const overview = calculateMonthBudgetsOverview(period, allBudgets, txs);

            const cat1 = overview.categoryBudgets.find((b) => b.categoryId === "c1");
            assert.ok(cat1);
            assert.strictEqual(cat1.status, "ok");
            assert.strictEqual(cat1.remainingAmount, 10000);

            assert.ok(overview.globalBudget);
            assert.strictEqual(overview.globalBudget.spentAmount, 25000);
            assert.strictEqual(overview.globalBudget.status, "over");
            assert.strictEqual(overview.globalBudget.remainingAmount, -5000);
            assert.strictEqual(overview.globalBudget.percentage, 125);
        });

        test("sorts category budgets in descending order of consumption percentage", () => {
            const allBudgets: Budget[] = [
                { id: "b1", period, scope: "category", categoryId: "c1", amount: 10000 }, // will be 30%
                { id: "b2", period, scope: "category", categoryId: "c2", amount: 10000 }, // will be 110%
                { id: "b3", period, scope: "category", categoryId: "c3", amount: 10000 }, // will be 85%
            ];

            const txs: Transaction[] = [
                { id: "t1", amount: 3000, type: "expense", categoryId: "c1", date: 1726000000000 },
                { id: "t2", amount: 11000, type: "expense", categoryId: "c2", date: 1726000000000 },
                { id: "t3", amount: 8500, type: "expense", categoryId: "c3", date: 1726000000000 },
            ];

            const overview = calculateMonthBudgetsOverview(period, allBudgets, txs);
            assert.strictEqual(overview.categoryBudgets.length, 3);
            assert.strictEqual(overview.categoryBudgets[0].categoryId, "c2"); // 110%
            assert.strictEqual(overview.categoryBudgets[1].categoryId, "c3"); // 85%
            assert.strictEqual(overview.categoryBudgets[2].categoryId, "c1"); // 30%
        });
    });
});

describe("2. Savings Goals / Huchas Logic", () => {
    describe("Contributions and Balances", () => {
        const goal: SavingsGoal = {
            id: "goal-vacations",
            name: "Vacaciones de Verano",
            targetAmount: 100000, // 1,000€
            icon: "✈️",
            color: "#3B82F6",
            createdAt: 1725000000000,
        };

        test("calculates savedAmount as sum of deposit contributions (expense transactions)", () => {
            const txs: Transaction[] = [
                { id: "tx-1", amount: 20000, type: "expense", savingsGoalId: goal.id, date: 1726000000000 },
                { id: "tx-2", amount: 15000, type: "expense", savingsGoalId: goal.id, date: 1726100000000 },
            ];

            const progress = calculateGoalProgress(goal, txs);
            assert.strictEqual(progress.savedAmount, 35000); // 350€
            assert.strictEqual(progress.remainingAmount, 65000); // 650€ remaining
            assert.strictEqual(progress.percentage, 35);
            assert.strictEqual(progress.isCompleted, false);
        });

        test("deducts withdrawals (income transactions) from savedAmount", () => {
            const txs: Transaction[] = [
                { id: "tx-1", amount: 50000, type: "expense", savingsGoalId: goal.id, date: 1726000000000 }, // +500€
                { id: "tx-2", amount: 10000, type: "income", savingsGoalId: goal.id, date: 1726100000000 },  // -100€ withdrawal
            ];

            const progress = calculateGoalProgress(goal, txs);
            assert.strictEqual(progress.savedAmount, 40000); // 400€
            assert.strictEqual(progress.remainingAmount, 60000);
            assert.strictEqual(progress.percentage, 40);
            assert.strictEqual(progress.isCompleted, false);
        });

        test("clamps savedAmount to 0 if withdrawals exceed deposits (no negative saved balance)", () => {
            const txs: Transaction[] = [
                { id: "tx-1", amount: 2000, type: "expense", savingsGoalId: goal.id, date: 1726000000000 }, // +20€
                { id: "tx-2", amount: 5000, type: "income", savingsGoalId: goal.id, date: 1726100000000 },  // -50€ withdrawal
            ];

            const progress = calculateGoalProgress(goal, txs);
            assert.strictEqual(progress.savedAmount, 0);
            assert.strictEqual(progress.remainingAmount, 100000);
            assert.strictEqual(progress.percentage, 0);
            assert.strictEqual(progress.isCompleted, false);
        });

        test("ignores transactions linked to other goals or regular transactions", () => {
            const txs: Transaction[] = [
                { id: "tx-1", amount: 30000, type: "expense", savingsGoalId: goal.id, date: 1726000000000 },
                { id: "tx-2", amount: 80000, type: "expense", savingsGoalId: "other-goal", date: 1726100000000 },
                { id: "tx-3", amount: 15000, type: "expense", savingsGoalId: null, categoryId: "c1", date: 1726200000000 },
            ];

            const progress = calculateGoalProgress(goal, txs);
            assert.strictEqual(progress.savedAmount, 30000);
        });
    });

    describe("Target Amount Completion & Sin Meta (No Target)", () => {
        test("marks isCompleted as true when savedAmount exactly equals targetAmount", () => {
            const goal: SavingsGoal = {
                id: "goal-laptop",
                name: "Nuevo Portátil",
                targetAmount: 150000, // 1,500€
                icon: "💻",
                color: "#10B981",
                createdAt: 1725000000000,
            };

            const txs: Transaction[] = [
                { id: "tx-1", amount: 150000, type: "expense", savingsGoalId: goal.id, date: 1726000000000 },
            ];

            const progress = calculateGoalProgress(goal, txs);
            assert.strictEqual(progress.savedAmount, 150000);
            assert.strictEqual(progress.remainingAmount, 0);
            assert.strictEqual(progress.percentage, 100);
            assert.strictEqual(progress.isCompleted, true);
        });

        test("marks isCompleted as true and remainingAmount as 0 when target is exceeded", () => {
            const goal: SavingsGoal = {
                id: "goal-emergency",
                name: "Fondo de Emergencia",
                targetAmount: 200000, // 2,000€
                icon: "🛡️",
                color: "#F59E0B",
                createdAt: 1725000000000,
            };

            const txs: Transaction[] = [
                { id: "tx-1", amount: 250000, type: "expense", savingsGoalId: goal.id, date: 1726000000000 }, // 2,500€
            ];

            const progress = calculateGoalProgress(goal, txs);
            assert.strictEqual(progress.savedAmount, 250000);
            assert.strictEqual(progress.remainingAmount, 0); // Not negative
            assert.strictEqual(progress.percentage, 125);
            assert.strictEqual(progress.isCompleted, true);
        });

        test("handles goal with no target amount (sin meta / targetAmount null)", () => {
            const goal: SavingsGoal = {
                id: "goal-rainy-day",
                name: "Ahorro Libre",
                targetAmount: null, // Sin meta
                icon: "🐷",
                color: "#EC4899",
                createdAt: 1725000000000,
            };

            const txs: Transaction[] = [
                { id: "tx-1", amount: 75000, type: "expense", savingsGoalId: goal.id, date: 1726000000000 },
            ];

            const progress = calculateGoalProgress(goal, txs);
            assert.strictEqual(progress.savedAmount, 75000);
            assert.strictEqual(progress.targetAmount, null);
            assert.strictEqual(progress.percentage, null);
            assert.strictEqual(progress.remainingAmount, null);
            assert.strictEqual(progress.isCompleted, false);
        });

        test("handles goal with targetAmount <= 0 as unbounded goal", () => {
            const goal: SavingsGoal = {
                id: "goal-zero",
                name: "Meta Cero",
                targetAmount: 0,
                icon: "🪙",
                color: "#6B7280",
                createdAt: 1725000000000,
            };

            const txs: Transaction[] = [
                { id: "tx-1", amount: 10000, type: "expense", savingsGoalId: goal.id, date: 1726000000000 },
            ];

            const progress = calculateGoalProgress(goal, txs);
            assert.strictEqual(progress.percentage, null);
            assert.strictEqual(progress.remainingAmount, null);
            assert.strictEqual(progress.isCompleted, false);
        });
    });
});

describe("3. Dashboard Aggregation Logic", () => {
    const period = "2026-09";

    const mockBudgetsOverview: MonthBudgetsOverview = {
        period,
        globalBudget: {
            id: "b-global",
            period,
            scope: "global",
            categoryId: null,
            limitAmount: 100000,
            spentAmount: 85000,
            remainingAmount: 15000,
            percentage: 85,
            status: "warn",
        },
        categoryBudgets: [
            {
                id: "b-dining",
                period,
                scope: "category",
                categoryId: "c-dining",
                limitAmount: 20000,
                spentAmount: 22000,
                remainingAmount: -2000,
                percentage: 110,
                status: "over",
            },
            {
                id: "b-groceries",
                period,
                scope: "category",
                categoryId: "c-groceries",
                limitAmount: 30000,
                spentAmount: 27000,
                remainingAmount: 3000,
                percentage: 90,
                status: "warn",
            },
            {
                id: "b-transport",
                period,
                scope: "category",
                categoryId: "c-transport",
                limitAmount: 15000,
                spentAmount: 7500,
                remainingAmount: 7500,
                percentage: 50,
                status: "ok",
            },
            {
                id: "b-leisure",
                period,
                scope: "category",
                categoryId: "c-leisure",
                limitAmount: 10000,
                spentAmount: 3000,
                remainingAmount: 7000,
                percentage: 30,
                status: "ok",
            },
            {
                id: "b-subscriptions",
                period,
                scope: "category",
                categoryId: "c-subs",
                limitAmount: 5000,
                spentAmount: 1000,
                remainingAmount: 4000,
                percentage: 20,
                status: "ok",
            },
        ],
        totalBudgeted: 80000,
        totalSpent: 85000,
    };

    const mockGoals: GoalProgress[] = [
        {
            id: "g1",
            name: "Fondo Emergencia",
            targetAmount: 500000,
            savedAmount: 250000,
            percentage: 50,
            remainingAmount: 250000,
            isCompleted: false,
            icon: "🛡️",
            color: "#10B981",
            createdAt: 1725000000000,
        },
        {
            id: "g2",
            name: "Viaje Japón",
            targetAmount: 300000,
            savedAmount: 90000,
            percentage: 30,
            remainingAmount: 210000,
            isCompleted: false,
            icon: "🗾",
            color: "#F43F5E",
            createdAt: 1725100000000,
        },
    ];

    test("aggregates availableBalance correctly as totalIncome - totalExpenses", () => {
        const transactions: Transaction[] = [
            { id: "t1", amount: 250000, type: "income", date: 1726000000000 },  // +2,500€
            { id: "t2", amount: 50000, type: "income", date: 1726050000000 },   // +500€
            { id: "t3", amount: 80000, type: "expense", date: 1726100000000 },  // -800€
            { id: "t4", amount: 45000, type: "expense", date: 1726150000000 },  // -450€
        ];

        const dashboard = aggregateDashboardData({
            period,
            budgetsOverview: mockBudgetsOverview,
            goals: mockGoals,
            periodTransactions: transactions,
        });

        // totalIncome = 300,000 cents (3,000€)
        // totalExpenses = 125,000 cents (1,250€)
        // balance = 175,000 cents (1,750€)
        assert.strictEqual(dashboard.totalIncome, 300000);
        assert.strictEqual(dashboard.totalExpenses, 125000);
        assert.strictEqual(dashboard.availableBalance, 175000);
    });

    test("calculates negative availableBalance when expenses exceed income (deficit)", () => {
        const transactions: Transaction[] = [
            { id: "t1", amount: 100000, type: "income", date: 1726000000000 },  // +1,000€
            { id: "t2", amount: 160000, type: "expense", date: 1726100000000 }, // -1,600€
        ];

        const dashboard = aggregateDashboardData({
            period,
            budgetsOverview: mockBudgetsOverview,
            goals: mockGoals,
            periodTransactions: transactions,
        });

        assert.strictEqual(dashboard.totalIncome, 100000);
        assert.strictEqual(dashboard.totalExpenses, 160000);
        assert.strictEqual(dashboard.availableBalance, -60000); // -600€ deficit
    });

    test("selects top 3 category budgets sorted by percentage descending", () => {
        const dashboard = aggregateDashboardData({
            period,
            budgetsOverview: mockBudgetsOverview,
            goals: mockGoals,
            periodTransactions: [],
        });

        assert.strictEqual(dashboard.topBudgets.length, 3);
        assert.strictEqual(dashboard.topBudgets[0].id, "b-dining");      // 110%
        assert.strictEqual(dashboard.topBudgets[1].id, "b-groceries");   // 90%
        assert.strictEqual(dashboard.topBudgets[2].id, "b-transport");   // 50%
    });

    test("handles fewer than 3 category budgets gracefully without padding undefined", () => {
        const reducedOverview: MonthBudgetsOverview = {
            ...mockBudgetsOverview,
            categoryBudgets: [mockBudgetsOverview.categoryBudgets[0]], // only 1 category budget
        };

        const dashboard = aggregateDashboardData({
            period,
            budgetsOverview: reducedOverview,
            goals: mockGoals,
            periodTransactions: [],
        });

        assert.strictEqual(dashboard.topBudgets.length, 1);
        assert.strictEqual(dashboard.topBudgets[0].id, "b-dining");
    });

    test("selects featured goal as the first active goal from the goals list", () => {
        const dashboard = aggregateDashboardData({
            period,
            budgetsOverview: mockBudgetsOverview,
            goals: mockGoals,
            periodTransactions: [],
        });

        assert.ok(dashboard.featuredGoal);
        assert.strictEqual(dashboard.featuredGoal.id, "g1");
        assert.strictEqual(dashboard.featuredGoal.name, "Fondo Emergencia");
    });

    test("sets featured goal to null when goals list is empty", () => {
        const dashboard = aggregateDashboardData({
            period,
            budgetsOverview: mockBudgetsOverview,
            goals: [],
            periodTransactions: [],
        });

        assert.strictEqual(dashboard.featuredGoal, null);
    });

    test("limits recent transactions to top 4 sorted by date descending", () => {
        const transactions: Transaction[] = [
            { id: "tx-old1", amount: 1000, type: "expense", date: 1726000000000, createdAt: 100 },
            { id: "tx-recent4", amount: 2000, type: "expense", date: 1726300000000, createdAt: 200 },
            { id: "tx-recent2", amount: 3000, type: "expense", date: 1726500000000, createdAt: 300 },
            { id: "tx-recent1", amount: 4000, type: "expense", date: 1726600000000, createdAt: 400 }, // newest date
            { id: "tx-recent3", amount: 5000, type: "expense", date: 1726400000000, createdAt: 500 },
            { id: "tx-old2", amount: 6000, type: "expense", date: 1725900000000, createdAt: 600 },
        ];

        const dashboard = aggregateDashboardData({
            period,
            budgetsOverview: mockBudgetsOverview,
            goals: mockGoals,
            periodTransactions: transactions,
        });

        assert.strictEqual(dashboard.recentTransactions.length, 4);
        assert.strictEqual(dashboard.recentTransactions[0].id, "tx-recent1"); // date: 1726600000000
        assert.strictEqual(dashboard.recentTransactions[1].id, "tx-recent2"); // date: 1726500000000
        assert.strictEqual(dashboard.recentTransactions[2].id, "tx-recent3"); // date: 1726400000000
        assert.strictEqual(dashboard.recentTransactions[3].id, "tx-recent4"); // date: 1726300000000
    });

    test("breaks tie with createdAt descending when transaction dates are equal", () => {
        const sameDay = 1726500000000;
        const transactions: Transaction[] = [
            { id: "tx-first-created", amount: 1000, type: "expense", date: sameDay, createdAt: 1000 },
            { id: "tx-third-created", amount: 3000, type: "expense", date: sameDay, createdAt: 3000 },
            { id: "tx-second-created", amount: 2000, type: "expense", date: sameDay, createdAt: 2000 },
        ];

        const dashboard = aggregateDashboardData({
            period,
            budgetsOverview: mockBudgetsOverview,
            goals: mockGoals,
            periodTransactions: transactions,
        });

        assert.strictEqual(dashboard.recentTransactions.length, 3);
        assert.strictEqual(dashboard.recentTransactions[0].id, "tx-third-created");
        assert.strictEqual(dashboard.recentTransactions[1].id, "tx-second-created");
        assert.strictEqual(dashboard.recentTransactions[2].id, "tx-first-created");
    });
});
