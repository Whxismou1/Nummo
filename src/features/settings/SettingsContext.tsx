import { conn } from "@/db";
import { setActiveCurrency } from "@/lib/money";
import React, { createContext, useContext, useEffect, useState } from "react";

export type CurrencyCode = "EUR" | "USD" | "GBP";
export type FirstDayOfWeek = "monday" | "sunday";

export interface AppSettings {
    currency: CurrencyCode;
    firstDayOfWeek: FirstDayOfWeek;
    hideBalances: boolean;
    notificationsApp: boolean;
    notificationsEmail: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
    currency: "EUR",
    firstDayOfWeek: "monday",
    hideBalances: false,
    notificationsApp: true,
    notificationsEmail: false,
};

export const CURRENCY_CONFIG: Record<CurrencyCode, { name: string; symbol: string; locale: string }> = {
    EUR: { name: "Euro (€)", symbol: "€", locale: "es-ES" },
    USD: { name: "Dólar ($)", symbol: "$", locale: "en-US" },
    GBP: { name: "Libra (£)", symbol: "£", locale: "en-GB" },
};

// Ensure app_settings table exists
try {
    conn.execSync(`
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);
} catch (e) {
    console.warn("Could not create app_settings table:", e);
}

export function getAppSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
    try {
        const row = conn.getFirstSync<{ value: string }>(
            "SELECT value FROM app_settings WHERE key = ?",
            [key]
        );
        if (!row) return DEFAULT_SETTINGS[key];
        if (key === "hideBalances" || key === "notificationsApp" || key === "notificationsEmail") {
            return (row.value === "true") as AppSettings[K];
        }
        return row.value as AppSettings[K];
    } catch {
        return DEFAULT_SETTINGS[key];
    }
}

export function setAppSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    try {
        conn.runSync(
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
            [key, String(value)]
        );
    } catch (e) {
        console.error("Error saving app setting:", e);
    }
}

interface SettingsContextValue {
    settings: AppSettings;
    currency: CurrencyCode;
    currencySymbol: string;
    firstDayOfWeek: FirstDayOfWeek;
    hideBalances: boolean;
    notificationsApp: boolean;
    notificationsEmail: boolean;
    setCurrency: (currency: CurrencyCode) => void;
    setFirstDayOfWeek: (day: FirstDayOfWeek) => void;
    setHideBalances: (hide: boolean) => void;
    toggleHideBalances: () => void;
    setNotificationsApp: (enabled: boolean) => void;
    setNotificationsEmail: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<AppSettings>(() => {
        const initialCurrency = getAppSetting("currency");
        setActiveCurrency(initialCurrency);
        return {
            currency: initialCurrency,
            firstDayOfWeek: getAppSetting("firstDayOfWeek"),
            hideBalances: getAppSetting("hideBalances"),
            notificationsApp: getAppSetting("notificationsApp"),
            notificationsEmail: getAppSetting("notificationsEmail"),
        };
    });

    useEffect(() => {
        setActiveCurrency(settings.currency);
    }, [settings.currency]);

    const updateSetting = <K extends keyof AppSettings>(key: K, val: AppSettings[K]) => {
        setAppSetting(key, val);
        if (key === "currency") {
            setActiveCurrency(val as string);
        }
        setSettings((prev) => ({ ...prev, [key]: val }));
    };

    const currencySymbol = CURRENCY_CONFIG[settings.currency]?.symbol ?? "€";

    const value: SettingsContextValue = {
        settings,
        currency: settings.currency,
        currencySymbol,
        firstDayOfWeek: settings.firstDayOfWeek,
        hideBalances: settings.hideBalances,
        notificationsApp: settings.notificationsApp,
        notificationsEmail: settings.notificationsEmail,
        setCurrency: (c) => updateSetting("currency", c),
        setFirstDayOfWeek: (d) => updateSetting("firstDayOfWeek", d),
        setHideBalances: (h) => updateSetting("hideBalances", h),
        toggleHideBalances: () => updateSetting("hideBalances", !settings.hideBalances),
        setNotificationsApp: (enabled) => updateSetting("notificationsApp", enabled),
        setNotificationsEmail: (enabled) => updateSetting("notificationsEmail", enabled),
    };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useAppSettings() {
    const ctx = useContext(SettingsContext);
    if (!ctx) {
        // Fallback for isolated tests or unmounted context
        const currency = getAppSetting("currency");
        const hideBalances = getAppSetting("hideBalances");
        const notificationsApp = getAppSetting("notificationsApp");
        const notificationsEmail = getAppSetting("notificationsEmail");
        return {
            settings: DEFAULT_SETTINGS,
            currency,
            currencySymbol: CURRENCY_CONFIG[currency]?.symbol ?? "€",
            firstDayOfWeek: getAppSetting("firstDayOfWeek"),
            hideBalances,
            notificationsApp,
            notificationsEmail,
            setCurrency: (c: CurrencyCode) => {
                setAppSetting("currency", c);
                setActiveCurrency(c);
            },
            setFirstDayOfWeek: (d: FirstDayOfWeek) => setAppSetting("firstDayOfWeek", d),
            setHideBalances: (h: boolean) => setAppSetting("hideBalances", h),
            toggleHideBalances: () => setAppSetting("hideBalances", !hideBalances),
            setNotificationsApp: (enabled: boolean) => setAppSetting("notificationsApp", enabled),
            setNotificationsEmail: (enabled: boolean) => setAppSetting("notificationsEmail", enabled),
        };
    }
    return ctx;
}
