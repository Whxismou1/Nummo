import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import {
    deleteGoal,
    getGoalsWithProgress,
    type GoalProgress,
} from "./repository";

export function useGoals() {
    const [goals, setGoals] = useState<GoalProgress[]>([]);
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getGoalsWithProgress();
            setGoals(data);
        } catch (error) {
            console.error("Failed to load savings goals:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener("nummo_sync_completed", () => {
            void reload();
        });
        return () => sub.remove();
    }, [reload]);

    const removeGoal = useCallback(
        async (id: string) => {
            await deleteGoal(id);
            await reload();
        },
        [reload],
    );

    return {
        goals,
        loading,
        reload,
        removeGoal,
    };
}
