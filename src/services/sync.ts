import { db, conn } from "@/db";
import { categories, transactions, budgets, savingsGoals } from "@/db/schema";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { eq } from "drizzle-orm";

/**
 * Sync Service for Nummo
 * Keeps local SQLite database and cloud Supabase PostgreSQL in sync.
 * Provides offline-first instant loading while ensuring data is never lost across reinstalls.
 */

// Ensure sync_deletions table exists to track offline deletions
try {
    conn.execSync(`
        CREATE TABLE IF NOT EXISTS sync_deletions (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
    `);
} catch (e) {
    console.warn("Could not create sync_deletions table:", e);
}

export function queueDeletion(
    id: string,
    entityType: "transactions" | "budgets" | "savings_goals" | "categories"
): void {
    try {
        conn.runSync(
            "INSERT OR REPLACE INTO sync_deletions (id, entity_type, created_at) VALUES (?, ?, ?)",
            [id, entityType, Date.now()]
        );
    } catch (e) {
        console.warn("Error queuing deletion:", e);
    }
}

export function isQueuedForDeletion(id: string): boolean {
    try {
        const row = conn.getFirstSync<{ id: string }>(
            "SELECT id FROM sync_deletions WHERE id = ? LIMIT 1",
            [id]
        );
        return Boolean(row);
    } catch {
        return false;
    }
}

export async function processPendingDeletions(): Promise<void> {
    if (!isSupabaseConfigured()) return;
    try {
        const pending = conn.getAllSync<{ id: string; entity_type: string }>(
            "SELECT id, entity_type FROM sync_deletions"
        );
        for (const item of pending) {
            const { error } = await supabase.from(item.entity_type).delete().eq("id", item.id);
            if (!error) {
                conn.runSync("DELETE FROM sync_deletions WHERE id = ?", [item.id]);
            }
        }
    } catch (e) {
        console.warn("Error processing pending deletions:", e);
    }
}

export async function syncFromCloud(userId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    try {
        // 1. Sync Categories
        const { data: cloudCats, error: catErr } = await supabase
            .from("categories")
            .select("*")
            .eq("user_id", userId);

        if (!catErr && cloudCats && cloudCats.length > 0) {
            for (const cat of cloudCats) {
                if (isQueuedForDeletion(cat.id)) continue;
                conn.runSync(
                    "INSERT OR REPLACE INTO categories (id, name, icon, color, type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    [cat.id, cat.name, cat.icon, cat.color, cat.type, cat.created_at]
                );
            }
        } else if (!catErr && (!cloudCats || cloudCats.length === 0)) {
            await seedAndUploadDefaultCategories(userId);
        }

        // 2. Sync Savings Goals
        const { data: cloudGoals, error: goalErr } = await supabase
            .from("savings_goals")
            .select("*")
            .eq("user_id", userId);

        if (!goalErr && cloudGoals && cloudGoals.length > 0) {
            for (const g of cloudGoals) {
                if (isQueuedForDeletion(g.id)) continue;
                conn.runSync(
                    "INSERT OR REPLACE INTO savings_goals (id, name, target_amount, icon, color, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    [g.id, g.name, g.target_amount, g.icon, g.color, g.created_at]
                );
            }
        }

        // 3. Sync Transactions
        const { data: cloudTxs, error: txErr } = await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", userId);

        if (!txErr && cloudTxs && cloudTxs.length > 0) {
            for (const tx of cloudTxs) {
                if (isQueuedForDeletion(tx.id)) continue;
                conn.runSync(
                    "INSERT OR REPLACE INTO transactions (id, amount, type, category_id, savings_goal_id, date, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        tx.id,
                        tx.amount,
                        tx.type,
                        tx.category_id || null,
                        tx.savings_goal_id || null,
                        tx.date,
                        tx.note || null,
                        tx.created_at,
                        tx.updated_at,
                    ]
                );
            }
        }

        // 4. Sync Budgets
        const { data: cloudBudgets, error: bErr } = await supabase
            .from("budgets")
            .select("*")
            .eq("user_id", userId);

        if (!bErr && cloudBudgets && cloudBudgets.length > 0) {
            for (const b of cloudBudgets) {
                if (isQueuedForDeletion(b.id)) continue;
                conn.runSync(
                    "INSERT OR REPLACE INTO budgets (id, period, scope, category_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    [b.id, b.period, b.scope, b.category_id || null, b.amount, b.created_at]
                );
            }
        }

        return true;
    } catch (e) {
        console.warn("Error during syncFromCloud:", e);
        return false;
    }
}

