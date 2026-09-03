export function toCents(text: string): number {
    const formated = text.replace(",", ".");

    const num = Math.round(parseFloat(formated) * 100);

    if (Number.isNaN(num)) {
        return 0;
    }

    return num;
}

export function formatMoney(cents: number): string {
    const euros = cents / 100;

    const curr = new Intl.NumberFormat('es-ES', {
        style: "currency",
        currency: "EUR"
    }).format(euros)

    return curr;
}
