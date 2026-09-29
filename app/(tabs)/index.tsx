import { useDashboard } from "@/features/dashboard/useDashboard";
import { formatDayGroup, formatPeriod } from "@/lib/date";
import { formatMoney } from "@/lib/money";
import { useTheme } from "@/theme";
import { fontSize, fontWeight } from "@/theme/typography";
import { spacing } from "@/theme/spacing";
import { useFocusEffect, useRouter, Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { useAppSettings } from "@/features/settings/SettingsContext";
import { useAuth } from "@/features/auth/AuthContext";
import { NotificationsModal } from "@/components/NotificationsModal";

export default function DashboardScreen() {
    const { colors: c, isDark, toggleTheme } = useTheme();
    const { hideBalances, currency, currencySymbol, notificationsApp, notificationsEmail } = useAppSettings();
    const { user, isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return <Redirect href="/auth" />;
    }
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [showBalances, setShowBalances] = useState(!hideBalances);
    const [notificationsVisible, setNotificationsVisible] = useState(false);

    useEffect(() => {
        setShowBalances(!hideBalances);
    }, [hideBalances]);

    const { data, loading, reload } = useDashboard();

    useFocusEffect(
        useCallback(() => {
            void reload();
        }, [reload]),
    );

    if (loading && !data) {
        return (
            <View
                style={[
                    styles.loadingContainer,
                    { backgroundColor: c.background },
                ]}
            >
                <ActivityIndicator size="large" color={c.primary} />
            </View>
        );
    }

    const available = data?.availableBalance ?? 0;
    const income = data?.totalIncome ?? 0;
    const expenses = data?.totalExpenses ?? 0;

    // Formatting whole and cents parts for hero typography
    const availableCents = Math.abs(available);
    const wholePart = Math.floor(availableCents / 100).toLocaleString("es-ES");
    const decimalPart = String(availableCents % 100).padStart(2, "0");
    const isNegativeBalance = available < 0;

    // Circular progress math for featured goal
    const radius = 22;
    const circumference = 2 * Math.PI * radius;
    const goalPct = data?.featuredGoal?.percentage
        ? Math.min(Math.round(data.featuredGoal.percentage), 100)
        : 0;
    const strokeDashoffset = circumference - (circumference * goalPct) / 100;

    const activeAlertsCount =
        (data?.topBudgets?.filter((b) => b.status === "over" || b.status === "warn")?.length ?? 0) +
        (data?.availableBalance && data.availableBalance < 0 ? 1 : 0) +
        (data?.featuredGoal?.isCompleted ? 1 : 0);

    return (
        <View style={[styles.screen, { backgroundColor: c.background }]}>
            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingTop: insets.top + spacing.sm,
                        paddingBottom: insets.bottom + 90,
                    },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* ── 1. Greeting Bar (Stitch Design) ──────────────── */}
                <View style={styles.greetingBar}>
                    <View style={styles.greetingTextCol}>
                        <Text style={[styles.periodLabel, { color: c.textMuted }]}>
                            {data ? formatPeriod(data.period) : "Septiembre 2026"}
                        </Text>
                        <Text style={[styles.greetingTitle, { color: c.text }]}>
                            {user ? `Hola, ${user.name.split(" ")[0]} 👋` : "Hola 👋"}
                        </Text>
                    </View>

                    <View style={styles.headerRightActions}>
                        {/* Notifications / Alerts Button */}
                        <Pressable
                            style={[
                                styles.iconCircleBtn,
                                {
                                    backgroundColor: c.surface,
                                    borderColor: c.border,
                                    position: "relative",
                                },
                            ]}
                            onPress={() => setNotificationsVisible(true)}
                            hitSlop={8}
                        >
                            <Ionicons
                                name="notifications-outline"
                                size={19}
                                color={c.text}
                            />
                            {notificationsApp && activeAlertsCount > 0 && (
                                <View
                                    style={{
                                        position: "absolute",
                                        top: 8,
                                        right: 8,
                                        width: 8,
                                        height: 8,
                                        borderRadius: 4,
                                        backgroundColor: c.danger,
                                    }}
                                />
                            )}
                        </Pressable>

                        {/* Avatar */}
                        <Pressable
                            style={[
                                styles.userAvatar,
                                { backgroundColor: c.primary },
                            ]}
                            onPress={() => {
                                if (isAuthenticated) {
                                    router.push("/(tabs)/settings" as any);
                                } else {
                                    router.push("/auth" as any);
                                }
                            }}
                        >
                            <Text style={styles.userAvatarText}>
                                {user ? user.name.charAt(0).toUpperCase() : "N"}
                            </Text>
                        </Pressable>
                    </View>
                </View>

                {/* ── 2. Hero Balance Card (Stitch Design) ─────────── */}
                <View
                    style={[
                        styles.heroCard,
                        {
                            backgroundColor: c.primary,
                            shadowColor: c.primary,
                        },
                    ]}
                >
                    {/* Top Row: Label + Eye toggle + "Al día" pill */}
                    <View style={styles.heroTopRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text style={styles.heroAvailableLabel}>
                                Disponible este mes
                            </Text>
                            <Pressable
                                onPress={() => setShowBalances((prev) => !prev)}
                                hitSlop={10}
                            >
                                <Ionicons
                                    name={showBalances ? "eye-outline" : "eye-off-outline"}
                                    size={18}
                                    color="#FFFFFFB3"
                                />
                            </Pressable>
                        </View>
                        <View style={styles.statusPill}>
                            <View style={styles.statusDot} />
                            <Text style={styles.statusPillText}>Al día</Text>
                        </View>
                    </View>

                    {/* Big Amount */}
                    <View style={styles.heroAmountRow}>
                        <Text style={styles.heroAmountWhole}>
                            {showBalances
                                ? `${isNegativeBalance ? "−" : ""}${wholePart},${decimalPart}`
                                : "••••"}
                        </Text>
                        <Text style={styles.heroAmountCurrency}> {currencySymbol}</Text>
                    </View>

                    {/* Sub-metrics Cards Grid */}
                    <View style={styles.heroSubMetricsGrid}>
                        {/* Incomes */}
                        <View style={styles.subMetricCard}>
                            <View style={styles.subMetricHeader}>
                                <Ionicons
                                    name="arrow-down"
                                    size={14}
                                    color="#ffffff"
                                />
                                <Text style={styles.subMetricLabel}>Ingresos</Text>
                            </View>
                            <Text style={styles.subMetricAmount}>
                                {showBalances
                                    ? `+${formatMoney(income, currency)}`
                                    : "••••"}
                            </Text>
                        </View>

                        {/* Expenses */}
                        <View style={styles.subMetricCard}>
                            <View style={styles.subMetricHeader}>
                                <Ionicons
                                    name="arrow-up"
                                    size={14}
                                    color="#ffffff"
                                />
                                <Text style={styles.subMetricLabel}>Gastos</Text>
                            </View>
                            <Text style={styles.subMetricAmount}>
                                {showBalances
                                    ? `−${formatMoney(expenses, currency)}`
                                    : "••••"}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ── 3. Envelope Budgets Section ("Presupuestos") ─── */}
                <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleWithBadge}>
                        <Text style={[styles.sectionTitle, { color: c.text }]}>
                            Presupuestos
                        </Text>
                        <View
                            style={[
                                styles.countBadge,
                                { backgroundColor: c.track },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.countBadgeText,
                                    { color: c.textMuted },
                                ]}
                            >
                                {data?.topBudgets.length ?? 0} activos
                            </Text>
                        </View>
                    </View>
                    <Pressable
                        onPress={() => router.push("/(tabs)/budgets" as any)}
                        hitSlop={8}
                    >
                        <Text style={[styles.sectionActionText, { color: c.primary }]}>
                            Ver todos
                        </Text>
                    </Pressable>
                </View>

                {data?.topBudgets && data.topBudgets.length > 0 ? (
                    <View
                        style={[
                            styles.sectionCard,
                            {
                                backgroundColor: c.surface,
                                borderColor: c.border,
                            },
                        ]}
                    >
                        {data.topBudgets.map((b, idx) => {
                            const isOver = b.status === "over";
                            const isWarn = b.status === "warn";
                            const dotColor = isOver
                                ? c.danger
                                : isWarn
                                  ? c.warning
                                  : c.primary;

                            const barColor = isOver
                                ? c.danger
                                : isWarn
                                  ? c.warning
                                  : c.primary;

                            const clampedPct = Math.min(
                                Math.max(b.percentage, 0),
                                100,
                            );

                            return (
                                <View
                                    key={b.id}
                                    style={[
                                        styles.budgetItem,
                                        idx > 0 && {
                                            marginTop: spacing.md,
                                            paddingTop: spacing.sm,
                                        },
                                    ]}
                                >
                                    <View style={styles.budgetTopLine}>
                                        <View style={styles.budgetLeft}>
                                            <View
                                                style={[
                                                    styles.budgetStatusDot,
                                                    { backgroundColor: dotColor },
                                                ]}
                                            />
                                            <Text
                                                style={[
                                                    styles.budgetName,
                                                    { color: c.text },
                                                ]}
                                            >
                                                {b.categoryName}
                                            </Text>
                                        </View>

                                        <View style={styles.budgetRight}>
                                            {isOver ? (
                                                <View
                                                    style={[
                                                        styles.badgeSmall,
                                                        { backgroundColor: `${c.danger}18` },
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.badgeSmallText,
                                                            { color: c.danger },
                                                        ]}
                                                    >
                                                        Excedido
                                                    </Text>
                                                </View>
                                            ) : isWarn ? (
                                                <View
                                                    style={[
                                                        styles.badgeSmall,
                                                        { backgroundColor: `${c.warning}18` },
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.badgeSmallText,
                                                            { color: c.warning },
                                                        ]}
                                                    >
                                                        {Math.round(b.percentage)}%
                                                    </Text>
                                                </View>
                                            ) : null}

                                            <Text
                                                style={[
                                                    styles.budgetAmounts,
                                                    {
                                                        color: isOver
                                                            ? c.danger
                                                            : c.textMuted,
                                                        fontWeight: isOver
                                                            ? fontWeight.bold
                                                            : fontWeight.medium,
                                                    },
                                                ]}
                                            >
                                                {showBalances
                                                    ? `${Math.round(b.spentAmount / 100)} / ${Math.round(b.limitAmount / 100)} ${currencySymbol}`
                                                    : `•••• / •••• ${currencySymbol}`}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Progress track */}
                                    <View
                                        style={[
                                            styles.budgetTrack,
                                            { backgroundColor: c.track },
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.budgetFill,
                                                {
                                                    width: `${clampedPct}%`,
                                                    backgroundColor: barColor,
                                                },
                                            ]}
                                        />
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                ) : (
                    <Pressable
                        style={[
                            styles.emptyCard,
                            {
                                backgroundColor: c.surface,
                                borderColor: c.border,
                            },
                        ]}
                        onPress={() => router.push("/budget/new" as any)}
                    >
                        <Text style={styles.emptyCardEmoji}>✉️</Text>
                        <Text style={[styles.emptyCardTitle, { color: c.text }]}>
                            Sin presupuestos este mes
                        </Text>
                        <Text
                            style={[
                                styles.emptyCardSub,
                                { color: c.textMuted },
                            ]}
                        >
                            Crea sobres para organizar tus gastos por categoría o con un límite global.
                        </Text>
                    </Pressable>
                )}

                {/* ── 4. Savings Goal Section ("Huchas") ────────────── */}
                <View style={[styles.sectionHeaderRow, { marginTop: spacing.lg }]}>
                    <Text style={[styles.sectionTitle, { color: c.text }]}>
                        Huchas
                    </Text>
                    <Pressable
                        onPress={() => router.push("/(tabs)/goals" as any)}
                        hitSlop={8}
                    >
                        <Text style={[styles.sectionActionText, { color: c.primary }]}>
                            Ver todas
                        </Text>
                    </Pressable>
                </View>

                {data?.featuredGoal ? (
                    <Pressable
                        style={[
                            styles.sectionCard,
                            styles.goalRowCard,
                            {
                                backgroundColor: c.surface,
                                borderColor: c.border,
                            },
                        ]}
                        onPress={() =>
                            router.push({
                                pathname: "/goal/[id]" as any,
                                params: { id: data.featuredGoal!.id },
                            })
                        }
                    >
                        {/* Circular Progress Ring */}
                        <View style={styles.circleProgressWrap}>
                            <Svg width="54" height="54" viewBox="0 0 54 54">
                                <Circle
                                    cx="27"
                                    cy="27"
                                    r={radius}
                                    stroke={c.track}
                                    strokeWidth="4.5"
                                    fill="none"
                                />
                                <Circle
                                    cx="27"
                                    cy="27"
                                    r={radius}
                                    stroke={c.primary}
                                    strokeWidth="4.5"
                                    strokeDasharray={`${circumference}`}
                                    strokeDashoffset={`${strokeDashoffset}`}
                                    strokeLinecap="round"
                                    fill="none"
                                    transform="rotate(-90 27 27)"
                                />
                            </Svg>
                            <Text style={[styles.circleProgressText, { color: c.text }]}>
                                {goalPct}%
                            </Text>
                        </View>

                        {/* Goal info */}
                        <View style={styles.goalInfoCol}>
                            <View style={styles.goalTitleRow}>
                                <Text
                                    style={[styles.goalNameText, { color: c.text }]}
                                    numberOfLines={1}
                                >
                                    {data.featuredGoal.name}
                                </Text>
                                <Ionicons
                                    name="sparkles"
                                    size={15}
                                    color={c.primary}
                                />
                            </View>
                            <Text
                                style={[styles.goalSubText, { color: c.textMuted }]}
                                numberOfLines={1}
                            >
                                {showBalances
                                    ? (data.featuredGoal.targetAmount
                                        ? `${formatMoney(data.featuredGoal.savedAmount)} de ${formatMoney(data.featuredGoal.targetAmount)}`
                                        : `${formatMoney(data.featuredGoal.savedAmount)} ahorrados`)
                                    : `•••• ${currencySymbol}`}
                            </Text>
                        </View>

                        {/* Quick action button (+) */}
                        <Pressable
                            style={[
                                styles.goalActionBtn,
                                { backgroundColor: c.track },
                            ]}
                            onPress={() =>
                                router.push({
                                    pathname: "/goal/[id]" as any,
                                    params: { id: data.featuredGoal!.id },
                                })
                            }
                        >
                            <Ionicons name="add" size={20} color={c.primary} />
                        </Pressable>
                    </Pressable>
                ) : (
                    <Pressable
                        style={[
                            styles.emptyCard,
                            {
                                backgroundColor: c.surface,
                                borderColor: c.border,
                            },
                        ]}
                        onPress={() => router.push("/goal/new" as any)}
                    >
                        <Text style={styles.emptyCardEmoji}>🐷</Text>
                        <Text style={[styles.emptyCardTitle, { color: c.text }]}>
                            Aún no tienes ninguna hucha
                        </Text>
                        <Text
                            style={[
                                styles.emptyCardSub,
                                { color: c.textMuted },
                            ]}
                        >
                            Crea una meta de ahorro para apartar dinero para tus vacaciones o imprevistos.
                        </Text>
                    </Pressable>
                )}

                {/* ── 5. Recent Transactions Section ("Últimos movimientos") */}
                <View style={[styles.sectionHeaderRow, { marginTop: spacing.lg }]}>
                    <Text style={[styles.sectionTitle, { color: c.text }]}>
                        Últimos movimientos
                    </Text>
                    <Pressable
                        onPress={() => router.push("/(tabs)/transactions" as any)}
                        hitSlop={8}
                    >
                        <Text
                            style={[
                                styles.sectionActionText,
                                { color: c.primary },
                            ]}
                        >
                            Ver todos
                        </Text>
                    </Pressable>
                </View>

                {data?.recentTransactions &&
                data.recentTransactions.length > 0 ? (
                    <View
                        style={[
                            styles.sectionCard,
                            {
                                backgroundColor: c.surface,
                                borderColor: c.border,
                                paddingVertical: 0,
                                paddingHorizontal: 0,
                            },
                        ]}
                    >
                        {data.recentTransactions.map((tx, idx) => {
                            const isExpense = tx.type === "expense";
                            const isFirst = idx === 0;

                            return (
                                <Pressable
                                    key={tx.id}
                                    style={[
                                        styles.transactionRowItem,
                                        !isFirst && {
                                            borderTopWidth: 1,
                                            borderTopColor: c.border,
                                        },
                                    ]}
                                    onPress={() =>
                                        router.push({
                                            pathname: "/transaction/[id]" as any,
                                            params: { id: tx.id },
                                        })
                                    }
                                >
                                    {/* Category Icon */}
                                    <View
                                        style={[
                                            styles.txIconAvatar,
                                            {
                                                backgroundColor: tx.category?.color
                                                    ? `${tx.category.color}16`
                                                    : c.track,
                                            },
                                        ]}
                                    >
                                        <Text style={styles.txIconChar}>
                                            {tx.category?.icon ?? "💼"}
                                        </Text>
                                    </View>

                                    {/* Info: Note + Date/Category */}
                                    <View style={styles.txInfoCol}>
                                        <Text
                                            style={[styles.txTitleText, { color: c.text }]}
                                            numberOfLines={1}
                                        >
                                            {tx.note ||
                                                tx.category?.name ||
                                                "Sin descripción"}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.txSubText,
                                                { color: c.textMuted },
                                            ]}
                                            numberOfLines={1}
                                        >
                                            {formatDayGroup(tx.date)}
                                            {tx.category ? ` · ${tx.category.name}` : ""}
                                        </Text>
                                    </View>

                                    {/* Amount */}
                                    <Text
                                        style={[
                                            styles.txAmountText,
                                            {
                                                color: isExpense
                                                    ? c.text
                                                    : c.success,
                                            },
                                        ]}
                                    >
                                        {isExpense ? "−" : "+"}
                                        {showBalances ? formatMoney(tx.amount) : "••••"}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                ) : (
                    <Pressable
                        style={[
                            styles.emptyCard,
                            {
                                backgroundColor: c.surface,
                                borderColor: c.border,
                            },
                        ]}
                        onPress={() => router.push("/transaction/new" as any)}
                    >
                        <Text style={styles.emptyCardEmoji}>📝</Text>
                        <Text style={[styles.emptyCardTitle, { color: c.text }]}>
                            Sin movimientos este mes
                        </Text>
                        <Text
                            style={[
                                styles.emptyCardSub,
                                { color: c.textMuted },
                            ]}
                        >
                            Tus gastos e ingresos aparecerán aquí ordenados por día.
                        </Text>
                    </Pressable>
                )}
            </ScrollView>

            <NotificationsModal
                visible={notificationsVisible}
                onClose={() => setNotificationsVisible(false)}
                data={data}
                notificationsApp={notificationsApp}
                notificationsEmail={notificationsEmail}
                userEmail={user?.email}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    scrollContent: {
        paddingHorizontal: spacing.md,
    },
    greetingBar: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.md,
    },
    greetingTextCol: {
        flex: 1,
    },
    periodLabel: {
        fontSize: 11,
        fontWeight: fontWeight.medium,
        textTransform: "capitalize",
        letterSpacing: 0.4,
    },
    greetingTitle: {
        fontSize: 18,
        fontWeight: fontWeight.bold,
        letterSpacing: -0.2,
        marginTop: 2,
    },
    headerRightActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
    },
    iconCircleBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        elevation: 2,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    userAvatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
        elevation: 4,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
    },
    userAvatarText: {
        fontSize: 15,
        fontWeight: fontWeight.bold,
        color: "#ffffff",
    },
    heroCard: {
        borderRadius: 20,
        padding: spacing.lg,
        elevation: 8,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.32,
        shadowRadius: 20,
        marginBottom: spacing.md,
    },
    heroTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    heroAvailableLabel: {
        fontSize: 12,
        fontWeight: fontWeight.medium,
        color: "rgba(255, 255, 255, 0.82)",
        letterSpacing: 0.3,
    },
    statusPill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 99,
        backgroundColor: "rgba(255, 255, 255, 0.16)",
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: "#34D399",
    },
    statusPillText: {
        fontSize: 11,
        fontWeight: fontWeight.medium,
        color: "#ffffff",
    },
    heroAmountRow: {
        flexDirection: "row",
        alignItems: "baseline",
        marginVertical: spacing.xs,
    },
    heroAmountWhole: {
        fontSize: 34,
        fontWeight: fontWeight.bold,
        color: "#ffffff",
        letterSpacing: -0.5,
    },
    heroAmountCurrency: {
        fontSize: 22,
        fontWeight: fontWeight.semibold,
        color: "rgba(255, 255, 255, 0.9)",
    },
    heroSubMetricsGrid: {
        flexDirection: "row",
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    subMetricCard: {
        flex: 1,
        backgroundColor: "rgba(255, 255, 255, 0.12)",
        borderRadius: 14,
        padding: spacing.sm + 2,
    },
    subMetricHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    subMetricLabel: {
        fontSize: 11,
        fontWeight: fontWeight.medium,
        color: "rgba(255, 255, 255, 0.85)",
    },
    subMetricAmount: {
        fontSize: 15,
        fontWeight: fontWeight.bold,
        color: "#ffffff",
        marginTop: 2,
    },
    sectionHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 2,
        marginBottom: spacing.xs + 2,
    },
    sectionTitleWithBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: fontWeight.bold,
        letterSpacing: -0.2,
    },
    countBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 99,
    },
    countBadgeText: {
        fontSize: 11,
        fontWeight: fontWeight.medium,
    },
    sectionActionText: {
        fontSize: 12,
        fontWeight: fontWeight.semibold,
    },
    sectionCard: {
        borderRadius: 18,
        padding: spacing.md,
        borderWidth: 1,
        elevation: 2,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
    },
    budgetItem: {},
    budgetTopLine: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
    },
    budgetLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flex: 1,
    },
    budgetStatusDot: {
        width: 9,
        height: 9,
        borderRadius: 4.5,
    },
    budgetName: {
        fontSize: 14,
        fontWeight: fontWeight.semibold,
    },
    budgetRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    badgeSmall: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
    },
    badgeSmallText: {
        fontSize: 10,
        fontWeight: fontWeight.bold,
    },
    budgetAmounts: {
        fontSize: 11,
    },
    budgetTrack: {
        width: "100%",
        height: 7,
        borderRadius: 99,
        overflow: "hidden",
    },
    budgetFill: {
        height: "100%",
        borderRadius: 99,
    },
    goalRowCard: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing.md,
    },
    circleProgressWrap: {
        width: 54,
        height: 54,
        alignItems: "center",
        justifyContent: "center",
        marginRight: spacing.md,
        position: "relative",
    },
    circleProgressText: {
        position: "absolute",
        fontSize: 12,
        fontWeight: fontWeight.bold,
    },
    goalInfoCol: {
        flex: 1,
    },
    goalTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    goalNameText: {
        fontSize: 15,
        fontWeight: fontWeight.bold,
    },
    goalSubText: {
        fontSize: 12,
        marginTop: 2,
    },
    goalActionBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    transactionRowItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 4,
    },
    txIconAvatar: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        marginRight: spacing.md,
    },
    txIconChar: {
        fontSize: 20,
    },
    txInfoCol: {
        flex: 1,
    },
    txTitleText: {
        fontSize: 14,
        fontWeight: fontWeight.semibold,
    },
    txSubText: {
        fontSize: 12,
        marginTop: 1,
    },
    txAmountText: {
        fontSize: 15,
        fontWeight: fontWeight.bold,
    },
    emptyCard: {
        borderRadius: 18,
        padding: spacing.lg,
        borderWidth: 1,
        alignItems: "center",
    },
    emptyCardEmoji: {
        fontSize: 32,
        marginBottom: 4,
    },
    emptyCardTitle: {
        fontSize: 14,
        fontWeight: fontWeight.bold,
        marginBottom: 2,
    },
    emptyCardSub: {
        fontSize: 12,
        textAlign: "center",
    },
});