export async function syncToCloud(userId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    try {
        // Sync local categories up to cloud
        const localCats = await db.select().from(categories);
        if (localCats.length > 0) {
            await supabase.from("categories").upsert(
                localCats.map((c) => ({
                    id: c.id,
                    user_id: userId,
                    name: c.name,
                    icon: c.icon,
                    color: c.color,
                    type: c.type,
                    created_at: c.createdAt,
                }))
            );
        }

        // Sync local savings goals
        const localGoals = await db.select().from(savingsGoals);
        if (localGoals.length > 0) {
            await supabase.from("savings_goals").upsert(
                localGoals.map((g) => ({
                    id: g.id,
                    user_id: userId,
                    name: g.name,
                    target_amount: g.targetAmount,
                    icon: g.icon,
                    color: g.color,
                    created_at: g.createdAt,
                }))
            );
        }

        // Sync local transactions
        const localTxs = await db.select().from(transactions);
        if (localTxs.length > 0) {
            await supabase.from("transactions").upsert(
                localTxs.map((t) => ({
                    id: t.id,
                    user_id: userId,
                    amount: t.amount,
                    type: t.type,
                    category_id: t.categoryId,
                    savings_goal_id: t.savingsGoalId,
                    date: t.date,
                    note: t.note,
                    created_at: t.createdAt,
                    updated_at: t.updatedAt,
                }))
            );
        }

        // Sync local budgets
        const localBudgets = await db.select().from(budgets);
        if (localBudgets.length > 0) {
            await supabase.from("budgets").upsert(
                localBudgets.map((b) => ({
                    id: b.id,
                    user_id: userId,
                    period: b.period,
                    scope: b.scope,
                    category_id: b.categoryId,
                    amount: b.amount,
                    created_at: b.createdAt,
                }))
            );
        }

        return true;
    } catch (e) {
        console.warn("Error during syncToCloud:", e);
        return false;
    }
}

export async function getCloudUserId(): Promise<string | null> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
            return session.user.id;
        }
    } catch {}
    return getActiveUserId();
}

/** Get active user id from local session */
export function getActiveUserId(): string | null {
    try {
        const session = conn.getFirstSync<{ user_id: string }>(
            "SELECT user_id FROM app_session WHERE key = 'active_user' LIMIT 1"
        );
        return session?.user_id || null;
    } catch {
        return null;
    }
}

export const DEFAULT_CATEGORY_TEMPLATES = [
    // Gastos
    { slug: "deporte", name: "Pádel & Deporte", icon: "🎾", color: "#4F46E5", type: "expense" as const },
    { slug: "ocio", name: "Ocio & Salidas", icon: "🍹", color: "#D97706", type: "expense" as const },
    { slug: "alimentacion", name: "Alimentación", icon: "🛒", color: "#E11D48", type: "expense" as const },
    { slug: "suscripciones", name: "Suscripciones", icon: "📱", color: "#7C3AED", type: "expense" as const },
    { slug: "transporte", name: "Transporte & Gasolina", icon: "🚗", color: "#2563EB", type: "expense" as const },
    { slug: "vivienda", name: "Vivienda & Hogar", icon: "🏠", color: "#0D9488", type: "expense" as const },
    { slug: "salud", name: "Salud & Bienestar", icon: "💊", color: "#DB2777", type: "expense" as const },
    { slug: "compras", name: "Compras & Ropa", icon: "🛍️", color: "#059669", type: "expense" as const },

    // Ingresos
    { slug: "nomina", name: "Nómina Principal", icon: "💼", color: "#16A34A", type: "income" as const },
    { slug: "freelance", name: "Freelance & Extras", icon: "💻", color: "#059669", type: "income" as const },
    { slug: "inversiones", name: "Inversiones", icon: "📈", color: "#2563EB", type: "income" as const },
];

