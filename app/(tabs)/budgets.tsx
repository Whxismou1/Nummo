import { useBudgets } from "@/features/budgets/useBudgets";
import { formatPeriod } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { useTheme } from "@/theme";
import { fontSize, fontWeight } from "@/theme/typography";
import { spacing } from "@/theme/spacing";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppSettings } from "@/features/settings/SettingsContext";

// Helper to get days remaining in the month of the period
const getDaysRemaining = (period: string) => {
    if (!period) return 0;
    const [year, month] = period.split("-").map(Number);
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
    
    if (isCurrentMonth) {
        const lastDay = new Date(year, month, 0).getDate();
        return Math.max(0, lastDay - now.getDate());
    } else {
        const lastDay = new Date(year, month, 0).getDate();
        return lastDay;
    }
};

const MONTH_NAMES = [
    "Ene", "Feb", "Mar", "Abr",
    "May", "Jun", "Jul", "Ago",
    "Sep", "Oct", "Nov", "Dic",
];

type FilterType = "all" | "warn" | "over" | "ok";

export default function BudgetsScreen() {
    const { colors: c } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { currency, hideBalances } = useAppSettings();

    const {
        period,
        overview,
        loading,
        reload,
        goToPrevMonth,
        goToNextMonth,
        goToCurrentMonth,
        setPeriod,
        removeBudget,
    } = useBudgets();

    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [pickerYear, setPickerYear] = useState(new Date().getFullYear());

    useFocusEffect(
        useCallback(() => {
            void reload();
        }, [reload])
    );

    const [activeFilter, setActiveFilter] = useState<FilterType>("all");

    const handleDelete = (id: string, name?: string) => {
        Alert.alert(
            "Eliminar sobre",
            `¿Seguro que quieres eliminar el presupuesto para "${name ?? "este elemento"}"?`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: () => void removeBudget(id),
                },
            ]
        );
    };

    const styles = useMemo(() => createStyles(c, insets), [c, insets]);

    const globalLimit = overview?.globalBudget?.limitAmount ?? overview?.totalBudgeted ?? 0;
    const globalSpent = overview?.totalSpent ?? 0;
    const globalRemaining = Math.max(0, globalLimit - globalSpent);
    const globalPercentage = globalLimit > 0 ? (globalSpent / globalLimit) * 100 : 0;
    const clampedGlobalPercentage = Math.min(100, Math.max(0, globalPercentage));
    
    const daysRemaining = getDaysRemaining(period);
    const perDay = daysRemaining > 0 ? globalRemaining / daysRemaining : 0;

    const counts = {
        all: overview?.categoryBudgets.length ?? 0,
        warn: overview?.categoryBudgets.filter(b => b.status === "warn").length ?? 0,
        over: overview?.categoryBudgets.filter(b => b.status === "over").length ?? 0,
        ok: overview?.categoryBudgets.filter(b => b.status === "ok").length ?? 0,
    };

    const filteredBudgets = overview?.categoryBudgets.filter(b => {
        if (activeFilter === "all") return true;
        return b.status === activeFilter;
    }) ?? [];

    const getStatusColor = (status: "ok" | "warn" | "over") => {
        if (status === "ok") return c.success || "#10b981"; // emerald
        if (status === "warn") return c.warning || "#f59e0b"; // amber
        return c.danger || "#ef4444"; // red
    };

    const getStatusIcon = (status: "ok" | "warn" | "over") => {
        if (status === "ok") return "checkmark-circle";
        if (status === "warn") return "warning";
        return "alert-circle";
    };

    const getStatusLabel = (status: "ok" | "warn" | "over") => {
        if (status === "ok") return "Holgado";
        if (status === "warn") return "Al límite";
        return "Excedido";
    };

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.headerContainer}>
                <View style={styles.headerTop}>
                    <Text style={styles.title}>Presupuestos</Text>
                    <View style={styles.securityPill}>
                        <Ionicons name="wallet-outline" size={13} color={c.primary} />
                        <Text style={[styles.securityText, { color: c.primary, fontWeight: fontWeight.semibold }]}>
                            {overview?.categoryBudgets.length ?? 0} sobres activos
                        </Text>
                    </View>
                </View>

                <View style={styles.headerActions}>
                    <View style={styles.periodSelectorContainer}>
                        <Pressable onPress={goToPrevMonth} hitSlop={10} style={styles.periodArrow}>
                            <Ionicons name="chevron-back" size={20} color={c.text} />
                        </Pressable>
                        
                        <Pressable
                            style={styles.periodPill}
                            onPress={() => {
                                const y = parseInt(period.split("-")[0], 10) || new Date().getFullYear();
                                setPickerYear(y);
                                setShowMonthPicker(true);
                            }}
                            hitSlop={6}
                        >
                            <Ionicons name="calendar-outline" size={16} color={c.primary} />
                            <Text style={styles.periodText}>{formatPeriod(period)}</Text>
                            <Ionicons name="chevron-down" size={13} color={c.textMuted} />
                        </Pressable>

                        <Pressable onPress={goToNextMonth} hitSlop={10} style={styles.periodArrow}>
                            <Ionicons name="chevron-forward" size={20} color={c.text} />
                        </Pressable>
                    </View>

                    {/* Botón Hoy */}
                    <Pressable
                        style={[styles.todayBtn, { backgroundColor: c.surface, borderColor: c.border }]}
                        onPress={goToCurrentMonth}
                        hitSlop={8}
                    >
                        <Text style={[styles.todayBtnText, { color: c.primary }]}>Hoy</Text>
                    </Pressable>

                    <Pressable
                        style={styles.addButtonCircle}
                        onPress={() => router.push({ pathname: "/budget/new" as any, params: { period } })}
                    >
                        <Ionicons name="add" size={24} color={c.primaryText || "#fff"} />
                    </Pressable>
                </View>
            </View>

            {loading && !overview ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={c.primary} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Summary Card */}
                    <View style={styles.summaryCard}>
                        {/* Ambient glow decoration */}
                        <View style={styles.ambientGlow1} />
                        <View style={styles.ambientGlow2} />
                        
                        <View style={styles.summaryContent}>
                            <View style={styles.summaryTopRow}>
                                <Text style={styles.summaryLabel}>Gasto total del mes</Text>
                                <View style={styles.badgeContainer}>
                                    <Text style={styles.badgeText}>Límite global</Text>
                                    <View style={styles.badgePercent}>
                                        <Text style={styles.badgePercentText}>{globalPercentage.toFixed(1).replace(".", ",")}%</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.summaryAmounts}>
                                <Text style={styles.spentAmount}>
                                    {hideBalances ? "••••" : formatMoney(globalSpent)}
                                </Text>
                                <Text style={styles.limitAmount}>
                                    {" "} / {hideBalances ? "••••" : formatMoney(globalLimit)}
                                </Text>
                            </View>

                            <View style={styles.progressBarBg}>
                                <View style={[styles.progressBarFill, { width: `${clampedGlobalPercentage}%`, backgroundColor: globalPercentage > 100 ? c.danger : c.primary }]} />
                            </View>

                            {globalLimit > 0 && (
                                <View style={styles.insightRow}>
                                    <Ionicons name="hourglass-outline" size={16} color={c.textMuted} />
                                    <Text style={styles.insightText}>
                                        Te quedan {hideBalances ? "••••" : formatMoney(globalRemaining)} para {daysRemaining} días
                                    </Text>
                                    {daysRemaining > 0 && (
                                        <Text style={styles.insightPerDay}>
                                            ~{hideBalances ? "••••" : formatMoney(Math.round(perDay))}/día
                                        </Text>
                                    )}
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Filters */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContainer}>
                        {(["all", "warn", "over", "ok"] as FilterType[]).map((filter) => {
                            const labels: Record<FilterType, string> = {
                                all: "Todos",
                                warn: "Al límite",
                                over: "Excedidos",
                                ok: "Holgados"
                            };
                            const isActive = activeFilter === filter;
                            return (
                                <Pressable
                                    key={filter}
                                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                                    onPress={() => setActiveFilter(filter)}
                                >
                                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                                        {labels[filter]} ({counts[filter]})
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>

                    {/* Budget Cards List */}
                    <View style={styles.budgetList}>
                        {filteredBudgets.map(b => {
                            const statusColor = getStatusColor(b.status);
                            const percentClamped = Math.min(100, Math.max(0, b.percentage));
                            
                            return (
                                <Pressable
                                    key={b.id}
                                    style={styles.budgetCard}
                                    onPress={() => router.push({ pathname: "/budget/[id]" as any, params: { id: b.id } })}
                                    onLongPress={() => handleDelete(b.id, b.categoryName)}
                                >
                                    <View style={styles.budgetCardTop}>
                                        <View style={styles.budgetCardLeft}>
                                            <View style={[styles.categoryIconBg, { backgroundColor: (b.categoryColor || c.primary) + "20" }]}>
                                                <Text style={styles.categoryIconText}>{b.categoryIcon || "📂"}</Text>
                                            </View>
                                            <View>
                                                <Text style={styles.categoryName}>{b.categoryName || "Presupuesto"}</Text>
                                                <Text style={[styles.categorySubtitle, { color: statusColor }]}>
                                                    {b.percentage.toFixed(1).replace(".", ",")}% consumido
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={styles.budgetCardRight}>
                                            <Text style={styles.budgetSpent}>
                                                {hideBalances ? "••••" : formatMoney(b.spentAmount)}
                                            </Text>
                                            <Text style={styles.budgetLimit}>
                                                de {hideBalances ? "••••" : formatMoney(b.limitAmount)}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.cardProgressBarBg}>
                                        <View style={[styles.cardProgressBarFill, { width: `${percentClamped}%`, backgroundColor: statusColor }]} />
                                    </View>

                                    <View style={styles.budgetCardBottom}>
                                        <View style={styles.statusContainer}>
                                            <Ionicons name={getStatusIcon(b.status)} size={14} color={statusColor} />
                                            <Text style={[styles.statusText, { color: statusColor }]}>{getStatusLabel(b.status)}</Text>
                                        </View>
                                        <Text style={styles.remainingText}>
                                            {hideBalances ? "•••• restantes" : `${formatMoney(b.remainingAmount)} restantes`}
                                        </Text>
                                    </View>
                                </Pressable>
                            );
                        })}
                        
                        {filteredBudgets.length === 0 && (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyEmoji}>✉️</Text>
                                <Text style={styles.emptyTitle}>
                                    {activeFilter === "all"
                                        ? "Sin sobres creados este mes"
                                        : "No hay sobres con este estado"}
                                </Text>
                                <Text style={styles.emptyStateText}>
                                    {activeFilter === "all"
                                        ? "Crea sobres para organizar lo que quieres gastar en cada categoría o fijar un límite global."
                                        : "Prueba a seleccionar otro filtro para ver tus sobres."}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Footer Button */}
                    <Pressable
                        style={styles.createButton}
                        onPress={() => router.push({ pathname: "/budget/new" as any, params: { period } })}
                    >
                        <Text style={styles.createButtonText}>Crear nuevo sobre de gasto</Text>
                    </Pressable>
                </ScrollView>
            )}

            {/* ── Month & Year Picker Modal ─────────────────── */}
            <Modal
                visible={showMonthPicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowMonthPicker(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowMonthPicker(false)}
                >
                    <Pressable
                        style={[
                            styles.pickerDialog,
                            { backgroundColor: c.surface, borderColor: c.border },
                        ]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        {/* Year Selector */}
                        <View style={styles.pickerYearRow}>
                            <Pressable
                                onPress={() => setPickerYear((y) => y - 1)}
                                style={[styles.yearArrow, { backgroundColor: c.track }]}
                                hitSlop={10}
                            >
                                <Ionicons name="chevron-back" size={18} color={c.text} />
                            </Pressable>
                            <Text style={[styles.pickerYearText, { color: c.text }]}>
                                {pickerYear}
                            </Text>
                            <Pressable
                                onPress={() => setPickerYear((y) => y + 1)}
                                style={[styles.yearArrow, { backgroundColor: c.track }]}
                                hitSlop={10}
                            >
                                <Ionicons name="chevron-forward" size={18} color={c.text} />
                            </Pressable>
                        </View>

                        {/* 12 Months Grid */}
                        <View style={styles.monthsGrid}>
                            {MONTH_NAMES.map((mName, idx) => {
                                const mNum = String(idx + 1).padStart(2, "0");
                                const pKey = `${pickerYear}-${mNum}`;
                                const isSelected = pKey === period;
                                return (
                                    <Pressable
                                        key={mName}
                                        style={[
                                            styles.monthItemBtn,
                                            {
                                                backgroundColor: isSelected
                                                    ? c.primary
                                                    : c.track,
                                            },
                                        ]}
                                        onPress={() => {
                                            setPeriod(pKey);
                                            setShowMonthPicker(false);
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.monthItemText,
                                                {
                                                    color: isSelected
                                                        ? "#FFFFFF"
                                                        : c.text,
                                                    fontWeight: isSelected
                                                        ? fontWeight.bold
                                                        : fontWeight.medium,
                                                },
                                            ]}
                                        >
                                            {mName}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {/* Close button */}
                        <Pressable
                            style={[styles.pickerCloseBtn, { backgroundColor: c.track }]}
                            onPress={() => setShowMonthPicker(false)}
                        >
                            <Text style={[styles.pickerCloseText, { color: c.text }]}>
                                Cerrar
                            </Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const createStyles = (c: any, insets: any) =>
    StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: c.background,
        },
        headerContainer: {
            paddingTop: insets.top + spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.md,
            backgroundColor: c.background,
        },
        headerTop: {
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
        securityPill: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.surface,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: 999,
            gap: 4,
            borderWidth: 1,
            borderColor: c.border,
        },
        securityText: {
            fontSize: fontSize.caption,
            color: c.textMuted,
            fontWeight: fontWeight.medium,
        },
        headerActions: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        periodSelectorContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
        },
        periodPill: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.surface,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: 999,
            gap: spacing.sm,
            borderWidth: 1,
            borderColor: c.border,
        },
        periodText: {
            fontSize: fontSize.body,
            fontWeight: fontWeight.semibold,
            color: c.text,
            textTransform: "capitalize",
        },
        periodArrow: {
            padding: spacing.xs,
            backgroundColor: c.surface,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: c.border,
        },
        addButtonCircle: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: c.primary,
            justifyContent: "center",
            alignItems: "center",
        },
        todayBtn: {
            paddingHorizontal: spacing.sm + 4,
            paddingVertical: spacing.sm,
            borderRadius: 999,
            borderWidth: 1,
            alignItems: "center",
            justifyContent: "center",
        },
        todayBtnText: {
            fontSize: fontSize.caption + 1,
            fontWeight: fontWeight.bold,
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.lg,
        },
        pickerDialog: {
            width: "100%",
            maxWidth: 340,
            borderRadius: 24,
            borderWidth: 1,
            padding: spacing.lg,
            gap: spacing.md,
            elevation: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
        },
        pickerYearRow: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.xs,
        },
        yearArrow: {
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
        },
        pickerYearText: {
            fontSize: fontSize.subtitle,
            fontWeight: fontWeight.bold,
        },
        monthsGrid: {
            flexDirection: "row",
            flexWrap: "wrap",
            gap: spacing.xs + 2,
            justifyContent: "space-between",
        },
        monthItemBtn: {
            width: "31%",
            paddingVertical: 12,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            marginVertical: 2,
        },
        monthItemText: {
            fontSize: fontSize.caption + 1,
            fontWeight: fontWeight.semibold,
        },
        pickerCloseBtn: {
            paddingVertical: 10,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            marginTop: spacing.xs,
        },
        pickerCloseText: {
            fontSize: fontSize.caption + 1,
            fontWeight: fontWeight.semibold,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
        },
        scrollContent: {
            paddingBottom: insets.bottom + 90,
            paddingHorizontal: spacing.lg,
            gap: spacing.md,
        },
        summaryCard: {
            backgroundColor: c.surface || "#ffffff",
            borderRadius: 20,
            overflow: "hidden",
            position: "relative",
            borderWidth: 1,
            borderColor: c.border,
            elevation: 2,
            shadowColor: c.text,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
        },
        ambientGlow1: {
            position: "absolute",
            top: -50,
            right: -50,
            width: 150,
            height: 150,
            borderRadius: 75,
            backgroundColor: c.primary,
            opacity: 0.05,
        },
        ambientGlow2: {
            position: "absolute",
            bottom: -50,
            left: -30,
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: c.primary,
            opacity: 0.03,
        },
        summaryContent: {
            padding: spacing.lg,
        },
        summaryTopRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing.sm,
        },
        summaryLabel: {
            fontSize: fontSize.body,
            color: c.textMuted,
            fontWeight: fontWeight.medium,
        },
        badgeContainer: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.background,
            borderRadius: 999,
            paddingLeft: spacing.sm,
            paddingRight: 2,
            paddingVertical: 2,
            borderWidth: 1,
            borderColor: c.border,
        },
        badgeText: {
            fontSize: fontSize.caption,
            color: c.textMuted,
            marginRight: spacing.sm,
        },
        badgePercent: {
            backgroundColor: c.primary,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            borderRadius: 999,
        },
        badgePercentText: {
            fontSize: fontSize.caption,
            color: c.primaryText || "#fff",
            fontWeight: fontWeight.bold,
        },
        summaryAmounts: {
            flexDirection: "row",
            alignItems: "baseline",
            marginBottom: spacing.md,
        },
        spentAmount: {
            fontSize: fontSize.heading,
            fontWeight: fontWeight.bold,
            color: c.text,
        },
        limitAmount: {
            fontSize: fontSize.subtitle,
            fontWeight: fontWeight.medium,
            color: c.textMuted,
        },
        progressBarBg: {
            height: 10,
            backgroundColor: c.track || c.border,
            borderRadius: 999,
            marginBottom: spacing.md,
            overflow: "hidden",
        },
        progressBarFill: {
            height: "100%",
            borderRadius: 999,
        },
        insightRow: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.background,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: 12,
            gap: spacing.xs,
            borderWidth: 1,
            borderColor: c.border,
        },
        insightText: {
            fontSize: fontSize.caption,
            color: c.textMuted,
            flex: 1,
        },
        insightPerDay: {
            fontSize: fontSize.caption,
            color: c.text,
            fontWeight: fontWeight.medium,
        },
        filtersContainer: {
            gap: spacing.sm,
            paddingVertical: spacing.xs,
        },
        filterChip: {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: 999,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
        },
        filterChipActive: {
            backgroundColor: c.text,
            borderColor: c.text,
        },
        filterChipText: {
            fontSize: fontSize.body,
            color: c.textMuted,
            fontWeight: fontWeight.medium,
        },
        filterChipTextActive: {
            color: c.background,
        },
        budgetList: {
            gap: spacing.md,
        },
        budgetCard: {
            backgroundColor: c.surface,
            borderRadius: 18,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: c.border,
        },
        budgetCardTop: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing.sm,
        },
        budgetCardLeft: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            flex: 1,
        },
        categoryIconBg: {
            width: 40,
            height: 40,
            borderRadius: 12,
            justifyContent: "center",
            alignItems: "center",
        },
        categoryIconText: {
            fontSize: 20,
        },
        categoryName: {
            fontSize: fontSize.body,
            fontWeight: fontWeight.semibold,
            color: c.text,
        },
        categorySubtitle: {
            fontSize: fontSize.caption,
            fontWeight: fontWeight.medium,
            marginTop: 2,
        },
        budgetCardRight: {
            alignItems: "flex-end",
        },
        budgetSpent: {
            fontSize: fontSize.body,
            fontWeight: fontWeight.bold,
            color: c.text,
        },
        budgetLimit: {
            fontSize: fontSize.caption,
            color: c.textMuted,
            marginTop: 2,
        },
        cardProgressBarBg: {
            height: 8,
            backgroundColor: c.track || c.border,
            borderRadius: 999,
            marginBottom: spacing.sm,
            overflow: "hidden",
        },
        cardProgressBarFill: {
            height: "100%",
            borderRadius: 999,
        },
        budgetCardBottom: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
        },
        statusContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
        },
        statusText: {
            fontSize: fontSize.caption,
            fontWeight: fontWeight.medium,
        },
        remainingText: {
            fontSize: fontSize.caption,
            color: c.textMuted,
        },
        emptyState: {
            padding: spacing.xl,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: c.surface,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: c.border,
            marginVertical: spacing.sm,
        },
        emptyEmoji: {
            fontSize: 36,
            marginBottom: spacing.xs,
        },
        emptyTitle: {
            fontSize: fontSize.subtitle,
            fontWeight: fontWeight.bold,
            color: c.text,
            marginBottom: 4,
            textAlign: "center",
        },
        emptyStateText: {
            fontSize: fontSize.body,
            color: c.textMuted,
            textAlign: "center",
            lineHeight: 20,
        },
        createButton: {
            backgroundColor: c.primary,
            borderRadius: 16,
            paddingVertical: spacing.md,
            alignItems: "center",
            marginTop: spacing.md,
        },
        createButtonText: {
            color: c.primaryText || "#fff",
            fontSize: fontSize.body,
            fontWeight: fontWeight.bold,
        },
    });
