import { CategoryForm, categorySchema } from "@/features/categories/categoryForm";
import { createCategory } from "@/features/categories/repository";
import { ColorPicker } from "@/components/ColorPicker";
import { useTheme } from "@/theme";
import { fontSize, fontWeight } from "@/theme/typography";
import { spacing } from "@/theme/spacing";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
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
import { EmojiPickerModal } from "@/components/EmojiPicker";

export default function NewCategory() {
    const { colors: c } = useTheme();
    const styles = useMemo(() => createStyles(c), [c]);
    const router = useRouter();
    const [emojiOpen, setEmojiOpen] = useState(false);

    const {
        control,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<CategoryForm>({
        resolver: zodResolver(categorySchema),
        defaultValues: { name: "", icon: "", color: "#4F46E5" },
    });

    const onSubmit = async (data: CategoryForm) => {
        try {
            await createCategory(data);
            router.back();
        } catch {
            Alert.alert("Error", "No se pudo crear la categoría.");
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.screen}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.form}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Icon (emoji picker) ─────────────────── */}
                <Text style={styles.label}>Icono</Text>
                <Controller
                    name="icon"
                    control={control}
                    render={({ field }) => (
                        <>
                            <Pressable
                                style={styles.iconButton}
                                onPress={() => setEmojiOpen(true)}
                            >
                                <Text style={styles.iconEmoji}>
                                    {field.value || "Toca para elegir"}
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
                    <Text style={styles.error}>{errors.icon.message}</Text>
                )}

                {/* ── Name ────────────────────────────────── */}
                <Text style={styles.label}>Nombre</Text>
                <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                        <TextInput
                            style={styles.input}
                            placeholder="Ej: Ocio, Transporte..."
                            placeholderTextColor={c.textMuted}
                            value={field.value}
                            onChangeText={field.onChange}
                            onBlur={field.onBlur}
                        />
                    )}
                />
                {errors.name && (
                    <Text style={styles.error}>{errors.name.message}</Text>
                )}

                {/* ── Color (palette) ─────────────────────── */}
                <Text style={styles.label}>Color</Text>
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
                    <Text style={styles.error}>{errors.color.message}</Text>
                )}

                {/* ── Submit ──────────────────────────────── */}
                <Pressable
                    style={[
                        styles.submitButton,
                        isSubmitting && styles.submitButtonDisabled,
                    ]}
                    onPress={handleSubmit(onSubmit)}
                    disabled={isSubmitting}
                >
                    <Text style={styles.submitButtonText}>
                        {isSubmitting ? "Creando..." : "Crear categoría"}
                    </Text>
                </Pressable>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

// ── Styles ───────────────────────────────────────────────────────────

type C = ReturnType<typeof import("@/theme").useTheme>["colors"];

const createStyles = (c: C) =>
    StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: c.background,
        },
        form: {
            padding: spacing.lg,
            gap: spacing.xs,
        },
        label: {
            fontSize: fontSize.caption,
            fontWeight: fontWeight.semibold,
            color: c.textMuted,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginTop: spacing.sm,
        },
        input: {
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 12,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 4,
            fontSize: fontSize.body,
            color: c.text,
        },
        iconButton: {
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: 12,
            paddingVertical: spacing.md,
            alignItems: "center",
            justifyContent: "center",
        },
        iconEmoji: {
            fontSize: 36,
        },
        error: {
            fontSize: fontSize.caption,
            color: c.danger,
            marginTop: 2,
        },
        submitButton: {
            backgroundColor: c.primary,
            paddingVertical: spacing.md,
            borderRadius: 12,
            alignItems: "center",
            marginTop: spacing.lg,
        },
        submitButtonDisabled: {
            opacity: 0.6,
        },
        submitButtonText: {
            color: c.primaryText,
            fontSize: fontSize.body,
            fontWeight: fontWeight.bold,
        },
    });