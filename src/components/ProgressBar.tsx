import { useTheme } from "@/theme";
import { StyleSheet, View } from "react-native";

interface ProgressBarProps {
    percentage: number;
    status: "ok" | "warn" | "over";
    height?: number;
}

export function ProgressBar({
    percentage,
    status,
    height = 8,
}: ProgressBarProps) {
    const { colors: c } = useTheme();

    const clampedPercentage = Math.min(Math.max(percentage, 0), 100);

    const fillColor =
        status === "over"
            ? c.danger
            : status === "warn"
              ? c.warning
              : c.primary;

    return (
        <View
            style={[
                styles.track,
                {
                    backgroundColor: c.track,
                    height,
                },
            ]}
        >
            <View
                style={[
                    styles.fill,
                    {
                        width: `${clampedPercentage}%`,
                        backgroundColor: fillColor,
                        height,
                    },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    track: {
        width: "100%",
        borderRadius: 99,
        overflow: "hidden",
    },
    fill: {
        borderRadius: 99,
    },
});
