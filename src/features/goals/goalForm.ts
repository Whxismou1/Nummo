import * as z from "zod";

export const goalSchema = z.object({
    name: z.string().min(1, "El nombre de la hucha es obligatorio"),
    targetAmount: z
        .string()
        .optional()
        .refine(
            (val) => {
                if (!val || val.trim() === "") return true;
                return /^\d+([.,]\d{1,2})?$/.test(val.trim());
            },
            {
                message: "Introduce una meta válida en euros (ej. 2000 o 2000,50)",
            },
        ),
    icon: z.string().min(1, "Selecciona un icono para tu hucha"),
    color: z.string().min(1, "Selecciona un color"),
});

export type GoalForm = z.infer<typeof goalSchema>;

export const contributionSchema = z.object({
    amount: z
        .string()
        .min(1, "Introduce un importe")
        .regex(
            /^\d+([.,]\d{1,2})?$/,
            "Introduce un importe válido (ej. 50 o 50,20)",
        ),
    note: z.string().optional(),
    type: z.enum(["expense", "income"]).default("expense"),
});

export type ContributionForm = z.infer<typeof contributionSchema>;
