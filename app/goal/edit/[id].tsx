import { GoalForm, goalSchema } from "@/features/goals/goalForm";
import {
    getGoalByIdWithProgress,
    updateGoal,
} from "@/features/goals/repository";
import { useAppSettings } from "@/features/settings/SettingsContext";
import { ColorPicker } from "@/components/ColorPicker";
import { EmojiPickerModal } from "@/components/EmojiPicker";
import { toCents } from "@/lib/money";
import { useTheme } from "@/theme";
import { fontSize, fontWeight } from "@/theme/typography";
import { spacing } from "@/theme/spacing";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
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

export default function EditGoalScreen() {
    const { colors: c } = useTheme();
    const { currencySymbol } = useAppSettings();
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [loading, setLoading] = useState(true);
    const [emojiOpen, setEmojiOpen] = useState(false);

    const {
        control,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<GoalForm>({
        resolver: zodResolver(goalSchema),
        defaultValues: {
            name: "",
            targetAmount: "",
            icon: "🐷",
            color: "#4F46E5",
        },
    });

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                const g = await getGoalByIdWithProgress(id);
                if (!g) {
                    Alert.alert("Error", "Hucha no encontrada.");
                    router.back();
                    return;
                }
                const targetStr =
                    g.targetAmount && g.targetAmount > 0
                        ? (g.targetAmount / 100).toFixed(2).replace(".", ",")
                        : "";
                reset({
                    name: g.name,
                    targetAmount: targetStr.endsWith(",00")
                        ? targetStr.slice(0, -3)
                        : targetStr,
                    icon: g.icon,
                    color: g.color,
                });
            } catch {
                Alert.alert("Error", "No se pudo cargar la hucha.");
                router.back();
            } finally {
                setLoading(false);
            }
        })();
    }, [id, reset, router]);

    const onSubmit = async (data: GoalForm) => {
        if (!id) return;
        try {
            const targetAmountCents =
                data.targetAmount && data.targetAmount.trim() !== ""
                    ? toCents(data.targetAmount)
                    : null;

            await updateGoal(id, {
                name: data.name,
                targetAmount: targetAmountCents,
                icon: data.icon,
                color: data.color,
            });
            router.back();
        } catch {
            Alert.alert("Error", "No se pudo actualizar la hucha.");
        }
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: c.background }]}>
                <ActivityIndicator size="large" color={c.primary} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={[styles.screen, { backgroundColor: c.background }]}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.form}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Icon Picker ───────────────────────────── */}
                <Text style={[styles.label, { color: c.textMuted }]}>Icono</Text>
                <Controller
                    name="icon"
                    control={control}
                    render={({ field }) => (
                        <>
                            <Pressable
                                style={[
                                    styles.iconButton,
                                    {
                                        backgroundColor: c.surface,
                                        borderColor: c.border,
                                    },
                                ]}
                                onPress={() => setEmojiOpen(true)}
                            >
                                <Text style={styles.iconEmoji}>
                                    {field.value || "🐷"}
                                </Text>
                            </Pressable>
                            <EmojiPickerModal
                                open={emojiOpen}
                                onClose={() => setEmojiOpen(false)}
                                onSelectEmoji={field.onChange}
                            />
                        </>
                    )}
                />
                {errors.icon && (
                    <Text style={[styles.error, { color: c.danger }]}>
                        {errors.icon.message}
                    </Text>
                )}

                {/* ── Name ──────────────────────────────────── */}
                <Text style={[styles.label, { color: c.textMuted }]}>
                    Nombre de la hucha
                </Text>
                <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: c.surface,
                                    borderColor: c.border,
                                    color: c.text,
                                },
                            ]}
                            placeholder="Ej. Vacaciones, Coche, Fondo..."
                            placeholderTextColor={c.textMuted}
                            value={field.value}
                            onChangeText={field.onChange}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                {errors.name && (
                    <Text style={[styles.error, { color: c.danger }]}>
                        {errors.name.message}
                    </Text>
                )}

                {/* ── Target Amount (Optional) ──────────────── */}
                <Text style={[styles.label, { color: c.textMuted }]}>
                    Objetivo / Meta ({currencySymbol}) — Opcional
                </Text>
                <Controller
                    name="targetAmount"
                    control={control}
                    render={({ field }) => (
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: c.surface,
                                    borderColor: c.border,
                                    color: c.text,
                                },
                            ]}
                            placeholder="Dejar vacío si no tienes meta fija"
                            placeholderTextColor={c.textMuted}
                            keyboardType="decimal-pad"
                            value={field.value}
                            onChangeText={field.onChange}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                {errors.targetAmount && (
                    <Text style={[styles.error, { color: c.danger }]}>
                        {errors.targetAmount.message}
                    </Text>
                )}

                {/* ── Color Picker ──────────────────────────── */}
                <Text style={[styles.label, { color: c.textMuted }]}>Color</Text>
                <Controller
                    name="color"
                    control={control}
                    render={({ field }) => (
                        <ColorPicker
                            value={field.value}
                            onChange={field.onChange}
                        />
                    )}
                />
                {errors.color && (
                    <Text style={[styles.error, { color: c.danger }]}>
                        {errors.color.message}
                    </Text>
                )}

                {/* ── Submit button ─────────────────────────── */}
                <Pressable
                    style={[
                        styles.submitButton,
                        { backgroundColor: c.primary },
                        isSubmitting && styles.submitButtonDisabled,
                    ]}
                    onPress={handleSubmit(onSubmit)}
                    disabled={isSubmitting}
                >
                    <Text style={[styles.submitButtonText, { color: c.primaryText }]}>
                        {isSubmitting ? "Guardando..." : "Guardar cambios"}
                    </Text>
                </Pressable>
            </ScrollView>
        </KeyboardAvoidingView>
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
    form: {
        padding: spacing.lg,
        gap: spacing.xs,
    },
    label: {
        fontSize: fontSize.caption,
        fontWeight: fontWeight.semibold,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginTop: spacing.sm,
    },
    iconButton: {
        borderWidth: 1,
        borderRadius: 14,
        paddingVertical: spacing.md,
        alignItems: "center",
        justifyContent: "center",
    },
    iconEmoji: {
        fontSize: 38,
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 4,
        fontSize: fontSize.body,
    },
    error: {
        fontSize: fontSize.caption,
        marginTop: 2,
    },
    submitButton: {
        paddingVertical: spacing.md,
        borderRadius: 12,
        alignItems: "center",
        marginTop: spacing.xl,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        fontSize: fontSize.body,
        fontWeight: fontWeight.bold,
    },
});
