import React from "react";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";

interface NummoLogoProps {
    size?: number;
    showBackground?: boolean;
    style?: StyleProp<ViewStyle>;
}

export function NummoLogo({
    size = 48,
    showBackground = true,
    style,
}: NummoLogoProps) {
    if (!showBackground) {
        return (
            <View style={[{ width: size, height: size }, style]}>
                <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
                    <Path
                        d="M7 25V7L19.5 21V7H25V25L12.5 11V25H7Z"
                        fill="#FFFFFF"
                    />
                </Svg>
            </View>
        );
    }

    const borderRadius = Math.round(size * 0.26);

    return (
        <View
            style={[
                styles.container,
                {
                    width: size,
                    height: size,
                    borderRadius,
                },
                style,
            ]}
        >
            <Svg width={size} height={size} viewBox="0 0 32 32">
                <Defs>
                    <LinearGradient id="nummoGrad" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor="#4F46E5" />
                        <Stop offset="100%" stopColor="#1E1B4B" />
                    </LinearGradient>
                </Defs>
                <Rect
                    x="0"
                    y="0"
                    width="32"
                    height="32"
                    rx={7}
                    fill="url(#nummoGrad)"
                />
                <Path
                    d="M7 25V7L19.5 21V7H25V25L12.5 11V25H7Z"
                    fill="#FFFFFF"
                />
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: "hidden",
        shadowColor: "#4F46E5",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
    },
});
