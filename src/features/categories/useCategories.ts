import { Category } from "@/db/schema";
import { useCallback, useEffect, useState } from "react";
import { getCategories } from "./repository";
import { conn } from "@/db";

export function useCategories() {
    const [categories, setCategories] = useState<Category[]>(() => {
        try {
            return conn.getAllSync<Category>("SELECT * FROM categories ORDER BY name ASC");
        } catch {
            return [];
        }
    });
    const [loading, setLoading] = useState(false);

    const load = useCallback(() => {
        getCategories().then(setCategories).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return { categories, loading, reloadCat: load };
}