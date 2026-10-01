import { db, conn } from "@/db";
import { budgets, categories, Category, transactions } from "@/db/schema";
import { newId } from "@/lib/id";
import { eq } from "drizzle-orm";
import type { CategoryForm } from "./categoryForm";
import { syncCategoryToCloud, deleteCategoryFromCloud } from "@/services/sync";

export const getCategories = async (): Promise<Category[]> => {
    const data = await db.select().from(categories);
    return data;
};

export const getCategoryByIdSync = (
    id: string,
): Category | undefined => {
    try {
        const row = conn.getFirstSync<Category>(
            "SELECT * FROM categories WHERE id = ? LIMIT 1",
            [id]
        );
        return row || undefined;
    } catch {
        return undefined;
    }
};

export const getCategoryById = async (
    id: string,
): Promise<Category | undefined> => {
    return getCategoryByIdSync(id);
};

/**
 * Creates a new category. The DB column `type` still exists but is no
 * longer user-facing — we default it to "expense" for backwards compat.
 */
export const createCategory = async (
    form: CategoryForm,
): Promise<Category> => {
    const [created] = await db
        .insert(categories)
        .values({
            id: newId(),
            name: form.name,
            icon: form.icon,
            color: form.color,
            type: "expense", // legacy column, no longer meaningful
        })
        .returning();
    void syncCategoryToCloud(created);
    return created;
};

export const updateCategory = async (
    id: string,
    form: CategoryForm,
): Promise<Category> => {
    const [updated] = await db
        .update(categories)
        .set({
            name: form.name,
            icon: form.icon,
            color: form.color,
        })
        .where(eq(categories.id, id))
        .returning();
    if (updated) {
        void syncCategoryToCloud(updated);
    }
    return updated;
};

/**
 * Deletes a category only if it's not referenced by any transaction
 * or budget.
 */
export const deleteCategory = async (id: string): Promise<void> => {
    const txUsage = await db
        .select()
        .from(transactions)
        .where(eq(transactions.categoryId, id))
        .limit(1);

    if (txUsage.length > 0) {
        throw new Error(
            "No se puede borrar: la categoría tiene movimientos asociados.",
        );
    }

    const budgetUsage = await db
        .select()
        .from(budgets)
        .where(eq(budgets.categoryId, id))
        .limit(1);

    if (budgetUsage.length > 0) {
        throw new Error(
            "No se puede borrar: la categoría tiene presupuestos asociados.",
        );
    }

    await db.delete(categories).where(eq(categories.id, id));
    void deleteCategoryFromCloud(id);
};
