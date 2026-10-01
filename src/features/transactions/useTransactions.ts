import { useCallback, useEffect, useState } from "react";
import { currentPeriod, prevPeriod, nextPeriod, formatDayGroup, isSameDay } from "@/lib/date";
import { DeviceEventEmitter } from "react-native";
import {
    deleteTransaction,
    getMonthSummary,
    getMonthSummarySync,
    getTransactionsForPeriod,
    getTransactionsForPeriodSync,
    MonthSummary,
    TransactionWithCategory,
} from "./repository";

export type TransactionSection = {
    title: string;
    data: TransactionWithCategory[];
};

export function useTransactions(initialPeriod: string = currentPeriod()) {
    const [period, setPeriod] = useState<string>(initialPeriod);

    const [sections, setSections] = useState<TransactionSection[]>(() => {
        try {
            const txs = getTransactionsForPeriodSync(period);
            return groupByDay(txs);
        } catch {
            return [];
        }
    });
    const [summary, setSummary] = useState<MonthSummary>(() => {
        try {
            return getMonthSummarySync(period);
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
                getTransactionsForPeriod(period),
                getMonthSummary(period),
            ]);
            setSections(groupByDay(txs));
            setSummary(monthSummary);
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("nummo_sync_completed", () => {
            void load();
        });
        return () => sub.remove();
    }, [load]);

    const goToPrevMonth = useCallback(() => {
        setPeriod((p) => prevPeriod(p));
    }, []);

    const goToNextMonth = useCallback(() => {
        setPeriod((p) => nextPeriod(p));
    }, []);

    const goToCurrentMonth = useCallback(() => {
        setPeriod(currentPeriod());
    }, []);

    const removeTransaction = useCallback(
        async (id: string) => {
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

    return {
        period,
        setPeriod,
        goToPrevMonth,
        goToNextMonth,
        goToCurrentMonth,
        sections,
        summary,
        loading,
        reload: load,
        removeTransaction,
    };
}

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
