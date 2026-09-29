import { BudgetForm, budgetSchema } from "@/features/budgets/budgetForm";
import { createBudget } from "@/features/budgets/repository";
import { useCategories } from "@/features/categories/useCategories";
import { currentPeriod, formatPeriod } from "@/lib/date";
import { toCents } from "@/lib/money";
import { useTheme } from "@/theme";
import { fontSize, fontWeight } from "@/theme/typography";
import { spacing } from "@/theme/spacing";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
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

export default function NewBudgetScreen() {
    const { colors: c } = useTheme();
    const { currencySymbol } = useAppSettings();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(c), [c]);

    const router = useRouter();
    const params = useLocalSearchParams<{
        scope?: "global" | "category";
        period?: string;
    }>();

    const targetPeriod = params.period ?? currentPeriod();
    const initialScope = params.scope ?? "category";

    const { categories } = useCategories();

    const {
        control,
        handleSubmit,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<BudgetForm>({
        resolver: zodResolver(budgetSchema),
        defaultValues: {
            period: targetPeriod,
            scope: initialScope,
            categoryId: "",
            amount: "",
        },
    });

    const currentScope = watch("scope");

    const onSubmit = async (data: BudgetForm) => {
        try {
            const amountCents = toCents(data.amount);
            await createBudget({
                period: data.period,
                scope: data.scope,
                categoryId: data.scope === "category" ? data.categoryId : null,
                amount: amountCents,
            });
            router.back();
        } catch {
            Alert.alert("Error", "No se pudo guardar el presupuesto.");
        }
    };

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

                {/* ── Period Banner ──────────────────────────── */}
                <View style={styles.periodBanner}>
                    <View style={styles.periodIconWrapper}>
                        <Ionicons name="calendar-outline" size={20} color={c.primary} />
                    </View>
                    <View style={styles.periodTexts}>
                        <Text style={styles.periodLabel}>Mes del presupuesto</Text>
                        <Text style={styles.periodValue}>
                            {formatPeriod(targetPeriod)}
                        </Text>
                    </View>
                </View>

                {/* ── Scope Selector (Global vs Category) ───── */}
                <Controller
                    name="scope"
                    control={control}
                    render={({ field }) => (
                        <View style={styles.segmentContainer}>
                            <Pressable
                                style={[
                                    styles.segmentButton,
                                    field.value === "category" && styles.segmentButtonActive,
                                ]}
                                onPress={() => field.onChange("category")}
                            >
                                <Ionicons
                                    name="shapes-outline"
                                    size={18}
                                    color={field.value === "category" ? c.primary : c.textMuted}
                                />
                                <Text
                                    style={[
                                        styles.segmentText,
                                        field.value === "category" && {
                                            color: c.text,
                                            fontWeight: fontWeight.bold,
                                        },
                                    ]}
                                >
                                    Por categoría
                                </Text>
                            </Pressable>
                            <Pressable
                                style={[
                                    styles.segmentButton,
                                    field.value === "global" && styles.segmentButtonActive,
                                ]}
                                onPress={() => {
                                    field.onChange("global");
                                    setValue("categoryId", "");
                                }}
                            >
                                <Ionicons
                                    name="globe-outline"
                                    size={18}
                                    color={field.value === "global" ? c.primary : c.textMuted}
                                />
                                <Text
                                    style={[
                                        styles.segmentText,
                                        field.value === "global" && {
                                            color: c.text,
                                            fontWeight: fontWeight.bold,
                                        },
                                    ]}
                                >
                                    Tope global
                                </Text>
                            </Pressable>
                        </View>
                    )}
                />

                {/* ── Category Chips (if category scope) ─────── */}
                {currentScope === "category" && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>Elige una categoría</Text>
                        <Controller
                            name="categoryId"
                            control={control}
                            render={({ field }) => (
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.chipsContent}
                                    keyboardShouldPersistTaps="handled"
                                >
                                    {categories.map((cat) => {
                                        const isActive = field.value === cat.id;
                                        return (
                                            <Pressable
                                                key={cat.id}
                                                style={[
                                                    styles.chip,
                                                    isActive && styles.chipActive,
                                                ]}
                                                onPress={() => field.onChange(cat.id)}
                                            >
                                                <Text style={styles.chipIcon}>{cat.icon}</Text>
                                                <Text
                                                    style={[
                                                        styles.chipText,
                                                        isActive && styles.chipTextActive,
                                                    ]}
                                                >
                                                    {cat.name}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </ScrollView>
                            )}
                        />
                        {errors.categoryId && (
                            <Text style={styles.errorText}>
                                {errors.categoryId.message}
                            </Text>
                        )}
                    </View>
                )}

                {/* ── Hero Amount Input ─────────────────────── */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Límite mensual</Text>
                    <View style={styles.heroAmountContainer}>
                        <Controller
                            name="amount"
                            control={control}
                            render={({ field }) => (
                                <TextInput
                                    style={styles.heroInput}
                                    placeholder="0,00"
                                    placeholderTextColor={c.textMuted}
                                    keyboardType="decimal-pad"
                                    value={field.value}
                                    onChangeText={field.onChange}
                                    onBlur={field.onBlur}
                                    autoFocus={currentScope === "global"}
                                />
                            )}
                        />
                        <Text style={styles.heroCurrency}>{currencySymbol}</Text>
                    </View>
                    {errors.amount && (
                        <Text style={styles.errorText}>{errors.amount.message}</Text>
                    )}
                </View>

                {/* ── Save Button ───────────────────────────── */}
                <View style={styles.footer}>
                    <Pressable
                        style={[
                            styles.submitButton,
                            isSubmitting && styles.submitButtonDisabled,
                        ]}
                        onPress={handleSubmit(onSubmit)}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color={c.primaryText} />
                        ) : (
                            <Ionicons
                                name="add-circle-outline"
                                size={24}
                                color={c.primaryText}
                            />
                        )}
                        <Text style={styles.submitButtonText}>
                            Crear sobre
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
        periodBanner: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.surface,
            borderRadius: 16,
            padding: spacing.md,
            borderWidth: 1,
            borderColor: c.border,
            gap: spacing.md,
        },
        periodIconWrapper: {
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: `${c.primary}15`,
            alignItems: "center",
            justifyContent: "center",
        },
        periodTexts: {
            flex: 1,
        },
        periodLabel: {
            fontSize: fontSize.caption,
            color: c.textMuted,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            fontWeight: fontWeight.medium,
        },
        periodValue: {
            fontSize: fontSize.body,
            fontWeight: fontWeight.bold,
            color: c.text,
            textTransform: "capitalize",
            marginTop: 2,
        },
        segmentContainer: {
            flexDirection: "row",
            backgroundColor: c.track,
            borderRadius: 999,
            padding: spacing.xs,
        },
        segmentButton: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: spacing.sm,
            borderRadius: 999,
            gap: spacing.xs,
        },
        segmentButtonActive: {
            backgroundColor: c.surface,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
        },
        segmentText: {
            fontSize: fontSize.body,
            fontWeight: fontWeight.medium,
            color: c.textMuted,
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
        chipsContent: {
            gap: spacing.sm,
            paddingHorizontal: 2,
            paddingVertical: spacing.xs,
        },
        chip: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.surface,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: 999,
            gap: spacing.xs,
            borderWidth: 1,
            borderColor: c.border,
        },
        chipActive: {
            backgroundColor: c.primary,
            borderColor: c.primary,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 3,
        },
        chipIcon: {
            fontSize: 16,
        },
        chipText: {
            fontSize: fontSize.body,
            color: c.textMuted,
            fontWeight: fontWeight.medium,
        },
        chipTextActive: {
            color: c.primaryText,
            fontWeight: fontWeight.bold,
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
            marginTop: spacing.lg,
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
        errorText: {
            fontSize: fontSize.caption,
            color: c.danger,
            marginTop: 4,
            paddingHorizontal: spacing.xs,
        },
    });
