import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getMonthSummary } from "@/features/transactions/repository";
import { getMonthBudgetsOverview } from "@/features/budgets/repository";
import { getGoalsWithProgress } from "@/features/goals/repository";
import { getAllTransactionsForExport } from "@/features/transactions/repository";
import { currentPeriod, formatPeriod, formatDate } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { getAppSetting } from "@/features/settings/SettingsContext";

export interface AlertEmailPayload {
    to: string;
    subject: string;
    title: string;
    message: string;
    badgeType?: "danger" | "warning" | "success" | "info";
    details?: { label: string; value: string }[];
}

/**
 * Sends an email notification using Supabase Edge Function (powered by Resend)
 */
export async function sendEmailViaSupabase(payload: {
    to: string;
    subject: string;
    html: string;
}): Promise<{ ok: boolean; error?: string }> {
    // We invoke the server-side Supabase Edge Function so the Resend Secret Key
    // NEVER enters the APK or client bundle (100% secure in the cloud vault).
    try {
        if (!isSupabaseConfigured()) {
            console.warn("[Notifications] Supabase no está configurado.");
            return { ok: false, error: "Supabase no está configurado." };
        }

        const { data, error } = await supabase.functions.invoke("send-email", {
            body: payload,
        });

        if (error) {
            console.warn("[Notifications] Edge function error:", error);
            return { ok: false, error: error.message };
        }

        return { ok: true };
    } catch (e: any) {
        console.warn("[Notifications] Error invoking send-email:", e);
        return { ok: false, error: e?.message || "Error al enviar correo" };
    }
}

/**
 * Sends a single alert email (e.g. Budget Exceeded or Goal Completed)
 */
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

/**
 * Generates and sends a comprehensive, beautiful HTML Financial Report with charts & tables
 */
