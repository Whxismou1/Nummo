import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";

const DEFAULT_SUPABASE_URL = "https://wbvfmnytnsmcghmfvepc.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_6UmEjoSZvNx3ErD-tM1-CQ_sGI-2X29";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_PROJECT_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    DEFAULT_SUPABASE_KEY;

const ExpoSecureStoreAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        if (Platform.OS === "web") {
            if (typeof localStorage !== "undefined") {
                return localStorage.getItem(key);
            }
            return null;
        }
        try {
            return await SecureStore.getItemAsync(key);
        } catch (e) {
            console.warn("[SecureStore] getItem error:", e);
            return null;
        }
    },
    setItem: async (key: string, value: string): Promise<void> => {
        if (Platform.OS === "web") {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem(key, value);
            }
            return;
        }
        try {
            await SecureStore.setItemAsync(key, value);
        } catch (e) {
            console.warn("[SecureStore] setItem error:", e);
        }
    },
    removeItem: async (key: string): Promise<void> => {
        if (Platform.OS === "web") {
            if (typeof localStorage !== "undefined") {
                localStorage.removeItem(key);
            }
            return;
        }
        try {
            await SecureStore.deleteItemAsync(key);
        } catch (e) {
            console.warn("[SecureStore] removeItem error:", e);
        }
    },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// React Native halts JS timers in background; startAutoRefresh on foreground keeps refresh tokens alive seamlessly
if (Platform.OS !== "web") {
    try {
        AppState.addEventListener("change", (state) => {
            try {
                if (state === "active") {
                    supabase.auth.startAutoRefresh();
                } else {
                    supabase.auth.stopAutoRefresh();
                }
            } catch (err) {
                console.warn("[Supabase] autoRefresh error:", err);
            }
        });
    } catch (err) {
        console.warn("[Supabase] AppState listener error:", err);
    }
}

export const isSupabaseConfigured = (): boolean => {
    return Boolean(
        supabaseUrl &&
        supabaseAnonKey &&
        supabaseUrl.startsWith("http")
    );
};
