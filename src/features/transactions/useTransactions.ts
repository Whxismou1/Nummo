import { useCallback, useEffect, useState } from "react";
import { currentPeriod, formatDayGroup, isSameDay } from "@/lib/date";
import {
    deleteTransaction,
    getMonthSummary,
    getMonthSummarySync,
    getTransactionsForPeriod,
    getTransactionsForPeriodSync,
    MonthSummary,
    TransactionWithCategory,
} from "./repository";

// ── Types ────────────────────────────────────────────────────────────

/** A section for SectionList: one day's worth of transactions */
export type TransactionSection = {
    title: string; // "Hoy", "Ayer", "lun, 22 sept 2026"
    data: TransactionWithCategory[];
};

// ── Hook ─────────────────────────────────────────────────────────────

export function useTransactions(period?: string) {
    const activePeriod = period ?? currentPeriod();

    const [sections, setSections] = useState<TransactionSection[]>(() => {
        try {
            const txs = getTransactionsForPeriodSync(activePeriod);
            return groupByDay(txs);
        } catch {
            return [];
        }
    });
    const [summary, setSummary] = useState<MonthSummary>(() => {
        try {
            return getMonthSummarySync(activePeriod);
        } catch {
            return {
                totalIncome: 0,
                totalExpenses: 0,
                balance: 0,
            };
        }
    });
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        try {
            const [txs, monthSummary] = await Promise.all([
                getTransactionsForPeriod(activePeriod),
                getMonthSummary(activePeriod),
            ]);
            setSections(groupByDay(txs));
            setSummary(monthSummary);
        } finally {
            setLoading(false);
        }
    }, [activePeriod]);

    useEffect(() => {
        void load();
    }, [load]);

    const removeTransaction = useCallback(
        async (id: string) => {
            // Optimistic update: filter out the deleted transaction immediately without flash
            setSections((prev) =>
                prev
                    .map((section) => ({
                        ...section,
                        data: section.data.filter((item) => item.id !== id),
                    }))
                    .filter((section) => section.data.length > 0)
            );
            await deleteTransaction(id);
            await load();
        },
        [load],
    );

    return { sections, summary, loading, reload: load, removeTransaction };
}

// ── Helpers ──────────────────────────────────────────────────────────

function groupByDay(
    transactions: TransactionWithCategory[],
): TransactionSection[] {
    const groups: TransactionSection[] = [];

    for (const tx of transactions) {
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
