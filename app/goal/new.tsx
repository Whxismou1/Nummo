import { GoalForm, goalSchema } from "@/features/goals/goalForm";
import { createGoal } from "@/features/goals/repository";
import { useAppSettings } from "@/features/settings/SettingsContext";
import { ColorPicker } from "@/components/ColorPicker";
import { EmojiPickerModal } from "@/components/EmojiPicker";
import { toCents } from "@/lib/money";
import { useTheme } from "@/theme";
import { fontSize, fontWeight } from "@/theme/typography";
import { spacing } from "@/theme/spacing";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
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

export default function NewGoalScreen() {
    const { colors: c } = useTheme();
    const { currencySymbol } = useAppSettings();
    const router = useRouter();
    const [emojiOpen, setEmojiOpen] = useState(false);

    const {
        control,
        handleSubmit,
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

    const onSubmit = async (data: GoalForm) => {
        try {
            const targetAmountCents =
                data.targetAmount && data.targetAmount.trim() !== ""
                    ? toCents(data.targetAmount)
                    : null;

            await createGoal({
                name: data.name,
                targetAmount: targetAmountCents,
                icon: data.icon,
                color: data.color,
            });
            router.back();
        } catch {
            Alert.alert("Error", "No se pudo crear la hucha.");
        }
    };

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
                        {isSubmitting ? "Creando..." : "Crear hucha"}
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
