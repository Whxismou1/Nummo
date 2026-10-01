import { useTheme } from "@/theme";
import { fontSize, fontWeight } from "@/theme/typography";
import { spacing } from "@/theme/spacing";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
export function CustomTabBar({ state, descriptors, navigation }: any) {
    const { colors: c } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const tabConfig: Record<
        string,
        { label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }
    > = {
        index: { label: "Inicio", icon: "wallet-outline", iconActive: "wallet" },
        budgets: { label: "Presupuestos", icon: "pie-chart-outline", iconActive: "pie-chart" },
        goals: { label: "Huchas", icon: "sparkles-outline", iconActive: "sparkles" },
        settings: { label: "Ajustes", icon: "settings-outline", iconActive: "settings" },
    };

    const validRoutes = state.routes.filter((route: any) => tabConfig[route.name] !== undefined);

    const leftTabs = validRoutes.slice(0, 2);
    const rightTabs = validRoutes.slice(2, 4);

    const renderTabButton = (route: any) => {
        const isFocused = state.routes[state.index]?.name === route.name;
        const config = tabConfig[route.name];
        if (!config) return null;

        const onPress = () => {
            const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
            }
        };

        const activeColor = c.primary;
        const inactiveColor = c.textMuted;
        const color = isFocused ? activeColor : inactiveColor;

        return (
            <Pressable
                key={route.key}
                onPress={onPress}
                style={styles.tabButton}
                hitSlop={8}
            >
                <Ionicons
                    name={isFocused ? config.iconActive : config.icon}
                    size={22}
                    color={color}
                />
                <Text
                    style={[
                        styles.tabLabel,
                        {
                            color,
                            fontWeight: isFocused ? fontWeight.bold : fontWeight.medium,
                        },
                    ]}
                >
                    {config.label}
                </Text>
                {isFocused && (
                    <View
                        style={[
                            styles.activeDot,
                            { backgroundColor: activeColor },
                        ]}
                    />
                )}
            </Pressable>
        );
    };

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: c.surface,
                    borderTopColor: c.border,
                    paddingBottom: Math.max(insets.bottom, 8),
                },
            ]}
        >
            {/* Left 2 tabs: Inicio, Gastos */}
            <View style={styles.tabGroup}>
                {leftTabs.map(renderTabButton)}
            </View>

            {/* Central Elevated FAB (+) matching Stitch design */}
            <View style={styles.fabWrapper}>
                <Pressable
                    style={({ pressed }) => [
                        styles.centerFab,
                        {
                            backgroundColor: c.primary,
                            shadowColor: c.primary,
                            transform: [{ scale: pressed ? 0.94 : 1 }],
                        },
                    ]}
                    onPress={() => router.push("/transaction/new" as any)}
                >
                    <Ionicons name="add" size={30} color="#FFFFFF" />
                </Pressable>
            </View>

            {/* Right 2 tabs: Huchas, Ajustes */}
            <View style={styles.tabGroup}>
                {rightTabs.map(renderTabButton)}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        alignItems: "center",
        borderTopWidth: 1,
        paddingTop: 8,
        minHeight: 64,
        position: "relative",
    },
    tabGroup: {
        flex: 1,
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
    },
    tabButton: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 2,
        minWidth: 54,
    },
    tabLabel: {
        fontSize: 11,
        marginTop: 3,
        letterSpacing: 0.2,
    },
    activeDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginTop: 2,
    },
    fabWrapper: {
        width: 68,
        alignItems: "center",
        justifyContent: "center",
        marginTop: -26, // Elevates the button nicely above the bar
    },
    centerFab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: "center",
        justifyContent: "center",
        elevation: 10,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.38,
        shadowRadius: 12,
    },
});
