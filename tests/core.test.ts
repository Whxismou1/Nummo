import { test, describe } from "node:test";
import assert from "node:assert/strict";

// ── 1. Money Logic Tests ─────────────────────────────────────────────

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

describe("Money Logic (toCents & formatMoney)", () => {
    test("converts integer euros correctly", () => {
        assert.strictEqual(toCents("10"), 1000);
        assert.strictEqual(toCents("0"), 0);
        assert.strictEqual(toCents("1200"), 120000);
    });

    test("converts decimal euros with comma or dot without float rounding errors", () => {
        assert.strictEqual(toCents("42,50"), 4250);
        assert.strictEqual(toCents("42.50"), 4250);
        assert.strictEqual(toCents("0,99"), 99);
        assert.strictEqual(toCents("0.01"), 1);
        assert.strictEqual(toCents("19,99"), 1999);
    });

    test("handles invalid inputs gracefully", () => {
        assert.strictEqual(toCents(""), 0);
        assert.strictEqual(toCents("abc"), 0);
        assert.strictEqual(toCents("   "), 0);
    });

    test("formats cents to EUR currency string properly", () => {
        const formatted = formatMoney(4250);
        assert.ok(formatted.includes("42,50"));
        assert.ok(formatted.includes("€"));
    });
});

// ── 2. Period & Date Logic Tests ─────────────────────────────────────

function prevPeriod(period: string): string {
    const [year, month] = period.split("-").map(Number);
    const date = new Date(year, month - 2, 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

function nextPeriod(period: string): string {
    const [year, month] = period.split("-").map(Number);
    const date = new Date(year, month, 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

describe("Period Navigation Logic", () => {
    test("transitions across normal months", () => {
        assert.strictEqual(prevPeriod("2026-09"), "2026-08");
        assert.strictEqual(nextPeriod("2026-09"), "2026-10");
    });

    test("transitions across year boundaries correctly", () => {
        // January -> previous is December of previous year
        assert.strictEqual(prevPeriod("2026-01"), "2025-12");
        // December -> next is January of next year
        assert.strictEqual(nextPeriod("2026-12"), "2027-01");
    });
});

// ── 3. Budget Status Calculation Tests ───────────────────────────────

function calculateBudgetStatus(spent: number, limit: number): {
    percentage: number;
    status: "ok" | "warn" | "over";
    remaining: number;
} {
    const percentage = limit > 0 ? (spent / limit) * 100 : 0;
    const status: "ok" | "warn" | "over" =
        percentage >= 100 ? "over" : percentage >= 80 ? "warn" : "ok";
    const remaining = limit - spent;
    return { percentage, status, remaining };
}

describe("Budget Envelope Calculation Logic", () => {
    test("marks budgets under 80% as ok", () => {
        const res = calculateBudgetStatus(12000, 30000); // 120€ of 300€ (40%)
        assert.strictEqual(res.status, "ok");
        assert.strictEqual(res.percentage, 40);
        assert.strictEqual(res.remaining, 18000);
    });

    test("marks budgets between 80% and 99.9% as warn", () => {
        const res = calculateBudgetStatus(44000, 50000); // 440€ of 500€ (88%)
        assert.strictEqual(res.status, "warn");
        assert.strictEqual(res.percentage, 88);
        assert.strictEqual(res.remaining, 6000);
    });

    test("marks budgets at or over 100% as over", () => {
        const res = calculateBudgetStatus(43000, 40000); // 430€ of 400€ (107.5%)
        assert.strictEqual(res.status, "over");
        assert.strictEqual(res.percentage, 107.5);
        assert.strictEqual(res.remaining, -3000); // Exceeded by 30€
    });
});

// ── 4. Savings Goals Progress Calculation Tests ──────────────────────

function calculateGoalProgress(saved: number, target: number | null): {
    percentage: number | null;
    remaining: number | null;
    isCompleted: boolean;
} {
    if (target === null || target <= 0) {
        return { percentage: null, remaining: null, isCompleted: false };
    }
    const percentage = (saved / target) * 100;
    const remaining = Math.max(0, target - saved);
    const isCompleted = saved >= target;
    return { percentage, remaining, isCompleted };
}

describe("Savings Goals Progress Calculation", () => {
    test("calculates in-progress goal accurately", () => {
        // Hipoteca: 12.000€ of 20.000€
        const res = calculateGoalProgress(1200000, 2000000);
        assert.strictEqual(res.percentage, 60);
        assert.strictEqual(res.remaining, 800000);
        assert.strictEqual(res.isCompleted, false);
    });

    test("detects completed goal when saved exceeds target", () => {
        const res = calculateGoalProgress(610000, 600000);
        assert.ok(res.percentage !== null && res.percentage >= 100);
        assert.strictEqual(res.remaining, 0);
        assert.strictEqual(res.isCompleted, true);
    });

    test("handles goals without target amount", () => {
        const res = calculateGoalProgress(15000, null);
        assert.strictEqual(res.percentage, null);
        assert.strictEqual(res.remaining, null);
        assert.strictEqual(res.isCompleted, false);
    });
});
