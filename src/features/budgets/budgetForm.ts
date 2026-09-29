import * as z from "zod";

export const budgetSchema = z
    .object({
        period: z.string().regex(/^\d{4}-\d{2}$/, "Periodo no válido (AAAA-MM)"),
        scope: z.enum(["global", "category"]),
        categoryId: z.string().optional(),
        amount: z
            .string()
            .min(1, "El importe es obligatorio")
            .regex(
                /^\d+([.,]\d{1,2})?$/,
                "Introduce un importe válido (ej. 250 o 250,50)",
            ),
    })
    .refine(
        (data) => {
            if (data.scope === "category" && (!data.categoryId || data.categoryId.trim() === "")) {
                return false;
            }
            return true;
        },
        {
            message: "Debes seleccionar una categoría para este sobre",
            path: ["categoryId"],
        },
    );

export type BudgetForm = z.infer<typeof budgetSchema>;
