import { deleteCategory } from "@/features/categories/repository";
import type { Category } from "@/db/schema";
import { useCategories } from "@/features/categories/useCategories";
import { useTheme } from "@/theme";
import { fontSize, fontWeight } from "@/theme/typography";
import { spacing } from "@/theme/spacing";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CategoriesScreen() {
    const { categories, loading, reloadCat } = useCategories();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors: c } = useTheme();

    useFocusEffect(
        useCallback(() => {
            void reloadCat();
        }, [reloadCat]),
    );

    const handleDelete = useCallback((id: string) => {
        Alert.alert(
            "Eliminar categoría",
            "¿Seguro que quieres eliminar esta categoría? Si tiene movimientos o presupuestos asociados, no se podrá borrar.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteCategory(id);
                            void reloadCat();
                        } catch (error) {
                            if (error instanceof Error) {
                                Alert.alert("Error", error.message);
                            }
                        }
                    },
                },
            ],
        );
    }, [reloadCat]);

    const sortedCategories = useMemo(() => {
        return [...categories].sort((a, b) => a.name.localeCompare(b.name));
    }, [categories]);

    const listEmpty = useMemo(() => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🏷️</Text>
            <Text style={[styles.emptyTitle, { color: c.text }]}>
                Sin categorías
            </Text>
            <Text style={[styles.emptySubtitle, { color: c.textMuted }]}>
                Crea categorías para clasificar tus gastos e ingresos.
            </Text>
        </View>
    ), [c, styles]);

    const listHeader = useMemo(() => (
        <View style={styles.header}>
            <View style={styles.headerRow}>
                <Text style={[styles.headerCount, { color: c.textMuted }]}>
                    {categories.length}{" "}
                    {categories.length === 1 ? "categoría" : "categorías"}
                </Text>
                <Pressable
                    style={[styles.newCatBtn, { backgroundColor: c.primary }]}
                    onPress={() => router.push("/category/new")}
                    hitSlop={8}
                >
                    <Ionicons name="add" size={18} color={c.primaryText} />
                    <Text style={[styles.newCatBtnText, { color: c.primaryText }]}>
                        Nueva
                    </Text>
                </Pressable>
            </View>
        </View>
    ), [categories.length, c, router, styles]);

    const renderItem = useCallback(
        ({ item }: { item: Category }) => {
            return (
                <Pressable
                    style={[
                        styles.row,
                        { backgroundColor: c.surface, borderColor: c.border },
                    ]}
                    onPress={() =>
                        router.push({
                            pathname: "/category/[id]",
                            params: { id: item.id },
                        })
                    }
                    onLongPress={() => handleDelete(item.id)}
                    android_ripple={{ color: c.border }}
                >
                    <View
                        style={[
                            styles.iconContainer,
                            {
                                backgroundColor: item.color
                                    ? `${item.color}20`
                                    : c.border,
                            },
                        ]}
                    >
                        <Text style={styles.iconText}>{item.icon}</Text>
                    </View>

                    <View style={styles.contentContainer}>
                        <Text style={[styles.name, { color: c.text }]}>
                            {item.name}
                        </Text>
                    </View>

                    <Pressable
                        style={styles.actionButton}
                        onPress={() =>
                            router.push({
                                pathname: "/category/[id]",
                                params: { id: item.id },
                            })
                        }
                        hitSlop={8}
                    >
                        <Ionicons name="pencil" size={18} color={c.textMuted} />
                    </Pressable>

                    <Pressable
                        style={styles.actionButton}
                        onPress={() => handleDelete(item.id)}
                        hitSlop={8}
                    >
                        <Ionicons name="trash" size={18} color={c.danger} />
                    </Pressable>
                </Pressable>
            );
        },
        [c, handleDelete, router, styles],
    );

    return (
        <View style={[styles.screen, { backgroundColor: c.background }]}>
            <FlatList
                data={sortedCategories}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                ListHeaderComponent={listHeader}
                ListEmptyComponent={listEmpty}
                contentContainerStyle={[
                    styles.listContent,
                    { paddingTop: insets.top + spacing.xs },
                ]}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    newCatBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 5,
        borderRadius: 12,
    },
    newCatBtnText: {
        fontSize: fontSize.caption,
        fontWeight: fontWeight.bold,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    listContent: {
        paddingBottom: 40,
        paddingTop: spacing.md,
    },
    header: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.sm,
    },
    headerCount: {
        fontSize: fontSize.caption,
        fontWeight: fontWeight.semibold,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: spacing.md,
        marginVertical: 4,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.md,
        borderRadius: 14,
        borderWidth: 1,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginRight: spacing.md,
    },
    iconText: {
        fontSize: 22,
    },
    contentContainer: {
        flex: 1,
    },
    name: {
        fontSize: fontSize.body,
        fontWeight: fontWeight.medium,
    },
    actionButton: {
        padding: spacing.sm,
        marginLeft: spacing.xs,
    },
    emptyContainer: {
        alignItems: "center",
        paddingTop: spacing.xxl * 2,
        paddingHorizontal: spacing.xl,
    },
    emptyEmoji: {
        fontSize: 48,
        marginBottom: spacing.md,
    },
    emptyTitle: {
        fontSize: fontSize.title,
        fontWeight: fontWeight.bold,
        marginBottom: spacing.sm,
    },
    emptySubtitle: {
        fontSize: fontSize.body,
        textAlign: "center",
        lineHeight: 22,
    },
    fab: {
        position: "absolute",
        bottom: spacing.lg,
        right: spacing.lg,
        width: 56,
        height: 56,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        elevation: 6,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.27,
        shadowRadius: 4.65,
    },
    fabText: {
        fontSize: 28,
        fontWeight: fontWeight.bold,
        marginTop: -2,
    },
});
