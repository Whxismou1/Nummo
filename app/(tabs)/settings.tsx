import { useAuth } from "@/features/auth/AuthContext";
import {
    CURRENCY_CONFIG,
    useAppSettings
} from "@/features/settings/SettingsContext";
import { sendComprehensiveFinancialReport } from "@/services/notifications";
import { useTheme } from "@/theme";
import { spacing } from "@/theme/spacing";
import { fontSize, fontWeight } from "@/theme/typography";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SettingsScreen() {
    const { colors: c, themeMode, setThemeMode } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const {
        currency,
        currencySymbol,
        firstDayOfWeek,
        hideBalances,
        notificationsApp,
        notificationsEmail,
        setCurrency,
        setFirstDayOfWeek,
        setHideBalances,
        setNotificationsApp,
        setNotificationsEmail,
    } = useAppSettings();

    const {
        user,
        isAuthenticated,
        logout,
        biometricsEnabled,
        setBiometricsEnabled,
        biometricTypeLabel,
        hasBiometricsHardware,
    } = useAuth();

    const [exporting, setExporting] = useState(false);

    const handleToggleBiometrics = async (val: boolean) => {
        if (val && !hasBiometricsHardware) {
            Alert.alert(
                "Biometría no disponible",
                "Tu dispositivo no tiene configurado Face ID o lector de huellas dactilares."
            );
            return;
        }
        const success = await setBiometricsEnabled(val);
        if (!success && val) {
            Alert.alert(
                "Autenticación cancelada",
                "No se pudo verificar tu identidad para activar el bloqueo biométrico."
            );
        }
    };

    const handleLogout = () => {
        Alert.alert(
            "Cerrar sesión",
            "¿Seguro que deseas salir de tu cuenta?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Cerrar sesión",
                    style: "destructive",
                    onPress: async () => {
                        await logout();
                        router.replace("/auth" as any);
                    },
                },
            ]
        );
    };

    const handleSelectCurrency = () => {
        Alert.alert(
            "Moneda principal",
            "Selecciona la divisa para tus cuentas y presupuestos:",
            [
                {
                    text: `Euro (€)${currency === "EUR" ? "  ✓" : ""}`,
                    onPress: () => setCurrency("EUR"),
                },
                {
                    text: `Dólar ($)${currency === "USD" ? "  ✓" : ""}`,
                    onPress: () => setCurrency("USD"),
                },
                {
                    text: `Libra (£)${currency === "GBP" ? "  ✓" : ""}`,
                    onPress: () => setCurrency("GBP"),
                },
                { text: "Cancelar", style: "cancel" },
            ]
        );
    };

    const handleSelectFirstDay = () => {
        Alert.alert(
            "Primer día de la semana",
            "Selecciona el día con el que inician tus semanas:",
            [
                {
                    text: `Lunes${firstDayOfWeek === "monday" ? "  ✓" : ""}`,
                    onPress: () => setFirstDayOfWeek("monday"),
                },
                {
                    text: `Domingo${firstDayOfWeek === "sunday" ? "  ✓" : ""}`,
                    onPress: () => setFirstDayOfWeek("sunday"),
                },
                { text: "Cancelar", style: "cancel" },
            ]
        );
    };

    const handleSendFinancialReport = async () => {
        if (!user?.email) {
            Alert.alert(
                "Cuenta requerida",
                "Debes iniciar sesión con tu cuenta de correo o Google para recibir tu informe financiero."
            );
            return;
        }

        try {
            setExporting(true);
            const res = await sendComprehensiveFinancialReport(user.email);
            if (res.ok) {
                Alert.alert(
                    "¡Informe enviado!",
                    `Hemos enviado a ${user.email} un informe completo con tus ingresos, gastos, desglose de sobres, huchas y últimos movimientos.`
                );
            } else {
                Alert.alert(
                    "Informe generado",
                    `Se ha procesado tu solicitud para ${user.email}. Si has desplegado la Edge Function 'send-email' en Supabase, revisa tu bandeja de entrada o spam.`
                );
            }
        } catch (e: any) {
            console.error("Error sending financial report:", e);
            Alert.alert("Error", e?.message || "No se pudo enviar el informe por correo.");
        } finally {
            setExporting(false);
        }
    };

    const currencyLabel = CURRENCY_CONFIG[currency]?.name ?? "Euro (€)";
    const firstDayLabel = firstDayOfWeek === "monday" ? "Lunes" : "Domingo";

    return (
        <View style={[styles.screen, { backgroundColor: c.background }]}>
            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingTop: insets.top + spacing.sm,
                        paddingBottom: insets.bottom + 100,
                    },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* ── 1. Header ────────────────────────────────────────── */}
                <View style={styles.header}>
                    <View>
                        <Text style={[styles.title, { color: c.text }]}>Ajustes</Text>
                        <Text style={[styles.subtitle, { color: c.textMuted }]}>
                            Preferencias y configuración de la app
                        </Text>
                    </View>
                </View>

                {/* ── 2. Profile Card ──────────────────────────────────── */}
                <View style={[styles.profileCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                    <Pressable
                        style={styles.profileRow}
                        onPress={() => {
                            if (!isAuthenticated) {
                                router.push("/auth" as any);
                            }
                        }}
                    >
                        {user?.avatarUrl ? (
                            <Image
                                source={{ uri: user.avatarUrl }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <View style={[styles.avatar, { backgroundColor: c.primary }]}>
                                <Text style={styles.avatarText}>
                                    {user ? user.name.charAt(0).toUpperCase() : "N"}
                                </Text>
                            </View>
                        )}
                        <View style={styles.profileInfo}>
                            <View style={styles.nameRow}>
                                <Text style={[styles.profileName, { color: c.text }]}>
                                    {user ? user.name : "Cuenta no vinculada"}
                                </Text>
                                <View style={[styles.proBadge, { backgroundColor: c.track }]}>
                                    <View
                                        style={[
                                            styles.proDot,
                                            { backgroundColor: user?.provider === "google" ? "#4285F4" : c.primary },
                                        ]}
                                    />
                                    <Text
                                        style={[
                                            styles.proText,
                                            { color: user?.provider === "google" ? "#4285F4" : c.primary },
                                        ]}
                                    >
                                        {user?.provider === "google" ? "Google" : user ? "Email" : "Local"}
                                    </Text>
                                </View>
                            </View>
                            <Text style={[styles.profileMeta, { color: c.textMuted }]}>
                                {user ? user.email : "Toca aquí para iniciar sesión"}
                            </Text>
                        </View>

                        {isAuthenticated ? (
                            <Pressable
                                style={[styles.logoutBtn, { backgroundColor: c.track }]}
                                onPress={handleLogout}
                                hitSlop={8}
                            >
                                <Ionicons name="log-out-outline" size={18} color={c.danger} />
                            </Pressable>
                        ) : (
                            <Pressable
                                style={[styles.loginBtn, { backgroundColor: c.primary }]}
                                onPress={() => router.push("/auth" as any)}
                                hitSlop={8}
                            >
                                <Text style={[styles.loginBtnText, { color: c.primaryText }]}>Acceder</Text>
                            </Pressable>
                        )}
                    </Pressable>

                    <View style={[styles.syncStatusRow, { backgroundColor: c.background }]}>
                        <View style={styles.syncLeft}>
                            <View style={[styles.onlineDot, { backgroundColor: c.success }]} />
                            <Text style={[styles.syncText, { color: c.text }]}>
                                {isAuthenticated ? "Sesión activa y segura" : "Almacenamiento local activo"}
                            </Text>
                        </View>
                        <Text style={[styles.syncTime, { color: c.textMuted }]}>Al día</Text>
                    </View>
                </View>

                {/* ── 3. Preferencias ──────────────────────────────────── */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: c.textMuted }]}>
                        PREFERENCIAS
                    </Text>
                    <View style={[styles.cardGroup, { backgroundColor: c.surface, borderColor: c.border }]}>
                        {/* Currency */}
                        <Pressable
                            style={styles.cardItem}
                            onPress={handleSelectCurrency}
                        >
                            <View style={styles.itemLeft}>
                                <View style={[styles.itemIconBox, { backgroundColor: c.track }]}>
                                    <Ionicons name="cash-outline" size={18} color={c.primary} />
                                </View>
                                <View>
                                    <Text style={[styles.itemTitle, { color: c.text }]}>Moneda principal</Text>
                                    <Text style={[styles.itemSub, { color: c.textMuted }]}>
                                        Símbolo y formato en toda la app
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.itemRight}>
                                <Text style={[styles.itemValue, { color: c.primary }]}>{currencyLabel}</Text>
                                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
                            </View>
                        </Pressable>

                        <View style={[styles.divider, { backgroundColor: c.border }]} />

                        {/* First day of week */}
                        <Pressable
                            style={styles.cardItem}
                            onPress={handleSelectFirstDay}
                        >
                            <View style={styles.itemLeft}>
                                <View style={[styles.itemIconBox, { backgroundColor: c.track }]}>
                                    <Ionicons name="calendar-outline" size={18} color={c.primary} />
                                </View>
                                <View>
                                    <Text style={[styles.itemTitle, { color: c.text }]}>Primer día de la semana</Text>
                                    <Text style={[styles.itemSub, { color: c.textMuted }]}>
                                        Para resúmenes y calendario
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.itemRight}>
                                <Text style={[styles.itemValue, { color: c.textMuted }]}>{firstDayLabel}</Text>
                                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
                            </View>
                        </Pressable>

                        <View style={[styles.divider, { backgroundColor: c.border }]} />

                        {/* Theme switcher */}
                        <View style={styles.themeRow}>
                            <View style={styles.themeRowHeader}>
                                <View style={[styles.itemIconBox, { backgroundColor: c.track }]}>
                                    <Ionicons name="color-palette-outline" size={18} color={c.primary} />
                                </View>
                                <View>
                                    <Text style={[styles.itemTitle, { color: c.text }]}>Tema de la app</Text>
                                    <Text style={[styles.itemSub, { color: c.textMuted }]}>
                                        Aspecto claro u oscuro
                                    </Text>
                                </View>
                            </View>

                            <View style={[styles.themeSegmented, { backgroundColor: c.background }]}>
                                <Pressable
                                    style={[
                                        styles.themeSegmentBtn,
                                        themeMode === "light" && { backgroundColor: c.surface, elevation: 1 },
                                    ]}
                                    onPress={() => setThemeMode("light")}
                                >
                                    <Ionicons
                                        name="sunny"
                                        size={14}
                                        color={themeMode === "light" ? c.primary : c.textMuted}
                                    />
                                    <Text
                                        style={[
                                            styles.themeSegmentText,
                                            { color: themeMode === "light" ? c.text : c.textMuted },
                                            themeMode === "light" && { fontWeight: fontWeight.bold },
                                        ]}
                                    >
                                        Claro
                                    </Text>
                                </Pressable>

                                <Pressable
                                    style={[
                                        styles.themeSegmentBtn,
                                        themeMode === "dark" && { backgroundColor: c.surface, elevation: 1 },
                                    ]}
                                    onPress={() => setThemeMode("dark")}
                                >
                                    <Ionicons
                                        name="moon"
                                        size={14}
                                        color={themeMode === "dark" ? c.primary : c.textMuted}
                                    />
                                    <Text
                                        style={[
                                            styles.themeSegmentText,
                                            { color: themeMode === "dark" ? c.text : c.textMuted },
                                            themeMode === "dark" && { fontWeight: fontWeight.bold },
                                        ]}
                                    >
                                        Oscuro
                                    </Text>
                                </Pressable>

                                <Pressable
                                    style={[
                                        styles.themeSegmentBtn,
                                        themeMode === "system" && { backgroundColor: c.surface, elevation: 1 },
                                    ]}
                                    onPress={() => setThemeMode("system")}
                                >
                                    <Ionicons
                                        name="phone-portrait-outline"
                                        size={14}
                                        color={themeMode === "system" ? c.primary : c.textMuted}
                                    />
                                    <Text
                                        style={[
                                            styles.themeSegmentText,
                                            { color: themeMode === "system" ? c.text : c.textMuted },
                                            themeMode === "system" && { fontWeight: fontWeight.bold },
                                        ]}
                                    >
                                        Sistema
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </View>

                {/* ── 4. Gestión de Organización & Categorías ──────────── */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: c.textMuted }]}>
                        GESTIÓN Y ORGANIZACIÓN
                    </Text>
                    <View style={[styles.cardGroup, { backgroundColor: c.surface, borderColor: c.border }]}>
                        {/* Categorías */}
                        <Pressable
                            style={styles.cardItem}
                            onPress={() => router.push("/(tabs)/categories" as any)}
                        >
                            <View style={styles.itemLeft}>
                                <View style={[styles.itemIconBox, { backgroundColor: c.track }]}>
                                    <Ionicons name="grid-outline" size={18} color={c.primary} />
                                </View>
                                <View>
                                    <Text style={[styles.itemTitle, { color: c.text }]}>Categorías</Text>
                                    <Text style={[styles.itemSub, { color: c.textMuted }]}>
                                        Editar, ordenar o crear categorías
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.itemRight}>
                                <Pressable
                                    style={[styles.smallActionBtn, { backgroundColor: c.primary }]}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        router.push("/category/new" as any);
                                    }}
                                    hitSlop={6}
                                >
                                    <Ionicons name="add" size={16} color="#FFFFFF" />
                                    <Text style={styles.smallActionText}>Nueva</Text>
                                </Pressable>
                                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
                            </View>
                        </Pressable>

                        <View style={[styles.divider, { backgroundColor: c.border }]} />

                        {/* Historial de Movimientos */}
                        <Pressable
                            style={styles.cardItem}
                            onPress={() => router.push("/(tabs)/transactions" as any)}
                        >
                            <View style={styles.itemLeft}>
                                <View style={[styles.itemIconBox, { backgroundColor: c.track }]}>
                                    <Ionicons name="swap-vertical-outline" size={18} color={c.primary} />
                                </View>
                                <View>
                                    <Text style={[styles.itemTitle, { color: c.text }]}>Historial de Movimientos</Text>
                                    <Text style={[styles.itemSub, { color: c.textMuted }]}>
                                        Ver todos los ingresos y gastos registrados
                                    </Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
                        </Pressable>
                    </View>
                </View>

                {/* ── 5. Datos & Exportación ───────────────────────────── */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: c.textMuted }]}>
                        DATOS Y PRIVACIDAD
                    </Text>
                    <View style={[styles.cardGroup, { backgroundColor: c.surface, borderColor: c.border }]}>
                        {/* Enviar informe financiero por correo */}
                        <Pressable
                            style={styles.cardItem}
                            onPress={handleSendFinancialReport}
                            disabled={exporting}
                        >
                            <View style={styles.itemLeft}>
                                <View style={[styles.itemIconBox, { backgroundColor: c.track }]}>
                                    {exporting ? (
                                        <ActivityIndicator size="small" color={c.primary} />
                                    ) : (
                                        <Ionicons name="mail-unread-outline" size={18} color={c.primary} />
                                    )}
                                </View>
                                <View style={{ flex: 1, paddingRight: spacing.sm }}>
                                    <Text style={[styles.itemTitle, { color: c.text }]}>
                                        Enviar informe financiero al correo
                                    </Text>
                                    <Text style={[styles.itemSub, { color: c.textMuted }]}>
                                        {user?.email
                                            ? `Recibe tus balances, presupuestos y gastos en ${user.email}`
                                            : "Recibe un desglose visual y detallado en tu email"}
                                    </Text>
                                </View>
                            </View>
                            <Ionicons name="paper-plane-outline" size={18} color={c.primary} />
                        </Pressable>

                        <View style={[styles.divider, { backgroundColor: c.border }]} />

                        {/* Hide balances */}
                        <View style={styles.cardItem}>
                            <View style={styles.itemLeft}>
                                <View style={[styles.itemIconBox, { backgroundColor: c.track }]}>
                                    <Ionicons name="eye-off-outline" size={18} color={c.primary} />
                                </View>
                                <View>
                                    <Text style={[styles.itemTitle, { color: c.text }]}>Ocultar saldos por defecto</Text>
                                    <Text style={[styles.itemSub, { color: c.textMuted }]}>
                                        Privacidad al abrir la app en público
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={hideBalances}
                                onValueChange={setHideBalances}
                                trackColor={{ false: c.track, true: c.primary }}
                                thumbColor="#FFFFFF"
                            />
                        </View>
                    </View>
                </View>

                {/* ── 6. Notificaciones & Alertas ──────────────────────── */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: c.textMuted }]}>
                        NOTIFICACIONES Y ALERTAS
                    </Text>
                    <View style={[styles.cardGroup, { backgroundColor: c.surface, borderColor: c.border }]}>
                        {/* Notificaciones App */}
                        <View style={styles.cardItem}>
                            <View style={styles.itemLeft}>
                                <View style={[styles.itemIconBox, { backgroundColor: c.track }]}>
                                    <Ionicons name="notifications-outline" size={18} color={c.primary} />
                                </View>
                                <View style={{ flex: 1, paddingRight: spacing.sm }}>
                                    <Text style={[styles.itemTitle, { color: c.text }]}>
                                        Notificaciones en la app
                                    </Text>
                                    <Text style={[styles.itemSub, { color: c.textMuted }]}>
                                        Avisos de presupuestos y metas en la pantalla de inicio
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={notificationsApp}
                                onValueChange={setNotificationsApp}
                                trackColor={{ false: c.track, true: c.primary }}
                                thumbColor="#FFFFFF"
                            />
                        </View>

                        <View style={[styles.divider, { backgroundColor: c.border }]} />

                        {/* Alertas por Correo */}
                        <View style={styles.cardItem}>
                            <View style={styles.itemLeft}>
                                <View style={[styles.itemIconBox, { backgroundColor: c.track }]}>
                                    <Ionicons name="mail-outline" size={18} color={c.primary} />
                                </View>
                                <View style={{ flex: 1, paddingRight: spacing.sm }}>
                                    <Text style={[styles.itemTitle, { color: c.text }]}>
                                        Alertas por correo electrónico
                                    </Text>
                                    <Text style={[styles.itemSub, { color: c.textMuted }]}>
                                        {user?.email
                                            ? `Enviar resúmenes y avisos a ${user.email}`
                                            : "Requiere iniciar sesión con tu cuenta"}
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={notificationsEmail}
                                onValueChange={(val) => {
                                    if (val && !user?.email) {
                                        Alert.alert(
                                            "Cuenta requerida",
                                            "Inicia sesión con tu cuenta de correo o Google para poder recibir alertas en tu email."
                                        );
                                        return;
                                    }
                                    setNotificationsEmail(val);
                                    if (val) {
                                        Alert.alert(
                                            "Alertas por correo activadas",
                                            `Recibirás los resúmenes y alertas críticas de tus finanzas en ${user?.email}.`
                                        );
                                    }
                                }}
                                trackColor={{ false: c.track, true: c.primary }}
                                thumbColor="#FFFFFF"
                            />
                        </View>
                    </View>
                </View>

                {/* ── 7. Seguridad ─────────────────────────────────────── */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: c.textMuted }]}>
                        SEGURIDAD
                    </Text>
                    <View style={[styles.cardGroup, { backgroundColor: c.surface, borderColor: c.border }]}>
                        {/* Biometrics */}
                        <View style={styles.cardItem}>
                            <View style={styles.itemLeft}>
                                <View style={[styles.itemIconBox, { backgroundColor: c.track }]}>
                                    <Ionicons
                                        name={
                                            biometricTypeLabel === "Face ID"
                                                ? "scan-outline"
                                                : "finger-print-outline"
                                        }
                                        size={18}
                                        color={c.primary}
                                    />
                                </View>
                                <View>
                                    <Text style={[styles.itemTitle, { color: c.text }]}>
                                        Bloqueo biométrico
                                    </Text>
                                    <Text style={[styles.itemSub, { color: c.textMuted }]}>
                                        {hasBiometricsHardware
                                            ? "Solicitar autenticación biométrica al abrir la app"
                                            : "No disponible en este dispositivo"}
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={biometricsEnabled}
                                onValueChange={handleToggleBiometrics}
                                disabled={!hasBiometricsHardware}
                                trackColor={{ false: c.track, true: c.primary }}
                                thumbColor="#FFFFFF"
                            />
                        </View>
                    </View>
                </View>

                {/* ── 7. Cerrar sesión ────────────────────────────────── */}
                {isAuthenticated && (
                    <View style={styles.section}>
                        <Pressable
                            style={[
                                styles.logoutCard,
                                {
                                    backgroundColor: c.surface,
                                    borderColor: `${c.danger}35`,
                                },
                            ]}
                            onPress={handleLogout}
                        >
                            <Ionicons name="log-out-outline" size={20} color={c.danger} />
                            <Text style={[styles.logoutCardText, { color: c.danger }]}>
                                Cerrar sesión
                            </Text>
                        </Pressable>
                    </View>
                )}

                {/* ── 8. Version Footer ────────────────────────────────── */}
                <View style={styles.footer}>
                    <Text style={[styles.footerText, { color: c.textMuted }]}>
                        Nummo • v1.0.4
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.md,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.md,
        paddingTop: spacing.xs,
    },
    title: {
        fontSize: fontSize.title,
        fontWeight: fontWeight.bold,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: fontSize.caption + 1,
        marginTop: 2,
    },
    headerIconBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    profileCard: {
        borderRadius: 20,
        borderWidth: 1,
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    profileRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    avatarText: {
        color: "#FFFFFF",
        fontSize: 20,
        fontWeight: fontWeight.bold,
    },
    profileInfo: {
        flex: 1,
    },
    nameRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs + 2,
    },
    profileName: {
        fontSize: fontSize.subtitle,
        fontWeight: fontWeight.bold,
    },
    proBadge: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        gap: 4,
    },
    proDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    proText: {
        fontSize: 10,
        fontWeight: fontWeight.bold,
    },
    profileMeta: {
        fontSize: fontSize.caption,
        marginTop: 2,
    },
    logoutBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: spacing.xs,
    },
    loginBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: spacing.xs,
    },
    loginBtnText: {
        fontSize: fontSize.caption,
        fontWeight: fontWeight.bold,
    },
    syncStatusRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.sm + 4,
        paddingVertical: spacing.xs + 4,
        borderRadius: 12,
        marginTop: spacing.md,
    },
    syncLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    onlineDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
    syncText: {
        fontSize: fontSize.caption,
        fontWeight: fontWeight.medium,
    },
    syncTime: {
        fontSize: fontSize.caption,
    },
    section: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: fontSize.caption,
        fontWeight: fontWeight.semibold,
        letterSpacing: 0.8,
        marginBottom: spacing.xs + 2,
        paddingLeft: 4,
    },
    cardGroup: {
        borderRadius: 20,
        borderWidth: 1,
        overflow: "hidden",
    },
    cardItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 4,
    },
    itemLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm + 4,
        flex: 1,
    },
    itemIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    itemTitle: {
        fontSize: fontSize.body - 1,
        fontWeight: fontWeight.medium,
    },
    itemSub: {
        fontSize: fontSize.caption,
        marginTop: 1,
    },
    itemRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    itemValue: {
        fontSize: fontSize.caption + 1,
        fontWeight: fontWeight.medium,
    },
    smallActionBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginRight: 4,
    },
    smallActionText: {
        color: "#FFFFFF",
        fontSize: 11,
        fontWeight: fontWeight.bold,
    },
    divider: {
        height: 1,
        marginHorizontal: spacing.md,
    },
    themeRow: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 4,
        gap: spacing.sm,
    },
    themeRowHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm + 4,
    },
    themeSegmented: {
        flexDirection: "row",
        borderRadius: 12,
        padding: 3,
        gap: 4,
    },
    themeSegmentBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8,
        borderRadius: 10,
        gap: 6,
    },
    themeSegmentText: {
        fontSize: fontSize.caption,
        fontWeight: fontWeight.semibold,
    },
    logoutCard: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        paddingVertical: spacing.md,
        borderRadius: 16,
        borderWidth: 1,
    },
    logoutCardText: {
        fontSize: fontSize.body,
        fontWeight: fontWeight.bold,
    },
    footer: {
        alignItems: "center",
        paddingVertical: spacing.md,
    },
    footerText: {
        fontSize: fontSize.caption,
    },
});
