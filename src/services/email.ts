/**
 * Email Delivery Service for Nummo
 * 
 * Supports:
 * 1. Resend API (via direct REST API or EXPO_PUBLIC_RESEND_API_KEY)
 * 2. Fallback to interactive in-app toast notification for local/offline dev
 */

export interface SendVerificationEmailResult {
    success: boolean;
    simulated: boolean;
    error?: string;
}

export async function sendVerificationEmail(
    toEmail: string,
    code: string,
    userName = "Usuario"
): Promise<SendVerificationEmailResult> {
    const apiKey = process.env.EXPO_PUBLIC_RESEND_API_KEY;

    if (!apiKey) {
        return {
            success: true,
            simulated: true,
        };
    }

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: "Nummo <onboarding@resend.dev>",
                to: [toEmail],
                subject: `Tu código de verificación de Nummo: ${code}`,
                html: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border: 1px solid #E2E8F0; border-radius: 20px;">
                        <div style="text-align: center; margin-bottom: 24px;">
                            <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 12px; background-color: #4F46E5; color: white; font-size: 24px; font-weight: bold;">
                                N
                            </div>
                            <h1 style="color: #0F172A; font-size: 24px; font-weight: 800; margin-top: 12px; margin-bottom: 4px;">Nummo</h1>
                            <p style="color: #64748B; font-size: 14px; margin: 0;">Finanzas personales claras y bajo control</p>
                        </div>

                        <p style="color: #334155; font-size: 16px; line-height: 24px;">
                            Hola <strong>${userName}</strong>,
                        </p>
                        <p style="color: #475569; font-size: 15px; line-height: 22px;">
                            Introduce el siguiente código de 6 dígitos en la aplicación para verificar tu correo y acceder a tus finanzas:
                        </p>

                        <div style="background-color: #F8FAFC; border: 1.5px dashed #CBD5E1; border-radius: 14px; padding: 20px; text-align: center; margin: 28px 0;">
                            <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #4F46E5; font-family: monospace;">
                                ${code}
                            </span>
                        </div>

                        <p style="color: #94A3B8; font-size: 13px; line-height: 18px; margin-bottom: 24px;">
                            ⏱️ Este código es de un solo uso y caduca en 10 minutos. Si tú no has solicitado este acceso, puedes ignorar este correo de forma segura.
                        </p>

                        <hr style="border: none; border-top: 1px solid #F1F5F9; margin: 24px 0;" />

                        <p style="color: #94A3B8; font-size: 12px; text-align: center; margin: 0;">
                            Nummo · Cifrado local y privacidad absoluta en tu dispositivo
                        </p>
                    </div>
                `,
            }),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.warn("Resend API responded with error:", errData);
            return {
                success: false,
                simulated: true,
                error: (errData as { message?: string }).message || "Error al enviar correo con Resend",
            };
        }

        return {
            success: true,
            simulated: false,
        };
    } catch (e: any) {
        console.warn("Error calling Resend API:", e);
        return {
            success: false,
            simulated: true,
            error: e?.message || "Error de red al conectar con Resend",
        };
    }
}
