/**
 * Translates Supabase Auth and network error messages into user-friendly Spanish.
 */

export function translateAuthError(error: unknown): string {
    if (!error) {
        return "Ha ocurrido un error inesperado.";
    }

    const message =
        typeof error === "string"
            ? error
            : (error as any)?.message || (error as any)?.error_description || String(error);

    const lower = message.toLowerCase();

    // Invalid credentials
    if (
        lower.includes("invalid login credentials") ||
        lower.includes("invalid_credentials") ||
        lower.includes("invalid username or password")
    ) {
        return "El correo o la contraseña son incorrectos.";
    }

    // User already registered (Anti-enumeration compliant)
    if (
        lower.includes("user already registered") ||
        lower.includes("already registered") ||
        lower.includes("email already in use") ||
        lower.includes("user_already_exists")
    ) {
        return "Si el correo no estaba registrado, recibirás un código de verificación. Si ya tienes una cuenta, puedes iniciar sesión o recuperar tu contraseña.";
    }

    // Email not confirmed
    if (
        lower.includes("email not confirmed") ||
        lower.includes("email_not_confirmed") ||
        lower.includes("unconfirmed email")
    ) {
        return "Debes confirmar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.";
    }

    // OTP / Token expired or invalid
    if (
        lower.includes("token has expired") ||
        lower.includes("token is expired") ||
        lower.includes("otp_expired") ||
        lower.includes("code has expired")
    ) {
        return "El código de verificación ha caducado. Solicita un nuevo código.";
    }

    if (
        lower.includes("invalid token") ||
        lower.includes("invalid otp") ||
        lower.includes("token not found") ||
        lower.includes("token is invalid") ||
        lower.includes("token_not_found")
    ) {
        return "El código de verificación es incorrecto. Comprueba el correo que has recibido.";
    }

    // Rate limits
    if (
        lower.includes("rate limit") ||
        lower.includes("over_email_send_rate_limit") ||
        lower.includes("too many requests") ||
        lower.includes("rate_limit_exceeded")
    ) {
        return "Has superado el límite de intentos. Por favor espera unos minutos antes de volver a intentarlo.";
    }

    if (lower.includes("for security purposes, you can only request this after")) {
        return "Por seguridad, debes esperar un momento antes de solicitar un nuevo código.";
    }

    // Password requirements
    if (
        lower.includes("password should be at least") ||
        lower.includes("password is too short") ||
        lower.includes("weak_password")
    ) {
        return "La contraseña debe contener al menos 6 caracteres.";
    }

    // User not found (Anti-enumeration compliant)
    if (lower.includes("user not found")) {
        return "Si el correo está registrado, recibirás un mensaje con las instrucciones por correo.";
    }

    // Network / connectivity errors
    if (
        lower.includes("network request failed") ||
        lower.includes("failed to fetch") ||
        lower.includes("networkerror") ||
        lower.includes("aborted")
    ) {
        return "Error de conexión. Comprueba tu conexión a internet e inténtalo de nuevo.";
    }

    // Signups disabled
    if (
        lower.includes("signup is disabled") ||
        lower.includes("signups not allowed")
    ) {
        return "El registro de nuevos usuarios no está disponible en este momento.";
    }

    return message;
}
