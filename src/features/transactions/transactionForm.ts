import { toCents } from "@/lib/money";
import * as z from "zod";

export const transactionSchema = z.object({
    amount: z
        .string()
        .refine((val) => toCents(val) > 0, { message: "El importe debe ser mayor que 0" }),
    type: z.enum(["expense", "income"]),
    categoryId: z.string().optional(),
    note: z.string().optional(),
    date: z.number({ message: "Selecciona una fecha" }),
});

export type TransactionForm = z.infer<typeof transactionSchema>;
