import { format, isToday, isYesterday, isSameDay as dateFnsIsSameDay, startOfMonth as dateFnsStartOfMonth, endOfMonth as dateFnsEndOfMonth } from "date-fns";
import { es } from "date-fns/locale";

/** Returns the current period as "YYYY-MM" */
export function currentPeriod(): string {
    return format(new Date(), "yyyy-MM");
}

/** Returns the period "YYYY-MM" for a given timestamp (ms) */
export function periodOf(timestamp: number): string {
    return format(new Date(timestamp), "yyyy-MM");
}

/** Formats a timestamp to a readable short date: "23 sept 2026" */
export function formatDate(timestamp: number): string {
    return format(new Date(timestamp), "d MMM yyyy", { locale: es });
}

/**
 * Returns a human-readable day label for grouping transactions.
 * - "Hoy" / "Ayer" for recent days
 * - "lun, 22 sept 2026" otherwise
 */
export function formatDayGroup(timestamp: number): string {
    const date = new Date(timestamp);
    if (isToday(date)) return "Hoy";
    if (isYesterday(date)) return "Ayer";
    return format(date, "EEE, d MMM yyyy", { locale: es });
}

/** Returns the start-of-month timestamp (ms) for a given period "YYYY-MM" */
export function monthStart(period: string): number {
    const [year, month] = period.split("-").map(Number);
    return dateFnsStartOfMonth(new Date(year, month - 1)).getTime();
}

/** Returns the end-of-month timestamp (ms) for a given period "YYYY-MM" */
export function monthEnd(period: string): number {
    const [year, month] = period.split("-").map(Number);
    return dateFnsEndOfMonth(new Date(year, month - 1)).getTime();
}

/** Checks if two timestamps fall on the same calendar day */
export function isSameDay(a: number, b: number): boolean {
    return dateFnsIsSameDay(new Date(a), new Date(b));
}

/**
 * Formats a period "YYYY-MM" into a readable label: "Septiembre 2026"
 */
export function formatPeriod(period: string): string {
    const [year, month] = period.split("-").map(Number);
    return format(new Date(year, month - 1), "MMMM yyyy", { locale: es });
}

/** Returns the previous period "YYYY-MM" */
export function prevPeriod(period: string): string {
    const [year, month] = period.split("-").map(Number);
    const date = new Date(year, month - 2, 1);
    return format(date, "yyyy-MM");
}

/** Returns the next period "YYYY-MM" */
export function nextPeriod(period: string): string {
    const [year, month] = period.split("-").map(Number);
    const date = new Date(year, month, 1);
    return format(date, "yyyy-MM");
}