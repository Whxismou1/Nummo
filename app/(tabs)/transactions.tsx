import { useTransactions } from "@/features/transactions/useTransactions";
import { currentPeriod, formatPeriod } from "@/lib/date";
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
    SectionList,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { TransactionWithCategory } from "@/features/transactions/repository";
import { useAppSettings } from "@/features/settings/SettingsContext";

const MONTH_NAMES = [
    "Ene", "Feb", "Mar", "Abr",
    "May", "Jun", "Jul", "Ago",
    "Sep", "Oct", "Nov", "Dic",
];

export default function TransactionsScreen() {
    const { colors: c } = useTheme();
    const { currency, hideBalances } = useAppSettings();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(c), [c]);

    const {
        period,
        setPeriod,
        goToPrevMonth,
        goToNextMonth,
        goToCurrentMonth,
        sections,
        summary,
        loading,
        reload,
        removeTransaction,
    } = useTransactions();
    const router = useRouter();

    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
    const [filter, setFilter] = useState<"all" | "expense" | "income">("all");

    useFocusEffect(
        useCallback(() => {
            void reload();
        }, [reload]),
    );

    const handleDelete = useCallback((id: string) => {
        Alert.alert(
            "Eliminar movimiento",
            "¿Seguro que quieres eliminar este movimiento? Esta acción no se puede deshacer.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: () => void removeTransaction(id),
                },
            ],
        );
    }, [removeTransaction]);

    const counts = useMemo(() => {
        let all = 0;
        let expense = 0;
        let income = 0;
        for (const s of sections) {
            for (const item of s.data) {
                all++;
                if (item.type === "expense") expense++;
                else if (item.type === "income") income++;
            }
        }
        return { all, expense, income };
    }, [sections]);

    const filteredSections = useMemo(() => {
        if (filter === "all") return sections;
        return sections
            .map((s) => ({
                ...s,
                data: s.data.filter((item) => item.type === filter),
            }))
            .filter((s) => s.data.length > 0);
    }, [sections, filter]);

    const listHeader = useMemo(
        () => (
            <View style={styles.headerContainer}>
                <View style={styles.headerTop}>
                    <Text style={styles.title}>Movimientos</Text>
                </View>

                <View style={styles.headerActions}>
                    <View style={styles.periodSelectorContainer}>
                        <Pressable onPress={goToPrevMonth} hitSlop={10} style={styles.periodArrow}>
                            <Ionicons name="chevron-back" size={18} color={c.text} />
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

                        <Pressable
                            onPress={goToNextMonth}
                            hitSlop={10}
                            style={styles.periodArrow}
                            disabled={period >= currentPeriod()}
                        >
                            <Ionicons
                                name="chevron-forward"
                                size={18}
                                color={period >= currentPeriod() ? `${c.textMuted}40` : c.text}
                            />
                        </Pressable>
                    </View>

                    <Pressable
                        style={[styles.todayBtn, { backgroundColor: c.surface, borderColor: c.border }]}
                        onPress={goToCurrentMonth}
                        hitSlop={8}
                    >
                        <Text style={[styles.todayBtnText, { color: c.primary }]}>Hoy</Text>
                    </Pressable>
                </View>

                <View style={styles.summaryCard}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Ingresos</Text>
                        <Text style={[styles.summaryAmount, { color: c.success }]}>
                            {hideBalances ? "••••" : formatMoney(summary.totalIncome, currency)}
                        </Text>
                    </View>
                    
                    <View style={styles.summaryDivider} />

                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Gastos</Text>
                        <Text style={[styles.summaryAmount, { color: c.danger }]}>
                            {hideBalances ? "••••" : formatMoney(summary.totalExpenses, currency)}
                        </Text>
                    </View>
                    
                    <View style={styles.summaryDivider} />

                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Balance</Text>
                        <Text
                            style={[
                                styles.summaryAmount,
                                {
                                    color:
                                        summary.balance >= 0
                                            ? c.text
                                            : c.danger,
                                },
                            ]}
                        >
                            {hideBalances ? "••••" : formatMoney(summary.balance, currency)}
                        </Text>
                    </View>
                </View>

                {/* ── Filter Chips ────────────────────────────── */}
                <View style={styles.filterRow}>
                    <Pressable
                        style={[
                            styles.filterChip,
                            filter === "all" && styles.filterChipActive,
                        ]}
                        onPress={() => setFilter("all")}
                    >
                        <Text
                            style={[
                                styles.filterChipText,
                                filter === "all" && styles.filterChipTextActive,
                            ]}
                        >
                            Todos{counts.all > 0 ? ` (${counts.all})` : ""}
                        </Text>
                    </Pressable>

                    <Pressable
                        style={[
                            styles.filterChip,
                            filter === "expense" && styles.filterChipActiveExpense,
                        ]}
                        onPress={() => setFilter("expense")}
                    >
                        <Ionicons
                            name="arrow-down"
                            size={14}
                            color={filter === "expense" ? "#FFFFFF" : c.danger}
                        />
                        <Text
                            style={[
                                styles.filterChipText,
                                filter === "expense" && styles.filterChipTextActive,
                            ]}
                        >
                            Gastos{counts.expense > 0 ? ` (${counts.expense})` : ""}
                        </Text>
                    </Pressable>

                    <Pressable
                        style={[
                            styles.filterChip,
                            filter === "income" && styles.filterChipActiveIncome,
                        ]}
                        onPress={() => setFilter("income")}
                    >
                        <Ionicons
                            name="arrow-up"
                            size={14}
                            color={filter === "income" ? "#FFFFFF" : c.success}
                        />
                        <Text
                            style={[
                                styles.filterChipText,
                                filter === "income" && styles.filterChipTextActive,
                            ]}
                        >
                            Ingresos{counts.income > 0 ? ` (${counts.income})` : ""}
                        </Text>
                    </Pressable>
                </View>
            </View>
        ),
        [styles, period, goToPrevMonth, goToNextMonth, goToCurrentMonth, c, hideBalances, summary, currency, filter, counts]
    );

    const listEmpty = useMemo(() => {
        if (loading) return null;
        return (
            <Pressable
                style={styles.emptyContainer}
                onPress={() => router.push("/transaction/new" as any)}
            >
                <View style={styles.emptyIconBg}>
                    <Ionicons name="receipt-outline" size={32} color={c.primary} />
                </View>
                <Text style={styles.emptyTitle}>
                    {filter === "all"
                        ? "Sin movimientos este mes"
                        : filter === "expense"
                        ? "No hay gastos registrados"
                        : "No hay ingresos registrados"}
                </Text>
                <Text style={styles.emptySubtitle}>
                    {filter === "all"
                        ? "Tus compras, transferencias e ingresos aparecerán aquí ordenados por día."
                        : "No se encontraron movimientos para el filtro seleccionado."}
                </Text>
            </Pressable>
        );
    }, [loading, filter, styles, c, router]);

    const renderItem = useCallback(
        ({ item }: { item: TransactionWithCategory }) => {
            const isExpense = item.type === "expense";

            const catName =
                (item as any).categoryName ||
                item.category?.name ||
                "Sin categoría";
            const catIcon =
                (item as any).categoryIcon || item.category?.icon || "💸";
            const catColor =
                (item as any).categoryColor ||
                item.category?.color ||
                c.textMuted;

            // 15% opacity hex is approx "26"
            const bgColor =
                catColor.startsWith("#") && catColor.length === 7
                    ? `${catColor}26`
                    : `${c.track}`;

            const txDate = item.date ? new Date(item.date) : new Date();
            const timeString = txDate.toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
            });

            return (
                <Pressable
                    style={({ pressed }) => [
                        styles.txRow,
                        pressed && { backgroundColor: c.track },
                    ]}
                    onPress={() =>
                        router.push({
                            pathname: "/transaction/[id]",
                            params: { id: item.id },
                        } as any)
                    }
                    onLongPress={() => handleDelete(item.id)}
                >
                    <View style={[styles.txIcon, { backgroundColor: bgColor }]}>
                        <Text style={styles.txIconText}>{catIcon}</Text>
                    </View>

                    <View style={styles.txCenter}>
                        <Text style={styles.txNote} numberOfLines={1}>
                            {item.note || catName}
                        </Text>
                        <Text style={styles.txCategory} numberOfLines={1}>
                            {catName} • {timeString}
                        </Text>
                    </View>

                    <Text
                        style={[
                            styles.txAmount,
                            { color: isExpense ? c.text : c.success },
                        ]}
                    >
                        {isExpense ? "−" : "+"}
                        {hideBalances ? "••••" : formatMoney(item.amount, currency)}
                    </Text>
                </Pressable>
            );
        },
        [c, currency, handleDelete, hideBalances, router, styles],
    );

    const renderSectionHeader = useCallback(
        ({ section }: { section: { title: string } }) => (
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
        ),
        [styles],
    );

    return (
        <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
            <SectionList
                sections={filteredSections}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                ListHeaderComponent={listHeader}
                ListEmptyComponent={listEmpty}
                stickySectionHeadersEnabled={false}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />

            <Modal
                visible={showMonthPicker}
                animationType="fade"
                transparent
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

const createStyles = (c: ReturnType<typeof import("@/theme").useTheme>["colors"]) =>
    StyleSheet.create({
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
            paddingBottom: 100,
        },
        headerContainer: {
            paddingHorizontal: spacing.lg,
            marginBottom: spacing.sm,
        },
        headerTop: {
            marginBottom: spacing.xs,
            marginTop: spacing.sm,
        },
        title: {
            fontSize: fontSize.heading,
            fontWeight: fontWeight.bold,
            color: c.text,
        },
        headerActions: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.md,
            gap: spacing.sm,
        },
        periodSelectorContainer: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
        },
        periodArrow: {
            padding: spacing.xs,
            backgroundColor: c.surface,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: c.border,
        },
        periodPill: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.surface,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: c.border,
            gap: spacing.xs + 2,
        },
        periodText: {
            fontSize: fontSize.body,
            fontWeight: fontWeight.semibold,
            color: c.text,
            textTransform: "capitalize",
        },
        todayBtn: {
            paddingHorizontal: spacing.md,
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
        summaryCard: {
            backgroundColor: c.surface,
            borderRadius: 20,
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing.md,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            borderWidth: 1,
            borderColor: c.border,
            marginBottom: spacing.md,
        },
        summaryItem: {
            flex: 1,
            alignItems: "center",
        },
        summaryDivider: {
            width: 1,
            height: 40,
            backgroundColor: c.border,
        },
        summaryLabel: {
            fontSize: fontSize.caption,
            color: c.textMuted,
            marginBottom: spacing.xs,
            fontWeight: fontWeight.medium,
        },
        summaryAmount: {
            fontSize: fontSize.subtitle,
            fontWeight: fontWeight.bold,
        },
        filterRow: {
            flexDirection: "row",
            gap: spacing.sm,
            marginTop: spacing.xs,
        },
        filterChip: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.surface,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: c.border,
            gap: 4,
        },
        filterChipActive: {
            backgroundColor: c.primary,
            borderColor: c.primary,
        },
        filterChipActiveExpense: {
            backgroundColor: c.danger,
            borderColor: c.danger,
        },
        filterChipActiveIncome: {
            backgroundColor: c.success,
            borderColor: c.success,
        },
        filterChipText: {
            fontSize: fontSize.caption,
            fontWeight: fontWeight.semibold,
            color: c.textMuted,
        },
        filterChipTextActive: {
            color: "#FFFFFF",
        },
        sectionHeader: {
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.sm,
            backgroundColor: c.background,
        },
        sectionTitle: {
            fontSize: fontSize.body,
            fontWeight: fontWeight.semibold,
            color: c.textMuted,
        },
        txRow: {
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
        },
        txIcon: {
            width: 40,
            height: 40,
            borderRadius: 16,
            justifyContent: "center",
            alignItems: "center",
            marginRight: spacing.md,
        },
        txIconText: {
            fontSize: 20,
        },
        txCenter: {
            flex: 1,
            marginRight: spacing.sm,
        },
        txNote: {
            fontSize: fontSize.body,
            fontWeight: fontWeight.semibold,
            color: c.text,
            marginBottom: 2,
        },
        txCategory: {
            fontSize: fontSize.caption,
            color: c.textMuted,
        },
        txAmount: {
            fontSize: fontSize.body,
            fontWeight: fontWeight.bold,
        },
        emptyContainer: {
            alignItems: "center",
            paddingTop: spacing.xxl * 2,
            paddingHorizontal: spacing.xl,
        },
        emptyIconBg: {
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: c.track,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: spacing.lg,
        },
        emptyTitle: {
            fontSize: fontSize.subtitle,
            fontWeight: fontWeight.bold,
            color: c.text,
            marginBottom: spacing.xs,
        },
        emptySubtitle: {
            fontSize: fontSize.body,
            color: c.textMuted,
            textAlign: "center",
            lineHeight: 22,
        },
    });
