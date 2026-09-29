import { currentPeriod } from "@/lib/date";
import { useCallback, useEffect, useState } from "react";
import { getDashboardData, type DashboardData } from "./repository";

export function useDashboard(period: string = currentPeriod()) {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        try {
            if (!data) {
                setLoading(true);
            }
            const res = await getDashboardData(period);
            setData(res);
        } catch (error) {
            console.error("Failed to load dashboard data:", error);
        } finally {
            setLoading(false);
        }
    }, [period, data]);

    useEffect(() => {
        void reload();
    }, [reload]);

    return {
        data,
        loading,
        reload,
    };
}
