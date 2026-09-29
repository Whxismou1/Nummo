import { Tabs } from "expo-router/js-tabs";
import { CustomTabBar } from "@/components/CustomTabBar";
import { useAuth } from "@/features/auth/AuthContext";
import { Redirect } from "expo-router";

export default function TabLayout() {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return <Redirect href="/auth" />;
    }

    return (
        <Tabs
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{
                headerShown: false,
            }}
        >
            <Tabs.Screen name="index" options={{ title: "Inicio" }} />
            <Tabs.Screen name="budgets" options={{ title: "Presupuestos" }} />
            <Tabs.Screen name="goals" options={{ title: "Huchas" }} />
            <Tabs.Screen name="settings" options={{ title: "Ajustes" }} />
            <Tabs.Screen
                name="transactions"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="categories"
                options={{
                    href: null,
                }}
            />
        </Tabs>
    );
}
