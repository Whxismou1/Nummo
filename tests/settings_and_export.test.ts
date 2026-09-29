import { describe, it } from "node:test";
import assert from "node:assert/strict";

function formatMoney(cents: number, currency: string = "EUR"): string {
    const amount = cents / 100;
    const locale = currency === "USD" ? "en-US" : currency === "GBP" ? "en-GB" : "es-ES";

    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency,
    }).format(amount);
}

describe("Settings and Export Logic", () => {
    describe("Currency Formatting", () => {
        it("formats EUR with symbol and Spanish locale by default", () => {
            const formatted = formatMoney(12550);
            assert.ok(formatted.includes("125,50") || formatted.includes("125.50"));
            assert.ok(formatted.includes("€"));
        });

        it("formats USD with dollar symbol", () => {
            const formatted = formatMoney(12550, "USD");
            assert.ok(formatted.includes("125.50") || formatted.includes("125,50"));
            assert.ok(formatted.includes("$"));
        });

        it("formats GBP with pound symbol", () => {
            const formatted = formatMoney(12550, "GBP");
            assert.ok(formatted.includes("125.50") || formatted.includes("125,50"));
            assert.ok(formatted.includes("£"));
        });
    });

    describe("CSV Export Formatting", () => {
        it("generates correct CSV rows with semicolons and sanitized notes", () => {
            const sampleTx = {
                date: new Date("2026-09-25T12:00:00Z").getTime(),
                type: "expense" as const,
                amount: 4250,
                note: "Cena; con amigos\nen Madrid",
                category: { name: "Ocio; Salidas" },
            };

            const typeStr = sampleTx.type === "expense" ? "Gasto" : "Ingreso";
            const catStr = (sampleTx.category?.name || "Sin categoría").replace(/;/g, ",");
            const amountStr = (sampleTx.amount / 100).toFixed(2).replace(".", ",");
            const noteStr = (sampleTx.note || "").replace(/;/g, ",").replace(/\n/g, " ");

            const row = `25/09/2026;${typeStr};${catStr};${amountStr};${noteStr}`;

            assert.equal(typeStr, "Gasto");
            assert.equal(catStr, "Ocio, Salidas");
            assert.equal(amountStr, "42,50");
            assert.equal(noteStr, "Cena, con amigos en Madrid");
            assert.ok(!row.includes("\n"));
        });

        it("handles uncategorized transactions gracefully in CSV export", () => {
            const sampleTx = {
                date: Date.now(),
                type: "income" as const,
                amount: 150000,
                note: null,
                category: null,
            };

            const catStr = (sampleTx.category as any)?.name || "Sin categoría";
            const noteStr = (sampleTx.note || "").replace(/;/g, ",");
            const amountStr = (sampleTx.amount / 100).toFixed(2).replace(".", ",");

            assert.equal(catStr, "Sin categoría");
            assert.equal(noteStr, "");
            assert.equal(amountStr, "1500,00");
        });
    });
});
