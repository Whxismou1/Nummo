import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getMonthSummary, getAllTransactionsForExport } from "@/features/transactions/repository";
import { getMonthBudgetsOverview } from "@/features/budgets/repository";
import { getGoalsWithProgress } from "@/features/goals/repository";
import { currentPeriod, formatPeriod, formatDate, periodOf } from "@/lib/date";
import { formatMoney, getCurrencySymbol } from "@/lib/money";
import { getAppSetting } from "@/features/settings/SettingsContext";
import XLSX from "xlsx-js-style";

export interface AlertEmailPayload {
    to: string;
    subject: string;
    title: string;
    message: string;
    badgeType?: "danger" | "warning" | "success" | "info";
    details?: { label: string; value: string }[];
}

export async function sendEmailViaSupabase(payload: {
    to: string;
    subject: string;
    html: string;
    attachments?: { filename: string; content: string }[];
}): Promise<{ ok: boolean; error?: string }> {
    try {
        if (!isSupabaseConfigured()) {
            return { ok: false, error: "Supabase no está configurado." };
        }

        const { error } = await supabase.functions.invoke("send-email", {
            body: payload,
        });

        if (error) {
            return { ok: false, error: error.message };
        }

        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message || "Error al enviar correo" };
    }
}

export async function sendAlertEmail(payload: AlertEmailPayload): Promise<boolean> {
    const isEmailEnabled = getAppSetting("notificationsEmail");
    if (!isEmailEnabled || !payload.to) {
        return false;
    }

    const badgeColor =
        payload.badgeType === "danger"
            ? "#EF4444"
            : payload.badgeType === "warning"
              ? "#F59E0B"
              : payload.badgeType === "success"
                ? "#10B981"
                : "#6366F1";

    const detailsHtml = payload.details
        ? `<table style="width: 100%; margin-top: 16px; border-collapse: collapse;">
            ${payload.details
                .map(
                    (d) => `
                <tr style="border-bottom: 1px solid #E5E7EB;">
                    <td style="padding: 10px 0; color: #6B7280; font-size: 14px;">${d.label}</td>
                    <td style="padding: 10px 0; color: #111827; font-weight: 600; text-align: right; font-size: 14px;">${d.value}</td>
                </tr>`
                )
                .join("")}
           </table>`
        : "";

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${payload.subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px;">
      <div style="max-width: 560px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background-color: #1E1B4B; padding: 24px; text-align: center;">
          <h1 style="color: #FFFFFF; margin: 0; font-size: 22px; font-weight: bold; letter-spacing: -0.5px;">Nummo</h1>
          <p style="color: #A5B4FC; margin: 4px 0 0 0; font-size: 13px;">Tu espacio financiero personal</p>
        </div>
        <div style="padding: 28px;">
          <div style="display: inline-block; padding: 4px 12px; border-radius: 20px; background-color: ${badgeColor}20; color: ${badgeColor}; font-weight: bold; font-size: 12px; text-transform: uppercase; margin-bottom: 12px;">
            Aviso de finanzas
          </div>
          <h2 style="color: #0F172A; margin: 0 0 12px 0; font-size: 20px;">${payload.title}</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0;">${payload.message}</p>
          ${detailsHtml}
          <div style="margin-top: 32px; padding: 16px; background-color: #F1F5F9; border-radius: 12px; text-align: center;">
            <p style="margin: 0; font-size: 13px; color: #64748B;">
              Abre la app <strong>Nummo</strong> en tu dispositivo para gestionar tus presupuestos y movimientos.
            </p>
          </div>
        </div>
        <div style="background-color: #F8FAFC; padding: 16px; text-align: center; border-top: 1px solid #E2E8F0;">
          <p style="margin: 0; font-size: 11px; color: #94A3B8;">
            Has recibido este correo porque tienes activadas las alertas en Nummo. Puedes cambiar tus preferencias en Ajustes.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    const res = await sendEmailViaSupabase({
        to: payload.to,
        subject: payload.subject,
        html,
    });

    return res.ok;
}

function buildProgressBar(ratio: number, length = 12): string {
    const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
    const filled = Math.round(clamped * length);
    return "█".repeat(filled) + "░".repeat(Math.max(0, length - filled));
}

const BORDER_THIN = {
    top: { style: "thin", color: { rgb: "E2E8F0" } },
    bottom: { style: "thin", color: { rgb: "E2E8F0" } },
    left: { style: "thin", color: { rgb: "E2E8F0" } },
    right: { style: "thin", color: { rgb: "E2E8F0" } },
};

const BORDER_ACCENT = {
    top: { style: "medium", color: { rgb: "4F46E5" } },
    bottom: { style: "medium", color: { rgb: "4F46E5" } },
    left: { style: "medium", color: { rgb: "4F46E5" } },
    right: { style: "medium", color: { rgb: "4F46E5" } },
};

function styleHeaderBanner(text: string) {
    return {
        v: text,
        t: "s",
        s: {
            fill: { fgColor: { rgb: "1E1B4B" } },
            font: { name: "Calibri", sz: 15, bold: true, color: { rgb: "FFFFFF" } },
            alignment: { horizontal: "left", vertical: "center" },
        },
    };
}

function styleSubtitleBanner(text: string) {
    return {
        v: text,
        t: "s",
        s: {
            fill: { fgColor: { rgb: "312E81" } },
            font: { name: "Calibri", sz: 10, italic: true, color: { rgb: "E0E7FF" } },
            alignment: { horizontal: "left", vertical: "center" },
        },
    };
}

function styleSectionTitle(text: string) {
    return {
        v: text,
        t: "s",
        s: {
            fill: { fgColor: { rgb: "0F172A" } },
            font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
            alignment: { horizontal: "left", vertical: "center" },
        },
    };
}

function styleTableHeader(text: string, align: "left" | "center" | "right" = "left") {
    return {
        v: text,
        t: "s",
        s: {
            fill: { fgColor: { rgb: "4F46E5" } },
            font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
            alignment: { horizontal: align, vertical: "center", wrapText: true },
            border: BORDER_THIN,
        },
    };
}

function styleCellText(
    text: string | number,
    opts?: {
        bold?: boolean;
        color?: string;
        bg?: string;
        align?: "left" | "center" | "right";
    }
) {
    return {
        v: text,
        t: typeof text === "number" ? "n" : "s",
        s: {
            fill: { fgColor: { rgb: opts?.bg || "FFFFFF" } },
            font: {
                name: "Calibri",
                sz: 10,
                bold: Boolean(opts?.bold),
                color: { rgb: opts?.color || "0F172A" },
            },
            alignment: { horizontal: opts?.align || "left", vertical: "center" },
            border: BORDER_THIN,
        },
    };
}

function styleCellMoney(
    amountEuros: number,
    currencySymbol: string,
    opts?: {
        formula?: string;
        bold?: boolean;
        color?: string;
        bg?: string;
        showPlus?: boolean;
    }
) {
    const fmt = opts?.showPlus
        ? `+#,##0.00 "${currencySymbol}";-#,##0.00 "${currencySymbol}";0.00 "${currencySymbol}"`
        : `#,##0.00 "${currencySymbol}";-#,##0.00 "${currencySymbol}";0.00 "${currencySymbol}"`;
    const cell: any = {
        v: Number(amountEuros.toFixed(2)),
        t: "n",
        s: {
            numFmt: fmt,
            fill: { fgColor: { rgb: opts?.bg || "FFFFFF" } },
            font: {
                name: "Calibri",
                sz: 10,
                bold: Boolean(opts?.bold),
                color: { rgb: opts?.color || "0F172A" },
            },
            alignment: { horizontal: "right", vertical: "center" },
            border: BORDER_THIN,
        },
    };
    if (opts?.formula) {
        cell.f = opts.formula;
    }
    return cell;
}

function styleCellPercent(
    ratio: number,
    opts?: {
        formula?: string;
        bold?: boolean;
        color?: string;
        bg?: string;
    }
) {
    const cell: any = {
        v: Number.isFinite(ratio) ? Number(ratio.toFixed(4)) : 0,
        t: "n",
        s: {
            numFmt: "0.0%",
            fill: { fgColor: { rgb: opts?.bg || "FFFFFF" } },
            font: {
                name: "Calibri",
                sz: 10,
                bold: Boolean(opts?.bold),
                color: { rgb: opts?.color || "0F172A" },
            },
            alignment: { horizontal: "right", vertical: "center" },
            border: BORDER_THIN,
        },
    };
    if (opts?.formula) {
        cell.f = opts.formula;
    }
    return cell;
}

function fillMergedBannerRow(
    titleCell: any,
    totalCols: number,
    fillRgb: string
): any[] {
    const row = [titleCell];
    for (let i = 1; i < totalCols; i++) {
        row.push({
            v: "",
            t: "s",
            s: {
                fill: { fgColor: { rgb: fillRgb } },
            },
        });
    }
    return row;
}

export async function sendComprehensiveFinancialReport(toEmail: string): Promise<{ ok: boolean; error?: string }> {
    const activePeriod = currentPeriod();
    const periodTitle = formatPeriod(activePeriod);
    const currencyCode = getAppSetting("currency") || "EUR";
    const sym = getCurrencySymbol(currencyCode);

    const [summary, budgetsOverview, goals, allTxs] = await Promise.all([
        getMonthSummary(activePeriod),
        getMonthBudgetsOverview(activePeriod),
        getGoalsWithProgress(),
        getAllTransactionsForExport(),
    ]);

    const periodsSet = new Set<string>();
    periodsSet.add(activePeriod);
    allTxs.forEach((t) => periodsSet.add(periodOf(t.date)));
    const allPeriods = Array.from(periodsSet).sort().reverse();
    const chronologicalPeriods = [...allPeriods].reverse();

    let runningCumulativeCents = 0;
    const periodCumulativeMap = new Map<string, number>();

    chronologicalPeriods.forEach((p) => {
        const inc = allTxs
            .filter((t) => periodOf(t.date) === p && t.type === "income")
            .reduce((sum, t) => sum + t.amount, 0);
        const exp = allTxs
            .filter((t) => periodOf(t.date) === p && t.type === "expense")
            .reduce((sum, t) => sum + t.amount, 0);
        runningCumulativeCents += inc - exp;
        periodCumulativeMap.set(p, runningCumulativeCents);
    });

    const monthlyStats = allPeriods.map((p) => {
        const monthTxs = allTxs.filter((t) => periodOf(t.date) === p);
        const incCents = monthTxs
            .filter((t) => t.type === "income")
            .reduce((sum, t) => sum + t.amount, 0);
        const expCents = monthTxs
            .filter((t) => t.type === "expense")
            .reduce((sum, t) => sum + t.amount, 0);
        const balCents = incCents - expCents;
        const cumCents = periodCumulativeMap.get(p) ?? 0;
        const savingsRate = incCents > 0 ? balCents / incCents : 0;

        return {
            period: p,
            label: formatPeriod(p),
            txCount: monthTxs.length,
            income: incCents / 100,
            expenses: expCents / 100,
            balance: balCents / 100,
            cumulative: cumCents / 100,
            savingsRate,
        };
    });

    const totalHistoricalIncome = monthlyStats.reduce((s, m) => s + m.income, 0);
    const totalHistoricalExpenses = monthlyStats.reduce((s, m) => s + m.expenses, 0);
    const totalHistoricalBalance = totalHistoricalIncome - totalHistoricalExpenses;
    const globalSavingsRate =
        totalHistoricalIncome > 0 ? totalHistoricalBalance / totalHistoricalIncome : 0;
    const avgMonthlyExpense =
        monthlyStats.length > 0 ? totalHistoricalExpenses / monthlyStats.length : 0;
    const totalSavedInGoals = goals.reduce((s, g) => s + g.savedAmount, 0) / 100;

    const categoryMap = new Map<
        string,
        {
            name: string;
            totalExpenseCents: number;
            activeMonthExpenseCents: number;
            txCount: number;
            byPeriod: Map<string, number>;
        }
    >();

    allTxs
        .filter((t) => t.type === "expense")
        .forEach((tx) => {
            const catName = tx.category?.name || "Sin categoría";
            const p = periodOf(tx.date);
            const existing = categoryMap.get(catName) || {
                name: catName,
                totalExpenseCents: 0,
                activeMonthExpenseCents: 0,
                txCount: 0,
                byPeriod: new Map<string, number>(),
            };
            existing.totalExpenseCents += tx.amount;
            if (p === activePeriod) {
                existing.activeMonthExpenseCents += tx.amount;
            }
            existing.txCount += 1;
            existing.byPeriod.set(p, (existing.byPeriod.get(p) ?? 0) + tx.amount);
            categoryMap.set(catName, existing);
        });

    const categoryRanking = Array.from(categoryMap.values()).sort(
        (a, b) => b.totalExpenseCents - a.totalExpenseCents
    );

    const wb = XLSX.utils.book_new();
    const generatedAtStr = formatDate(Date.now());
    const DASH_COLS = 8;

    const dashRows: any[][] = [];
    dashRows.push(
        fillMergedBannerRow(
            styleHeaderBanner("NUMMO · INFORME FINANCIERO EJECUTIVO & PATRIMONIAL"),
            DASH_COLS,
            "1E1B4B"
        )
    );
    dashRows.push(
        fillMergedBannerRow(
            styleSubtitleBanner(
                `Generado el ${generatedAtStr}  |  Periodo activo: ${periodTitle}  |  Meses registrados: ${allPeriods.length}  |  Movimientos auditados: ${allTxs.length}`
            ),
            DASH_COLS,
            "312E81"
        )
    );
    dashRows.push([]);

    dashRows.push(
        fillMergedBannerRow(
            styleSectionTitle("1. RESUMEN PATRIMONIAL GLOBAL (HISTÓRICO ACUMULADO)"),
            DASH_COLS,
            "0F172A"
        )
    );
    dashRows.push([
        styleTableHeader("Indicador Patrimonial"),
        styleTableHeader("Valor Actual", "right"),
        styleTableHeader("Detalle / Interpretación"),
        styleTableHeader("Indicador Complementario"),
        styleTableHeader("Valor", "right"),
        styleTableHeader("Estado / Referencia"),
        styleTableHeader("Progreso / Ratio", "center"),
        styleTableHeader("Nivel", "center"),
    ]);

    dashRows.push([
        styleCellText("Ingresos Históricos Totales", { bold: true, bg: "F8FAFC" }),
        styleCellMoney(totalHistoricalIncome, sym, {
            formula: 'SUMIFS(Movimientos!G:G,Movimientos!D:D,"Ingreso")',
            bold: true,
            color: "059669",
            bg: "ECFDF5",
        }),
        styleCellText("Suma de todas las entradas registradas", { bg: "F8FAFC", color: "475569" }),
        styleCellText("Tasa de Ahorro Global", { bold: true, bg: "F8FAFC" }),
        styleCellPercent(globalSavingsRate, {
            formula: "IF(B6>0,(B6-B7)/B6,0)",
            bold: true,
            color: globalSavingsRate >= 0.2 ? "059669" : globalSavingsRate >= 0 ? "D97706" : "DC2626",
            bg: "F8FAFC",
        }),
        styleCellText("Meta recomendada: >= 20%", { bg: "F8FAFC", color: "475569" }),
        styleCellText(buildProgressBar(Math.max(0, globalSavingsRate)), {
            align: "center",
            color: "4F46E5",
            bg: "F8FAFC",
        }),
        styleCellText(
            globalSavingsRate >= 0.2 ? "ÓPTIMO" : globalSavingsRate >= 0 ? "POSITIVO" : "DÉFICIT",
            {
                bold: true,
                align: "center",
                color: globalSavingsRate >= 0.2 ? "059669" : globalSavingsRate >= 0 ? "D97706" : "DC2626",
                bg: globalSavingsRate >= 0.2 ? "ECFDF5" : globalSavingsRate >= 0 ? "FEF3C7" : "FEF2F2",
            }
        ),
    ]);

    dashRows.push([
        styleCellText("Gastos Históricos Totales", { bold: true }),
        styleCellMoney(totalHistoricalExpenses, sym, {
            formula: 'SUMIFS(Movimientos!G:G,Movimientos!D:D,"Gasto")',
            bold: true,
            color: "DC2626",
            bg: "FEF2F2",
        }),
        styleCellText("Suma de todas las salidas registradas", { color: "475569" }),
        styleCellText("Gasto Promedio Mensual", { bold: true }),
        styleCellMoney(avgMonthlyExpense, sym, { bold: true, color: "0F172A" }),
        styleCellText(`Media en ${allPeriods.length} mes(es)`, { color: "475569" }),
        styleCellText(`${allTxs.length} movs`, { align: "center", bold: true }),
        styleCellText("ACTIVO", {
            bold: true,
            align: "center",
            color: "4F46E5",
            bg: "EEF2FF",
        }),
    ]);

    dashRows.push([
        styleCellText("Saldo Disponible Real (c/ Arrastre)", { bold: true, bg: "EEF2FF" }),
        styleCellMoney(totalHistoricalBalance, sym, {
            formula: "B6-B7",
            bold: true,
            color: totalHistoricalBalance >= 0 ? "1E1B4B" : "DC2626",
            bg: "EEF2FF",
            showPlus: true,
        }),
        styleCellText("Patrimonio líquido acumulado a hoy", { bg: "EEF2FF", color: "312E81" }),
        styleCellText("Capital en Huchas de Ahorro", { bold: true, bg: "EEF2FF" }),
        styleCellMoney(totalSavedInGoals, sym, {
            bold: true,
            color: "4F46E5",
            bg: "EEF2FF",
        }),
        styleCellText(`${goals.length} hucha(s) configurada(s)`, { bg: "EEF2FF", color: "312E81" }),
        styleCellText(
            totalHistoricalBalance >= 0 ? "SOLVENTE" : "ATENCIÓN",
            {
                bold: true,
                align: "center",
                color: totalHistoricalBalance >= 0 ? "059669" : "DC2626",
                bg: totalHistoricalBalance >= 0 ? "ECFDF5" : "FEF2F2",
            }
        ),
        styleCellText(currencyCode, {
            bold: true,
            align: "center",
            color: "1E1B4B",
            bg: "EEF2FF",
        }),
    ]);

    dashRows.push([]);

    dashRows.push(
        fillMergedBannerRow(
            styleSectionTitle(
                "2. SELECTOR INTERACTIVO DE MES (Cambia la celda amarilla B11 para recalcular todo el bloque)"
            ),
            DASH_COLS,
            "0F172A"
        )
    );

    const optionsListStr = `${allPeriods.join(" | ")} | TODOS`;
    dashRows.push([
        styleCellText("MES A CONSULTAR (EDITABLE):", {
            bold: true,
            color: "92400E",
            bg: "FEF3C7",
        }),
        {
            v: activePeriod,
            t: "s",
            s: {
                fill: { fgColor: { rgb: "FDE68A" } },
                font: { name: "Calibri", sz: 12, bold: true, color: { rgb: "78350F" } },
                alignment: { horizontal: "center", vertical: "center" },
                border: BORDER_ACCENT,
            },
        },
        styleCellText(`Opciones válidas: ${optionsListStr}`, {
            bold: true,
            color: "4F46E5",
            bg: "EEF2FF",
        }),
        styleCellText("Escribe un periodo YYYY-MM o TODOS", { color: "475569", bg: "F8FAFC" }),
        styleCellText("", { bg: "F8FAFC" }),
        styleCellText("", { bg: "F8FAFC" }),
        styleCellText("", { bg: "F8FAFC" }),
        styleCellText("DINÁMICO", {
            bold: true,
            align: "center",
            color: "92400E",
            bg: "FEF3C7",
        }),
    ]);

    const activeMonthTxCount = allTxs.filter((t) => periodOf(t.date) === activePeriod).length;
    const activeMonthSavingsRate =
        summary.totalIncome > 0 ? summary.balance / summary.totalIncome : 0;

    dashRows.push([
        styleTableHeader("Métrica del Periodo Seleccionado"),
        styleTableHeader("Importe / Valor", "right"),
        styleTableHeader("Fórmula Activa Vinculada"),
        styleTableHeader("Indicador del Periodo"),
        styleTableHeader("Resultado", "right"),
        styleTableHeader("Diagnóstico Automático"),
        styleTableHeader("Comparativa", "center"),
        styleTableHeader("Estado Mes", "center"),
    ]);

    dashRows.push([
        styleCellText("Ingresos del Periodo", { bold: true }),
        styleCellMoney(summary.totalIncome / 100, sym, {
            formula:
                'IF($B$11="TODOS",SUMIFS(Movimientos!G:G,Movimientos!D:D,"Ingreso"),SUMIFS(Movimientos!G:G,Movimientos!C:C,$B$11,Movimientos!D:D,"Ingreso"))',
            bold: true,
            color: "059669",
            bg: "ECFDF5",
        }),
        styleCellText("Suma dinámica de ingresos del mes en B11", { color: "64748B" }),
        styleCellText("Nº de Operaciones del Periodo", { bold: true }),
        {
            v: activeMonthTxCount,
            t: "n",
            f: 'IF($B$11="TODOS",COUNTA(Movimientos!A:A)-3,COUNTIF(Movimientos!C:C,$B$11))',
            s: {
                numFmt: "#,##0",
                fill: { fgColor: { rgb: "FFFFFF" } },
                font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "0F172A" } },
                alignment: { horizontal: "right", vertical: "center" },
                border: BORDER_THIN,
            },
        },
        styleCellText("Movimientos contabilizados en el filtro", { color: "64748B" }),
        styleCellText("INGRESOS", {
            bold: true,
            align: "center",
            color: "059669",
            bg: "ECFDF5",
        }),
        styleCellText("OK", {
            bold: true,
            align: "center",
            color: "059669",
            bg: "ECFDF5",
        }),
    ]);

    dashRows.push([
        styleCellText("Gastos del Periodo", { bold: true, bg: "F8FAFC" }),
        styleCellMoney(summary.totalExpenses / 100, sym, {
            formula:
                'IF($B$11="TODOS",SUMIFS(Movimientos!G:G,Movimientos!D:D,"Gasto"),SUMIFS(Movimientos!G:G,Movimientos!C:C,$B$11,Movimientos!D:D,"Gasto"))',
            bold: true,
            color: "DC2626",
            bg: "FEF2F2",
        }),
        styleCellText("Suma dinámica de gastos del mes en B11", { color: "64748B", bg: "F8FAFC" }),
        styleCellText("Tasa de Ahorro del Periodo", { bold: true, bg: "F8FAFC" }),
        styleCellPercent(activeMonthSavingsRate, {
            formula: "IF(B13>0,(B13-B14)/B13,0)",
            bold: true,
            color: activeMonthSavingsRate >= 0 ? "059669" : "DC2626",
            bg: "F8FAFC",
        }),
        styleCellText("Porcentaje de ingresos retenido", { color: "64748B", bg: "F8FAFC" }),
        styleCellText("GASTOS", {
            bold: true,
            align: "center",
            color: "DC2626",
            bg: "FEF2F2",
        }),
        styleCellText("CONTROL", {
            bold: true,
            align: "center",
            color: "D97706",
            bg: "FEF3C7",
        }),
    ]);

    dashRows.push([
        styleCellText("Balance Neto del Periodo", { bold: true, bg: "EEF2FF" }),
        styleCellMoney(summary.balance / 100, sym, {
            formula: "B13-B14",
            bold: true,
            color: summary.balance >= 0 ? "059669" : "DC2626",
            bg: "EEF2FF",
            showPlus: true,
        }),
        styleCellText("Ingresos menos gastos del periodo filtrado", {
            color: "312E81",
            bg: "EEF2FF",
        }),
        styleCellText("Diagnóstico del Periodo", { bold: true, bg: "EEF2FF" }),
        {
            v: summary.balance >= 0 ? "SUPERÁVIT MENSUAL" : "DÉFICIT MENSUAL",
            t: "s",
            f: 'IF(B15>=0,"SUPERÁVIT MENSUAL","DÉFICIT MENSUAL")',
            s: {
                fill: { fgColor: { rgb: summary.balance >= 0 ? "ECFDF5" : "FEF2F2" } },
                font: {
                    name: "Calibri",
                    sz: 10,
                    bold: true,
                    color: { rgb: summary.balance >= 0 ? "059669" : "DC2626" },
                },
                alignment: { horizontal: "center", vertical: "center" },
                border: BORDER_THIN,
            },
        },
        styleCellText("Se compensa con el saldo arrastrado", { color: "312E81", bg: "EEF2FF" }),
        styleCellText("NETO", {
            bold: true,
            align: "center",
            color: "1E1B4B",
            bg: "EEF2FF",
        }),
        styleCellText(summary.balance >= 0 ? "POSITIVO" : "NEGATIVO", {
            bold: true,
            align: "center",
            color: summary.balance >= 0 ? "059669" : "DC2626",
            bg: summary.balance >= 0 ? "ECFDF5" : "FEF2F2",
        }),
    ]);

    dashRows.push([]);

    dashRows.push(
        fillMergedBannerRow(
            styleSectionTitle("3. EVOLUCIÓN HISTÓRICA MES A MES (CON SALDO ARRASTRADO ACUMULADO)"),
            DASH_COLS,
            "0F172A"
        )
    );

    dashRows.push([
        styleTableHeader("Periodo", "center"),
        styleTableHeader("Mes"),
        styleTableHeader(`Ingresos (${sym})`, "right"),
        styleTableHeader(`Gastos (${sym})`, "right"),
        styleTableHeader(`Balance Mes (${sym})`, "right"),
        styleTableHeader(`Saldo Acumulado (${sym})`, "right"),
        styleTableHeader("Ratio Gasto/Ing.", "center"),
        styleTableHeader("Estado Mensual", "center"),
    ]);

    const monthTableStartRow = dashRows.length + 1;
    monthlyStats.forEach((m, idx) => {
        const rowBg = idx % 2 === 0 ? "FFFFFF" : "F8FAFC";
        const expRatio = m.income > 0 ? m.expenses / m.income : m.expenses > 0 ? 1 : 0;
        const bar = buildProgressBar(Math.min(1, expRatio), 10);
        const isSurplus = m.balance >= 0;

        dashRows.push([
            styleCellText(m.period, { bold: true, align: "center", bg: rowBg, color: "4F46E5" }),
            styleCellText(m.label.charAt(0).toUpperCase() + m.label.slice(1), {
                bold: true,
                bg: rowBg,
            }),
            styleCellMoney(m.income, sym, { color: "059669", bg: rowBg }),
            styleCellMoney(m.expenses, sym, { color: "DC2626", bg: rowBg }),
            styleCellMoney(m.balance, sym, {
                bold: true,
                color: isSurplus ? "059669" : "DC2626",
                bg: rowBg,
                showPlus: true,
            }),
            styleCellMoney(m.cumulative, sym, {
                bold: true,
                color: m.cumulative >= 0 ? "1E1B4B" : "DC2626",
                bg: "EEF2FF",
                showPlus: true,
            }),
            styleCellText(`${bar} ${Math.round(expRatio * 100)}%`, {
                align: "center",
                color: expRatio > 1 ? "DC2626" : expRatio > 0.8 ? "D97706" : "059669",
                bg: rowBg,
            }),
            styleCellText(isSurplus ? "▲ SUPERÁVIT" : "▼ DÉFICIT", {
                bold: true,
                align: "center",
                color: isSurplus ? "059669" : "DC2626",
                bg: isSurplus ? "ECFDF5" : "FEF2F2",
            }),
        ]);
    });
    const monthTableEndRow = dashRows.length;

    dashRows.push([
        styleCellText("TOTAL", { bold: true, align: "center", bg: "1E1B4B", color: "FFFFFF" }),
        styleCellText(`${monthlyStats.length} mes(es)`, {
            bold: true,
            bg: "1E1B4B",
            color: "FFFFFF",
        }),
        styleCellMoney(totalHistoricalIncome, sym, {
            formula: `SUM(C${monthTableStartRow}:C${monthTableEndRow})`,
            bold: true,
            color: "10B981",
            bg: "1E1B4B",
        }),
        styleCellMoney(totalHistoricalExpenses, sym, {
            formula: `SUM(D${monthTableStartRow}:D${monthTableEndRow})`,
            bold: true,
            color: "FCA5A5",
            bg: "1E1B4B",
        }),
        styleCellMoney(totalHistoricalBalance, sym, {
            formula: `SUM(E${monthTableStartRow}:E${monthTableEndRow})`,
            bold: true,
            color: "FFFFFF",
            bg: "1E1B4B",
            showPlus: true,
        }),
        styleCellMoney(totalHistoricalBalance, sym, {
            bold: true,
            color: "A5B4FC",
            bg: "1E1B4B",
            showPlus: true,
        }),
        styleCellPercent(
            totalHistoricalIncome > 0 ? totalHistoricalExpenses / totalHistoricalIncome : 0,
            {
                bold: true,
                color: "FFFFFF",
                bg: "1E1B4B",
            }
        ),
        styleCellText(" CONSOLIDADO", {
            bold: true,
            align: "center",
            color: "FFFFFF",
            bg: "1E1B4B",
        }),
    ]);

    dashRows.push([]);

    dashRows.push(
        fillMergedBannerRow(
            styleSectionTitle(
                "4. RANKING DE GASTOS POR CATEGORÍA (COLUMNA C VINCULADA AL SELECTOR DE MES B11)"
            ),
            DASH_COLS,
            "0F172A"
        )
    );

    dashRows.push([
        styleTableHeader("#", "center"),
        styleTableHeader("Categoría de Gasto"),
        styleTableHeader(`Gasto Mes en B11 (${sym})`, "right"),
        styleTableHeader(`Gasto Histórico (${sym})`, "right"),
        styleTableHeader("Nº Operaciones", "right"),
        styleTableHeader(`Ticket Medio (${sym})`, "right"),
        styleTableHeader("% Peso s/ Total", "right"),
        styleTableHeader("Distribución Visual", "left"),
    ]);

    categoryRanking.forEach((cat, idx) => {
        const rowNum = dashRows.length + 1;
        const rowBg = idx % 2 === 0 ? "FFFFFF" : "F8FAFC";
        const totalCatEuros = cat.totalExpenseCents / 100;
        const activeCatEuros = cat.activeMonthExpenseCents / 100;
        const avgTicket = cat.txCount > 0 ? totalCatEuros / cat.txCount : 0;
        const share =
            totalHistoricalExpenses > 0 ? totalCatEuros / totalHistoricalExpenses : 0;
        const bar = buildProgressBar(share, 12);

        dashRows.push([
            styleCellText(idx + 1, { bold: true, align: "center", bg: rowBg, color: "64748B" }),
            styleCellText(cat.name, { bold: true, bg: rowBg }),
            styleCellMoney(activeCatEuros, sym, {
                formula: `IF($B$11="TODOS",SUMIFS(Movimientos!G:G,Movimientos!D:D,"Gasto",Movimientos!E:E,B${rowNum}),SUMIFS(Movimientos!G:G,Movimientos!C:C,$B$11,Movimientos!D:D,"Gasto",Movimientos!E:E,B${rowNum}))`,
                bold: true,
                color: "4F46E5",
                bg: "EEF2FF",
            }),
            styleCellMoney(totalCatEuros, sym, { bold: true, color: "DC2626", bg: rowBg }),
            styleCellText(cat.txCount, { align: "right", bg: rowBg }),
            styleCellMoney(avgTicket, sym, { bg: rowBg, color: "475569" }),
            styleCellPercent(share, { bold: true, bg: rowBg, color: "0F172A" }),
            styleCellText(`${bar} ${(share * 100).toFixed(1)}%`, {
                color: share >= 0.25 ? "DC2626" : share >= 0.12 ? "D97706" : "4F46E5",
                bg: rowBg,
            }),
        ]);
    });

    const wsDashboard = XLSX.utils.aoa_to_sheet(dashRows);
    wsDashboard["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: DASH_COLS - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: DASH_COLS - 1 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: DASH_COLS - 1 } },
        { s: { r: 9, c: 0 }, e: { r: 9, c: DASH_COLS - 1 } },
        { s: { r: 16, c: 0 }, e: { r: 16, c: DASH_COLS - 1 } },
        {
            s: { r: 19 + monthlyStats.length + 1, c: 0 },
            e: { r: 19 + monthlyStats.length + 1, c: DASH_COLS - 1 },
        },
    ];
    wsDashboard["!cols"] = [
        { wch: 30 },
        { wch: 22 },
        { wch: 34 },
        { wch: 28 },
        { wch: 20 },
        { wch: 26 },
        { wch: 22 },
        { wch: 18 },
    ];
    wsDashboard["!rows"] = [{ hpt: 32 }, { hpt: 22 }, { hpt: 10 }, { hpt: 24 }, { hpt: 24 }];
    XLSX.utils.book_append_sheet(wb, wsDashboard, "Dashboard Ejecutivo");

    const MOV_COLS = 9;
    const chronologicalTxs = [...allTxs].reverse();
    let runningTxBalanceCents = 0;
    const txRunningMap = new Map<string, number>();
    chronologicalTxs.forEach((tx) => {
        runningTxBalanceCents += tx.type === "income" ? tx.amount : -tx.amount;
        txRunningMap.set(tx.id, runningTxBalanceCents);
    });

    const movRows: any[][] = [];
    movRows.push(
        fillMergedBannerRow(
            styleHeaderBanner("LIBRO MAYOR DE MOVIMIENTOS · HISTORIAL COMPLETO AUDITADO"),
            MOV_COLS,
            "1E1B4B"
        )
    );
    movRows.push(
        fillMergedBannerRow(
            styleSubtitleBanner(
                `Total operaciones: ${allTxs.length}  |  Ingresos acumulados: ${formatMoney(totalHistoricalIncome * 100)}  |  Gastos acumulados: ${formatMoney(totalHistoricalExpenses * 100)}`
            ),
            MOV_COLS,
            "312E81"
        )
    );
    movRows.push([
        styleTableHeader("#", "center"),
        styleTableHeader("Fecha", "center"),
        styleTableHeader("Periodo", "center"),
        styleTableHeader("Tipo", "center"),
        styleTableHeader("Categoría"),
        styleTableHeader("Concepto / Nota"),
        styleTableHeader(`Importe Abs. (${sym})`, "right"),
        styleTableHeader(`Impacto Neto (${sym})`, "right"),
        styleTableHeader(`Saldo Post-Op (${sym})`, "right"),
    ]);

    allTxs.forEach((tx, idx) => {
        const isIncome = tx.type === "income";
        const rowBg = idx % 2 === 0 ? "FFFFFF" : "F8FAFC";
        const amountEuros = tx.amount / 100;
        const signedEuros = isIncome ? amountEuros : -amountEuros;
        const postBalanceEuros = (txRunningMap.get(tx.id) ?? 0) / 100;

        movRows.push([
            styleCellText(allTxs.length - idx, {
                align: "center",
                color: "64748B",
                bg: rowBg,
            }),
            styleCellText(formatDate(tx.date), { align: "center", bg: rowBg }),
            styleCellText(periodOf(tx.date), {
                bold: true,
                align: "center",
                color: "4F46E5",
                bg: rowBg,
            }),
            styleCellText(isIncome ? "Ingreso" : "Gasto", {
                bold: true,
                align: "center",
                color: isIncome ? "059669" : "DC2626",
                bg: isIncome ? "ECFDF5" : "FEF2F2",
            }),
            styleCellText(tx.category?.name || "Sin categoría", {
                bold: true,
                bg: rowBg,
            }),
            styleCellText(tx.note?.trim() || "—", { bg: rowBg, color: "334155" }),
            styleCellMoney(amountEuros, sym, {
                bold: true,
                color: "0F172A",
                bg: rowBg,
            }),
            styleCellMoney(signedEuros, sym, {
                bold: true,
                color: isIncome ? "059669" : "DC2626",
                bg: isIncome ? "ECFDF5" : "FEF2F2",
                showPlus: true,
            }),
            styleCellMoney(postBalanceEuros, sym, {
                bold: true,
                color: postBalanceEuros >= 0 ? "1E1B4B" : "DC2626",
                bg: "EEF2FF",
                showPlus: true,
            }),
        ]);
    });

    if (allTxs.length > 0) {
        const lastTxRow = movRows.length;
        movRows.push([
            styleCellText("", { bg: "1E1B4B" }),
            styleCellText("TOTALES", { bold: true, align: "center", bg: "1E1B4B", color: "FFFFFF" }),
            styleCellText(`${allPeriods.length} mes(es)`, {
                bold: true,
                align: "center",
                bg: "1E1B4B",
                color: "A5B4FC",
            }),
            styleCellText(`${allTxs.length} ops`, {
                bold: true,
                align: "center",
                bg: "1E1B4B",
                color: "FFFFFF",
            }),
            styleCellText(" Flujo Acumulado", { bold: true, bg: "1E1B4B", color: "FFFFFF" }),
            styleCellText("", { bg: "1E1B4B" }),
            styleCellMoney(totalHistoricalIncome + totalHistoricalExpenses, sym, {
                formula: `SUM(G4:G${lastTxRow})`,
                bold: true,
                color: "E0E7FF",
                bg: "1E1B4B",
            }),
            styleCellMoney(totalHistoricalBalance, sym, {
                formula: `SUM(H4:H${lastTxRow})`,
                bold: true,
                color: "10B981",
                bg: "1E1B4B",
                showPlus: true,
            }),
            styleCellMoney(totalHistoricalBalance, sym, {
                bold: true,
                color: "FFFFFF",
                bg: "1E1B4B",
                showPlus: true,
            }),
        ]);
    }

    const wsMovimientos = XLSX.utils.aoa_to_sheet(movRows);
    wsMovimientos["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: MOV_COLS - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: MOV_COLS - 1 } },
    ];
    wsMovimientos["!cols"] = [
        { wch: 7 },
        { wch: 15 },
        { wch: 12 },
        { wch: 12 },
        { wch: 24 },
        { wch: 34 },
        { wch: 18 },
        { wch: 18 },
        { wch: 20 },
    ];
    wsMovimientos["!rows"] = [{ hpt: 30 }, { hpt: 20 }, { hpt: 24 }];
    XLSX.utils.book_append_sheet(wb, wsMovimientos, "Movimientos");

    const matrixCols = 1 + chronologicalPeriods.length + 4;
    const matrixRows: any[][] = [];
    matrixRows.push(
        fillMergedBannerRow(
            styleHeaderBanner("MATRIZ ANALÍTICA · GASTOS POR CATEGORÍA MES A MES"),
            matrixCols,
            "1E1B4B"
        )
    );
    matrixRows.push(
        fillMergedBannerRow(
            styleSubtitleBanner(
                "Comparativa evolutiva de cada partida de gasto a lo largo de todos los meses registrados"
            ),
            matrixCols,
            "312E81"
        )
    );

    const matrixHeaderRow = [
        styleTableHeader("Categoría de Gasto"),
        ...chronologicalPeriods.map((p) => styleTableHeader(formatPeriod(p), "right")),
        styleTableHeader(`Total (${sym})`, "right"),
        styleTableHeader(`Media / Mes (${sym})`, "right"),
        styleTableHeader("% Peso", "right"),
        styleTableHeader("Impacto Visual", "left"),
    ];
    matrixRows.push(matrixHeaderRow);

    categoryRanking.forEach((cat, idx) => {
        const rowBg = idx % 2 === 0 ? "FFFFFF" : "F8FAFC";
        const totalEuros = cat.totalExpenseCents / 100;
        const avgEuros =
            chronologicalPeriods.length > 0 ? totalEuros / chronologicalPeriods.length : 0;
        const share =
            totalHistoricalExpenses > 0 ? totalEuros / totalHistoricalExpenses : 0;

        matrixRows.push([
            styleCellText(cat.name, { bold: true, bg: rowBg }),
            ...chronologicalPeriods.map((p) => {
                const val = (cat.byPeriod.get(p) ?? 0) / 100;
                return styleCellMoney(val, sym, {
                    bg: rowBg,
                    color: val > 0 ? "0F172A" : "94A3B8",
                });
            }),
            styleCellMoney(totalEuros, sym, {
                bold: true,
                color: "DC2626",
                bg: "FEF2F2",
            }),
            styleCellMoney(avgEuros, sym, {
                bold: true,
                color: "4F46E5",
                bg: "EEF2FF",
            }),
            styleCellPercent(share, { bold: true, bg: rowBg }),
            styleCellText(`${buildProgressBar(share, 10)} ${(share * 100).toFixed(1)}%`, {
                color: "4F46E5",
                bg: rowBg,
            }),
        ]);
    });

    const wsMatrix = XLSX.utils.aoa_to_sheet(matrixRows);
    wsMatrix["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: matrixCols - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: matrixCols - 1 } },
    ];
    wsMatrix["!cols"] = [
        { wch: 26 },
        ...chronologicalPeriods.map(() => ({ wch: 18 })),
        { wch: 18 },
        { wch: 18 },
        { wch: 12 },
        { wch: 22 },
    ];
    wsMatrix["!rows"] = [{ hpt: 30 }, { hpt: 20 }, { hpt: 24 }];
    XLSX.utils.book_append_sheet(wb, wsMatrix, "Categorías x Mes");

    const BUD_COLS = 7;
    const budgetRows: any[][] = [];
    budgetRows.push(
        fillMergedBannerRow(
            styleHeaderBanner(`CONTROL DE PRESUPUESTOS Y LÍMITES · ${periodTitle.toUpperCase()}`),
            BUD_COLS,
            "1E1B4B"
        )
    );
    budgetRows.push(
        fillMergedBannerRow(
            styleSubtitleBanner(
                "Seguimiento de sobres de gasto configurados y desglose de consumo mensual por partida"
            ),
            BUD_COLS,
            "312E81"
        )
    );
    budgetRows.push([
        styleTableHeader("Sobre / Categoría"),
        styleTableHeader(`Límite Mensual (${sym})`, "right"),
        styleTableHeader(`Gastado (${sym})`, "right"),
        styleTableHeader(`Disponible (${sym})`, "right"),
        styleTableHeader("% Consumo", "right"),
        styleTableHeader("Barra de Consumo", "left"),
        styleTableHeader("Estado", "center"),
    ]);

    const allBudgetItems = [
        ...(budgetsOverview.globalBudget ? [budgetsOverview.globalBudget] : []),
        ...budgetsOverview.categoryBudgets,
    ];

    if (allBudgetItems.length > 0) {
        allBudgetItems.forEach((b, idx) => {
            const rowBg = idx % 2 === 0 ? "FFFFFF" : "F8FAFC";
            const ratio = b.percentage / 100;
            const statusLabel =
                b.status === "ok" ? "EN REGLA" : b.status === "warn" ? "ALERTA >80%" : "EXCEDIDO";
            const statusColor =
                b.status === "ok" ? "059669" : b.status === "warn" ? "D97706" : "DC2626";
            const statusBg =
                b.status === "ok" ? "ECFDF5" : b.status === "warn" ? "FEF3C7" : "FEF2F2";

            budgetRows.push([
                styleCellText(
                    `${b.categoryIcon || ""} ${b.categoryName || "Presupuesto Global"}`.trim(),
                    { bold: true, bg: rowBg }
                ),
                styleCellMoney(b.limitAmount / 100, sym, { bold: true, bg: rowBg }),
                styleCellMoney(b.spentAmount / 100, sym, {
                    bold: true,
                    color: "DC2626",
                    bg: rowBg,
                }),
                styleCellMoney(b.remainingAmount / 100, sym, {
                    bold: true,
                    color: b.remainingAmount >= 0 ? "059669" : "DC2626",
                    bg: rowBg,
                    showPlus: true,
                }),
                styleCellPercent(ratio, { bold: true, color: statusColor, bg: rowBg }),
                styleCellText(buildProgressBar(ratio, 12), { color: statusColor, bg: rowBg }),
                styleCellText(statusLabel, {
                    bold: true,
                    align: "center",
                    color: statusColor,
                    bg: statusBg,
                }),
            ]);
        });
    } else {
        categoryRanking
            .filter((c) => c.activeMonthExpenseCents > 0)
            .forEach((cat, idx) => {
                const rowBg = idx % 2 === 0 ? "FFFFFF" : "F8FAFC";
                const spentEuros = cat.activeMonthExpenseCents / 100;
                const monthTotalExp = summary.totalExpenses / 100;
                const share = monthTotalExp > 0 ? spentEuros / monthTotalExp : 0;

                budgetRows.push([
                    styleCellText(cat.name, { bold: true, bg: rowBg }),
                    styleCellText("Sin límite fijado", {
                        align: "right",
                        color: "64748B",
                        bg: rowBg,
                    }),
                    styleCellMoney(spentEuros, sym, {
                        bold: true,
                        color: "DC2626",
                        bg: rowBg,
                    }),
                    styleCellText("—", { align: "right", color: "64748B", bg: rowBg }),
                    styleCellPercent(share, { bold: true, bg: rowBg, color: "4F46E5" }),
                    styleCellText(`${buildProgressBar(share, 12)} s/ mes`, {
                        color: "4F46E5",
                        bg: rowBg,
                    }),
                    styleCellText("SIN TOPE", {
                        bold: true,
                        align: "center",
                        color: "4F46E5",
                        bg: "EEF2FF",
                    }),
                ]);
            });
    }

    const wsPresupuestos = XLSX.utils.aoa_to_sheet(budgetRows);
    wsPresupuestos["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: BUD_COLS - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: BUD_COLS - 1 } },
    ];
    wsPresupuestos["!cols"] = [
        { wch: 28 },
        { wch: 20 },
        { wch: 18 },
        { wch: 18 },
        { wch: 14 },
        { wch: 20 },
        { wch: 16 },
    ];
    wsPresupuestos["!rows"] = [{ hpt: 30 }, { hpt: 20 }, { hpt: 24 }];
    XLSX.utils.book_append_sheet(wb, wsPresupuestos, "Presupuestos");

    const GOAL_COLS = 7;
    const goalRows: any[][] = [];
    goalRows.push(
        fillMergedBannerRow(
            styleHeaderBanner("HUCHAS DE AHORRO Y METAS FINANCIERAS"),
            GOAL_COLS,
            "1E1B4B"
        )
    );
    goalRows.push(
        fillMergedBannerRow(
            styleSubtitleBanner(
                `Huchas activas: ${goals.length}  |  Total acumulado en huchas: ${formatMoney(totalSavedInGoals * 100)}`
            ),
            GOAL_COLS,
            "312E81"
        )
    );
    goalRows.push([
        styleTableHeader("Hucha / Meta de Ahorro"),
        styleTableHeader(`Capital Ahorrado (${sym})`, "right"),
        styleTableHeader(`Objetivo Meta (${sym})`, "right"),
        styleTableHeader(`Importe Restante (${sym})`, "right"),
        styleTableHeader("% Completado", "right"),
        styleTableHeader("Progreso Visual", "left"),
        styleTableHeader("Estado", "center"),
    ]);

    goals.forEach((g, idx) => {
        const rowBg = idx % 2 === 0 ? "FFFFFF" : "F8FAFC";
        const savedEuros = g.savedAmount / 100;
        const targetEuros = g.targetAmount ? g.targetAmount / 100 : null;
        const remainingEuros = g.remainingAmount !== null ? g.remainingAmount / 100 : 0;
        const ratio = g.percentage !== null ? g.percentage / 100 : 0;

        goalRows.push([
            styleCellText(`${g.icon || "💰"} ${g.name}`.trim(), { bold: true, bg: rowBg }),
            styleCellMoney(savedEuros, sym, {
                bold: true,
                color: savedEuros > 0 ? "059669" : "475569",
                bg: savedEuros > 0 ? "ECFDF5" : rowBg,
            }),
            targetEuros !== null
                ? styleCellMoney(targetEuros, sym, { bold: true, bg: rowBg })
                : styleCellText("Abierta (Sin límite)", {
                      align: "right",
                      color: "4F46E5",
                      bg: rowBg,
                  }),
            targetEuros !== null
                ? styleCellMoney(remainingEuros, sym, { color: "475569", bg: rowBg })
                : styleCellText("—", { align: "right", color: "94A3B8", bg: rowBg }),
            g.percentage !== null
                ? styleCellPercent(ratio, { bold: true, color: "4F46E5", bg: rowBg })
                : styleCellText("LIBRE", {
                      bold: true,
                      align: "right",
                      color: "4F46E5",
                      bg: rowBg,
                  }),
            styleCellText(
                g.percentage !== null
                    ? `${buildProgressBar(ratio, 12)} ${Math.round(g.percentage)}%`
                    : "████████████ Ahorro libre",
                {
                    color: g.isCompleted ? "059669" : "4F46E5",
                    bg: rowBg,
                }
            ),
            styleCellText(
                g.isCompleted
                    ? "★ COMPLETADA"
                    : savedEuros > 0
                      ? "EN PROGRESO"
                      : "PENDIENTE",
                {
                    bold: true,
                    align: "center",
                    color: g.isCompleted ? "059669" : savedEuros > 0 ? "4F46E5" : "64748B",
                    bg: g.isCompleted ? "ECFDF5" : savedEuros > 0 ? "EEF2FF" : "F1F5F9",
                }
            ),
        ]);
    });

    const wsHuchas = XLSX.utils.aoa_to_sheet(goalRows);
    wsHuchas["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: GOAL_COLS - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: GOAL_COLS - 1 } },
    ];
    wsHuchas["!cols"] = [
        { wch: 26 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 15 },
        { wch: 26 },
        { wch: 16 },
    ];
    wsHuchas["!rows"] = [{ hpt: 30 }, { hpt: 20 }, { hpt: 24 }];
    XLSX.utils.book_append_sheet(wb, wsHuchas, "Huchas");

    const base64String = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

    return sendEmailViaSupabase({
        to: toEmail,
        subject: `Informe Financiero Ejecutivo Nummo · ${periodTitle}`,
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8FAFC; padding: 24px; color: #0F172A;">
          <div style="max-width: 560px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0;">
            <div style="background-color: #1E1B4B; padding: 24px; text-align: center;">
              <h1 style="color: #FFFFFF; margin: 0; font-size: 22px;">Nummo</h1>
              <p style="color: #A5B4FC; margin: 4px 0 0 0; font-size: 13px;">Informe Financiero Ejecutivo</p>
            </div>
            <div style="padding: 28px;">
              <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-top: 0;">
                Adjunto encontrarás tu <strong>Informe Financiero Ejecutivo (.xlsx)</strong> con diseño profesional y 5 hojas analíticas:
              </p>
              <ul style="font-size: 14px; line-height: 1.8; color: #475569; padding-left: 20px;">
                <li><strong>Dashboard Ejecutivo</strong>: KPIs globales, selector dinámico de mes (celda amarilla B11), evolución mensual con saldo arrastrado y ranking de categorías.</li>
                <li><strong>Movimientos</strong>: Libro mayor completo con saldo acumulado tras cada operación.</li>
                <li><strong>Categorías x Mes</strong>: Matriz comparativa mes a mes por partida de gasto.</li>
                <li><strong>Presupuestos</strong>: Estado de límites y distribución mensual.</li>
                <li><strong>Huchas</strong>: Progreso de tus metas de ahorro.</li>
              </ul>
            </div>
          </div>
        </body>
        </html>
        `,
        attachments: [{ filename: `informe_nummo_ejecutivo_${activePeriod}.xlsx`, content: base64String }],
    });
}
