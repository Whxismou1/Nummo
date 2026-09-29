import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_PROJECT_URL || "";
const supabaseAnonKey =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";

const ExpoSecureStoreAdapter = {
    getItem: (key: string): Promise<string | null> => {
        if (Platform.OS === "web") {
            if (typeof localStorage !== "undefined") {
                return Promise.resolve(localStorage.getItem(key));
            }
            return Promise.resolve(null);
        }
        return SecureStore.getItemAsync(key);
    },
    setItem: (key: string, value: string): Promise<void> => {
        if (Platform.OS === "web") {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem(key, value);
            }
            return Promise.resolve();
        }
        return SecureStore.setItemAsync(key, value);
    },
    removeItem: (key: string): Promise<void> => {
        if (Platform.OS === "web") {
            if (typeof localStorage !== "undefined") {
                localStorage.removeItem(key);
            }
            return Promise.resolve();
        }
        return SecureStore.deleteItemAsync(key);
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

export const isSupabaseConfigured = (): boolean => {
    return Boolean(
        supabaseUrl &&
        supabaseAnonKey &&
        supabaseUrl.startsWith("http")
    );
};
