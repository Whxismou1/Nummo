import React, { useEffect } from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/features/auth/AuthContext";
import { useTheme } from "@/theme";
import { fontSize, fontWeight } from "@/theme/typography";
import { spacing } from "@/theme/spacing";
import { NummoLogo } from "@/components/NummoLogo";

export function AppLockOverlay() {
    const { isLocked, user, unlockApp, biometricTypeLabel } = useAuth();
    const { colors: c } = useTheme();

    useEffect(() => {
        if (isLocked && user) {
            void unlockApp();
        }
    }, [isLocked, user, unlockApp]);

    if (!isLocked || !user) return null;

    const iconName =
        biometricTypeLabel === "Face ID"
            ? "scan-outline"
            : "finger-print-outline";

    return (
        <Modal visible={isLocked} animationType="fade" transparent={false}>
            <View style={[styles.container, { backgroundColor: c.background }]}>
                <View style={[styles.glow, { backgroundColor: c.primary }]} />

                <View style={styles.content}>
                    <NummoLogo size={80} />
                    <Text style={[styles.title, { color: c.text }]}>Nummo</Text>
                    <Text style={[styles.subtitle, { color: c.textMuted }]}>
                        Tu espacio financiero está protegido
                    </Text>

                    <Pressable
                        style={[
                            styles.unlockBtn,
                            {
                                backgroundColor: c.primary,
                                shadowColor: c.primary,
                            },
                        ]}
                        onPress={() => void unlockApp()}
                    >
                        <Ionicons name={iconName} size={24} color={c.primaryText} />
                        <Text
                            style={[
                                styles.unlockBtnText,
                                { color: c.primaryText },
                            ]}
                        >
                            Desbloqueo biométrico
                        </Text>
                    </Pressable>
                </View>

                <View style={styles.footer}>
                    <Ionicons name="lock-closed" size={14} color={c.textMuted} />
                    <Text style={[styles.footerText, { color: c.textMuted }]}>
                        Protección biométrica activa
                    </Text>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.lg,
    },
    glow: {
        position: "absolute",
        width: 260,
        height: 260,
        borderRadius: 130,
        opacity: 0.12,
        top: "25%",
    },
    content: {
        alignItems: "center",
        width: "100%",
        maxWidth: 360,
    },
    title: {
        fontSize: fontSize.heading,
        fontWeight: fontWeight.bold,
        letterSpacing: -0.5,
        marginTop: spacing.md,
    },
    subtitle: {
        fontSize: fontSize.body,
        fontWeight: fontWeight.medium,
        textAlign: "center",
        marginTop: spacing.xs,
        marginBottom: spacing.xl,
        maxWidth: 260,
    },
    unlockBtn: {
        width: "100%",
        height: 54,
        borderRadius: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    unlockBtnText: {
        fontSize: fontSize.body,
        fontWeight: fontWeight.bold,
    },
    footer: {
        position: "absolute",
        bottom: 48,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    footerText: {
        fontSize: fontSize.caption,
        fontWeight: fontWeight.medium,
    },
});
