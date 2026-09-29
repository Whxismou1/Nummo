import { db } from "@/db";
import { seedDefaultData } from "@/db/seed";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, LogBox, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "@/theme";
import migrations from "../drizzle/migrations";

// Ignore deprecated warnings from older sub-dependencies in React Native 0.86 / Expo 57
LogBox.ignoreLogs([
  "SafeAreaView has been deprecated",
  "InteractionManager has been deprecated",
]);

import { SafeAreaProvider } from "react-native-safe-area-context";

import { SettingsProvider } from "@/features/settings/SettingsContext";
import { AuthProvider } from "@/features/auth/AuthContext";
import { AppLockOverlay } from "@/components/AppLockOverlay";

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  useEffect(() => {
    if (success) {
      void seedDefaultData();
    }
  }, [success]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "red" }}>{error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SettingsProvider>
          <AuthProvider>
            <RootLayoutNav />
            <AppLockOverlay />
          </AuthProvider>
        </SettingsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootLayoutNav() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        initialRouteName="index"
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="auth"
          options={{
            headerShown: false,
            animation: "fade",
            gestureEnabled: false,
          }}
        />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="categories" options={{ headerShown: false }} />
        <Stack.Screen
          name="transaction/new"
          options={{
            headerShown: false,
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="transaction/[id]"
          options={{
            headerShown: false,
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen name="category/new" options={{ title: "Nueva categoría" }} />
        <Stack.Screen name="category/[id]" options={{ title: "Editar categoría" }} />
        <Stack.Screen name="budget/new" options={{ title: "Nuevo sobre" }} />
        <Stack.Screen name="budget/[id]" options={{ title: "Editar sobre" }} />
        <Stack.Screen name="goal/new" options={{ title: "Nueva hucha" }} />
        <Stack.Screen name="goal/[id]" options={{ title: "Detalle de hucha" }} />
        <Stack.Screen name="goal/edit/[id]" options={{ title: "Editar hucha" }} />
      </Stack>
    </>
  );
}
