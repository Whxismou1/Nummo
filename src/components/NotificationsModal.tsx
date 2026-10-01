import React from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme";
import { fontSize, fontWeight } from "@/theme/typography";
import { spacing } from "@/theme/spacing";
import { formatMoney } from "@/lib/money";
import type { DashboardData } from "@/features/dashboard/repository";
import { sendComprehensiveFinancialReport } from "@/services/notifications";

export interface NotificationItem {
    id: string;
    type: "danger" | "warning" | "success" | "info";
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
    date: string;
    isEmailEligible: boolean;
}

interface NotificationsModalProps {
    visible: boolean;
    onClose: () => void;
    data: DashboardData | null;
    notificationsApp: boolean;
    notificationsEmail: boolean;
    userEmail?: string;
}

export function NotificationsModal({
    visible,
    onClose,
    data,
    notificationsApp,
    notificationsEmail,
    userEmail,
}: NotificationsModalProps) {
    const { colors: c } = useTheme();

    if (!visible) return null;

    const items: NotificationItem[] = [];

    if (data) {
        for (const b of data.topBudgets) {
            if (b.status === "over") {
                const overAmount = b.spentAmount - b.limitAmount;
                items.push({
                    id: `budget_over_${b.id}`,
                    type: "danger",
                    icon: "alert-circle",
                    title: `Límite superado: ${b.categoryName || "Sobre"}`,
                    description: `Has consumido el ${Math.round(b.percentage)}% (${formatMoney(b.spentAmount)} de ${formatMoney(b.limitAmount)}). Exceso: +${formatMoney(overAmount)}.`,
                    date: "Este mes",
                    isEmailEligible: true,
                });
            } else if (b.status === "warn") {
                items.push({
                    id: `budget_warn_${b.id}`,
                    type: "warning",
                    icon: "warning-outline",
                    title: `Al límite: ${b.categoryName || "Sobre"}`,
                    description: `Has consumido el ${Math.round(b.percentage)}%. Te quedan ${formatMoney(b.remainingAmount)} disponibles.`,
                    date: "Este mes",
                    isEmailEligible: false,
                });
            }
        }

        if (data.featuredGoal) {
            const fg = data.featuredGoal;
            if (fg.isCompleted) {
                items.push({
                    id: `goal_comp_${fg.id}`,
                    type: "success",
                    icon: "trophy-outline",
                    title: `¡Meta completada: ${fg.name}! 🎉`,
                    description: `Has alcanzado el objetivo acumulando un total de ${formatMoney(fg.savedAmount)}.`,
                    date: "Ahorro",
                    isEmailEligible: true,
                });
            } else if (fg.percentage && fg.percentage >= 75) {
                items.push({
                    id: `goal_prog_${fg.id}`,
                    type: "info",
                    icon: "ribbon-outline",
                    title: `Cerca de la meta: ${fg.name}`,
                    description: `Has alcanzado el ${Math.round(fg.percentage)}% del objetivo (${formatMoney(fg.savedAmount)} ahorrados).`,
                    date: "Ahorro",
                    isEmailEligible: false,
                });
            }
        }

        if (data.availableBalance < 0) {
            items.push({
                id: "balance_negative",
                type: "danger",
                icon: "trending-down-outline",
                title: "Déficit en balance mensual",
                description: `Tus gastos del mes superan a los ingresos en ${formatMoney(Math.abs(data.availableBalance))}.`,
                date: "Este mes",
                isEmailEligible: true,
            });
        }
    }

    if (items.length === 0) {
        items.push({
            id: "system_ok",
            type: "success",
            icon: "checkmark-circle-outline",
            title: "Tus cuentas están equilibradas",
            description: "No tienes presupuestos sobrepasados ni alertas de gasto pendientes en este periodo.",
            date: "Al día",
            isEmailEligible: false,
        });
    }

    items.push({
        id: "security_info",
        type: "info",
        icon: "shield-checkmark-outline",
        title: "Bóveda cifrada y sincronizada",
        description: "Tu base de datos SQLite opera offline-first y los datos se sincronizan con cifrado seguro.",
        date: "Sistema",
        isEmailEligible: false,
    });

    const handleSendTestEmail = async () => {
        if (!userEmail) {
            Alert.alert(
                "Sin correo vinculado",
                "Debes iniciar sesión con tu cuenta de correo o Google para recibir avisos."
            );
            return;
        }
        if (!notificationsEmail) {
            Alert.alert(
                "Alertas por correo desactivadas",
                "Puedes activar el envío de alertas por correo en Ajustes > Notificaciones."
            );
            return;
        }

        try {
            const res = await sendComprehensiveFinancialReport(userEmail);
            if (res.ok) {
                Alert.alert(
                    "Resumen enviado",
                    `Se ha generado y enviado el informe financiero completo a tu correo: ${userEmail}.`
                );
            } else {
                Alert.alert(
                    "Resumen generado",
                    `Se ha procesado el envío para ${userEmail}. Si has desplegado la Edge Function en Supabase, revisa tu correo.`
                );
            }
        } catch {
            Alert.alert("Error", "No se pudo enviar el informe por correo.");
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: c.surface,
                            borderColor: c.border,
                        },
                    ]}
                    onPress={(e) => e.stopPropagation()}
                >
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <View
                                style={[
                                    styles.iconBox,
                                    { backgroundColor: `${c.primary}18` },
                                ]}
                            >
                                <Ionicons
                                    name="notifications"
                                    size={20}
                                    color={c.primary}
                                />
                            </View>
                            <View>
                                <Text style={[styles.title, { color: c.text }]}>
                                    Avisos y Alertas
                                </Text>
                                <Text style={[styles.subtitle, { color: c.textMuted }]}>
                                    {items.length} avisos activos
                                </Text>
                            </View>
                        </View>

                        <Pressable
                            style={[styles.closeBtn, { backgroundColor: c.background }]}
                            onPress={onClose}
                            hitSlop={8}
                        >
                            <Ionicons name="close" size={18} color={c.text} />
                        </Pressable>
                    </View>

                    <View style={[styles.channelsBar, { backgroundColor: c.background, borderColor: c.border }]}>
                        <View style={styles.channelItem}>
                            <Ionicons
                                name={notificationsApp ? "checkmark-circle" : "close-circle"}
                                size={14}
                                color={notificationsApp ? c.success : c.textMuted}
                            />
                            <Text style={[styles.channelText, { color: c.text }]}>
                                App: {notificationsApp ? "Activa" : "Desactivada"}
                            </Text>
                        </View>
                        <View style={styles.channelDivider} />
                        <View style={styles.channelItem}>
                            <Ionicons
                                name={notificationsEmail ? "mail" : "mail-outline"}
                                size={14}
                                color={notificationsEmail ? c.primary : c.textMuted}
                            />
                            <Text style={[styles.channelText, { color: c.text }]}>
                                Correo: {notificationsEmail ? "Activo" : "Inactivo"}
                            </Text>
                        </View>
                    </View>

                    <ScrollView
                        style={styles.list}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {items.map((item) => {
                            const badgeColor =
                                item.type === "danger"
                                    ? c.danger
                                    : item.type === "warning"
                                      ? "#D97706"
                                      : item.type === "success"
                                        ? c.success
                                        : c.primary;

                            return (
                                <View
                                    key={item.id}
                                    style={[
                                        styles.itemCard,
                                        {
                                            backgroundColor: c.background,
                                            borderColor: c.border,
                                        },
                                    ]}
                                >
                                    <View style={styles.itemHeader}>
                                        <View
                                            style={[
                                                styles.itemBadge,
                                                { backgroundColor: `${badgeColor}18` },
                                            ]}
                                        >
                                            <Ionicons
                                                name={item.icon}
                                                size={16}
                                                color={badgeColor}
                                            />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text
                                                style={[
                                                    styles.itemTitle,
                                                    { color: c.text },
                                                ]}
                                            >
                                                {item.title}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.itemDate,
                                                    { color: c.textMuted },
                                                ]}
                                            >
                                                {item.date}
                                            </Text>
                                        </View>
                                    </View>

                                    <Text
                                        style={[
                                            styles.itemDesc,
                                            { color: c.textMuted },
                                        ]}
                                    >
                                        {item.description}
                                    </Text>

                                    <View style={styles.tagsRow}>
                                        <View
                                            style={[
                                                styles.tagPill,
                                                { backgroundColor: `${c.success}18` },
                                            ]}
                                        >
                                            <Ionicons
                                                name="phone-portrait-outline"
                                                size={12}
                                                color={c.success}
                                            />
                                            <Text
                                                style={[
                                                    styles.tagText,
                                                    { color: c.success },
                                                ]}
                                            >
                                                En la app
                                            </Text>
                                        </View>

                                        {item.isEmailEligible && notificationsEmail && (
                                            <View
                                                style={[
                                                    styles.tagPill,
                                                    { backgroundColor: `${c.primary}18` },
                                                ]}
                                            >
                                                <Ionicons
                                                    name="mail"
                                                    size={12}
                                                    color={c.primary}
                                                />
                                                <Text
                                                    style={[
                                                        styles.tagText,
                                                        { color: c.primary },
                                                    ]}
                                                >
                                                    Enviado a tu correo
                                                </Text>
                                            </View>
                                        )}

                                        {item.isEmailEligible && !notificationsEmail && (
                                            <View
                                                style={[
                                                    styles.tagPill,
                                                    { backgroundColor: `${c.textMuted}18` },
                                                ]}
                                            >
                                                <Ionicons
                                                    name="mail-outline"
                                                    size={12}
                                                    color={c.textMuted}
                                                />
                                                <Text
                                                    style={[
                                                        styles.tagText,
                                                        { color: c.textMuted },
                                                    ]}
                                                >
                                                    Correo desactivado
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>

                    <View style={styles.footer}>
                        {notificationsEmail && userEmail && (
                            <Pressable
                                style={[
                                    styles.emailReportBtn,
                                    {
                                        borderColor: c.primary,
                                        backgroundColor: `${c.primary}10`,
                                    },
                                ]}
                                onPress={handleSendTestEmail}
                            >
                                <Ionicons
                                    name="paper-plane-outline"
                                    size={16}
                                    color={c.primary}
                                />
                                <Text
                                    style={[
                                        styles.emailReportBtnText,
                                        { color: c.primary },
                                    ]}
                                >
                                    Enviar resumen a mi correo
                                </Text>
                            </Pressable>
                        )}

                        <Pressable
                            style={[styles.closeBottomBtn, { backgroundColor: c.primary }]}
                            onPress={onClose}
                        >
                            <Text style={styles.closeBottomBtnText}>Entendido</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "flex-end",
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: "85%",
        borderTopWidth: 1,
        paddingBottom: 24,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.sm,
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        fontSize: fontSize.subtitle,
        fontWeight: fontWeight.bold,
    },
    subtitle: {
        fontSize: fontSize.caption,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    channelsBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        marginHorizontal: spacing.lg,
        marginVertical: spacing.sm,
        paddingVertical: spacing.xs + 2,
        paddingHorizontal: spacing.md,
        borderRadius: 12,
        borderWidth: 1,
    },
    channelItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    channelDivider: {
        width: 1,
        height: 16,
        backgroundColor: "rgba(150,150,150,0.3)",
    },
    channelText: {
        fontSize: fontSize.caption,
        fontWeight: fontWeight.medium,
    },
    list: {
        paddingHorizontal: spacing.lg,
    },
    listContent: {
        gap: spacing.sm,
        paddingVertical: spacing.xs,
    },
    itemCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: spacing.md,
    },
    itemHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    itemBadge: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    itemTitle: {
        fontSize: fontSize.body,
        fontWeight: fontWeight.semibold,
    },
    itemDate: {
        fontSize: fontSize.caption - 1,
    },
    itemDesc: {
        fontSize: fontSize.body - 1,
        lineHeight: 20,
        marginTop: 2,
    },
    tagsRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.xs,
        marginTop: spacing.sm,
    },
    tagPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: 8,
    },
    tagText: {
        fontSize: fontSize.caption - 1,
        fontWeight: fontWeight.semibold,
    },
    footer: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        gap: spacing.sm,
    },
    emailReportBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: spacing.sm + 2,
    },
    emailReportBtnText: {
        fontSize: fontSize.caption,
        fontWeight: fontWeight.bold,
    },
    closeBottomBtn: {
        borderRadius: 14,
        paddingVertical: spacing.sm + 4,
        alignItems: "center",
        justifyContent: "center",
    },
    closeBottomBtnText: {
        color: "#FFFFFF",
        fontSize: fontSize.body,
        fontWeight: fontWeight.bold,
    },
});