/**
 * Resets local categories to the clean standard set, re-links existing transactions/budgets,
 * and pushes the new categories and transactions to Supabase.
 */
export async function resetAndUploadDefaultCategories(userId: string): Promise<void> {
    if (!userId) return;
    const userPrefix = userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
    const now = Date.now();

    const newCats = DEFAULT_CATEGORY_TEMPLATES.map((tmpl, idx) => ({
        id: `cat_${userPrefix}_${tmpl.slug}`,
        user_id: userId,
        name: tmpl.name,
        icon: tmpl.icon,
        color: tmpl.color,
        type: tmpl.type,
        created_at: now + idx,
    }));

    // 1. Re-link any existing transactions and budgets to new category IDs by name match
    for (const cat of newCats) {
        try {
            const oldCats = conn.getAllSync<{ id: string }>(
                "SELECT id FROM categories WHERE name = ? AND id != ?",
                [cat.name, cat.id]
            );
            for (const old of oldCats) {
                conn.runSync("UPDATE transactions SET category_id = ? WHERE category_id = ?", [cat.id, old.id]);
                conn.runSync("UPDATE budgets SET category_id = ? WHERE category_id = ?", [cat.id, old.id]);
            }
        } catch (e) {
            console.warn("Could not re-link transactions for category:", cat.name, e);
        }
    }

    // 2. Delete old categories from local SQLite that are not in the new set
    try {
        const newCatIds = newCats.map((c) => `'${c.id}'`).join(",");
        conn.runSync(`DELETE FROM categories WHERE id NOT IN (${newCatIds})`);
    } catch (e) {
        console.warn("Could not prune old local categories:", e);
    }

    // 3. Upsert clean categories into local SQLite
    for (const cat of newCats) {
        conn.runSync(
            "INSERT OR REPLACE INTO categories (id, name, icon, color, type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            [cat.id, cat.name, cat.icon, cat.color, cat.type, cat.created_at]
        );
    }

    // 4. In Supabase: delete previous cloud categories for this user and upsert the new set
    if (isSupabaseConfigured()) {
        try {
            // Delete old cloud categories
            await supabase.from("categories").delete().eq("user_id", userId);

            // Upsert new clean categories
            const { error: catErr } = await supabase.from("categories").upsert(newCats);
            if (catErr) {
                console.error("Supabase clean categories upsert error:", catErr.message);
            } else {
                console.log("Clean categories successfully uploaded to Supabase!");
            }

            // Sync all existing local transactions to Supabase now that new categories exist
            const localTxs = await db.select().from(transactions);
            if (localTxs.length > 0) {
                const { error: txErr } = await supabase.from("transactions").upsert(
                    localTxs.map((t) => ({
                        id: t.id,
                        user_id: userId,
                        amount: t.amount,
                        type: t.type,
                        category_id: t.categoryId || null,
                        savings_goal_id: t.savingsGoalId || null,
                        date: t.date,
                        note: t.note || null,
                        created_at: t.createdAt,
                        updated_at: t.updatedAt,
                    }))
                );
                if (txErr) {
                    console.error("Supabase transactions upsert error during category reset:", txErr.message);
                } else {
                    console.log("Local transactions re-synced to Supabase with new categories!");
                }
            }
        } catch (e) {
            console.warn("Error during Supabase category reset:", e);
        }
    }
}

/** Seed and upload default categories for newly created user / fresh APK */
export const seedAndUploadDefaultCategories = resetAndUploadDefaultCategories;

/** Full two-way sync: pulls cloud data and pushes local data */
export async function syncAll(userId: string): Promise<void> {
    if (!isSupabaseConfigured() || !userId) return;
    try {
        // First process any deletions that occurred while offline
        await processPendingDeletions();

        const flag = conn.getFirstSync<{ value: string }>(
            "SELECT value FROM app_flags WHERE key = 'categories_reset_v4'"
        );
        if (!flag) {
            await resetAndUploadDefaultCategories(userId);
            conn.runSync(
                "INSERT OR REPLACE INTO app_flags (key, value) VALUES ('categories_reset_v4', 'true')"
            );
        } else {
            await syncFromCloud(userId);
            await syncToCloud(userId);
        }
    } catch (e) {
        console.warn("syncAll error:", e);
    }
}

