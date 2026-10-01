import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getMonthSummary } from "@/features/transactions/repository";
import { getMonthBudgetsOverview } from "@/features/budgets/repository";
import { getGoalsWithProgress } from "@/features/goals/repository";
import { getAllTransactionsForExport } from "@/features/transactions/repository";
import { currentPeriod, formatPeriod, formatDate, periodOf } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { getAppSetting } from "@/features/settings/SettingsContext";
import * as XLSX from "xlsx";

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

        const { data, error } = await supabase.functions.invoke("send-email", {
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

export async function sendComprehensiveFinancialReport(toEmail: string): Promise<{ ok: boolean; error?: string }> {
    const activePeriod = currentPeriod();
    const periodTitle = formatPeriod(activePeriod);

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

    const monthlyStats: {
        period: string;
        label: string;
        income: number;
        expenses: number;
        balance: number;
        cumulative: number;
    }[] = [];

    const chronologicalPeriods = [...allPeriods].reverse();
    let runningCumulative = 0;
    const periodCumulativeMap = new Map<string, number>();

    chronologicalPeriods.forEach((p) => {
        const inc = allTxs
            .filter((t) => periodOf(t.date) === p && t.type === "income")
            .reduce((sum, t) => sum + t.amount, 0);
        const exp = allTxs
            .filter((t) => periodOf(t.date) === p && t.type === "expense")
            .reduce((sum, t) => sum + t.amount, 0);
        const bal = inc - exp;
        runningCumulative += bal;
        periodCumulativeMap.set(p, runningCumulative);
    });

    allPeriods.forEach((p) => {
        const inc = allTxs
            .filter((t) => periodOf(t.date) === p && t.type === "income")
            .reduce((sum, t) => sum + t.amount, 0);
        const exp = allTxs
            .filter((t) => periodOf(t.date) === p && t.type === "expense")
            .reduce((sum, t) => sum + t.amount, 0);
        const bal = inc - exp;
        monthlyStats.push({
            period: p,
            label: formatPeriod(p),
            income: inc / 100,
            expenses: exp / 100,
            balance: bal / 100,
            cumulative: (periodCumulativeMap.get(p) ?? 0) / 100,
        });
    });

    const wb = XLSX.utils.book_new();

    const optionsText = `(Opciones: ${allPeriods.join(", ")} o TODOS)`;
    const dashboardRows: any[] = [
        ["INFORME FINANCIERO NUMMO"],
        ["Control mensual, historial completo y fórmulas dinámicas"],
        [],
        ["SELECTOR DINÁMICO DE MES"],
        ["Mes a consultar:", activePeriod, optionsText],
        [
            "Ingresos del periodo (€):",
            {
                t: "n",
                f: 'IF($B$5="TODOS",SUMIFS(Movimientos!F:F,Movimientos!C:C,"Ingreso"),SUMIFS(Movimientos!F:F,Movimientos!B:B,$B$5,Movimientos!C:C,"Ingreso"))',
                v: summary.totalIncome / 100,
            },
        ],
        [
            "Gastos del periodo (€):",
            {
                t: "n",
                f: 'IF($B$5="TODOS",SUMIFS(Movimientos!F:F,Movimientos!C:C,"Gasto"),SUMIFS(Movimientos!F:F,Movimientos!B:B,$B$5,Movimientos!C:C,"Gasto"))',
                v: summary.totalExpenses / 100,
            },
        ],
        ["Balance del periodo (€):", { t: "n", f: "B6-B7", v: summary.balance / 100 }],
        [],
        ["HISTORIAL COMPLETO DE TODOS LOS MESES"],
        ["Periodo", "Mes", "Ingresos (€)", "Gastos (€)", "Balance (€)", "Saldo Acumulado (€)"],
        ...monthlyStats.map((m) => [m.period, m.label, m.income, m.expenses, m.balance, m.cumulative]),
    ];

    const wsDashboard = XLSX.utils.aoa_to_sheet(dashboardRows);
    wsDashboard["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } },
        { s: { r: 9, c: 0 }, e: { r: 9, c: 5 } },
    ];
    wsDashboard["!cols"] = [
        { wch: 28 },
        { wch: 20 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDashboard, "Dashboard & Meses");

    const txData = [
        ["Fecha", "Periodo", "Tipo", "Categoría", "Nota", "Importe (€)", "Detalle"],
        ...allTxs.map((tx) => [
            formatDate(tx.date),
            periodOf(tx.date),
            tx.type === "income" ? "Ingreso" : "Gasto",
            tx.category?.name || "Sin categoría",
            tx.note || "-",
            tx.amount / 100,
            (tx.type === "expense" ? "-" : "+") + formatMoney(tx.amount),
        ]),
    ];
    const wsMovimientos = XLSX.utils.aoa_to_sheet(txData);
    wsMovimientos["!cols"] = [
        { wch: 16 },
        { wch: 12 },
        { wch: 12 },
        { wch: 20 },
        { wch: 30 },
        { wch: 15 },
        { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, wsMovimientos, "Movimientos");

    const budgetsData = [["Categoría", "Límite", "Gastado", "Restante", "% Uso", "Estado"]];
    if (budgetsOverview.globalBudget) {
        const gb = budgetsOverview.globalBudget;
        budgetsData.push([
            "Presupuesto Global",
            formatMoney(gb.limitAmount),
            formatMoney(gb.spentAmount),
            formatMoney(gb.remainingAmount),
            `${Math.round(gb.percentage)}%`,
            gb.status === "ok" ? "OK" : gb.status === "warn" ? "Alerta" : "Excedido",
        ]);
    }
    budgetsOverview.categoryBudgets.forEach((b) => {
        budgetsData.push([
            `${b.categoryIcon || ""} ${b.categoryName || "Global"}`.trim(),
            formatMoney(b.limitAmount),
            formatMoney(b.spentAmount),
            formatMoney(b.remainingAmount),
            `${Math.round(b.percentage)}%`,
            b.status === "ok" ? "OK" : b.status === "warn" ? "Alerta" : "Excedido",
        ]);
    });
    const wsPresupuestos = XLSX.utils.aoa_to_sheet(budgetsData);
    wsPresupuestos["!cols"] = [
        { wch: 25 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 12 },
        { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsPresupuestos, "Presupuestos");

    const goalsData = [
        ["Nombre", "Ahorrado", "Meta", "Restante", "% Completado", "Estado"],
        ...goals.map((g) => [
            `${g.icon || ""} ${g.name}`.trim(),
            formatMoney(g.savedAmount),
            g.targetAmount ? formatMoney(g.targetAmount) : "Sin límite",
            g.remainingAmount !== null ? formatMoney(g.remainingAmount) : "0",
            g.percentage !== null ? `${Math.round(g.percentage)}%` : "∞",
            g.isCompleted ? "Completada" : "En progreso",
        ]),
    ];
    const wsHuchas = XLSX.utils.aoa_to_sheet(goalsData);
    wsHuchas["!cols"] = [
        { wch: 25 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, wsHuchas, "Huchas");

    const base64String = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

    return sendEmailViaSupabase({
        to: toEmail,
        subject: `Informe Financiero Nummo - Historial Completo`,
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: sans-serif; padding: 24px; color: #0F172A;">
          <h2>Nummo</h2>
          <p>Adjunto encontrarás tu informe financiero completo en Excel con selector dinámico de meses y desglose histórico.</p>
        </body>
        </html>
        `,
        attachments: [{ filename: `informe_nummo_completo.xlsx`, content: base64String }],
    });
}
