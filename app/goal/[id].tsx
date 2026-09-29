import {
    addContribution,
    deleteGoal,
    getGoalByIdWithProgress,
    getGoalTransactions,
    type GoalProgress,
} from "@/features/goals/repository";
import { useAppSettings } from "@/features/settings/SettingsContext";
import type { Transaction } from "@/db/schema";
import { formatDate } from "@/lib/date";
import { formatMoney, toCents } from "@/lib/money";
import { useTheme } from "@/theme";
import { fontSize, fontWeight } from "@/theme/typography";
import { spacing } from "@/theme/spacing";
import { ProgressBar } from "@/components/ProgressBar";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function GoalDetailScreen() {
    const { colors: c } = useTheme();
    const { currencySymbol } = useAppSettings();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [goal, setGoal] = useState<GoalProgress | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state for contribution / withdrawal
    const [actionModalVisible, setActionModalVisible] = useState(false);
    const [actionType, setActionType] = useState<"deposit" | "withdraw">("deposit");
    const [amountText, setAmountText] = useState("");
    const [noteText, setNoteText] = useState("");
    const [actionSubmitting, setActionSubmitting] = useState(false);

    const loadData = useCallback(async () => {
        if (!id) return;
        try {
            const [g, txs] = await Promise.all([
                getGoalByIdWithProgress(id),
                getGoalTransactions(id),
            ]);
            if (!g) {
                Alert.alert("Error", "Hucha no encontrada.");
                router.back();
                return;
            }
            setGoal(g);
            setTransactions(txs);
        } catch {
            Alert.alert("Error", "No se pudo cargar la hucha.");
        } finally {
            setLoading(false);
        }
    }, [id, router]);

    useFocusEffect(
        useCallback(() => {
            void loadData();
        }, [loadData]),
    );

    const handleOpenAction = (type: "deposit" | "withdraw") => {
        setActionType(type);
        setAmountText("");
        setNoteText("");
        setActionModalVisible(true);
    };

    const handleConfirmAction = async () => {
        if (!id || !amountText.trim()) return;

        try {
            setActionSubmitting(true);
            const cents = toCents(amountText);
            await addContribution({
                goalId: id,
                amount: cents,
                note: noteText.trim() || undefined,
                isWithdrawal: actionType === "withdraw",
            });
            setActionModalVisible(false);
            await loadData();
        } catch {
            Alert.alert("Error", "No se pudo registrar la operación.");
        } finally {
            setActionSubmitting(false);
        }
    };

    const handleDelete = () => {
        if (!id) return;
        Alert.alert(
            "Eliminar hucha",
            "¿Seguro que quieres eliminar esta hucha? Las aportaciones anteriores permanecerán en tus movimientos pero desvinculadas.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: async () => {
                        await deleteGoal(id);
                        router.back();
                    },
                },
            ],
        );
    };

    if (loading || !goal) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: c.background }]}>
                <ActivityIndicator size="large" color={c.primary} />
            </View>
        );
    }

    const hasTarget = goal.targetAmount !== null && goal.targetAmount > 0;
    const pct = goal.percentage ? Math.min(Math.round(goal.percentage), 100) : null;

    const ListHeader = () => (
        <View style={styles.header}>
            {/* ── Main Progress Card ───────────────────────────── */}
            <View
                style={[
                    styles.mainCard,
                    {
                        backgroundColor: c.surface,
                        borderColor: goal.isCompleted ? `${c.success}60` : c.border,
                    },
                ]}
            >
                <View style={styles.cardTop}>
                    <View
                        style={[
                            styles.iconBox,
                            {
                                backgroundColor: goal.color
                                    ? `${goal.color}20`
                                    : c.track,
                            },
                        ]}
                    >
                        <Text style={styles.iconEmoji}>{goal.icon}</Text>
                    </View>

                    <View style={styles.cardTitles}>
                        <Text style={[styles.goalName, { color: c.text }]}>
                            {goal.name}
                        </Text>
                        <Text style={[styles.goalSub, { color: c.textMuted }]}>
                            {hasTarget
                                ? `Meta: ${formatMoney(goal.targetAmount!)}`
                                : "Sin meta fija (ahorro libre)"}
                        </Text>
                    </View>

                    {/* Edit button */}
                    <Pressable
                        style={styles.editBtn}
                        onPress={() =>
                            router.push({
                                pathname: "/goal/edit/[id]" as any,
                                params: { id: goal.id },
                            })
                        }
                        hitSlop={8}
                    >
                        <Ionicons name="create-outline" size={22} color={c.textMuted} />
                    </Pressable>
                </View>

                {/* Amount display */}
                <View style={styles.amountDisplay}>
                    <Text style={[styles.savedAmount, { color: c.text }]}>
                        {formatMoney(goal.savedAmount)}
                    </Text>
                    {hasTarget && pct !== null && (
                        <View
                            style={[
                                styles.pctBadge,
                                {
                                    backgroundColor: goal.isCompleted
                                        ? `${c.success}20`
                                        : c.track,
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.pctText,
                                    {
                                        color: goal.isCompleted
                                            ? c.success
                                            : c.primary,
                                    },
                                ]}
                            >
                                {pct}% conseguido
                            </Text>
                        </View>
                    )}
                </View>

                {/* Progress bar */}
                {hasTarget && pct !== null && (
                    <View style={styles.progressWrap}>
                        <ProgressBar
                            percentage={goal.percentage ?? 0}
                            status={goal.isCompleted ? "ok" : "ok"}
                            height={8}
                        />
                        {goal.remainingAmount !== null && goal.remainingAmount > 0 ? (
                            <Text style={[styles.remainingText, { color: c.textMuted }]}>
                                Te faltan {formatMoney(goal.remainingAmount)} para la meta
                            </Text>
                        ) : (
                            <Text style={[styles.remainingText, { color: c.success }]}>
                                ¡Meta alcanzada! 🎉
                            </Text>
                        )}
                    </View>
                )}

                {/* Action buttons (Aportar / Retirar) */}
                <View style={styles.actionRow}>
                    <Pressable
                        style={[styles.actionBtn, { backgroundColor: c.primary }]}
                        onPress={() => handleOpenAction("deposit")}
                    >
                        <Ionicons
                            name="arrow-down-circle"
                            size={18}
                            color={c.primaryText}
                        />
                        <Text style={[styles.actionBtnText, { color: c.primaryText }]}>
                            Aportar dinero
                        </Text>
                    </Pressable>

                    <Pressable
                        style={[
                            styles.actionBtn,
                            styles.withdrawBtn,
                            { borderColor: c.border, backgroundColor: c.surface },
                        ]}
                        onPress={() => handleOpenAction("withdraw")}
                    >
                        <Ionicons
                            name="arrow-up-circle-outline"
                            size={18}
                            color={c.text}
                        />
                        <Text style={[styles.actionBtnText, { color: c.text }]}>
                            Retirar
                        </Text>
                    </Pressable>
                </View>
            </View>

            {/* ── Transactions History Header ─────────────────── */}
            <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: c.textMuted }]}>
                    Historial de aportaciones ({transactions.length})
                </Text>
            </View>
        </View>
    );

    const ListEmpty = () => (
        <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: c.textMuted }]}>
                Aún no has registrado aportaciones en esta hucha.
            </Text>
        </View>
    );

    const renderItem = ({ item }: { item: Transaction }) => {
        const isDeposit = item.type === "expense"; // expense from user balance into goal
        return (
            <View
                style={[
                    styles.txRow,
                    { backgroundColor: c.surface, borderColor: c.border },
                ]}
            >
                <View
                    style={[
                        styles.txIconBox,
                        {
                            backgroundColor: isDeposit
                                ? `${c.success}20`
                                : `${c.danger}20`,
                        },
                    ]}
                >
                    <Ionicons
                        name={isDeposit ? "arrow-down" : "arrow-up"}
                        size={18}
                        color={isDeposit ? c.success : c.danger}
                    />
                </View>

                <View style={styles.txInfo}>
                    <Text style={[styles.txNote, { color: c.text }]}>
                        {item.note || (isDeposit ? "Aportación" : "Retirada")}
                    </Text>
                    <Text style={[styles.txDate, { color: c.textMuted }]}>
                        {formatDate(item.date)}
                    </Text>
                </View>

                <Text
                    style={[
                        styles.txAmount,
                        { color: isDeposit ? c.success : c.danger },
                    ]}
                >
                    {isDeposit ? "+" : "−"}
                    {formatMoney(item.amount)}
                </Text>
            </View>
        );
    };

    return (
        <View style={[styles.screen, { backgroundColor: c.background }]}>
            <FlatList
                data={transactions}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                ListHeaderComponent={ListHeader}
                ListEmptyComponent={ListEmpty}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={
                    <View style={styles.footer}>
                        <Pressable style={styles.deleteLink} onPress={handleDelete}>
                            <Ionicons name="trash-outline" size={16} color={c.danger} />
                            <Text style={[styles.deleteLinkText, { color: c.danger }]}>
                                Eliminar esta hucha
                            </Text>
                        </Pressable>
                    </View>
                }
            />

            {/* ── Modal for Deposit / Withdrawal ───────────────── */}
            <Modal
                visible={actionModalVisible}
                animationType="fade"
                transparent
                onRequestClose={() => setActionModalVisible(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setActionModalVisible(false)}
                >
                    <Pressable
                        style={[
                            styles.modalSheet,
                            { backgroundColor: c.surface, borderColor: c.border },
                        ]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <Text style={[styles.modalTitle, { color: c.text }]}>
                            {actionType === "deposit"
                                ? "Aportar a la hucha"
                                : "Retirar dinero de la hucha"}
                        </Text>

                        <Text style={[styles.modalLabel, { color: c.textMuted }]}>
                            Importe ({currencySymbol})
                        </Text>
                        <TextInput
                            style={[
                                styles.modalInput,
                                {
                                    backgroundColor: c.background,
                                    borderColor: c.border,
                                    color: c.text,
                                },
                            ]}
                            placeholder="0,00"
                            placeholderTextColor={c.textMuted}
                            keyboardType="decimal-pad"
                            value={amountText}
                            onChangeText={setAmountText}
                            autoFocus
                        />

                        <Text style={[styles.modalLabel, { color: c.textMuted }]}>
                            Nota (opcional)
                        </Text>
                        <TextInput
                            style={[
                                styles.modalInput,
                                {
                                    backgroundColor: c.background,
                                    borderColor: c.border,
                                    color: c.text,
                                },
                            ]}
                            placeholder={
                                actionType === "deposit"
                                    ? "Ej. Ahorro de la semana"
                                    : "Ej. Pago imprevisto"
                            }
                            placeholderTextColor={c.textMuted}
                            value={noteText}
                            onChangeText={setNoteText}
                        />

                        <View style={styles.modalButtons}>
                            <Pressable
                                style={[
                                    styles.modalCancelBtn,
                                    { borderColor: c.border },
                                ]}
                                onPress={() => setActionModalVisible(false)}
                            >
                                <Text style={[styles.modalBtnText, { color: c.textMuted }]}>
                                    Cancelar
                                </Text>
                            </Pressable>

                            <Pressable
                                style={[
                                    styles.modalConfirmBtn,
                                    {
                                        backgroundColor:
                                            actionType === "deposit"
                                                ? c.primary
                                                : c.danger,
                                    },
                                    actionSubmitting && { opacity: 0.6 },
                                ]}
                                onPress={handleConfirmAction}
                                disabled={actionSubmitting}
                            >
                                <Text
                                    style={[
                                        styles.modalBtnText,
                                        { color: "#ffffff", fontWeight: fontWeight.bold },
                                    ]}
                                >
                                    {actionSubmitting
                                        ? "Guardando..."
                                        : actionType === "deposit"
                                          ? "Aportar"
                                          : "Retirar"}
                                </Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
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
    listContent: {
        paddingBottom: 60,
    },
    header: {
        paddingTop: spacing.sm,
    },
    mainCard: {
        marginHorizontal: spacing.md,
        borderRadius: 20,
        padding: spacing.lg,
        borderWidth: 1,
    },
    cardTop: {
        flexDirection: "row",
        alignItems: "center",
    },
    iconBox: {
        width: 52,
        height: 52,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        marginRight: spacing.md,
    },
    iconEmoji: {
        fontSize: 30,
    },
    cardTitles: {
        flex: 1,
    },
    goalName: {
        fontSize: fontSize.title,
        fontWeight: fontWeight.bold,
    },
    goalSub: {
        fontSize: fontSize.caption,
        marginTop: 2,
    },
    editBtn: {
        padding: spacing.xs,
    },
    amountDisplay: {
        marginTop: spacing.md,
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
    },
    savedAmount: {
        fontSize: fontSize.heading,
        fontWeight: fontWeight.bold,
    },
    pctBadge: {
        paddingHorizontal: spacing.sm + 4,
        paddingVertical: spacing.xs,
        borderRadius: 12,
    },
    pctText: {
        fontSize: fontSize.caption,
        fontWeight: fontWeight.bold,
    },
    progressWrap: {
        marginTop: spacing.sm,
    },
    remainingText: {
        fontSize: fontSize.caption,
        marginTop: spacing.xs + 2,
    },
    actionRow: {
        flexDirection: "row",
        gap: spacing.sm,
        marginTop: spacing.lg,
    },
    actionBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs + 2,
        paddingVertical: spacing.sm + 4,
        borderRadius: 14,
    },
    withdrawBtn: {
        borderWidth: 1,
    },
    actionBtnText: {
        fontSize: fontSize.body,
        fontWeight: fontWeight.bold,
    },
    sectionHeader: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.xs,
    },
    sectionTitle: {
        fontSize: fontSize.caption,
        fontWeight: fontWeight.semibold,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    emptyContainer: {
        padding: spacing.xl,
        alignItems: "center",
    },
    emptyText: {
        fontSize: fontSize.body,
    },
    txRow: {
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: spacing.md,
        marginVertical: 4,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.md,
        borderRadius: 14,
        borderWidth: 1,
    },
    txIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        marginRight: spacing.sm + 4,
    },
    txInfo: {
        flex: 1,
    },
    txNote: {
        fontSize: fontSize.body,
        fontWeight: fontWeight.medium,
    },
    txDate: {
        fontSize: fontSize.caption,
        marginTop: 2,
    },
    txAmount: {
        fontSize: fontSize.body,
        fontWeight: fontWeight.bold,
    },
    footer: {
        alignItems: "center",
        marginTop: spacing.xl,
    },
    deleteLink: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        padding: spacing.sm,
    },
    deleteLinkText: {
        fontSize: fontSize.caption,
        fontWeight: fontWeight.semibold,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        padding: spacing.lg,
    },
    modalSheet: {
        borderRadius: 20,
        padding: spacing.lg,
        borderWidth: 1,
    },
    modalTitle: {
        fontSize: fontSize.subtitle,
        fontWeight: fontWeight.bold,
        marginBottom: spacing.md,
    },
    modalLabel: {
        fontSize: fontSize.caption,
        fontWeight: fontWeight.semibold,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginTop: spacing.sm,
        marginBottom: 4,
    },
    modalInput: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 4,
        fontSize: fontSize.body,
    },
    modalButtons: {
        flexDirection: "row",
        gap: spacing.sm,
        marginTop: spacing.lg,
    },
    modalCancelBtn: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: spacing.sm + 4,
        alignItems: "center",
    },
    modalConfirmBtn: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: spacing.sm + 4,
        alignItems: "center",
    },
    modalBtnText: {
        fontSize: fontSize.body,
        fontWeight: fontWeight.semibold,
    },
});
