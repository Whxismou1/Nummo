import {
    deleteBudget,
    getBudgetById,
    updateBudget,
    type BudgetWithCategory,
} from "@/features/budgets/repository";
import { formatPeriod } from "@/lib/date";
import { toCents } from "@/lib/money";
import { useTheme } from "@/theme";
import { fontSize, fontWeight } from "@/theme/typography";
import { spacing } from "@/theme/spacing";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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
import { useAppSettings } from "@/features/settings/SettingsContext";

export default function EditBudgetScreen() {
    const { colors: c } = useTheme();
    const { currencySymbol } = useAppSettings();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(c), [c]);

    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [budget, setBudget] = useState<BudgetWithCategory | null>(null);
    const [amountText, setAmountText] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                const data = await getBudgetById(id);
                if (!data) {
                    Alert.alert("Error", "Presupuesto no encontrado.");
                    router.back();
                    return;
                }
                setBudget(data);
                // Convert cents to display string e.g. "300" or "300,50"
                const str = (data.amount / 100).toFixed(2).replace(".", ",");
                setAmountText(str.endsWith(",00") ? str.slice(0, -3) : str);
            } catch {
                Alert.alert("Error", "No se pudo cargar el presupuesto.");
                router.back();
            } finally {
                setLoading(false);
            }
        })();
    }, [id, router]);

    const handleSave = async () => {
        if (!id) return;
        if (!amountText.trim()) {
            setError("El importe es obligatorio");
            return;
        }

        try {
            setSaving(true);
            const cents = toCents(amountText);
            await updateBudget(id, { amount: cents });
            router.back();
        } catch {
            Alert.alert("Error", "No se pudo actualizar el sobre.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        if (!id) return;
        Alert.alert(
            "Eliminar sobre",
            "¿Seguro que quieres eliminar este presupuesto? Los movimientos asociados seguirán existiendo.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: async () => {
                        await deleteBudget(id);
                        router.back();
                    },
                },
            ],
        );
    };

    if (loading || !budget) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={c.primary} />
            </View>
        );
    }

    const title =
        budget.scope === "global"
            ? "Presupuesto global"
            : (budget.category?.name ?? "Sobre por categoría");

    const icon =
        budget.scope === "global" ? "🌐" : (budget.category?.icon ?? "📦");

    const categoryColor = budget.category?.color ?? c.primary;

    return (
        <KeyboardAvoidingView
            style={styles.screen}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingTop: insets.top + spacing.xs,
                        paddingBottom: insets.bottom + spacing.xl,
                    },
                ]}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Modal Drag Handle & Close Button ────────── */}
                <View style={styles.modalHeader}>
                    <View style={[styles.dragHandle, { backgroundColor: c.border }]} />
                    <Pressable
                        style={[styles.closeBtn, { backgroundColor: c.track }]}
                        onPress={() => router.back()}
                        hitSlop={12}
                    >
                        <Ionicons name="close" size={20} color={c.text} />
                    </Pressable>
                </View>

                {/* ── Preview Card ────────────────────────────── */}
                <View style={styles.previewCard}>
                    <View
                        style={[
                            styles.iconContainer,
                            {
                                backgroundColor:
                                    categoryColor.startsWith("#") && categoryColor.length === 7
                                        ? `${categoryColor}20`
                                        : `${c.primary}15`,
                            },
                        ]}
                    >
                        <Text style={styles.iconText}>{icon}</Text>
                    </View>
                    <View style={styles.previewTexts}>
                        <Text style={styles.previewTitle}>{title}</Text>
                        <View style={styles.periodRow}>
                            <Ionicons name="calendar-outline" size={14} color={c.textMuted} />
                            <Text style={styles.previewPeriod}>
                                {formatPeriod(budget.period)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ── Hero Amount Input ───────────────────────── */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Límite mensual</Text>
                    <View style={styles.heroAmountContainer}>
                        <TextInput
                            style={styles.heroInput}
                            placeholder="0,00"
                            placeholderTextColor={c.textMuted}
                            keyboardType="decimal-pad"
                            value={amountText}
                            onChangeText={(val) => {
                                setAmountText(val);
                                if (error) setError(null);
                            }}
                            autoFocus
                        />
                        <Text style={styles.heroCurrency}>{currencySymbol}</Text>
                    </View>
                    {error && (
                        <Text style={styles.errorText}>{error}</Text>
                    )}
                </View>

                {/* ── Action Buttons ──────────────────────────── */}
                <View style={styles.footer}>
                    <Pressable
                        style={[
                            styles.submitButton,
                            saving && styles.submitButtonDisabled,
                        ]}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator color={c.primaryText} />
                        ) : (
                            <Ionicons
                                name="checkmark-circle-outline"
                                size={24}
                                color={c.primaryText}
                            />
                        )}
                        <Text style={styles.submitButtonText}>
                            Guardar cambios
                        </Text>
                    </Pressable>

                    <Pressable
                        style={styles.deleteButton}
                        onPress={handleDelete}
                    >
                        <Ionicons
                            name="trash-outline"
                            size={20}
                            color={c.danger}
                        />
                        <Text style={styles.deleteButtonText}>
                            Eliminar sobre
                        </Text>
                    </Pressable>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

