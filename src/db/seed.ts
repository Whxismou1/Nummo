import { conn, db } from ".";
import { categories, budgets, savingsGoals, transactions, NewCategory } from "./schema";
import { newId } from "@/lib/id";
import { count } from "drizzle-orm";

export const defaultCategories: Omit<NewCategory, "id">[] = [
    {
        name: "Pádel & Deporte",
        icon: "🎾",
        color: "#4F46E5",
        type: "expense",
    },
    {
        name: "Ocio & Salidas",
        icon: "🍹",
        color: "#D97706",
        type: "expense",
    },
    {
        name: "Alimentación",
        icon: "🛒",
        color: "#E11D48",
        type: "expense",
    },
    {
        name: "Suscripciones",
        icon: "📱",
        color: "#7C3AED",
        type: "expense",
    },
    {
        name: "Transporte & Gasolina",
        icon: "🚗",
        color: "#2563EB",
        type: "expense",
    },
    {
        name: "Vivienda & Hogar",
        icon: "🏠",
        color: "#0D9488",
        type: "expense",
    },
    {
        name: "Salud & Bienestar",
        icon: "💊",
        color: "#DB2777",
        type: "expense",
    },
    {
        name: "Compras & Ropa",
        icon: "🛍️",
        color: "#059669",
        type: "expense",
    },

    {
        name: "Nómina Principal",
        icon: "💼",
        color: "#16A34A",
        type: "income",
    },
    {
        name: "Proyectos Freelance",
        icon: "💻",
        color: "#059669",
        type: "income",
    },
    {
        name: "Inversiones",
        icon: "📈",
        color: "#2563EB",
        type: "income",
    },
];

/**
 * Clear all transactions, budgets and savings goals, leaving categories intact.
 */
export const clearAllUserData = async () => {
    try {
        await db.delete(transactions);
        await db.delete(budgets);
        await db.delete(savingsGoals);
    } catch (e) {
        console.error("Error clearing user data:", e);
    }
};

/**
 * Standard seed for clean app launch:
 * 1. Checks and wipes legacy mock data once to leave DB completely empty.
 * 2. ONLY seeds default categories if none exist in the database.
 * No mock transactions, no mock budgets, no mock goals.
 */
export const seedDefaultData = async () => {
    try {
        conn.execSync(`
            CREATE TABLE IF NOT EXISTS app_flags (key TEXT PRIMARY KEY, value TEXT);
        `);

        const flag = conn.getFirstSync<{ value: string }>(
            "SELECT value FROM app_flags WHERE key = 'mocks_cleared_v2'"
        );
        if (!flag) {
            await clearAllUserData();
            conn.runSync(
                "INSERT OR REPLACE INTO app_flags (key, value) VALUES ('mocks_cleared_v2', 'true')"
            );
        }

        const authFlag = conn.getFirstSync<{ value: string }>(
            "SELECT value FROM app_flags WHERE key = 'auth_initial_reset_v3'"
        );
        if (!authFlag) {
            try {
                conn.runSync("CREATE TABLE IF NOT EXISTS app_user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, provider TEXT NOT NULL, avatar_url TEXT, created_at INTEGER NOT NULL);");
                conn.runSync("DELETE FROM app_user;");
            } catch {}
            conn.runSync(
                "INSERT OR REPLACE INTO app_flags (key, value) VALUES ('auth_initial_reset_v3', 'true')"
            );
        }

        const existingCat = await db.select({ count: count() }).from(categories);
        const catCount = Number(existingCat[0]?.count ?? 0);

        if (catCount > 0) {
            return;
        }

        for (const cat of defaultCategories) {
            await db.insert(categories).values({
                id: newId(),
                name: cat.name,
                icon: cat.icon,
                color: cat.color,
                type: cat.type,
            });
        }
    } catch (error) {
        console.error("Error seeding default categories:", error);
    }
};

export const seedDefaultCategories = () => seedDefaultData();