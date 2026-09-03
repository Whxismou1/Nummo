import { format } from "date-fns";
import { es } from "date-fns/locale";

export function currentPeriod(): string {
    return format(new Date(), "yyyy-MM")
}

export function periodOf(timestamp: number): string {
    return format(new Date(timestamp), "yyyy-MM")
}

export function formatDate(timestamp: number): string {
    return format(new Date(timestamp), "d MMM yyyy", { locale: es })
}