type C = ReturnType<typeof import("@/theme").useTheme>["colors"];

const createStyles = (c: C) =>
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
        scrollContent: {
            paddingHorizontal: spacing.md,
            gap: spacing.lg,
        },
        modalHeader: {
            alignItems: "center",
            justifyContent: "center",
            paddingTop: spacing.xs,
            paddingBottom: spacing.xs,
            position: "relative",
            minHeight: 36,
        },
        dragHandle: {
            width: 44,
            height: 5,
            borderRadius: 3,
        },
        closeBtn: {
            position: "absolute",
            right: 0,
            top: 2,
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
        },
        previewCard: {
            flexDirection: "row",
            alignItems: "center",
            padding: spacing.md,
            borderRadius: 18,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
            gap: spacing.md,
        },
        iconContainer: {
            width: 48,
            height: 48,
            borderRadius: 14,
            justifyContent: "center",
            alignItems: "center",
        },
        iconText: {
            fontSize: 24,
        },
        previewTexts: {
            flex: 1,
            gap: 2,
        },
        previewTitle: {
            fontSize: fontSize.subtitle,
            fontWeight: fontWeight.bold,
            color: c.text,
        },
        periodRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
        },
        previewPeriod: {
            fontSize: fontSize.caption,
            color: c.textMuted,
            textTransform: "capitalize",
            fontWeight: fontWeight.medium,
        },
        section: {
            gap: spacing.sm,
        },
        sectionLabel: {
            fontSize: fontSize.caption,
            fontWeight: fontWeight.semibold,
            color: c.textMuted,
            textTransform: "uppercase",
            letterSpacing: 0.5,
        },
        heroAmountContainer: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: spacing.md,
            backgroundColor: c.surface,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: c.border,
        },
        heroInput: {
            fontSize: 40,
            fontWeight: "700",
            color: c.text,
            textAlign: "center",
            minWidth: 120,
        },
        heroCurrency: {
            fontSize: fontSize.heading,
            color: c.textMuted,
            marginLeft: spacing.xs,
            fontWeight: fontWeight.bold,
            alignSelf: "center",
        },
        footer: {
            marginTop: spacing.xl,
            gap: spacing.md,
        },
        submitButton: {
            flexDirection: "row",
            backgroundColor: c.primary,
            paddingVertical: spacing.md,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
        },
        submitButtonDisabled: {
            opacity: 0.6,
        },
        submitButtonText: {
            color: c.primaryText,
            fontSize: fontSize.subtitle,
            fontWeight: fontWeight.bold,
        },
        deleteButton: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: spacing.md,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: c.danger,
            gap: spacing.xs,
            backgroundColor: `${c.danger}10`,
        },
        deleteButtonText: {
            color: c.danger,
            fontSize: fontSize.body,
            fontWeight: fontWeight.semibold,
        },
        errorText: {
            fontSize: fontSize.caption,
            color: c.danger,
            marginTop: 4,
            paddingHorizontal: spacing.xs,
        },
    });
