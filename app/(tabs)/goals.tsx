import { useGoals } from "@/features/goals/useGoals";
import { formatMoney } from "@/lib/money";
import { useTheme } from "@/theme";
import { fontSize, fontWeight } from "@/theme/typography";
import { spacing } from "@/theme/spacing";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppSettings } from "@/features/settings/SettingsContext";

export default function GoalsScreen() {
    const { colors: c } = useTheme();
    const { currency, hideBalances } = useAppSettings();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const { goals, loading, reload, removeGoal } = useGoals();

    useFocusEffect(
        useCallback(() => {
            void reload();
        }, [reload]),
    );

    const totalSaved = goals.reduce((sum, g) => sum + g.savedAmount, 0);

    const handleDelete = (id: string, name: string) => {
        Alert.alert(
            "Eliminar hucha",
            `¿Seguro que quieres eliminar la hucha "${name}"? Los movimientos de aportación seguirán existiendo pero desvinculados de la hucha.`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: () => void removeGoal(id),
                },
            ],
        );
    };

    const styles = useMemo(() => {
        return StyleSheet.create({
            screen: {
                flex: 1,
                backgroundColor: c.background,
            },
            loadingContainer: {
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: c.background,
            },
            listContent: {
                paddingBottom: insets.bottom + 90,
                paddingTop: insets.top + spacing.sm,
            },
            headerSection: {
                paddingHorizontal: spacing.md,
                marginBottom: spacing.md,
            },
            securityPillRow: {
                flexDirection: "row",
                alignItems: "center",
                marginBottom: spacing.md,
                gap: spacing.sm,
            },
            securityPill: {
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: c.surface,
                paddingHorizontal: spacing.sm,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: c.border,
                gap: 6,
            },
            pulseDot: {
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: c.success,
            },
            securityPillText: {
                fontSize: fontSize.caption,
                fontWeight: fontWeight.medium,
                color: c.text,
            },
            offlineFirst: {
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
            },
            offlineText: {
                fontSize: fontSize.caption,
                color: c.textMuted,
            },
            titleRow: {
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: spacing.md,
            },
            title: {
                fontSize: fontSize.heading,
                fontWeight: fontWeight.bold,
                color: c.text,
            },
            subtitle: {
                fontSize: fontSize.body,
                color: c.textMuted,
                marginTop: 2,
            },
            addBtn: {
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: c.primary,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: c.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
            },
            heroCard: {
                backgroundColor: c.surface,
                borderRadius: 20,
                padding: spacing.lg,
                marginBottom: spacing.xl,
                marginHorizontal: spacing.md,
                borderWidth: 1,
                borderColor: c.border,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
            },
            heroTopRow: {
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: spacing.md,
            },
            heroLabel: {
                fontSize: fontSize.body,
                color: c.textMuted,
                marginBottom: 4,
            },
            heroAmount: {
                fontSize: fontSize.heading,
                fontWeight: fontWeight.bold,
                color: c.text,
            },
            heroGoalsCount: {
                fontSize: fontSize.caption,
                color: c.textMuted,
                marginTop: 4,
            },
            heroIconBg: {
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: c.background,
                alignItems: "center",
                justifyContent: "center",
            },
            heroIcon: {
                fontSize: 24,
            },
            heroSubCard: {
                backgroundColor: c.background,
                borderRadius: 16,
                padding: spacing.md,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
            },
            heroSubLeft: {
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
            },
            heroSubText: {
                fontSize: fontSize.caption,
                color: c.textMuted,
                fontWeight: fontWeight.medium,
            },
            heroSubAmount: {
                fontSize: fontSize.body,
                fontWeight: fontWeight.bold,
                color: c.success,
            },
            sectionHeader: {
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: spacing.md,
                marginBottom: spacing.md,
                gap: spacing.sm,
            },
            sectionTitle: {
                fontSize: fontSize.subtitle,
                fontWeight: fontWeight.semibold,
                color: c.text,
            },
            activeBadge: {
                backgroundColor: c.surface,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: c.border,
            },
            activeBadgeText: {
                fontSize: fontSize.caption,
                fontWeight: fontWeight.medium,
                color: c.textMuted,
            },
            goalCard: {
                backgroundColor: c.surface,
                borderRadius: 20,
                padding: spacing.md,
                marginHorizontal: spacing.md,
                marginBottom: spacing.md,
                borderWidth: 1,
                borderColor: c.border,
            },
            goalTop: {
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: spacing.md,
            },
            goalLeft: {
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                flex: 1,
            },
            goalIconBg: {
                width: 48,
                height: 48,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
            },
            goalIcon: {
                fontSize: 24,
            },
            goalName: {
                fontSize: fontSize.body,
                fontWeight: fontWeight.semibold,
                color: c.text,
                marginBottom: 2,
            },
            goalSubtitle: {
                fontSize: fontSize.caption,
                color: c.textMuted,
            },
            goalRight: {
                alignItems: "flex-end",
            },
            goalPercent: {
                fontSize: fontSize.subtitle,
                fontWeight: fontWeight.bold,
                color: c.text,
            },
            goalPercentLabel: {
                fontSize: 10,
                color: c.textMuted,
                textTransform: "uppercase",
                marginTop: 2,
            },
            progressTrack: {
                height: 10,
                backgroundColor: c.track,
                borderRadius: 999,
                padding: 1,
                marginBottom: spacing.sm,
                overflow: "hidden",
            },
            progressFill: {
                height: "100%",
                borderRadius: 999,
            },
            goalSavedRow: {
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: spacing.md,
            },
            goalSavedAmount: {
                fontSize: fontSize.subtitle,
                fontWeight: fontWeight.bold,
                color: c.text,
            },
            goalTargetAmount: {
                fontSize: fontSize.caption,
                color: c.textMuted,
            },
            goalBottom: {
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                borderTopWidth: 1,
                borderTopColor: c.border,
                paddingTop: spacing.md,
            },
            goalDateInfo: {
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
            },
            goalDateText: {
                fontSize: fontSize.caption,
                color: c.textMuted,
            },
            aportarBtn: {
                backgroundColor: c.background,
                paddingHorizontal: spacing.md,
                paddingVertical: 8,
                borderRadius: 12,
            },
            aportarBtnText: {
                color: c.primary,
                fontWeight: fontWeight.bold,
                fontSize: fontSize.caption,
            },
            privacyCard: {
                backgroundColor: c.surface,
                borderRadius: 20,
                padding: spacing.md,
                marginHorizontal: spacing.md,
                marginTop: spacing.sm,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                borderWidth: 1,
                borderColor: c.border,
            },
            privacyIconBg: {
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: c.background,
                alignItems: "center",
                justifyContent: "center",
            },
            privacyTextContainer: {
                flex: 1,
            },
            privacyTitle: {
                fontSize: fontSize.body,
                fontWeight: fontWeight.semibold,
                color: c.text,
                marginBottom: 2,
            },
            privacyDesc: {
                fontSize: fontSize.caption,
                color: c.textMuted,
                lineHeight: 16,
            },
            emptyContainer: {
                backgroundColor: c.surface,
                borderRadius: 20,
                padding: spacing.xl,
                marginHorizontal: spacing.md,
                alignItems: "center",
                borderWidth: 1,
                borderColor: c.border,
                borderStyle: "dashed",
            },
            emptyEmoji: {
                fontSize: 48,
                marginBottom: spacing.md,
            },
            emptyTitle: {
                fontSize: fontSize.subtitle,
                fontWeight: fontWeight.bold,
                color: c.text,
                marginBottom: spacing.sm,
            },
            emptySubtitle: {
                fontSize: fontSize.body,
                color: c.textMuted,
                textAlign: "center",
                lineHeight: 22,
            },
        });
    }, [c, insets]);

    const listHeader = useMemo(
        () => (
            <View>
                <View style={styles.headerSection}>
                    <View style={styles.titleRow}>
                        <View>
                            <Text style={styles.title}>Huchas de Ahorro</Text>
                            <Text style={styles.subtitle}>
                                Total acumulado: {hideBalances ? "••••" : formatMoney(totalSaved)}
                            </Text>
                        </View>
                        <Pressable
                            style={styles.addBtn}
                            onPress={() => router.push("/goal/new" as any)}
                        >
                            <Ionicons name="add" size={24} color="#FFF" />
                        </Pressable>
                    </View>
                </View>

                <View style={styles.heroCard}>
                    <View style={styles.heroTopRow}>
                        <View>
                            <Text style={styles.heroLabel}>Rendimiento acumulado</Text>
                            <Text style={styles.heroAmount}>{hideBalances ? "••••" : formatMoney(totalSaved)}</Text>
                            <Text style={styles.heroGoalsCount}>
                                en {goals.length} {goals.length === 1 ? "meta" : "metas"}
                            </Text>
                        </View>
                        <View style={styles.heroIconBg}>
                            <Text style={styles.heroIcon}>🎯</Text>
                        </View>
                    </View>
                    <View style={styles.heroSubCard}>
                        <View style={styles.heroSubLeft}>
                            <Ionicons name="sparkles" size={16} color={c.primary} />
                            <Text style={styles.heroSubText}>Ahorro activo</Text>
                        </View>
                        <Text style={[styles.heroSubAmount, { color: c.primary }]}>
                            {goals.filter(g => g.isCompleted).length} metas cumplidas
                        </Text>
                    </View>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Metas en curso</Text>
                    <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>
                            {goals.length} {goals.length === 1 ? "activa" : "activas"}
                        </Text>
                    </View>
                </View>
            </View>
        ),
        [c, goals, hideBalances, router, styles, totalSaved],
    );

    const listEmpty = useMemo(
        () => (
            <Pressable
                style={styles.emptyContainer}
                onPress={() => router.push("/goal/new" as any)}
            >
                <Text style={styles.emptyEmoji}>🎯</Text>
                <Text style={styles.emptyTitle}>Aún no tienes ninguna hucha</Text>
                <Text style={styles.emptySubtitle}>
                    Crea una meta de ahorro para apartar dinero para tus vacaciones, compras o un fondo para imprevistos.
                </Text>
            </Pressable>
        ),
        [router, styles],
    );

    const renderItem = useCallback(
        ({ item }: { item: any }) => {
            const hasTarget = item.targetAmount !== null;
            const percent = hasTarget ? item.percentage ?? 0 : null;
            const subtitle = hasTarget
                ? (hideBalances ? "Meta: ••••" : `Meta: ${formatMoney(item.targetAmount)}`)
                : "Sin límite";
            const isCompleted = item.isCompleted;

            return (
                <Pressable
                    style={styles.goalCard}
                    onPress={() => router.push({ pathname: "/goal/[id]", params: { id: item.id } } as any)}
                    onLongPress={() => handleDelete(item.id, item.name)}
                >
                    <View style={styles.goalTop}>
                        <View style={styles.goalLeft}>
                            <View style={[styles.goalIconBg, { backgroundColor: item.color + "20" }]}>
                                <Text style={styles.goalIcon}>{item.icon}</Text>
                            </View>
                            <View>
                                <Text style={styles.goalName}>{item.name}</Text>
                                <Text style={styles.goalSubtitle}>{subtitle}</Text>
                            </View>
                        </View>
                        <View style={styles.goalRight}>
                            <Text style={styles.goalPercent}>
                                {hasTarget ? `${Math.floor(percent!)}%` : "∞"}
                            </Text>
                            <Text style={styles.goalPercentLabel}>Completado</Text>
                        </View>
                    </View>

                    {hasTarget && (
                        <View style={styles.progressTrack}>
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        backgroundColor: isCompleted ? c.success : item.color,
                                        width: `${Math.min(Math.max(percent || 0, 0), 100)}%`,
                                    },
                                ]}
                            />
                        </View>
                    )}

                    <View style={styles.goalSavedRow}>
                        <Text style={styles.goalSavedAmount}>
                            {hideBalances ? "••••" : formatMoney(item.savedAmount)}
                        </Text>
                        {hasTarget && (
                            <Text style={styles.goalTargetAmount}>
                                {hideBalances ? "Meta: ••••" : `Meta: ${formatMoney(item.targetAmount)}`}
                            </Text>
                        )}
                    </View>

                    <View style={styles.goalBottom}>
                        <View style={styles.goalDateInfo}>
                            <Ionicons name="calendar-outline" size={14} color={c.textMuted} />
                            <Text style={styles.goalDateText}>
                                Creada el {new Date(item.createdAt).toLocaleDateString()}
                            </Text>
                        </View>
                        <Pressable
                            style={styles.aportarBtn}
                            onPress={() => router.push({ pathname: "/goal/[id]", params: { id: item.id } } as any)}
                        >
                            <Text style={styles.aportarBtnText}>Aportar</Text>
                        </Pressable>
                    </View>
                </Pressable>
            );
        },
        [c, handleDelete, hideBalances, router, styles],
    );

    return (
        <View style={styles.screen}>
            <FlatList
                data={goals}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                ListHeaderComponent={listHeader}
                ListEmptyComponent={listEmpty}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}
