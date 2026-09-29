import { useTheme } from "@/theme";
import { spacing } from "@/theme/spacing";
import { fontSize, fontWeight } from "@/theme/typography";
import React, { useState, useEffect } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";

// ── Helpers ──────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
    const clean = hex.replace("#", "");
    if (clean.length === 6) {
        const r = parseInt(clean.substring(0, 2), 16);
        const g = parseInt(clean.substring(2, 4), 16);
        const b = parseInt(clean.substring(4, 6), 16);
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
            return { r, g, b };
        }
    }
    return { r: 79, g: 70, b: 229 }; // fallback indigo
}

function rgbToHex(r: number, g: number, b: number) {
    const toHex = (n: number) =>
        Math.max(0, Math.min(255, Math.round(n)))
            .toString(16)
            .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// Quick Preset Favorites
const PRESET_COLORS = [
    "#4F46E5", // Indigo
    "#7C3AED", // Violet
    "#DB2777", // Pink
    "#E11D48", // Rose
    "#EA580C", // Orange
    "#D97706", // Amber
    "#16A34A", // Green
    "#059669", // Emerald
    "#0891B2", // Cyan
    "#2563EB", // Blue
    "#64748B", // Slate
    "#1E293B", // Dark Slate
];

// ── Main ColorPicker Component ───────────────────────────────────────

type Props = {
    value: string;
    onChange: (color: string) => void;
};

export function ColorPicker({ value, onChange }: Props) {
    const { colors: c } = useTheme();

    const initial = hexToRgb(value);
    const [r, setR] = useState(initial.r);
    const [g, setG] = useState(initial.g);
    const [b, setB] = useState(initial.b);

    useEffect(() => {
        const rgb = hexToRgb(value);
        setR(rgb.r);
        setG(rgb.g);
        setB(rgb.b);
    }, [value]);

    const handleRgbChange = (newR: number, newG: number, newB: number) => {
        setR(newR);
        setG(newG);
        setB(newB);
        const hex = rgbToHex(newR, newG, newB);
        onChange(hex);
    };

    const currentColor = rgbToHex(r, g, b);

    return (
        <View style={styles.container}>
            {/* Color Preview & HEX Banner */}
            <View style={[styles.previewCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View
                    style={[
                        styles.colorSwatchLarge,
                        {
                            backgroundColor: currentColor,
                            shadowColor: currentColor,
                        },
                    ]}
                />
                <View style={styles.previewInfo}>
                    <Text style={[styles.previewTitle, { color: c.text }]}>
                        Color personalizado
                    </Text>
                    <Text style={[styles.previewHex, { color: c.primary }]}>
                        {currentColor}
                    </Text>
                    <Text style={[styles.previewRgbDesc, { color: c.textMuted }]}>
                        RGB ({r}, {g}, {b})
                    </Text>
                </View>
            </View>

            {/* Native RGB Sliders */}
            <View style={[styles.slidersCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Text style={[styles.sectionSubtitle, { color: c.textMuted }]}>
                    DESLIZA PARA MEZCLAR COLOR (RGB NATIVO)
                </Text>

                {/* Red Channel */}
                <View style={styles.channelRow}>
                    <View style={styles.channelHeader}>
                        <Text style={[styles.channelLabel, { color: "#EF4444" }]}>
                            Rojo (R)
                        </Text>
                        <Text style={[styles.channelVal, { color: c.text }]}>{r}</Text>
                    </View>
                    <Slider
                        style={styles.nativeSlider}
                        minimumValue={0}
                        maximumValue={255}
                        step={1}
                        value={r}
                        onValueChange={(val) => handleRgbChange(val, g, b)}
                        minimumTrackTintColor="#EF4444"
                        maximumTrackTintColor={c.track}
                        thumbTintColor="#EF4444"
                    />
                </View>

                {/* Green Channel */}
                <View style={styles.channelRow}>
                    <View style={styles.channelHeader}>
                        <Text style={[styles.channelLabel, { color: "#10B981" }]}>
                            Verde (G)
                        </Text>
                        <Text style={[styles.channelVal, { color: c.text }]}>{g}</Text>
                    </View>
                    <Slider
                        style={styles.nativeSlider}
                        minimumValue={0}
                        maximumValue={255}
                        step={1}
                        value={g}
                        onValueChange={(val) => handleRgbChange(r, val, b)}
                        minimumTrackTintColor="#10B981"
                        maximumTrackTintColor={c.track}
                        thumbTintColor="#10B981"
                    />
                </View>

                {/* Blue Channel */}
                <View style={styles.channelRow}>
                    <View style={styles.channelHeader}>
                        <Text style={[styles.channelLabel, { color: "#3B82F6" }]}>
                            Azul (B)
                        </Text>
                        <Text style={[styles.channelVal, { color: c.text }]}>{b}</Text>
                    </View>
                    <Slider
                        style={styles.nativeSlider}
                        minimumValue={0}
                        maximumValue={255}
                        step={1}
                        value={b}
                        onValueChange={(val) => handleRgbChange(r, g, val)}
                        minimumTrackTintColor="#3B82F6"
                        maximumTrackTintColor={c.track}
                        thumbTintColor="#3B82F6"
                    />
                </View>
            </View>

            {/* Presets Grid */}
            <View style={styles.presetsSection}>
                <Text style={[styles.sectionSubtitle, { color: c.textMuted }]}>
                    O ELIGE UNO RÁPIDO
                </Text>
                <View style={styles.presetsGrid}>
                    {PRESET_COLORS.map((preset) => {
                        const isSelected =
                            currentColor.toLowerCase() === preset.toLowerCase();
                        return (
                            <Pressable
                                key={preset}
                                style={[
                                    styles.presetBtn,
                                    { backgroundColor: preset },
                                    isSelected && styles.presetBtnSelected,
                                ]}
                                onPress={() => {
                                    const rgb = hexToRgb(preset);
                                    handleRgbChange(rgb.r, rgb.g, rgb.b);
                                }}
                                hitSlop={4}
                            >
                                {isSelected && (
                                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                                )}
                            </Pressable>
                        );
                    })}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: spacing.md,
    },
    previewCard: {
        flexDirection: "row",
        alignItems: "center",
        padding: spacing.md,
        borderRadius: 18,
        borderWidth: 1,
        gap: spacing.md,
    },
    colorSwatchLarge: {
        width: 52,
        height: 52,
        borderRadius: 16,
        elevation: 6,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    previewInfo: {
        flex: 1,
    },
    previewTitle: {
        fontSize: fontSize.body - 1,
        fontWeight: fontWeight.semibold,
    },
    previewHex: {
        fontSize: fontSize.subtitle,
        fontFamily: "monospace",
        fontWeight: fontWeight.bold,
        marginTop: 2,
    },
    previewRgbDesc: {
        fontSize: fontSize.caption,
        marginTop: 1,
    },
    slidersCard: {
        borderRadius: 18,
        borderWidth: 1,
        padding: spacing.md,
        gap: spacing.md,
    },
    sectionSubtitle: {
        fontSize: 10,
        fontWeight: fontWeight.bold,
        letterSpacing: 0.6,
        marginBottom: 2,
    },
    channelRow: {
        gap: 2,
    },
    channelHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 4,
    },
    channelLabel: {
        fontSize: 11,
        fontWeight: fontWeight.bold,
    },
    channelVal: {
        fontSize: 11,
        fontFamily: "monospace",
        fontWeight: fontWeight.bold,
    },
    nativeSlider: {
        width: "100%",
        height: 38,
    },
    presetsSection: {
        gap: spacing.xs + 2,
    },
    presetsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
    },
    presetBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.1)",
    },
    presetBtnSelected: {
        borderWidth: 3,
        borderColor: "#FFFFFF",
        transform: [{ scale: 1.15 }],
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
});
