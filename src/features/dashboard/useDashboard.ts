import { currentPeriod, prevPeriod, nextPeriod } from "@/lib/date";
import { useCallback, useEffect, useState, useRef } from "react";
import { DeviceEventEmitter } from "react-native";
import { getDashboardData, getDashboardDataSync, type DashboardData } from "./repository";

export function useDashboard() {
    const [period, setPeriod] = useState(currentPeriod);
    const [data, setData] = useState<DashboardData | null>(() => getDashboardDataSync(currentPeriod()));
    const [loading, setLoading] = useState(() => !getDashboardDataSync(currentPeriod()));
    const initialLoadDone = useRef(Boolean(getDashboardDataSync(currentPeriod())));

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
        void reload();
    }, [reload]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("nummo_sync_completed", () => {
            void reload();
        });
        return () => sub.remove();
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
