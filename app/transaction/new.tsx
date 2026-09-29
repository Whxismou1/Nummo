import { useCategories } from "@/features/categories/useCategories";
import { createTransaction } from "@/features/transactions/repository";
import {
    TransactionForm,
    transactionSchema,
} from "@/features/transactions/transactionForm";
import { formatDate } from "@/lib/date";
import { toCents } from "@/lib/money";
import { useTheme } from "@/theme";
import { fontSize, fontWeight } from "@/theme/typography";
import { spacing } from "@/theme/spacing";
import { zodResolver } from "@hookform/resolvers/zod";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
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

export default function NewTransaction() {
    const { colors: c } = useTheme();
    const { currencySymbol } = useAppSettings();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(c), [c]);

    const router = useRouter();
    const { categories } = useCategories();
    const [showDatePicker, setShowDatePicker] = useState(false);

    const {
        control,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<TransactionForm>({
        resolver: zodResolver(transactionSchema),
        defaultValues: {
            amount: "",
            type: "expense",
            note: "",
            categoryId: "",
            date: Date.now(),
        },
    });

    const currentType = watch("type");

    const onSubmit = async (data: TransactionForm) => {
        try {
            const amountCents = toCents(data.amount);
            const categoryId = data.categoryId || undefined;
            await createTransaction({
                amount: amountCents,
                type: data.type,
                categoryId,
                date: data.date,
                note: data.note || undefined,
            });
            router.back();
        } catch {
            Alert.alert("Error", "No se pudo guardar el movimiento.");
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.screen}
        >
            <ScrollView
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: insets.top + spacing.xs, paddingBottom: insets.bottom + spacing.xl },
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

                {/* ── Type Segmented Control ──────────────────────── */}
                <Controller
                    name="type"
                    control={control}
                    render={({ field }) => (
                        <View style={styles.segmentContainer}>
                            <Pressable
                                style={[
                                    styles.segmentButton,
                                    field.value === "expense" && styles.segmentButtonActive,
                                ]}
                                onPress={() => field.onChange("expense")}
                            >
                                <Ionicons
                                    name="arrow-down"
                                    size={18}
                                    color={field.value === "expense" ? c.danger : c.textMuted}
                                />
                                <Text
                                    style={[
                                        styles.segmentText,
                                        field.value === "expense" && { color: c.danger, fontWeight: fontWeight.bold },
                                    ]}
                                >
                                    Gasto
                                </Text>
                            </Pressable>
                            <Pressable
                                style={[
                                    styles.segmentButton,
                                    field.value === "income" && styles.segmentButtonActive,
                                ]}
                                onPress={() => field.onChange("income")}
                            >
                                <Ionicons
                                    name="arrow-up"
                                    size={18}
                                    color={field.value === "income" ? c.success : c.textMuted}
                                />
                                <Text
                                    style={[
                                        styles.segmentText,
                                        field.value === "income" && { color: c.success, fontWeight: fontWeight.bold },
                                    ]}
                                >
                                    Ingreso
                                </Text>
                            </Pressable>
                        </View>
                    )}
                />
                {errors.type && (
                    <Text style={styles.errorText}>{errors.type.message}</Text>
                )}

                {/* ── Hero Amount ─────────────────────────────────── */}
                <View style={styles.heroAmountContainer}>
                    <Text
                        style={[
                            styles.heroSign,
                            { color: currentType === "expense" ? c.danger : c.success },
                        ]}
                    >
                        {currentType === "expense" ? "-" : "+"}
                    </Text>
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
                                autoFocus
                            />
                        )}
                    />
                    <Text style={styles.heroCurrency}>{currencySymbol}</Text>
                </View>
                {errors.amount && (
                    <Text style={styles.errorText}>{errors.amount.message}</Text>
                )}

                {/* ── Note Input ──────────────────────────────────── */}
                <Controller
                    name="note"
                    control={control}
                    render={({ field }) => (
                        <View style={styles.noteContainer}>
                            <Ionicons name="pencil" size={20} color={c.textMuted} />
                            <TextInput
                                style={styles.noteInput}
                                placeholder="Añadir nota o concepto..."
                                placeholderTextColor={c.textMuted}
                                value={field.value}
                                onChangeText={field.onChange}
                                onBlur={field.onBlur}
                            />
                        </View>
                    )}
                />

                {/* ── Date & Info Pills ───────────────────────────── */}
                <Controller
                    name="date"
                    control={control}
                    render={({ field }) => (
                        <View style={styles.pillsRow}>
                            <Pressable
                                style={styles.datePill}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Ionicons name="calendar-outline" size={18} color={c.text} />
                                <Text style={styles.datePillText}>
                                    {formatDate(field.value)}
                                </Text>
                            </Pressable>
                            {showDatePicker && (
                                <DateTimePicker
                                    value={new Date(field.value)}
                                    mode="date"
                                    display="default"
                                    maximumDate={new Date()}
                                    onValueChange={(_event, date) => {
                                        setShowDatePicker(Platform.OS === "ios");
                                        if (date) {
                                            field.onChange(date.getTime());
                                        }
                                    }}
                                    onDismiss={() => setShowDatePicker(false)}
                                />
                            )}
                        </View>
                    )}
                />
                {errors.date && (
                    <Text style={styles.errorText}>{errors.date.message}</Text>
                )}

                {/* ── Category Chips ──────────────────────────────── */}
                <View style={styles.categoriesSection}>
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
                </View>

                {/* ── Save Button ─────────────────────────────────── */}
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
                                name="checkmark-circle-outline"
                                size={24}
                                color={c.primaryText}
                            />
                        )}
                        <Text style={styles.submitButtonText}>
                            Guardar Movimiento
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
        segmentContainer: {
            flexDirection: "row",
            backgroundColor: c.track,
            borderRadius: 999,
            padding: spacing.xs,
            marginTop: spacing.xs,
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
        heroAmountContainer: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginVertical: spacing.lg,
        },
        heroSign: {
            fontSize: fontSize.heading,
            fontWeight: fontWeight.bold,
            marginRight: spacing.xs,
        },
        heroInput: {
            fontSize: 48,
            fontWeight: "700",
            color: c.text,
            textAlign: "center",
            minWidth: 100,
        },
        heroCurrency: {
            fontSize: fontSize.heading,
            color: c.textMuted,
            marginLeft: spacing.xs,
            fontWeight: fontWeight.bold,
            alignSelf: "center",
            marginBottom: 6,
        },
        noteContainer: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "transparent",
            gap: spacing.sm,
        },
        noteInput: {
            fontSize: fontSize.body,
            color: c.text,
            textAlign: "center",
            minWidth: 200,
        },
        pillsRow: {
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
        },
        datePill: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.surface,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: 999,
            gap: spacing.xs,
        },
        datePillText: {
            fontSize: fontSize.body,
            color: c.text,
            fontWeight: fontWeight.medium,
        },
        categoriesSection: {
            marginTop: spacing.sm,
        },
        chipsContent: {
            gap: spacing.sm,
            paddingHorizontal: spacing.xs,
            paddingBottom: spacing.sm,
        },
        chip: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: c.surface,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: 999,
            gap: spacing.xs,
        },
        chipActive: {
            backgroundColor: c.primary,
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
        footer: {
            marginTop: spacing.xxl,
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
            textAlign: "center",
        },
    });
