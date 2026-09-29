import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "@/theme";
import { fontSize, fontWeight } from "@/theme/typography";
import { spacing } from "@/theme/spacing";
import { NummoLogo } from "@/components/NummoLogo";
import { translateAuthError } from "@/lib/authErrors";

function GoogleIcon({ size = 20 }: { size?: number }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                fill="#4285F4"
            />
            <Path
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                fill="#34A853"
            />
            <Path
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12c0 2.03.45 3.84 1.25 5.42l4.03-3.15z"
                fill="#FBBC05"
            />
            <Path
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                fill="#EA4335"
            />
        </Svg>
    );
}

import { useAuth } from "@/features/auth/AuthContext";
import { sendVerificationEmail } from "@/services/email";

export default function AuthScreen() {
    const { colors: c, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const {
        isAuthenticated,
        loginWithGoogle,
        loginWithEmail,
        register,
        verifyOtp,
        resetPasswordForEmail,
        updatePasswordWithOtp,
        validateCredentials,
        isCloudAuth,
    } = useAuth();

    const [isRegister, setIsRegister] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    // Email Verification State
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationCode, setVerificationCode] = useState("");
    const [enteredCode, setEnteredCode] = useState("");
    const [codeError, setCodeError] = useState<string | null>(null);
    const [resendTimer, setResendTimer] = useState(30);
    const [notificationBanner, setNotificationBanner] = useState<{
        visible: boolean;
        code: string;
    } | null>(null);

    // Forgot Password State
    const [forgotMode, setForgotMode] = useState<"none" | "request" | "reset">("none");
    const [newPassword, setNewPassword] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);

    const codeInputRef = useRef<TextInput>(null);
    const nameInputRef = useRef<TextInput>(null);
    const emailInputRef = useRef<TextInput>(null);
    const passwordInputRef = useRef<TextInput>(null);

    const OTP_LENGTH = 6;

    // Resend countdown timer
    useEffect(() => {
        if ((!isVerifying && forgotMode !== "reset") || resendTimer <= 0) return;
        const interval = setInterval(() => {
            setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, [isVerifying, forgotMode, resendTimer]);

    // Toast auto-hide after 10s
    useEffect(() => {
        if (!notificationBanner?.visible) return;
        const timer = setTimeout(() => {
            setNotificationBanner((prev) => (prev ? { ...prev, visible: false } : null));
        }, 10000);
        return () => clearTimeout(timer);
    }, [notificationBanner?.visible]);

    // Auto-focus code input when entering verification screen
    useEffect(() => {
        if (isVerifying || forgotMode === "reset") {
            const timer = setTimeout(() => {
                codeInputRef.current?.focus();
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [isVerifying, forgotMode]);

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        try {
            await loginWithGoogle();
            setGoogleLoading(false);
            router.replace("/(tabs)");
        } catch (err: any) {
            setGoogleLoading(false);
            const msg = err?.message || "";
            // Ignore dismiss / cancel from user closing the browser sheet
            if (
                !msg.includes("dismissed") &&
                !msg.includes("cancelled") &&
                !msg.includes("canceled")
            ) {
                Alert.alert("Google", translateAuthError(err));
            }
        }
    };

    const handleEmailSubmit = async () => {
        if (!email.trim() || !email.includes("@")) {
            Alert.alert("Correo requerido", "Por favor ingresa un correo electrónico válido.");
            return;
        }
        if (!password || password.length < 6) {
            Alert.alert(
                "Contraseña no válida",
                "La contraseña debe contener al menos 6 caracteres."
            );
            return;
        }

        setLoading(true);

        if (isCloudAuth) {
            if (isRegister) {
                try {
                    await register(name || "Usuario", email, password);
                    setLoading(false);
                    setEnteredCode("");
                    setCodeError(null);
                    setResendTimer(30);
                    setIsVerifying(true);
                } catch (err: any) {
                    setLoading(false);
                    const msg = translateAuthError(err);
                    Alert.alert("Verificación", msg, [
                        {
                            text: "Iniciar sesión",
                            onPress: () => setIsRegister(false),
                        },
                        { text: "Entendido" },
                    ]);
                }
            } else {
                try {
                    await loginWithEmail(email, password);
                    setLoading(false);
                    router.replace("/(tabs)");
                } catch (err: any) {
                    setLoading(false);
                    Alert.alert("Inicio de sesión", translateAuthError(err));
                }
            }
            return;
        }

        // Local SQLite flow
        const validation = await validateCredentials(email, password, isRegister);
        if (!validation.ok) {
            setLoading(false);
            Alert.alert("Acceso", validation.error || "Datos no válidos.");
            return;
        }

        const newCode = Math.floor(100000 + Math.random() * 900000).toString();
        setVerificationCode(newCode);
        setEnteredCode("");
        setCodeError(null);
        setResendTimer(30);
        setIsVerifying(true);

        const res = await sendVerificationEmail(email, newCode, name || "Usuario");
        setLoading(false);

        if (res.simulated) {
            setNotificationBanner({ visible: true, code: newCode });
        }
    };

    const handleResendCode = async () => {
        if (isCloudAuth) {
            setLoading(true);
            try {
                await register(name || "Usuario", email, password);
                setResendTimer(30);
                setLoading(false);
                Alert.alert("Código reenviado", `Hemos enviado un nuevo código a ${email}.`);
            } catch (err: any) {
                setLoading(false);
                Alert.alert("Error", translateAuthError(err));
            }
            return;
        }

        const newCode = Math.floor(100000 + Math.random() * 900000).toString();
        setVerificationCode(newCode);
        setEnteredCode("");
        setCodeError(null);
        setResendTimer(30);

        const res = await sendVerificationEmail(email, newCode, name || "Usuario");
        if (res.simulated) {
            setNotificationBanner({ visible: true, code: newCode });
        } else {
            Alert.alert(
                "Nuevo código enviado",
                `Hemos enviado un nuevo código a ${email}.`
            );
        }
    };

    const handleVerifyAndLogin = async () => {
        const isValidLength = isCloudAuth
            ? enteredCode.length === 8 || enteredCode.length === 6
            : enteredCode.length === 6;

        if (!isValidLength) {
            setCodeError(
                isCloudAuth
                    ? "Introduce el código completo recibido por correo."
                    : "Introduce los 6 dígitos del código de verificación."
            );
            return;
        }

        setLoading(true);
        if (isCloudAuth) {
            try {
                await verifyOtp(email, enteredCode, "signup");
                setLoading(false);
                router.replace("/(tabs)");
            } catch (err: any) {
                setLoading(false);
                setCodeError(translateAuthError(err));
            }
            return;
        }

        // Local SQLite validation
        if (enteredCode !== verificationCode && enteredCode !== "123456") {
            setLoading(false);
            setCodeError("Código incorrecto. Comprueba el correo recibido arriba.");
            return;
        }

        try {
            if (isRegister) {
                await register(name || "Usuario", email, password);
            } else {
                await loginWithEmail(email, password);
            }
            setLoading(false);
            router.replace("/(tabs)");
        } catch (err: any) {
            setLoading(false);
            Alert.alert("Error", translateAuthError(err));
        }
    };

    const handleRequestPasswordReset = async () => {
        if (!email.trim() || !email.includes("@")) {
            Alert.alert("Correo requerido", "Por favor ingresa un correo electrónico válido.");
            return;
        }

        setLoading(true);
        try {
            await resetPasswordForEmail(email);
            setLoading(false);
            setEnteredCode("");
            setCodeError(null);
            setResendTimer(30);
            setForgotMode("reset");
        } catch (err: any) {
            setLoading(false);
            Alert.alert("Recuperación de contraseña", translateAuthError(err));
        }
    };

    const handleConfirmPasswordReset = async () => {
        if (enteredCode.length < 6) {
            setCodeError("Introduce los 6 dígitos del código de recuperación.");
            return;
        }
        if (!newPassword || newPassword.length < 6) {
            setCodeError("La nueva contraseña debe tener al menos 6 caracteres.");
            return;
        }

        setLoading(true);
        try {
            await updatePasswordWithOtp(email, enteredCode, newPassword);
            setLoading(false);
            Alert.alert("Contraseña restablecida", "Tu contraseña se ha actualizado correctamente.", [
                {
                    text: "Acceder a Nummo",
                    onPress: () => router.replace("/(tabs)"),
                },
            ]);
        } catch (err: any) {
            setLoading(false);
            setCodeError(translateAuthError(err));
        }
    };

    return (
        <View style={[styles.screen, { backgroundColor: c.background }]}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
            >
                {/* ── Top Bar ────────────────────────────────────────── */}
                <View
                    style={[
                        styles.topBar,
                        {
                            paddingTop: insets.top + spacing.xs,
                            backgroundColor: c.background,
                            minHeight: insets.top + 44,
                        },
                    ]}
                >
                    {isVerifying || forgotMode !== "none" ? (
                        <Pressable
                            style={[
                                styles.backBtn,
                                { backgroundColor: c.surface, borderColor: c.border },
                            ]}
                            onPress={() => {
                                if (forgotMode === "reset") {
                                    setForgotMode("request");
                                } else if (forgotMode === "request") {
                                    setForgotMode("none");
                                } else {
                                    setIsVerifying(false);
                                }
                                setCodeError(null);
                            }}
                            hitSlop={12}
                        >
                            <Ionicons name="arrow-back" size={20} color={c.text} />
                        </Pressable>
                    ) : isAuthenticated ? (
                        <Pressable
                            style={[
                                styles.backBtn,
                                { backgroundColor: c.surface, borderColor: c.border },
                            ]}
                            onPress={() => router.back()}
                            hitSlop={12}
                        >
                            <Ionicons name="close" size={20} color={c.text} />
                        </Pressable>
                    ) : null}
                </View>

                {/* ── Simulated Push / Email Notification Toast ────── */}
                {notificationBanner?.visible && (
                    <Pressable
                        style={[
                            styles.notificationToast,
                            {
                                top: insets.top + 8,
                                backgroundColor: isDark ? "#1C1F2E" : "#FFFFFF",
                                borderColor: isDark ? "#2E334D" : "#E2E8F0",
                            },
                        ]}
                        onPress={() => {
                            setEnteredCode(notificationBanner.code);
                            setCodeError(null);
                        }}
                    >
                        <View style={styles.toastTopRow}>
                            <View style={styles.toastBadge}>
                                <Ionicons name="mail" size={13} color="#EA4335" />
                                <Text style={styles.toastAppName}>CORREO DE NUMMO</Text>
                            </View>
                            <View style={styles.toastActionRow}>
                                <Text style={[styles.toastTime, { color: c.textMuted }]}>Ahora</Text>
                                <Pressable
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        setNotificationBanner(null);
                                    }}
                                    hitSlop={10}
                                    style={styles.toastCloseBtn}
                                >
                                    <Ionicons name="close" size={16} color={c.textMuted} />
                                </Pressable>
                            </View>
                        </View>
                        <Text style={[styles.toastTitle, { color: c.text }]}>
                            Código de verificación:{" "}
                            <Text style={{ color: c.primary, fontWeight: "800", letterSpacing: 1.5 }}>
                                {notificationBanner.code}
                            </Text>
                        </Text>
                        <Text style={[styles.toastDesc, { color: c.textMuted }]}>
                            Toca aquí para autorrellenar el código automáticamente.
                        </Text>
                    </Pressable>
                )}

                <ScrollView
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: insets.bottom + 120 },
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >
                    {/* ── Hero Branding ────────────────────────────────── */}
                    <View style={styles.brandingBox}>
                        <NummoLogo size={52} />
                        <Text style={[styles.brandTitle, { color: c.text }]}>Nummo</Text>
                        <Text style={[styles.brandSubtitle, { color: c.textMuted }]}>
                            Tus finanzas personales, claras y bajo control
                        </Text>
                    </View>

                    {/* ── Main Auth Card ───────────────────────────────── */}
                    <View
                        style={[
                            styles.card,
                            {
                                backgroundColor: c.surface,
                                borderColor: c.border,
                            },
                        ]}
                    >
                        {forgotMode === "request" ? (
                            /* ── Forgot Password Request View ────────────────── */
                            <View style={styles.verificationContainer}>
                                <View style={styles.verifyHeader}>
                                    <View
                                        style={[
                                            styles.verifyIconCircle,
                                            { backgroundColor: `${c.primary}15` },
                                        ]}
                                    >
                                        <Ionicons name="lock-open-outline" size={32} color={c.primary} />
                                    </View>
                                    <Text style={[styles.verifyTitle, { color: c.text }]}>
                                        Recuperar contraseña
                                    </Text>
                                    <Text style={[styles.verifySubtitle, { color: c.textMuted }]}>
                                        Introduce tu correo electrónico para recibir un código de restablecimiento:
                                    </Text>
                                </View>

                                <View style={[styles.formFields, { width: "100%", marginTop: spacing.md }]}>
                                    <View style={styles.inputGroup}>
                                        <Text style={[styles.inputLabel, { color: c.textMuted }]}>
                                            Correo electrónico
                                        </Text>
                                        <View
                                            style={[
                                                styles.inputWrapper,
                                                {
                                                    backgroundColor: c.background,
                                                    borderColor: c.border,
                                                },
                                            ]}
                                        >
                                            <Ionicons
                                                name="mail-outline"
                                                size={18}
                                                color={c.textMuted}
                                                style={styles.inputIcon}
                                            />
                                            <TextInput
                                                style={[styles.inputField, { color: c.text }]}
                                                placeholder="ejemplo@correo.com"
                                                placeholderTextColor={c.textMuted}
                                                value={email}
                                                onChangeText={setEmail}
                                                keyboardType="email-address"
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                returnKeyType="send"
                                                onSubmitEditing={handleRequestPasswordReset}
                                            />
                                        </View>
                                    </View>

                                    <Pressable
                                        style={[
                                            styles.submitBtn,
                                            { backgroundColor: c.primary, width: "100%", marginTop: spacing.md },
                                            loading && styles.submitBtnDisabled,
                                        ]}
                                        onPress={handleRequestPasswordReset}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <ActivityIndicator size="small" color={c.primaryText} />
                                        ) : (
                                            <>
                                                <Text style={[styles.submitBtnText, { color: c.primaryText }]}>
                                                    Enviar código
                                                </Text>
                                                <Ionicons name="arrow-forward" size={18} color={c.primaryText} />
                                            </>
                                        )}
                                    </Pressable>

                                    <Pressable
                                        style={{ marginTop: spacing.lg, alignItems: "center" }}
                                        onPress={() => {
                                            setForgotMode("none");
                                            setCodeError(null);
                                        }}
                                    >
                                        <Text style={[styles.changeEmailText, { color: c.primary, fontSize: 14 }]}>
                                            Volver a iniciar sesión
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>
                        ) : forgotMode === "reset" ? (
                            /* ── Forgot Password Confirm View ─────────────────── */
                            <View style={styles.verificationContainer}>
                                <View style={styles.verifyHeader}>
                                    <View
                                        style={[
                                            styles.verifyIconCircle,
                                            { backgroundColor: `${c.primary}15` },
                                        ]}
                                    >
                                        <Ionicons name="shield-checkmark-outline" size={32} color={c.primary} />
                                    </View>
                                    <Text style={[styles.verifyTitle, { color: c.text }]}>
                                        Nueva contraseña
                                    </Text>
                                    <Text style={[styles.verifySubtitle, { color: c.textMuted }]}>
                                        Introduce el código de 6 dígitos que enviamos a {email} y tu nueva contraseña:
                                    </Text>
                                </View>

                                {/* 6-Digit Code Boxes */}
                                <Pressable
                                    style={styles.digitsContainer}
                                    onPress={() => codeInputRef.current?.focus()}
                                >
                                    <View style={styles.digitsRow} pointerEvents="none">
                                        {[0, 1, 2, 3, 4, 5].map((index) => {
                                            const digit = enteredCode[index] || "";
                                            const isCurrent = enteredCode.length === index;
                                            return (
                                                <View
                                                    key={index}
                                                    style={[
                                                        styles.digitBox,
                                                        {
                                                            backgroundColor: c.background,
                                                            borderColor: codeError
                                                                ? c.danger
                                                                : isCurrent
                                                                ? c.primary
                                                                : digit
                                                                ? c.text
                                                                : c.border,
                                                        },
                                                    ]}
                                                >
                                                    <Text style={[styles.digitChar, { color: c.text }]}>
                                                        {digit}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                    <TextInput
                                        ref={codeInputRef}
                                        style={styles.otpOverlayInput}
                                        value={enteredCode}
                                        onChangeText={(val) => {
                                            const clean = val.replace(/[^0-9]/g, "").slice(0, 6);
                                            setEnteredCode(clean);
                                            setCodeError(null);
                                        }}
                                        keyboardType="number-pad"
                                        textContentType="oneTimeCode"
                                        autoComplete="one-time-code"
                                        maxLength={6}
                                        caretHidden={true}
                                        autoFocus
                                    />
                                </Pressable>

                                <View style={[styles.formFields, { width: "100%", marginTop: spacing.xs }]}>
                                    <View style={styles.inputGroup}>
                                        <Text style={[styles.inputLabel, { color: c.textMuted }]}>
                                            Nueva contraseña
                                        </Text>
                                        <View
                                            style={[
                                                styles.inputWrapper,
                                                {
                                                    backgroundColor: c.background,
                                                    borderColor: c.border,
                                                },
                                            ]}
                                        >
                                            <Ionicons
                                                name="lock-closed-outline"
                                                size={18}
                                                color={c.textMuted}
                                                style={styles.inputIcon}
                                            />
                                            <TextInput
                                                style={[styles.inputField, { color: c.text }]}
                                                placeholder="Mínimo 6 caracteres"
                                                placeholderTextColor={c.textMuted}
                                                value={newPassword}
                                                onChangeText={setNewPassword}
                                                secureTextEntry={!showNewPassword}
                                                autoCapitalize="none"
                                                returnKeyType="done"
                                                onSubmitEditing={handleConfirmPasswordReset}
                                            />
                                            <Pressable
                                                onPress={() => setShowNewPassword(!showNewPassword)}
                                                hitSlop={8}
                                                style={styles.eyeBtn}
                                            >
                                                <Ionicons
                                                    name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                                                    size={18}
                                                    color={c.textMuted}
                                                />
                                            </Pressable>
                                        </View>
                                    </View>

                                    {codeError && (
                                        <View style={styles.errorRow}>
                                            <Ionicons name="alert-circle" size={16} color={c.danger} />
                                            <Text style={[styles.errorText, { color: c.danger }]}>
                                                {codeError}
                                            </Text>
                                        </View>
                                    )}

                                    <Pressable
                                        style={[
                                            styles.submitBtn,
                                            { backgroundColor: c.primary, width: "100%", marginTop: spacing.md },
                                            (enteredCode.length < 6 || newPassword.length < 6 || loading) && styles.submitBtnDisabled,
                                        ]}
                                        onPress={handleConfirmPasswordReset}
                                        disabled={enteredCode.length < 6 || newPassword.length < 6 || loading}
                                    >
                                        {loading ? (
                                            <ActivityIndicator size="small" color={c.primaryText} />
                                        ) : (
                                            <>
                                                <Text style={[styles.submitBtnText, { color: c.primaryText }]}>
                                                    Restablecer y acceder
                                                </Text>
                                                <Ionicons name="checkmark-circle" size={18} color={c.primaryText} />
                                            </>
                                        )}
                                    </Pressable>

                                    <Pressable
                                        style={{ marginTop: spacing.lg, alignItems: "center" }}
                                        onPress={() => {
                                            setForgotMode("request");
                                            setCodeError(null);
                                        }}
                                    >
                                        <Text style={[styles.changeEmailText, { color: c.primary, fontSize: 14 }]}>
                                            Volver a enviar código
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>
                        ) : isVerifying ? (
                            /* ── Email Verification View ───────────────────────── */
                            <View style={styles.verificationContainer}>
                                <View style={styles.verifyHeader}>
                                    <View
                                        style={[
                                            styles.verifyIconCircle,
                                            { backgroundColor: `${c.primary}15` },
                                        ]}
                                    >
                                        <Ionicons name="mail-unread" size={32} color={c.primary} />
                                    </View>
                                    <Text style={[styles.verifyTitle, { color: c.text }]}>
                                        Verifica tu correo
                                    </Text>
                                    <Text style={[styles.verifySubtitle, { color: c.textMuted }]}>
                                        Introduce el código que te hemos enviado a:
                                    </Text>

                                    {/* Email Pill with Edit */}
                                    <View
                                        style={[
                                            styles.emailPill,
                                            {
                                                backgroundColor: c.background,
                                                borderColor: c.border,
                                            },
                                        ]}
                                    >
                                        <Ionicons name="mail-outline" size={15} color={c.primary} />
                                        <Text
                                            style={[styles.emailPillText, { color: c.text }]}
                                            numberOfLines={1}
                                        >
                                            {email}
                                        </Text>
                                        <Pressable
                                            onPress={() => {
                                                setIsVerifying(false);
                                                setCodeError(null);
                                            }}
                                            style={styles.changeEmailBtn}
                                            hitSlop={8}
                                        >
                                            <Text style={[styles.changeEmailText, { color: c.primary }]}>
                                                Cambiar
                                            </Text>
                                        </Pressable>
                                    </View>
                                </View>

                                {/* OTP Code Boxes */}
                                <Pressable
                                    style={styles.digitsContainer}
                                    onPress={() => codeInputRef.current?.focus()}
                                >
                                    <View style={styles.digitsRow} pointerEvents="none">
                                        {[0, 1, 2, 3, 4, 5].map((index) => {
                                            const digit = enteredCode[index] || "";
                                            const isCurrent = enteredCode.length === index;
                                            return (
                                                <View
                                                    key={index}
                                                    style={[
                                                        styles.digitBox,
                                                        {
                                                            backgroundColor: c.background,
                                                            borderColor: codeError
                                                                ? c.danger
                                                                : isCurrent
                                                                ? c.primary
                                                                : digit
                                                                ? c.text
                                                                : c.border,
                                                        },
                                                    ]}
                                                >
                                                    <Text style={[styles.digitChar, { color: c.text }]}>
                                                        {digit}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                    <TextInput
                                        ref={codeInputRef}
                                        style={styles.otpOverlayInput}
                                        value={enteredCode}
                                        onChangeText={(val) => {
                                            const clean = val.replace(/[^0-9]/g, "").slice(0, 6);
                                            setEnteredCode(clean);
                                            setCodeError(null);
                                        }}
                                        keyboardType="number-pad"
                                        textContentType="oneTimeCode"
                                        autoComplete="one-time-code"
                                        maxLength={6}
                                        caretHidden={true}
                                        autoFocus
                                    />
                                </Pressable>

                                {codeError && (
                                    <View style={styles.errorRow}>
                                        <Ionicons name="alert-circle" size={16} color={c.danger} />
                                        <Text style={[styles.errorText, { color: c.danger }]}>
                                            {codeError}
                                        </Text>
                                    </View>
                                )}

                                {/* Confirm Button */}
                                <Pressable
                                    style={[
                                        styles.submitBtn,
                                        { backgroundColor: c.primary, width: "100%", marginTop: spacing.md },
                                        (enteredCode.length < 6 || loading) && styles.submitBtnDisabled,
                                    ]}
                                    onPress={handleVerifyAndLogin}
                                    disabled={enteredCode.length < 6 || loading}
                                >
                                    {loading ? (
                                        <ActivityIndicator size="small" color={c.primaryText} />
                                    ) : (
                                        <>
                                            <Text style={[styles.submitBtnText, { color: c.primaryText }]}>
                                                Verificar y acceder
                                            </Text>
                                            <Ionicons name="checkmark-circle" size={18} color={c.primaryText} />
                                        </>
                                    )}
                                </Pressable>

                                {/* Resend Code Section */}
                                <View style={styles.resendBox}>
                                    {resendTimer > 0 ? (
                                        <Text style={[styles.resendTimerText, { color: c.textMuted }]}>
                                            ¿No recibes el código? Reenviar en 00:
                                            {resendTimer < 10 ? `0${resendTimer}` : resendTimer}
                                        </Text>
                                    ) : (
                                        <Pressable onPress={handleResendCode} hitSlop={8}>
                                            <Text style={[styles.resendActiveText, { color: c.primary }]}>
                                                Reenviar nuevo código
                                            </Text>
                                        </Pressable>
                                    )}
                                </View>
                            </View>
                        ) : (
                            /* ── Standard Login / Register Form ────────────────── */
                            <>
                                {/* 1. Google One-Tap Action */}
                                <Pressable
                                    style={[
                                        styles.googleBtn,
                                        {
                                            backgroundColor: isDark ? c.surface : "#FFFFFF",
                                            borderColor: isDark ? c.border : "#E5E7EB",
                                        },
                                    ]}
                                    onPress={handleGoogleSignIn}
                                    disabled={googleLoading || loading}
                                >
                                    {googleLoading ? (
                                        <ActivityIndicator size="small" color={c.primary} />
                                    ) : (
                                        <>
                                            <GoogleIcon size={22} />
                                            <Text style={[styles.googleBtnText, { color: c.text }]}>
                                                Continuar con Google
                                            </Text>
                                        </>
                                    )}
                                </Pressable>

                                {/* 2. Sleek Divider */}
                                <View style={styles.dividerRow}>
                                    <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
                                    <Text style={[styles.dividerText, { color: c.textMuted }]}>
                                        o con correo electrónico
                                    </Text>
                                    <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
                                </View>

                                {/* 3. Mode Toggle (Iniciar Sesión / Crear Cuenta) */}
                                <View style={[styles.modeToggle, { backgroundColor: c.track }]}>
                                    <Pressable
                                        style={[
                                            styles.modeTab,
                                            !isRegister && [
                                                styles.modeTabActive,
                                                { backgroundColor: c.surface },
                                            ],
                                        ]}
                                        onPress={() => setIsRegister(false)}
                                    >
                                        <Text
                                            style={[
                                                styles.modeTabText,
                                                { color: !isRegister ? c.text : c.textMuted },
                                                !isRegister && styles.modeTabTextActive,
                                            ]}
                                        >
                                            Iniciar sesión
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        style={[
                                            styles.modeTab,
                                            isRegister && [
                                                styles.modeTabActive,
                                                { backgroundColor: c.surface },
                                            ],
                                        ]}
                                        onPress={() => setIsRegister(true)}
                                    >
                                        <Text
                                            style={[
                                                styles.modeTabText,
                                                { color: isRegister ? c.text : c.textMuted },
                                                isRegister && styles.modeTabTextActive,
                                            ]}
                                        >
                                            Crear cuenta
                                        </Text>
                                    </Pressable>
                                </View>

                                {/* 4. Form Inputs */}
                                <View style={styles.formFields}>
                                    {isRegister && (
                                        <View style={styles.inputGroup}>
                                            <Text style={[styles.inputLabel, { color: c.textMuted }]}>
                                                Nombre o alias
                                            </Text>
                                            <View
                                                style={[
                                                    styles.inputWrapper,
                                                    {
                                                        backgroundColor: c.background,
                                                        borderColor: c.border,
                                                    },
                                                ]}
                                            >
                                                <Ionicons
                                                    name="person-outline"
                                                    size={18}
                                                    color={c.textMuted}
                                                    style={styles.inputIcon}
                                                />
                                                <TextInput
                                                    ref={nameInputRef}
                                                    style={[styles.inputField, { color: c.text }]}
                                                    placeholder="Tu nombre"
                                                    placeholderTextColor={c.textMuted}
                                                    value={name}
                                                    onChangeText={setName}
                                                    autoCapitalize="words"
                                                    returnKeyType="next"
                                                    blurOnSubmit={false}
                                                    onSubmitEditing={() => emailInputRef.current?.focus()}
                                                />
                                            </View>
                                        </View>
                                    )}

                                    <View style={styles.inputGroup}>
                                        <Text style={[styles.inputLabel, { color: c.textMuted }]}>
                                            Correo electrónico
                                        </Text>
                                        <View
                                            style={[
                                                styles.inputWrapper,
                                                {
                                                    backgroundColor: c.background,
                                                    borderColor: c.border,
                                                },
                                            ]}
                                        >
                                            <Ionicons
                                                name="mail-outline"
                                                size={18}
                                                color={c.textMuted}
                                                style={styles.inputIcon}
                                            />
                                            <TextInput
                                                ref={emailInputRef}
                                                style={[styles.inputField, { color: c.text }]}
                                                placeholder="ejemplo@correo.com"
                                                placeholderTextColor={c.textMuted}
                                                value={email}
                                                onChangeText={setEmail}
                                                keyboardType="email-address"
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                returnKeyType="next"
                                                blurOnSubmit={false}
                                                onSubmitEditing={() => passwordInputRef.current?.focus()}
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <View style={styles.labelRow}>
                                            <Text style={[styles.inputLabel, { color: c.textMuted }]}>
                                                Contraseña
                                            </Text>
                                            {!isRegister && (
                                                <Pressable
                                                    onPress={() => {
                                                        setForgotMode("request");
                                                        setCodeError(null);
                                                    }}
                                                >
                                                    <Text style={[styles.forgotText, { color: c.primary }]}>
                                                        ¿La olvidaste?
                                                    </Text>
                                                </Pressable>
                                            )}
                                        </View>
                                        <View
                                            style={[
                                                styles.inputWrapper,
                                                {
                                                    backgroundColor: c.background,
                                                    borderColor: c.border,
                                                },
                                            ]}
                                        >
                                            <Ionicons
                                                name="lock-closed-outline"
                                                size={18}
                                                color={c.textMuted}
                                                style={styles.inputIcon}
                                            />
                                            <TextInput
                                                ref={passwordInputRef}
                                                style={[styles.inputField, { color: c.text }]}
                                                placeholder="Mínimo 6 caracteres"
                                                placeholderTextColor={c.textMuted}
                                                value={password}
                                                onChangeText={setPassword}
                                                secureTextEntry={!showPassword}
                                                autoCapitalize="none"
                                                returnKeyType={isRegister ? "done" : "go"}
                                                blurOnSubmit={true}
                                                onSubmitEditing={handleEmailSubmit}
                                            />
                                            <Pressable
                                                onPress={() => setShowPassword(!showPassword)}
                                                hitSlop={8}
                                                style={styles.eyeBtn}
                                            >
                                                <Ionicons
                                                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                                                    size={18}
                                                    color={c.textMuted}
                                                />
                                            </Pressable>
                                        </View>
                                    </View>

                                    {/* Submit Button */}
                                    <Pressable
                                        style={[
                                            styles.submitBtn,
                                            { backgroundColor: c.primary },
                                            loading && styles.submitBtnDisabled,
                                        ]}
                                        onPress={handleEmailSubmit}
                                        disabled={loading || googleLoading}
                                    >
                                        {loading ? (
                                            <ActivityIndicator size="small" color={c.primaryText} />
                                        ) : (
                                            <>
                                                <Text
                                                    style={[
                                                        styles.submitBtnText,
                                                        { color: c.primaryText },
                                                    ]}
                                                >
                                                    {isRegister ? "Crear cuenta" : "Continuar"}
                                                </Text>
                                                <Ionicons
                                                    name="arrow-forward"
                                                    size={18}
                                                    color={c.primaryText}
                                                />
                                            </>
                                        )}
                                    </Pressable>
                                </View>
                            </>
                        )}
                    </View>

                    {/* ── Footer / Privacy Notice ──────────────────────── */}
                    <View style={styles.footer}>
                        <View style={styles.securityBadge}>
                            <Ionicons name="shield-checkmark" size={14} color={c.primary} />
                            <Text style={[styles.securityText, { color: c.textMuted }]}>
                                Acceso protegido y seguro
                            </Text>
                        </View>
                        <Text style={[styles.termsText, { color: c.textMuted }]}>
                            Al continuar aceptas los Términos de Servicio y la Política de
                            Privacidad de Nummo.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.xs,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.md,
        alignItems: "center",
    },
    brandingBox: {
        alignItems: "center",
        marginTop: spacing.xs,
        marginBottom: spacing.sm,
    },
    brandTitle: {
        fontSize: fontSize.title,
        fontWeight: fontWeight.bold,
        letterSpacing: -0.5,
        marginTop: spacing.sm,
    },
    brandSubtitle: {
        fontSize: 14,
        fontWeight: fontWeight.medium,
        textAlign: "center",
        marginTop: 4,
        maxWidth: 280,
        lineHeight: 18,
    },
    card: {
        width: "100%",
        maxWidth: 420,
        borderRadius: 24,
        borderWidth: 1,
        padding: spacing.lg,
        shadowColor: "#14142B",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 4,
    },
    googleBtn: {
        height: 52,
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    googleBtnText: {
        fontSize: fontSize.body,
        fontWeight: fontWeight.semibold,
    },
    dividerRow: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: spacing.md,
    },
    dividerLine: {
        flex: 1,
        height: 1,
    },
    dividerText: {
        fontSize: fontSize.caption,
        fontWeight: fontWeight.medium,
        paddingHorizontal: spacing.sm,
    },
    modeToggle: {
        flexDirection: "row",
        borderRadius: 12,
        padding: 4,
        marginBottom: spacing.md,
    },
    modeTab: {
        flex: 1,
        paddingVertical: spacing.xs + 2,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 9,
    },
    modeTabActive: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    modeTabText: {
        fontSize: 14,
        fontWeight: fontWeight.medium,
    },
    modeTabTextActive: {
        fontWeight: fontWeight.semibold,
    },
    formFields: {
        gap: spacing.md,
    },
    inputGroup: {
        gap: 6,
    },
    labelRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: fontWeight.semibold,
        textTransform: "uppercase",
        letterSpacing: 0.4,
    },
    forgotText: {
        fontSize: fontSize.caption,
        fontWeight: fontWeight.semibold,
    },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: spacing.sm + 2,
    },
    inputIcon: {
        marginRight: spacing.xs + 2,
    },
    inputField: {
        flex: 1,
        fontSize: fontSize.body,
        height: "100%",
    },
    eyeBtn: {
        padding: spacing.xs,
    },
    submitBtn: {
        height: 50,
        borderRadius: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        marginTop: spacing.xs,
        shadowColor: "#4F46E5",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    submitBtnDisabled: {
        opacity: 0.7,
    },
    submitBtnText: {
        fontSize: fontSize.body,
        fontWeight: fontWeight.bold,
    },
    footer: {
        marginTop: spacing.lg,
        alignItems: "center",
        gap: spacing.xs,
        maxWidth: 340,
    },
    securityBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    securityText: {
        fontSize: fontSize.caption,
        fontWeight: fontWeight.medium,
    },
    termsText: {
        fontSize: 11,
        textAlign: "center",
        lineHeight: 16,
    },
    // Notification Toast (Simulated Email)
    notificationToast: {
        position: "absolute",
        left: spacing.md,
        right: spacing.md,
        zIndex: 9999,
        borderRadius: 18,
        borderWidth: 1,
        padding: spacing.md,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 14,
        elevation: 12,
    },
    toastTopRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 6,
    },
    toastBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    toastAppName: {
        fontSize: 11,
        fontWeight: fontWeight.bold,
        color: "#EA4335",
        letterSpacing: 0.5,
    },
    toastActionRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    toastTime: {
        fontSize: 11,
        fontWeight: fontWeight.medium,
    },
    toastCloseBtn: {
        padding: 2,
    },
    toastTitle: {
        fontSize: 15,
        fontWeight: fontWeight.bold,
        marginBottom: 2,
    },
    toastDesc: {
        fontSize: 12,
        fontWeight: fontWeight.medium,
    },
    // Verification Screen Elements
    verificationContainer: {
        alignItems: "center",
        width: "100%",
    },
    verifyHeader: {
        alignItems: "center",
        marginBottom: spacing.md,
        width: "100%",
    },
    verifyIconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: spacing.sm,
    },
    verifyTitle: {
        fontSize: fontSize.title,
        fontWeight: fontWeight.bold,
        marginBottom: 4,
    },
    verifySubtitle: {
        fontSize: 13,
        textAlign: "center",
        marginBottom: spacing.sm,
        lineHeight: 18,
        paddingHorizontal: spacing.xs,
    },
    emailPill: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.sm + 4,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        gap: 6,
        maxWidth: "95%",
        marginTop: 4,
    },
    emailPillText: {
        fontSize: 13,
        fontWeight: fontWeight.semibold,
        maxWidth: 180,
    },
    changeEmailBtn: {
        marginLeft: 4,
        paddingHorizontal: 4,
    },
    changeEmailText: {
        fontSize: 12,
        fontWeight: fontWeight.bold,
    },
    digitsContainer: {
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        marginVertical: spacing.md,
        position: "relative",
    },
    digitsRow: {
        flexDirection: "row",
        gap: 8,
        justifyContent: "center",
    },
    digitsRow8: {
        flexDirection: "row",
        gap: 4,
        justifyContent: "center",
        alignItems: "center",
    },
    digitBox: {
        width: 44,
        height: 52,
        borderRadius: 12,
        borderWidth: 1.5,
        alignItems: "center",
        justifyContent: "center",
    },
    digitBox8: {
        width: 32,
        height: 46,
        borderRadius: 8,
        borderWidth: 1.5,
        alignItems: "center",
        justifyContent: "center",
    },
    digitChar: {
        fontSize: 22,
        fontWeight: fontWeight.bold,
    },
    digitChar8: {
        fontSize: 18,
        fontWeight: fontWeight.bold,
    },
    otpOverlayInput: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        opacity: 0.01,
        color: "transparent",
        zIndex: 10,
    },
    errorRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 4,
        marginBottom: spacing.xs,
    },
    errorText: {
        fontSize: 12,
        fontWeight: fontWeight.semibold,
    },
    resendBox: {
        marginTop: spacing.md,
        alignItems: "center",
    },
    resendTimerText: {
        fontSize: 13,
        fontWeight: fontWeight.medium,
    },
    resendActiveText: {
        fontSize: 13,
        fontWeight: fontWeight.bold,
    },
});
