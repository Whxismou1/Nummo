import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getMonthSummary } from "@/features/transactions/repository";
import { getMonthBudgetsOverview } from "@/features/budgets/repository";
import { getGoalsWithProgress } from "@/features/goals/repository";
import { getAllTransactionsForExport } from "@/features/transactions/repository";
import { currentPeriod, formatPeriod, formatDate } from "@/lib/date";
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
    const period = currentPeriod();
    const periodTitle = formatPeriod(period);

    const [summary, budgetsOverview, goals, allTxs] = await Promise.all([
        getMonthSummary(period),
        getMonthBudgetsOverview(period),
        getGoalsWithProgress(),
        getAllTransactionsForExport(),
    ]);

    const wb = XLSX.utils.book_new();

    const wsResumen = XLSX.utils.aoa_to_sheet([
        ["INFORME FINANCIERO NUMMO"],
        [`Periodo: ${periodTitle}`],
        [],
        ["Concepto", "Importe"],
        ["Ingresos totales", formatMoney(summary.totalIncome)],
        ["Gastos totales", formatMoney(summary.totalExpenses)],
        ["Balance", formatMoney(summary.balance)],
        [],
        ["Total presupuestado", formatMoney(budgetsOverview.totalBudgeted)],
        ["Total gastado (presupuestos)", formatMoney(budgetsOverview.totalSpent)]
    ]);
    wsResumen["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
    wsResumen["!cols"] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

    const txData = [
        ["Fecha", "Tipo", "Categoría", "Nota", "Importe"],
        ...allTxs.map(tx => [
            formatDate(tx.date),
            tx.type === "income" ? "Ingreso" : "Gasto",
            tx.category?.name || "Sin categoría",
            tx.note || "-",
            (tx.type === "expense" ? "-" : "") + formatMoney(tx.amount)
        ])
    ];
    const wsMovimientos = XLSX.utils.aoa_to_sheet(txData);
    wsMovimientos["!cols"] = [{ wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 30 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsMovimientos, "Movimientos");

    const budgetsData = [
        ["Categoría", "Límite", "Gastado", "Restante", "% Uso", "Estado"]
    ];
    if (budgetsOverview.globalBudget) {
        const gb = budgetsOverview.globalBudget;
        budgetsData.push([
            "Presupuesto Global",
            formatMoney(gb.limitAmount),
            formatMoney(gb.spentAmount),
            formatMoney(gb.remainingAmount),
            `${Math.round(gb.percentage)}%`,
            gb.status === "ok" ? "OK" : gb.status === "warn" ? "Alerta" : "Excedido"
        ]);
    }
    budgetsOverview.categoryBudgets.forEach(b => {
        budgetsData.push([
            `${b.categoryIcon || ''} ${b.categoryName || 'Global'}`.trim(),
            formatMoney(b.limitAmount),
            formatMoney(b.spentAmount),
            formatMoney(b.remainingAmount),
            `${Math.round(b.percentage)}%`,
            b.status === "ok" ? "OK" : b.status === "warn" ? "Alerta" : "Excedido"
        ]);
    });
    const wsPresupuestos = XLSX.utils.aoa_to_sheet(budgetsData);
    wsPresupuestos["!cols"] = [{ wch: 25 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsPresupuestos, "Presupuestos");

    const goalsData = [
        ["Nombre", "Ahorrado", "Meta", "Restante", "% Completado", "Estado"],
        ...goals.map(g => [
            `${g.icon || ''} ${g.name}`.trim(),
            formatMoney(g.savedAmount),
            g.targetAmount ? formatMoney(g.targetAmount) : "Sin límite",
            g.remainingAmount !== null ? formatMoney(g.remainingAmount) : "0",
            g.percentage !== null ? `${Math.round(g.percentage)}%` : "∞",
            g.isCompleted ? "Completada" : "En progreso"
        ])
    ];
    const wsHuchas = XLSX.utils.aoa_to_sheet(goalsData);
    wsHuchas["!cols"] = [{ wch: 25 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsHuchas, "Huchas");

    const base64String = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    return sendEmailViaSupabase({
        to: toEmail,
        subject: `Informe Financiero Nummo - ${periodTitle}`,
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: sans-serif; padding: 24px; color: #0F172A;">
          <h2>Nummo</h2>
          <p>Adjunto encontrarás tu informe financiero mensual de Nummo.</p>
        </body>
        </html>
        `,
        attachments: [{ filename: `informe_nummo_${period}.xlsx`, content: base64String }]
    });
}
