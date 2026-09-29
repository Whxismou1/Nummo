let activeCurrency: string = "EUR";

export function setActiveCurrency(currency: string) {
    if (currency) {
        activeCurrency = currency;
    }
}

export function getActiveCurrency(): string {
    return activeCurrency;
}

export function toCents(text: string): number {
    const formated = text.replace(",", ".");

    const num = Math.round(parseFloat(formated) * 100);

    if (Number.isNaN(num)) {
        return 0;
    }

    return num;
}

export function formatMoney(cents: number, currency?: string): string {
    const curr = currency || activeCurrency || "EUR";
    const amount = cents / 100;
    const locale = curr === "USD" ? "en-US" : curr === "GBP" ? "en-GB" : "es-ES";

    const formatted = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: curr,
    }).format(amount);

    return formatted;
}

export function getCurrencySymbol(currency?: string): string {
    const curr = currency || activeCurrency || "EUR";
    if (curr === "USD") return "$";
    if (curr === "GBP") return "£";
    return "€";
}
