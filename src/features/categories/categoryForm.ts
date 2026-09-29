import * as z from "zod";

export const categorySchema = z.object({
    name: z.string().min(1, "El nombre es obligatorio"),
    icon: z.string().min(1, "Selecciona un icono"),
    color: z.string().min(1, "Selecciona un color"),
});

export type CategoryForm = z.infer<typeof categorySchema>;