/** Push single transaction to Supabase */
export async function syncTransactionToCloud(tx: {
    id: string;
    amount: number;
    type: string;
    categoryId?: string | null;
    savingsGoalId?: string | null;
    date: number;
    note?: string | null;
    createdAt: number;
    updatedAt: number;
}): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const userId = await getCloudUserId();
    if (!userId) {
        console.warn("syncTransactionToCloud: No active authenticated Supabase user found.");
        return;
    }

    try {
        // Ensure category exists in Supabase first to satisfy foreign key constraint
        if (tx.categoryId) {
            try {
                const cat = conn.getFirstSync<{
                    id: string;
                    name: string;
                    icon: string;
                    color: string;
                    type: string;
                    created_at: number;
                }>("SELECT * FROM categories WHERE id = ? LIMIT 1", [tx.categoryId]);
                if (cat) {
                    const { error: catErr } = await supabase.from("categories").upsert({
                        id: cat.id,
                        user_id: userId,
                        name: cat.name,
                        icon: cat.icon,
                        color: cat.color,
                        type: cat.type,
                        created_at: cat.created_at,
                    });
                    if (catErr) {
                        console.warn("Pre-sync category error:", catErr.message);
                    }
                }
            } catch (catE) {
                console.warn("Failed to pre-sync category for transaction:", catE);
            }
        }

        // Ensure savings goal exists in Supabase first to satisfy foreign key constraint
        if (tx.savingsGoalId) {
            try {
                const goal = conn.getFirstSync<{
                    id: string;
                    name: string;
                    target_amount: number | null;
                    icon: string;
                    color: string;
                    created_at: number;
                }>("SELECT * FROM savings_goals WHERE id = ? LIMIT 1", [tx.savingsGoalId]);
                if (goal) {
                    const { error: goalErr } = await supabase.from("savings_goals").upsert({
                        id: goal.id,
                        user_id: userId,
                        name: goal.name,
                        target_amount: goal.target_amount ?? null,
                        icon: goal.icon,
                        color: goal.color,
                        created_at: goal.created_at,
                    });
                    if (goalErr) {
                        console.warn("Pre-sync savings goal error:", goalErr.message);
                    }
                }
            } catch (goalE) {
                console.warn("Failed to pre-sync savings goal for transaction:", goalE);
            }
        }

        const { error } = await supabase.from("transactions").upsert({
            id: tx.id,
            user_id: userId,
            amount: tx.amount,
            type: tx.type,
            category_id: tx.categoryId || null,
            savings_goal_id: tx.savingsGoalId || null,
            date: tx.date,
            note: tx.note || null,
            created_at: tx.createdAt,
            updated_at: tx.updatedAt,
        });

        if (error) {
            console.error("Supabase syncTransactionToCloud error:", error.message, error.details);
        } else {
            console.log("Supabase transaction synced successfully:", tx.id);
        }
    } catch (e) {
        console.warn("Background sync error (transaction upsert):", e);
    }
}

/** Delete transaction from Supabase */
export async function deleteTransactionFromCloud(id: string): Promise<void> {
    queueDeletion(id, "transactions");
    if (!isSupabaseConfigured()) return;
    try {
        const { error } = await supabase.from("transactions").delete().eq("id", id);
        if (error) {
            console.error("Supabase delete transaction error:", error.message);
        } else {
            conn.runSync("DELETE FROM sync_deletions WHERE id = ?", [id]);
            console.log("Supabase transaction deleted successfully:", id);
        }
    } catch (e) {
        console.warn("Background sync error (transaction delete):", e);
    }
}

