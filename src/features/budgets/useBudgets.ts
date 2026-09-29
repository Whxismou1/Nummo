import { currentPeriod, nextPeriod, prevPeriod } from "@/lib/date";
import { useCallback, useEffect, useState } from "react";
import {
    deleteBudget,
    getMonthBudgetsOverview,
    type MonthBudgetsOverview,
} from "./repository";

export function useBudgets(initialPeriod: string = currentPeriod()) {
    const [period, setPeriod] = useState<string>(initialPeriod);
    const [overview, setOverview] = useState<MonthBudgetsOverview | null>(null);
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getMonthBudgetsOverview(period);
            setOverview(data);
        } catch (error) {
            console.error("Failed to load budgets overview:", error);
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const goToPrevMonth = useCallback(() => {
        setPeriod((p) => prevPeriod(p));
    }, []);

    const goToNextMonth = useCallback(() => {
        setPeriod((p) => nextPeriod(p));
    }, []);

    const goToCurrentMonth = useCallback(() => {
        setPeriod(currentPeriod());
    }, []);

    const removeBudget = useCallback(
        async (id: string) => {
            await deleteBudget(id);
            await reload();
        },
        [reload],
    );

    return {
        period,
        overview,
        loading,
        reload,
        goToPrevMonth,
        goToNextMonth,
        goToCurrentMonth,
        setPeriod,
        removeBudget,
    };
}
