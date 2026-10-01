import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import { useColorScheme } from "react-native";
import { colors } from "./colors";
import { conn } from "@/db";

/** Color tokens available in every screen via useTheme() */
export type ThemeColors = {
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    primary: string;
    primaryText: string;
    border: string;
    track: string;
    success: string;
    danger: string;
    warning: string;
};

export type ThemeMode = "system" | "light" | "dark";

interface ThemeContextType {
    colors: ThemeColors;
    isDark: boolean;
    colorScheme: "light" | "dark";
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

try {
    conn.execSync(`
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);
} catch {}

function getStoredThemeMode(): ThemeMode {
    try {
        const row = conn.getFirstSync<{ value: string }>(
            "SELECT value FROM app_settings WHERE key = 'theme_mode'"
        );
        if (row?.value === "light" || row?.value === "dark" || row?.value === "system") {
            return row.value as ThemeMode;
        }
    } catch (e) {
        console.warn("[ThemeContext] Error reading stored theme:", e);
    }
    return "system";
}

function persistThemeMode(mode: ThemeMode): void {
    try {
        conn.runSync(
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('theme_mode', ?)",
            [mode]
        );
    } catch (e) {
        console.warn("[ThemeContext] Error saving stored theme:", e);
    }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemColorScheme = useColorScheme();
    const [themeMode, setThemeModeState] = useState<ThemeMode>(() => getStoredThemeMode());

    const isDark =
        themeMode === "system"
            ? systemColorScheme === "dark"
            : themeMode === "dark";

    const colorScheme = isDark ? ("dark" as const) : ("light" as const);
    const themeColors: ThemeColors = isDark ? colors.dark : colors.light;

    const setThemeMode = useCallback((mode: ThemeMode) => {
        setThemeModeState(mode);
        persistThemeMode(mode);
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeModeState((current) => {
            const next: ThemeMode =
                current === "system"
                    ? systemColorScheme === "dark"
                        ? "light"
                        : "dark"
                    : current === "dark"
                    ? "light"
                    : "dark";
            persistThemeMode(next);
            return next;
        });
    }, [systemColorScheme]);

    const value = useMemo(
        () => ({
            colors: themeColors,
            isDark,
            colorScheme,
            themeMode,
            setThemeMode,
            toggleTheme,
        }),
        [themeColors, isDark, colorScheme, themeMode, setThemeMode, toggleTheme],
    );

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextType {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}
