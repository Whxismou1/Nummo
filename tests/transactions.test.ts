import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as z from "zod";
function toCents(text: string): number {
    const formatted = text.replace(",", ".");
    const num = Math.round(parseFloat(formatted) * 100);
    if (Number.isNaN(num)) return 0;
    return num;
}

function formatMoney(cents: number): string {
    const euros = cents / 100;
    return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR",
    }).format(euros);
}

function isSameDay(a: number, b: number): boolean {
    const da = new Date(a);
    const db = new Date(b);
    return (
        da.getFullYear() === db.getFullYear() &&
        da.getMonth() === db.getMonth() &&
        da.getDate() === db.getDate()
    );
}

function formatDayGroup(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString("es-ES", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

// ── Types & Domain Models ─────────────────────────────────────────────

export type TransactionType = "expense" | "income";

export interface Category {
    id: string;
    name: string;
    icon: string;
    color: string;
    type: TransactionType;
    createdAt?: number;
}

export interface Transaction {
    id: string;
    amount: number; // strictly positive integer cents
    type: TransactionType;
    categoryId?: string | null;
    savingsGoalId?: string | null;
    date: number; // unix timestamp in ms
    note?: string | null;
    createdAt: number;
    updatedAt: number;
}

export interface TransactionWithCategory extends Transaction {
    category: Category | null;
}

export interface TransactionSection {
    title: string;
    data: TransactionWithCategory[];
}

export interface MonthSummary {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
}

// ── Schemas & Pure Domain Logic ───────────────────────────────────────

/** Form validation schema matching transaction input rules */
export const transactionFormSchema = z.object({
    amount: z
        .string()
        .refine((val) => toCents(val) > 0, { message: "El importe debe ser mayor que 0" }),
    type: z.enum(["expense", "income"]),
    categoryId: z.string().optional(),
    note: z.string().optional(),
    date: z.number({ message: "Selecciona una fecha" }),
});

/** Category form validation schema */
export const categoryFormSchema = z.object({
    name: z.string().min(1, "El nombre es obligatorio"),
    icon: z.string().min(1, "Selecciona un icono"),
    color: z.string().min(1, "Selecciona un color"),
    type: z.enum(["expense", "income"]),
});

/** Validates whether an amount is a valid positive integer in cents */
export function isValidAmountInCents(amount: unknown): amount is number {
    return (
        typeof amount === "number" &&
        Number.isInteger(amount) &&
        amount > 0 &&
        Number.isFinite(amount)
    );
}

/** Validates transaction type */
export function isValidTransactionType(type: unknown): type is TransactionType {
    return type === "expense" || type === "income";
}

/** Validates timestamp */
export function isValidDateTimestamp(timestamp: unknown): timestamp is number {
    return (
        typeof timestamp === "number" &&
        Number.isFinite(timestamp) &&
        timestamp > 0
    );
}

/** Input for creating a transaction */
export interface CreateTransactionParams {
    id?: string;
    amount: number; // in cents
    type: TransactionType;
    categoryId?: string | null;
    savingsGoalId?: string | null;
    date?: number;
    note?: string | null;
}

/**
 * Validates and instantiates a new Transaction entity.
 * Enforces business rules:
 * - Amount must be positive integer cents.
 * - Type must be 'expense' or 'income'.
 * - Date must be a valid positive timestamp.
 * - If categoryId is provided and categoryMap is given, validates category exists and types match.
 */
export function createTransaction(
    params: CreateTransactionParams,
    categoriesMap?: Map<string, Category>
): Transaction {
    if (!isValidAmountInCents(params.amount)) {
        throw new Error(`Invalid transaction amount: ${params.amount}. Amount must be positive integer cents.`);
    }

    if (!isValidTransactionType(params.type)) {
        throw new Error(`Invalid transaction type: ${params.type}. Must be 'expense' or 'income'.`);
    }

    const date = params.date ?? Date.now();
    if (!isValidDateTimestamp(date)) {
        throw new Error(`Invalid transaction date: ${params.date}. Must be a valid timestamp.`);
    }

    if (params.categoryId && categoriesMap) {
        const category = categoriesMap.get(params.categoryId);
        if (!category) {
            throw new Error(`Category not found: ${params.categoryId}`);
        }
        if (category.type !== params.type) {
            throw new Error(`Category type mismatch: Transaction is '${params.type}' but Category is '${category.type}'`);
        }
    }

    const now = Date.now();
    return {
        id: params.id ?? `tx_${now}_${Math.random().toString(36).slice(2, 9)}`,
        amount: params.amount,
        type: params.type,
        categoryId: params.categoryId ?? null,
        savingsGoalId: params.savingsGoalId ?? null,
        date,
        note: params.note ?? null,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Links a transaction to its category from a category map/lookup.
 */
export function linkTransactionCategory(
    tx: Transaction,
    categoriesMap: Map<string, Category>
): TransactionWithCategory {
    const category = tx.categoryId ? categoriesMap.get(tx.categoryId) ?? null : null;
    return {
        ...tx,
        category,
    };
}

/**
 * Groups a list of transactions by day, sorting them chronologically descending.
 * Transactions on the same calendar day are grouped together.
 */
export function groupTransactionsByDay(
    transactions: TransactionWithCategory[]
): TransactionSection[] {
    // 1. Sort chronologically descending (newest date first)
    const sorted = [...transactions].sort((a, b) => b.date - a.date);

    const groups: TransactionSection[] = [];

    // 2. Group consecutive items that fall on the same day
    for (const tx of sorted) {
        const last = groups[groups.length - 1];
        if (last && isSameDay(last.data[0].date, tx.date)) {
            last.data.push(tx);
        } else {
            groups.push({
                title: formatDayGroup(tx.date),
                data: [tx],
            });
        }
    }

    return groups;
}

/**
 * Calculates monthly financial summary: totalIncome, totalExpenses, and balance.
 * Amounts are in cents.
 */
export function calculateMonthSummary(
    transactions: Array<{ type: TransactionType; amount: number }>
): MonthSummary {
    let totalIncome = 0;
    let totalExpenses = 0;

    for (const tx of transactions) {
        if (tx.type === "income") {
            totalIncome += tx.amount;
        } else if (tx.type === "expense") {
            totalExpenses += tx.amount;
        }
    }

    return {
        totalIncome,
        totalExpenses,
        balance: totalIncome - totalExpenses,
    };
}

// ── Test Suites ───────────────────────────────────────────────────────

describe("1. Transaction Validation & Creation", () => {
    const sampleCategories = new Map<string, Category>([
        [
            "cat_groceries",
            {
                id: "cat_groceries",
                name: "Alimentación",
                icon: "cart",
                color: "#10B981",
                type: "expense",
            },
        ],
        [
            "cat_salary",
            {
                id: "cat_salary",
                name: "Nómina",
                icon: "briefcase",
                color: "#3B82F6",
                type: "income",
            },
        ],
    ]);

    describe("Amount Validation (in integer cents)", () => {
        test("accepts valid positive integer cents", () => {
            assert.strictEqual(isValidAmountInCents(1), true);
            assert.strictEqual(isValidAmountInCents(100), true); // 1.00 €
            assert.strictEqual(isValidAmountInCents(4250), true); // 42.50 €
            assert.strictEqual(isValidAmountInCents(245000), true); // 2450.00 €
        });

        test("rejects zero amount", () => {
            assert.strictEqual(isValidAmountInCents(0), false);
            assert.throws(() => {
                createTransaction({ amount: 0, type: "expense" });
            }, /Amount must be positive integer cents/);
        });

        test("rejects negative amounts", () => {
            assert.strictEqual(isValidAmountInCents(-1), false);
            assert.strictEqual(isValidAmountInCents(-4250), false);
            assert.throws(() => {
                createTransaction({ amount: -500, type: "expense" });
            }, /Amount must be positive integer cents/);
        });

        test("rejects non-integer floating point cents", () => {
            // Amounts in cents must be integers to avoid floating point inaccuracies
            assert.strictEqual(isValidAmountInCents(42.5), false);
            assert.strictEqual(isValidAmountInCents(0.99), false);
            assert.throws(() => {
                createTransaction({ amount: 15.5, type: "expense" });
            }, /Amount must be positive integer cents/);
        });

        test("rejects non-numeric, NaN, and infinite values", () => {
            assert.strictEqual(isValidAmountInCents(NaN), false);
            assert.strictEqual(isValidAmountInCents(Infinity), false);
            assert.strictEqual(isValidAmountInCents("100"), false);
            assert.strictEqual(isValidAmountInCents(null), false);
            assert.strictEqual(isValidAmountInCents(undefined), false);
        });

        test("verifies toCents conversion handles strings to positive cents properly", () => {
            assert.strictEqual(toCents("10"), 1000);
            assert.strictEqual(toCents("42,50"), 4250);
            assert.strictEqual(toCents("42.50"), 4250);
            assert.strictEqual(toCents("0,01"), 1);
            assert.strictEqual(toCents("0"), 0);
            assert.strictEqual(toCents("-5"), -500);
        });

        test("transactionFormSchema enforces positive amount via string refinement", () => {
            const valid = transactionFormSchema.safeParse({
                amount: "42.50",
                type: "expense",
                date: 1727272800000,
            });
            assert.strictEqual(valid.success, true);

            const zeroResult = transactionFormSchema.safeParse({
                amount: "0",
                type: "expense",
                date: 1727272800000,
            });
            assert.strictEqual(zeroResult.success, false);

            const negativeResult = transactionFormSchema.safeParse({
                amount: "-10",
                type: "expense",
                date: 1727272800000,
            });
            assert.strictEqual(negativeResult.success, false);
        });
    });

    describe("Transaction Types ('expense' and 'income')", () => {
        test("accepts valid 'expense' and 'income' types", () => {
            assert.strictEqual(isValidTransactionType("expense"), true);
            assert.strictEqual(isValidTransactionType("income"), true);

            const expenseTx = createTransaction({
                amount: 1500,
                type: "expense",
            });
            assert.strictEqual(expenseTx.type, "expense");

            const incomeTx = createTransaction({
                amount: 250000,
                type: "income",
            });
            assert.strictEqual(incomeTx.type, "income");
        });

        test("rejects invalid transaction types", () => {
            assert.strictEqual(isValidTransactionType("transfer"), false);
            assert.strictEqual(isValidTransactionType("EXPENSE"), false);
            assert.strictEqual(isValidTransactionType(""), false);
            assert.strictEqual(isValidTransactionType(null), false);

            assert.throws(() => {
                // @ts-expect-error Testing invalid type input at runtime
                createTransaction({ amount: 1000, type: "transfer" });
            }, /Invalid transaction type/);
        });

        test("transactionFormSchema validates strict enum values", () => {
            const validIncome = transactionFormSchema.safeParse({
                amount: "100",
                type: "income",
                date: Date.now(),
            });
            assert.strictEqual(validIncome.success, true);

            const invalidType = transactionFormSchema.safeParse({
                amount: "100",
                type: "unknown",
                date: Date.now(),
            });
            assert.strictEqual(invalidType.success, false);
        });
    });

    describe("Date & Category Linking Validation", () => {
        test("validates date timestamp correctly", () => {
            const now = Date.now();
            assert.strictEqual(isValidDateTimestamp(now), true);
            assert.strictEqual(isValidDateTimestamp(1727272800000), true);
            assert.strictEqual(isValidDateTimestamp(0), false);
            assert.strictEqual(isValidDateTimestamp(-100), false);
            assert.strictEqual(isValidDateTimestamp(NaN), false);

            const tx = createTransaction({
                amount: 3500,
                type: "expense",
                date: 1727272800000,
            });
            assert.strictEqual(tx.date, 1727272800000);
        });

        test("defaults date to current timestamp if not specified", () => {
            const before = Date.now();
            const tx = createTransaction({
                amount: 2000,
                type: "expense",
            });
            const after = Date.now();
            assert.ok(tx.date >= before && tx.date <= after);
        });

        test("links transaction to an existing category successfully", () => {
            const tx = createTransaction(
                {
                    amount: 5400,
                    type: "expense",
                    categoryId: "cat_groceries",
                },
                sampleCategories
            );

            const enriched = linkTransactionCategory(tx, sampleCategories);
            assert.strictEqual(enriched.categoryId, "cat_groceries");
            assert.notStrictEqual(enriched.category, null);
            assert.strictEqual(enriched.category?.id, "cat_groceries");
            assert.strictEqual(enriched.category?.name, "Alimentación");
            assert.strictEqual(enriched.category?.type, "expense");
        });

        test("supports uncategorized transactions with null category", () => {
            const tx = createTransaction({
                amount: 1200,
                type: "expense",
                categoryId: null,
            });

            const enriched = linkTransactionCategory(tx, sampleCategories);
            assert.strictEqual(enriched.categoryId, null);
            assert.strictEqual(enriched.category, null);
        });

        test("rejects linking to a non-existent category", () => {
            assert.throws(() => {
                createTransaction(
                    {
                        amount: 3000,
                        type: "expense",
                        categoryId: "non_existent_category",
                    },
                    sampleCategories
                );
            }, /Category not found: non_existent_category/);
        });

        test("rejects category type mismatch (e.g. expense transaction with income category)", () => {
            assert.throws(() => {
                createTransaction(
                    {
                        amount: 1500,
                        type: "expense",
                        categoryId: "cat_salary", // cat_salary is 'income'
                    },
                    sampleCategories
                );
            }, /Category type mismatch/);
        });

        test("validates category attributes via categoryFormSchema", () => {
            const validCategory = categoryFormSchema.safeParse({
                name: "Ocio",
                icon: "game-controller",
                color: "#F59E0B",
                type: "expense",
            });
            assert.strictEqual(validCategory.success, true);

            const emptyName = categoryFormSchema.safeParse({
                name: "",
                icon: "game-controller",
                color: "#F59E0B",
                type: "expense",
            });
            assert.strictEqual(emptyName.success, false);

            const missingIcon = categoryFormSchema.safeParse({
                name: "Ocio",
                icon: "",
                color: "#F59E0B",
                type: "expense",
            });
            assert.strictEqual(missingIcon.success, false);
        });
    });
});

describe("2. Grouping by Day", () => {
    // Fixed timestamps for reliable testing across days
    // 2026-09-25 at 09:00, 14:30, 20:00
    const day1_morning = new Date(2026, 8, 25, 9, 0, 0).getTime();
    const day1_afternoon = new Date(2026, 8, 25, 14, 30, 0).getTime();
    const day1_evening = new Date(2026, 8, 25, 20, 0, 0).getTime();

    // 2026-09-24 at 10:15, 18:45
    const day2_morning = new Date(2026, 8, 24, 10, 15, 0).getTime();
    const day2_evening = new Date(2026, 8, 24, 18, 45, 0).getTime();

    // 2026-09-20 at 12:00
    const day3_noon = new Date(2026, 8, 20, 12, 0, 0).getTime();

    const mockCategory: Category = {
        id: "cat_1",
        name: "General",
        icon: "tag",
        color: "#10B981",
        type: "expense",
    };

    function createMockTx(id: string, date: number, amount = 1000): TransactionWithCategory {
        return {
            id,
            amount,
            type: "expense",
            categoryId: mockCategory.id,
            date,
            createdAt: date,
            updatedAt: date,
            category: mockCategory,
        };
    }

    test("groups multiple transactions on the same day into a single section", () => {
        const txs: TransactionWithCategory[] = [
            createMockTx("tx1", day1_morning, 1500),
            createMockTx("tx2", day1_afternoon, 2500),
            createMockTx("tx3", day1_evening, 4000),
        ];

        const sections = groupTransactionsByDay(txs);

        assert.strictEqual(sections.length, 1);
        assert.strictEqual(sections[0].data.length, 3);
        // Should be ordered descending within the day
        assert.strictEqual(sections[0].data[0].id, "tx3"); // 20:00
        assert.strictEqual(sections[0].data[1].id, "tx2"); // 14:30
        assert.strictEqual(sections[0].data[2].id, "tx1"); // 09:00
    });

    test("groups transactions across multiple days into separate sections ordered chronologically descending", () => {
        const txs: TransactionWithCategory[] = [
            createMockTx("tx1_d1", day1_morning, 1000),
            createMockTx("tx2_d1", day1_evening, 2000),
            createMockTx("tx3_d2", day2_morning, 3000),
            createMockTx("tx4_d2", day2_evening, 4000),
            createMockTx("tx5_d3", day3_noon, 5000),
        ];

        const sections = groupTransactionsByDay(txs);

        // 3 distinct days -> 3 sections
        assert.strictEqual(sections.length, 3);

        // Section 1: Day 1 (Sept 25)
        assert.strictEqual(sections[0].data.length, 2);
        assert.strictEqual(sections[0].data[0].id, "tx2_d1");
        assert.strictEqual(sections[0].data[1].id, "tx1_d1");
        assert.ok(isSameDay(sections[0].data[0].date, day1_morning));

        // Section 2: Day 2 (Sept 24)
        assert.strictEqual(sections[1].data.length, 2);
        assert.strictEqual(sections[1].data[0].id, "tx4_d2");
        assert.strictEqual(sections[1].data[1].id, "tx3_d2");
        assert.ok(isSameDay(sections[1].data[0].date, day2_morning));

        // Section 3: Day 3 (Sept 20)
        assert.strictEqual(sections[2].data.length, 1);
        assert.strictEqual(sections[2].data[0].id, "tx5_d3");
        assert.ok(isSameDay(sections[2].data[0].date, day3_noon));

        // Assert strictly descending order between section dates
        assert.ok(sections[0].data[0].date > sections[1].data[0].date);
        assert.ok(sections[1].data[0].date > sections[2].data[0].date);
    });

    test("sorts unordered/random inputs chronologically descending before grouping", () => {
        // Transactions provided completely out of order
        const unordered: TransactionWithCategory[] = [
            createMockTx("tx_d3", day3_noon),
            createMockTx("tx_d1_late", day1_evening),
            createMockTx("tx_d2_early", day2_morning),
            createMockTx("tx_d1_early", day1_morning),
            createMockTx("tx_d2_late", day2_evening),
        ];

        const sections = groupTransactionsByDay(unordered);

        assert.strictEqual(sections.length, 3);
        // Sept 25 first
        assert.strictEqual(sections[0].data[0].id, "tx_d1_late");
        assert.strictEqual(sections[0].data[1].id, "tx_d1_early");
        // Sept 24 second
        assert.strictEqual(sections[1].data[0].id, "tx_d2_late");
        assert.strictEqual(sections[1].data[1].id, "tx_d2_early");
        // Sept 20 third
        assert.strictEqual(sections[2].data[0].id, "tx_d3");
    });

    test("handles edge case of empty transactions list", () => {
        const sections = groupTransactionsByDay([]);
        assert.deepStrictEqual(sections, []);
        assert.strictEqual(sections.length, 0);
    });

    test("handles edge case of a single transaction", () => {
        const singleTx = createMockTx("tx_single", day1_morning);
        const sections = groupTransactionsByDay([singleTx]);
        assert.strictEqual(sections.length, 1);
        assert.strictEqual(sections[0].data.length, 1);
        assert.strictEqual(sections[0].data[0].id, "tx_single");
    });

    test("handles day boundary timestamps (midnight transition)", () => {
        // Day 1 at 23:59:59
        const day1_end = new Date(2026, 8, 24, 23, 59, 59, 999).getTime();
        // Day 2 at 00:00:01 (1 second later)
        const day2_start = new Date(2026, 8, 25, 0, 0, 1, 0).getTime();

        const txs = [
            createMockTx("tx_start_day2", day2_start),
            createMockTx("tx_end_day1", day1_end),
        ];

        const sections = groupTransactionsByDay(txs);

        // They must belong to two separate groups despite 1-second gap
        assert.strictEqual(sections.length, 2);
        assert.strictEqual(sections[0].data[0].id, "tx_start_day2");
        assert.strictEqual(sections[1].data[0].id, "tx_end_day1");
        assert.strictEqual(isSameDay(sections[0].data[0].date, sections[1].data[0].date), false);
    });
});

describe("3. Monthly Financial Summary", () => {
    test("calculates totalIncome, totalExpenses, and positive balance correctly (prompt scenario)", () => {
        // Income transactions: 245000 (2,450.00 €), 95000 (950.00 €)
        // Expense transactions: 8540 (85.40 €), 4250 (42.50 €), 2400 (24.00 €)
        const transactions: Array<{ type: TransactionType; amount: number }> = [
            { type: "income", amount: 245000 },
            { type: "income", amount: 95000 },
            { type: "expense", amount: 8540 },
            { type: "expense", amount: 4250 },
            { type: "expense", amount: 2400 },
        ];

        const summary = calculateMonthSummary(transactions);

        // totalIncome = 245000 + 95000 = 340000 cents (3,400.00 €)
        assert.strictEqual(summary.totalIncome, 340000);

        // totalExpenses = 8540 + 4250 + 2400 = 15190 cents (151.90 €)
        assert.strictEqual(summary.totalExpenses, 15190);

        // balance = 340000 - 15190 = 324810 cents (3,248.10 €)
        assert.strictEqual(summary.balance, 324810);
        assert.strictEqual(summary.balance, summary.totalIncome - summary.totalExpenses);

        // Verify currency formatting matches expected euros
        const formattedBalance = formatMoney(summary.balance);
        assert.ok(
            formattedBalance.includes("3248,10") || formattedBalance.includes("3.248,10"),
            `Expected formatted balance to contain 3248,10, but got: ${formattedBalance}`
        );
        assert.ok(formattedBalance.includes("€"));
    });

    test("handles negative balance scenarios (overspending)", () => {
        // Income = 500.00 € (50000 cents), Expenses = 1,200.00 € (120000 cents)
        const overspendingTxs: Array<{ type: TransactionType; amount: number }> = [
            { type: "income", amount: 50000 },
            { type: "expense", amount: 120000 },
        ];

        const summary = calculateMonthSummary(overspendingTxs);

        assert.strictEqual(summary.totalIncome, 50000);
        assert.strictEqual(summary.totalExpenses, 120000);
        assert.strictEqual(summary.balance, -70000); // Deficit of 700.00 €
        assert.ok(summary.balance < 0);

        // Scenario: Expenses only (e.g. 45.00 € without any income)
        const expenseOnlySummary = calculateMonthSummary([
            { type: "expense", amount: 4500 },
        ]);
        assert.strictEqual(expenseOnlySummary.totalIncome, 0);
        assert.strictEqual(expenseOnlySummary.totalExpenses, 4500);
        assert.strictEqual(expenseOnlySummary.balance, -4500);
        assert.ok(expenseOnlySummary.balance < 0);
    });

    test("returns zero balance when no transactions exist", () => {
        const summary = calculateMonthSummary([]);

        assert.strictEqual(summary.totalIncome, 0);
        assert.strictEqual(summary.totalExpenses, 0);
        assert.strictEqual(summary.balance, 0);
    });

    test("returns zero balance when total income exactly matches total expenses", () => {
        const balancedTxs: Array<{ type: TransactionType; amount: number }> = [
            { type: "income", amount: 18000 },
            { type: "expense", amount: 10000 },
            { type: "expense", amount: 8000 },
        ];

        const summary = calculateMonthSummary(balancedTxs);

        assert.strictEqual(summary.totalIncome, 18000);
        assert.strictEqual(summary.totalExpenses, 18000);
        assert.strictEqual(summary.balance, 0);
    });

    test("handles income-only scenario correctly", () => {
        const incomeOnlyTxs: Array<{ type: TransactionType; amount: number }> = [
            { type: "income", amount: 150000 },
            { type: "income", amount: 35000 },
        ];

        const summary = calculateMonthSummary(incomeOnlyTxs);

        assert.strictEqual(summary.totalIncome, 185000);
        assert.strictEqual(summary.totalExpenses, 0);
        assert.strictEqual(summary.balance, 185000);
    });

    test("preserves precision in integer cents without IEEE-754 floating point drift", () => {
        // In standard floats: 0.1 + 0.2 = 0.30000000000000004
        // In cents: 10 + 20 = 30
        const smallCentsTxs: Array<{ type: TransactionType; amount: number }> = [
            { type: "income", amount: 10 },
            { type: "income", amount: 20 },
            { type: "expense", amount: 29 },
        ];

        const summary = calculateMonthSummary(smallCentsTxs);

        assert.strictEqual(summary.totalIncome, 30);
        assert.strictEqual(summary.totalExpenses, 29);
        assert.strictEqual(summary.balance, 1);
        assert.strictEqual(Number.isInteger(summary.balance), true);
    });
});