/** Push single category to Supabase */
export async function syncCategoryToCloud(cat: {
    id: string;
    name: string;
    icon: string;
    color: string;
    type: string;
    createdAt: number;
}): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const userId = await getCloudUserId();
    if (!userId) return;

    try {
        const { error } = await supabase.from("categories").upsert({
            id: cat.id,
            user_id: userId,
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            type: cat.type,
            created_at: cat.createdAt,
        });
        if (error) {
            console.error("Supabase syncCategoryToCloud error:", error.message);
        }
    } catch (e) {
        console.warn("Background sync error (category upsert):", e);
    }
}

/** Delete category from Supabase */
export async function deleteCategoryFromCloud(id: string): Promise<void> {
    queueDeletion(id, "categories");
    if (!isSupabaseConfigured()) return;
    try {
        const { error } = await supabase.from("categories").delete().eq("id", id);
        if (error) {
            console.error("Supabase delete category error:", error.message);
        } else {
            conn.runSync("DELETE FROM sync_deletions WHERE id = ?", [id]);
        }
    } catch (e) {
        console.warn("Background sync error (category delete):", e);
    }
}

/** Push single savings goal to Supabase */
export async function syncGoalToCloud(goal: {
    id: string;
    name: string;
    targetAmount?: number | null;
    icon: string;
    color: string;
    createdAt: number;
}): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const userId = await getCloudUserId();
    if (!userId) return;

    try {
        const { error } = await supabase.from("savings_goals").upsert({
            id: goal.id,
            user_id: userId,
            name: goal.name,
            target_amount: goal.targetAmount ?? null,
            icon: goal.icon,
            color: goal.color,
            created_at: goal.createdAt,
        });
        if (error) {
            console.error("Supabase syncGoalToCloud error:", error.message);
        }
    } catch (e) {
        console.warn("Background sync error (goal upsert):", e);
    }
}

/** Delete savings goal from Supabase */
export async function deleteGoalFromCloud(id: string): Promise<void> {
    queueDeletion(id, "savings_goals");
    if (!isSupabaseConfigured()) return;
    try {
        const { error } = await supabase.from("savings_goals").delete().eq("id", id);
        if (error) {
            console.error("Supabase delete goal error:", error.message);
        } else {
            conn.runSync("DELETE FROM sync_deletions WHERE id = ?", [id]);
        }
    } catch (e) {
        console.warn("Background sync error (goal delete):", e);
    }
}

/** Push single budget to Supabase */
export async function syncBudgetToCloud(b: {
    id: string;
    period: string;
    scope: string;
    categoryId?: string | null;
    amount: number;
    createdAt: number;
}): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const userId = await getCloudUserId();
    if (!userId) return;

    try {
        // Ensure category exists in Supabase first if categoryId is set
        if (b.categoryId) {
            try {
                const cat = conn.getFirstSync<{
                    id: string;
                    name: string;
                    icon: string;
                    color: string;
                    type: string;
                    created_at: number;
                }>("SELECT * FROM categories WHERE id = ? LIMIT 1", [b.categoryId]);
                if (cat) {
                    await supabase.from("categories").upsert({
                        id: cat.id,
                        user_id: userId,
                        name: cat.name,
                        icon: cat.icon,
                        color: cat.color,
                        type: cat.type,
                        created_at: cat.created_at,
                    });
                }
            } catch {}
        }

        const { error } = await supabase.from("budgets").upsert({
            id: b.id,
            user_id: userId,
            period: b.period,
            scope: b.scope,
            category_id: b.categoryId || null,
            amount: b.amount,
            created_at: b.createdAt,
        });
        if (error) {
            console.error("Supabase syncBudgetToCloud error:", error.message);
        }
    } catch (e) {
        console.warn("Background sync error (budget upsert):", e);
    }
}

/** Delete budget from Supabase */
export async function deleteBudgetFromCloud(id: string): Promise<void> {
    queueDeletion(id, "budgets");
    if (!isSupabaseConfigured()) return;
    try {
        const { error } = await supabase.from("budgets").delete().eq("id", id);
        if (error) {
            console.error("Supabase delete budget error:", error.message);
        } else {
            conn.runSync("DELETE FROM sync_deletions WHERE id = ?", [id]);
        }
    } catch (e) {
        console.warn("Background sync error (budget delete):", e);
    }
}