export async function sendComprehensiveFinancialReport(toEmail: string): Promise<{ ok: boolean; error?: string }> {
    const period = currentPeriod();
    const periodTitle = formatPeriod(period);

    // Fetch financial data in parallel
    const [summary, budgetsOverview, goals, allTxs] = await Promise.all([
        getMonthSummary(period),
        getMonthBudgetsOverview(period),
        getGoalsWithProgress(),
        getAllTransactionsForExport(),
    ]);

    const formattedIncome = formatMoney(summary.totalIncome);
    const formattedExpenses = formatMoney(summary.totalExpenses);
    const formattedBalance = formatMoney(summary.balance);
    const isDeficit = summary.balance < 0;

    // Budgets rows
    const budgetsHtml =
        budgetsOverview.categoryBudgets.length > 0
            ? budgetsOverview.categoryBudgets
                  .map((b) => {
                      const pct = Math.min(Math.round(b.percentage), 100);
                      const barColor = b.status === "over" ? "#EF4444" : b.status === "warn" ? "#F59E0B" : "#10B981";
                      return `
            <div style="margin-bottom: 14px; padding: 12px; background: #F8FAFC; border-radius: 10px; border: 1px solid #E2E8F0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-weight: 600; color: #1E293B; font-size: 14px;">${b.categoryIcon || "🏷️"} ${b.categoryName || "Sobre"}</span>
                <span style="font-size: 13px; font-weight: bold; color: ${barColor};">${formatMoney(b.spentAmount)} / ${formatMoney(b.limitAmount)} (${Math.round(b.percentage)}%)</span>
              </div>
              <div style="background: #E2E8F0; height: 8px; border-radius: 4px; overflow: hidden;">
                <div style="background: ${barColor}; height: 8px; width: ${pct}%;"></div>
              </div>
            </div>`;
                  })
                  .join("")
            : `<p style="color: #64748B; font-size: 14px; font-style: italic;">No tienes sobres de gasto configurados en este periodo.</p>`;

    // Goals rows
    const goalsHtml =
        goals.length > 0
            ? goals
                  .map((g) => {
                      const pct = g.percentage ? Math.min(Math.round(g.percentage), 100) : 100;
                      return `
            <div style="margin-bottom: 14px; padding: 12px; background: #F8FAFC; border-radius: 10px; border: 1px solid #E2E8F0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-weight: 600; color: #1E293B; font-size: 14px;">${g.icon || "🐖"} ${g.name}</span>
                <span style="font-size: 13px; font-weight: bold; color: #6366F1;">${formatMoney(g.savedAmount)}${g.targetAmount ? ` de ${formatMoney(g.targetAmount)}` : ""}</span>
              </div>
              <div style="background: #E2E8F0; height: 8px; border-radius: 4px; overflow: hidden;">
                <div style="background: #6366F1; height: 8px; width: ${pct}%;"></div>
              </div>
            </div>`;
                  })
                  .join("")
            : `<p style="color: #64748B; font-size: 14px; font-style: italic;">Aún no has creado huchas de ahorro.</p>`;

    // Recent movements (last 15)
    const recentTxs = allTxs.slice(0, 15);
    const txRowsHtml =
        recentTxs.length > 0
            ? recentTxs
                  .map((tx) => {
                      const isExp = tx.type === "expense";
                      const color = isExp ? "#0F172A" : "#10B981";
                      const sign = isExp ? "−" : "+";
                      return `
            <tr style="border-bottom: 1px solid #F1F5F9;">
              <td style="padding: 10px 8px; font-size: 13px; color: #64748B;">${formatDate(tx.date)}</td>
              <td style="padding: 10px 8px; font-size: 13px; font-weight: 500; color: #1E293B;">${tx.category?.name || "Sin categoría"}</td>
              <td style="padding: 10px 8px; font-size: 13px; color: #475569;">${tx.note || "-"}</td>
              <td style="padding: 10px 8px; font-size: 13px; font-weight: bold; color: ${color}; text-align: right;">${sign}${formatMoney(tx.amount)}</td>
            </tr>`;
                  })
                  .join("")
            : `<tr><td colspan="4" style="padding: 12px; text-align: center; color: #94A3B8;">Sin movimientos</td></tr>`;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Informe Financiero Nummo - ${periodTitle}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F1F5F9; margin: 0; padding: 24px;">
      <div style="max-width: 650px; margin: 0 auto; background: #FFFFFF; border-radius: 20px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 8px 24px rgba(0,0,0,0.06);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1E1B4B 0%, #312E81 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #FFFFFF; margin: 0; font-size: 26px; font-weight: bold; letter-spacing: -0.5px;">Nummo</h1>
          <p style="color: #C7D2FE; margin: 6px 0 0 0; font-size: 15px;">Informe Financiero Mensual · ${periodTitle}</p>
        </div>

        <div style="padding: 28px;">
          <!-- 3 Metric Cards -->
          <table style="width: 100%; border-collapse: separate; border-spacing: 8px 0; margin-bottom: 24px;">
            <tr>
              <td style="width: 33%; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px; text-align: center;">
                <div style="font-size: 11px; font-weight: bold; color: #10B981; text-transform: uppercase;">Ingresos</div>
                <div style="font-size: 18px; font-weight: bold; color: #0F172A; margin-top: 4px;">${formattedIncome}</div>
              </td>
              <td style="width: 33%; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px; text-align: center;">
                <div style="font-size: 11px; font-weight: bold; color: #EF4444; text-transform: uppercase;">Gastos</div>
                <div style="font-size: 18px; font-weight: bold; color: #0F172A; margin-top: 4px;">${formattedExpenses}</div>
              </td>
              <td style="width: 33%; background: ${isDeficit ? "#FEF2F2" : "#EFF6FF"}; border: 1px solid ${isDeficit ? "#FCA5A5" : "#BFDBFE"}; border-radius: 12px; padding: 14px; text-align: center;">
                <div style="font-size: 11px; font-weight: bold; color: ${isDeficit ? "#DC2626" : "#2563EB"}; text-transform: uppercase;">Balance</div>
                <div style="font-size: 18px; font-weight: bold; color: ${isDeficit ? "#DC2626" : "#1D4ED8"}; margin-top: 4px;">${formattedBalance}</div>
              </td>
            </tr>
          </table>

          <!-- Section: Presupuestos -->
          <h3 style="color: #0F172A; font-size: 16px; margin: 24px 0 12px 0; padding-bottom: 6px; border-bottom: 2px solid #F1F5F9;">
            📊 Estado de Presupuestos (${periodTitle})
          </h3>
          ${budgetsHtml}

          <!-- Section: Huchas de Ahorro -->
          <h3 style="color: #0F172A; font-size: 16px; margin: 28px 0 12px 0; padding-bottom: 6px; border-bottom: 2px solid #F1F5F9;">
            🎯 Huchas de Ahorro
          </h3>
          ${goalsHtml}

          <!-- Section: Movimientos Recientes -->
          <h3 style="color: #0F172A; font-size: 16px; margin: 28px 0 12px 0; padding-bottom: 6px; border-bottom: 2px solid #F1F5F9;">
            📝 Últimos Movimientos
          </h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
            <thead>
              <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
                <th style="padding: 8px; text-align: left; font-size: 11px; color: #64748B; text-transform: uppercase;">Fecha</th>
                <th style="padding: 8px; text-align: left; font-size: 11px; color: #64748B; text-transform: uppercase;">Categoría</th>
                <th style="padding: 8px; text-align: left; font-size: 11px; color: #64748B; text-transform: uppercase;">Nota</th>
                <th style="padding: 8px; text-align: right; font-size: 11px; color: #64748B; text-transform: uppercase;">Importe</th>
              </tr>
            </thead>
            <tbody>
              ${txRowsHtml}
            </tbody>
          </table>

          <!-- Footer note -->
          <div style="margin-top: 32px; padding: 16px; background: #F8FAFC; border-radius: 12px; text-align: center; border: 1px solid #E2E8F0;">
            <p style="margin: 0; font-size: 12px; color: #64748B;">
              🔒 Informe generado de forma segura desde Nummo. Cifrado local · Offline First.
            </p>
          </div>
        </div>

        <div style="background-color: #F1F5F9; padding: 16px; text-align: center; border-top: 1px solid #E2E8F0;">
          <p style="margin: 0; font-size: 11px; color: #94A3B8;">
            Nummo · Gestión financiera privada · Puedes gestionar tus preferencias en cualquier momento desde la app.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    return sendEmailViaSupabase({
        to: toEmail,
        subject: `📊 Informe Financiero Nummo - ${periodTitle}`,
        html,
    });
}
