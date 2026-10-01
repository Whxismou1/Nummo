import { currentPeriod, prevPeriod, nextPeriod } from "@/lib/date";
import { useCallback, useEffect, useState, useRef } from "react";
import { getDashboardData, type DashboardData } from "./repository";

export function useDashboard() {
    const [period, setPeriod] = useState(currentPeriod);
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const initialLoadDone = useRef(false);

    const reload = useCallback(async () => {
        try {
            if (!initialLoadDone.current) {
                setLoading(true);
            }
            const res = await getDashboardData(period);
            setData(res);
        } catch (error) {
            console.error("Failed to load dashboard data:", error);
        } finally {
            initialLoadDone.current = true;
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        initialLoadDone.current = false;
        void reload();
    }, [reload]);

    const goToPrevMonth = useCallback(() => setPeriod((p) => prevPeriod(p)), []);
    const goToNextMonth = useCallback(() => setPeriod((p) => nextPeriod(p)), []);

    return {
        period,
        data,
        loading,
        reload,
        goToPrevMonth,
        goToNextMonth,
    };
}
