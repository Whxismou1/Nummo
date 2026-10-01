import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { AppState, AppStateStatus, Platform, TurboModuleRegistry } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as Crypto from "expo-crypto";
import { conn } from "@/db";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { syncFromCloud, syncToCloud, syncAll } from "@/services/sync";

WebBrowser.maybeCompleteAuthSession();

async function hashLocalPassword(password: string): Promise<string> {
    return Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `nummo_secure_salt_v1:${password}`
    );
}

async function verifyLocalPassword(input: string, stored: string | null): Promise<boolean> {
    if (!stored) return false;
    if (stored === input) return true; // Support legacy plaintext
    const hashed = await hashLocalPassword(input);
    return stored === hashed;
}

let GoogleSignin: any = null;
let statusCodes: any = {};

const hasNativeGoogleSignin = (): boolean => {
    try {
        if (typeof TurboModuleRegistry !== "undefined" && TurboModuleRegistry.get) {
            return Boolean(TurboModuleRegistry.get("RNGoogleSignin"));
        }
    } catch {}
    return false;
};

if (hasNativeGoogleSignin()) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const gModule = require("@react-native-google-signin/google-signin");
        GoogleSignin = gModule.GoogleSignin;
        statusCodes = gModule.statusCodes;
        const DEFAULT_GOOGLE_WEB_CLIENT_ID = "1089752702487-55ekq1ol4mu6kc0nveo8pk58uktumm12.apps.googleusercontent.com";
        const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || DEFAULT_GOOGLE_WEB_CLIENT_ID;
        GoogleSignin.configure({
            webClientId: webClientId || undefined,
            scopes: ["profile", "email"],
        });
    } catch (e) {
        console.warn("[Auth] Failed to initialize native Google Sign-in:", e);
    }
}

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    provider: "google" | "email";
    avatarUrl?: string;
    createdAt: number;
}

interface AuthContextValue {
    user: UserProfile | null;
    isAuthenticated: boolean;
    biometricsEnabled: boolean;
    isLocked: boolean;
    hasBiometricsHardware: boolean;
    biometricTypeLabel: string;
    isCloudAuth: boolean;
    loginWithGoogle: (account?: { name: string; email: string; avatarUrl?: string }) => Promise<void>;
    loginWithEmail: (email: string, password?: string) => Promise<void>;
    register: (name: string, email: string, password?: string) => Promise<void>;
    verifyOtp: (email: string, token: string, type?: "signup" | "email" | "recovery") => Promise<void>;
    validateCredentials: (email: string, password?: string, isRegister?: boolean) => Promise<{ ok: boolean; error?: string }>;
    resetPasswordForEmail: (email: string) => Promise<void>;
    updatePasswordWithOtp: (email: string, token: string, newPassword: string) => Promise<void>;
    logout: () => Promise<void>;
    setBiometricsEnabled: (enabled: boolean) => Promise<boolean>;
    unlockApp: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

try {
    conn.execSync(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT,
            provider TEXT NOT NULL,
            avatar_url TEXT,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS app_session (
            key TEXT PRIMARY KEY,
            user_id TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS app_flags (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    `);

    try {
        const legacyRows = conn.getAllSync<{
            id: string;
            name: string;
            email: string;
            provider: string;
            avatar_url: string | null;
            created_at: number;
        }>("SELECT * FROM app_user");
        for (const row of legacyRows) {
            conn.runSync(
                "INSERT OR IGNORE INTO users (id, name, email, password, provider, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [row.id, row.name, row.email.toLowerCase(), null, row.provider, row.avatar_url, row.created_at]
            );
        }
    } catch {}

    const resetFlag = conn.getFirstSync<{ value: string }>(
        "SELECT value FROM app_flags WHERE key = 'auth_initial_reset_v3'"
    );
    if (!resetFlag) {
        conn.runSync("DELETE FROM app_session WHERE key = 'active_user';");
        conn.runSync(
            "INSERT OR REPLACE INTO app_flags (key, value) VALUES ('auth_initial_reset_v3', 'true');"
        );
    }
} catch (e) {
    console.warn("Could not setup users / app_session tables:", e);
}

function persistUserSession(profile: UserProfile): void {
    try {
        conn.runSync(
            `INSERT OR REPLACE INTO users (id, name, email, password, provider, avatar_url, created_at)
             VALUES (?, ?, ?, (SELECT password FROM users WHERE id = ?), ?, COALESCE(?, (SELECT avatar_url FROM users WHERE id = ?)), ?)`,
            [
                profile.id,
                profile.name,
                profile.email.toLowerCase(),
                profile.id,
                profile.provider,
                profile.avatarUrl || null,
                profile.id,
                profile.createdAt || Date.now(),
            ]
        );
        conn.runSync(
            "INSERT OR REPLACE INTO app_session (key, user_id) VALUES ('active_user', ?)",
            [profile.id]
        );
    } catch (e) {
        console.warn("Failed to persist user session:", e);
    }
}

function getStoredUser(): UserProfile | null {
    try {
        const session = conn.getFirstSync<{ user_id: string }>(
            "SELECT user_id FROM app_session WHERE key = 'active_user' LIMIT 1"
        );
        if (!session?.user_id) return null;

        const row = conn.getFirstSync<{
            id: string;
            name: string;
            email: string;
            provider: string;
            avatar_url: string | null;
            created_at: number;
        }>("SELECT * FROM users WHERE id = ? LIMIT 1", [session.user_id]);

        if (row) {
            return {
                id: row.id,
                name: row.name,
                email: row.email,
                provider: row.provider as "google" | "email",
                avatarUrl: row.avatar_url || undefined,
                createdAt: row.created_at,
            };
        }

        return {
            id: session.user_id,
            name: "Usuario",
            email: "",
            provider: "google",
            createdAt: Date.now(),
        };
    } catch {
        return null;
    }
}

const BIOMETRICS_KEY = "nummo_biometrics_enabled";

function isBiometricsConfiguredSync(): boolean {
    try {
        const row = conn.getFirstSync<{ value: string }>(
            "SELECT value FROM app_settings WHERE key = ?",
            [BIOMETRICS_KEY]
        );
        return row?.value === "true";
    } catch {
        return false;
    }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(() => getStoredUser());
    const [biometricsEnabled, setBiometricsEnabledState] = useState<boolean>(() => isBiometricsConfiguredSync());
    const [isLocked, setIsLocked] = useState<boolean>(() => Boolean(getStoredUser()) && isBiometricsConfiguredSync());
    const [hasBiometricsHardware, setHasBiometricsHardware] = useState(false);
    const [biometricTypeLabel, setBiometricTypeLabel] = useState("Biometría");

    const appState = useRef(AppState.currentState);

    useEffect(() => {
        let mounted = true;

        async function initBiometrics() {
            try {
                const hasHardware = await LocalAuthentication.hasHardwareAsync();
                const isEnrolled = await LocalAuthentication.isEnrolledAsync();
                if (mounted) {
                    setHasBiometricsHardware(hasHardware && isEnrolled);
                }

                if (hasHardware) {
                    if (mounted) setBiometricTypeLabel("biométrico");
                }

                let storedBio = false;
                if (Platform.OS !== "web") {
                    try {
                        const val = await SecureStore.getItemAsync(BIOMETRICS_KEY);
                        storedBio = val === "true";
                    } catch {
                        const row = conn.getFirstSync<{ value: string }>(
                            "SELECT value FROM app_settings WHERE key = ?",
                            [BIOMETRICS_KEY]
                        );
                        storedBio = row?.value === "true";
                    }
                }

                if (mounted) {
                    setBiometricsEnabledState(storedBio);
                    const currentUser = getStoredUser();
                    if (!currentUser) {
                        setIsLocked(false);
                    } else if (storedBio && (!hasHardware || !isEnrolled)) {
                        setIsLocked(false);
                    } else if (storedBio) {
                        setIsLocked(true);
                    } else {
                        setIsLocked(false);
                    }
                }
            } catch (err) {
                console.warn("Error initializing biometrics:", err);
            }
        }

        void initBiometrics();

        return () => {
            mounted = false;
        };
    }, []);

    const unlockApp = useCallback(async (): Promise<boolean> => {
        try {
            if (!hasBiometricsHardware) {
                if (!biometricsEnabled) {
                    setIsLocked(false);
                    return true;
                }
                return false;
            }

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: "Desbloquear Nummo",
                cancelLabel: "Cancelar",
                fallbackLabel: "Usar código",
                disableDeviceFallback: false,
            });

            if (result.success) {
                setIsLocked(false);
                return true;
            }
            return false;
        } catch (e) {
            console.warn("Biometric authentication error:", e);
            return false;
        }
    }, [hasBiometricsHardware, biometricsEnabled]);

    useEffect(() => {
        if (!biometricsEnabled || !user) return;

        const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
            if (
                appState.current.match(/inactive|background/) &&
                nextAppState === "active"
            ) {
                if (user) {
                    setIsLocked(true);
                    void unlockApp();
                }
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, [biometricsEnabled, user, unlockApp]);

    useEffect(() => {
        if (!isSupabaseConfigured()) return;

        let mounted = true;

        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (!mounted) return;
            if (error) {
                console.warn("[AuthContext] getSession error:", error.message);
                if (
                    error.message?.includes("Refresh Token Not Found") ||
                    error.message?.includes("Invalid Refresh Token") ||
                    error.message?.includes("token is expired")
                ) {
                    setUser(null);
                    conn.runSync("DELETE FROM app_session WHERE key = 'active_user'");
                }
                return;
            }
            if (session?.user) {
                const existingUserRow = conn.getFirstSync<{ avatar_url: string | null }>(
                    "SELECT avatar_url FROM users WHERE id = ? LIMIT 1",
                    [session.user.id]
                );
                const avatar =
                    session.user.user_metadata?.avatar_url ||
                    session.user.user_metadata?.picture ||
                    session.user.user_metadata?.photo ||
                    existingUserRow?.avatar_url ||
                    undefined;

                const cloudProfile: UserProfile = {
                    id: session.user.id,
                    name:
                        session.user.user_metadata?.full_name ||
                        session.user.user_metadata?.name ||
                        session.user.email?.split("@")[0] ||
                        "Usuario",
                    email: (session.user.email || "").toLowerCase(),
                    provider: (session.user.app_metadata?.provider as any) || "email",
                    avatarUrl: avatar,
                    createdAt: new Date(session.user.created_at).getTime() || Date.now(),
                };
                persistUserSession(cloudProfile);
                setUser(cloudProfile);
                void syncAll(cloudProfile.id);
            }
        }).catch((err) => {
            console.warn("[AuthContext] getSession unexpected failure:", err);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (!mounted) return;
            if (session?.user) {
                const existingUserRow = conn.getFirstSync<{ avatar_url: string | null }>(
                    "SELECT avatar_url FROM users WHERE id = ? LIMIT 1",
                    [session.user.id]
                );
                const avatar =
                    session.user.user_metadata?.avatar_url ||
                    session.user.user_metadata?.picture ||
                    session.user.user_metadata?.photo ||
                    existingUserRow?.avatar_url ||
                    undefined;

                const cloudProfile: UserProfile = {
                    id: session.user.id,
                    name:
                        session.user.user_metadata?.full_name ||
                        session.user.user_metadata?.name ||
                        session.user.email?.split("@")[0] ||
                        "Usuario",
                    email: (session.user.email || "").toLowerCase(),
                    provider: (session.user.app_metadata?.provider as any) || "email",
                    avatarUrl: avatar,
                    createdAt: new Date(session.user.created_at).getTime() || Date.now(),
                };
                persistUserSession(cloudProfile);
                setUser(cloudProfile);
                void syncAll(cloudProfile.id);
            } else if (_event === "SIGNED_OUT") {
                setUser(null);
                conn.runSync("DELETE FROM app_session WHERE key = 'active_user'");
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const loginWithGoogle = async (account?: { name: string; email: string; avatarUrl?: string }) => {
        if (!isSupabaseConfigured()) {
            const selectedName = account?.name || "Usuario";
            const selectedEmail = (account?.email || "usuario@gmail.com").trim().toLowerCase();
            const existing = conn.getFirstSync<{
                id: string;
                name: string;
                email: string;
                provider: string;
                avatar_url: string | null;
                created_at: number;
            }>("SELECT * FROM users WHERE email = ? LIMIT 1", [selectedEmail]);

            let userToSet: UserProfile;
            if (existing) {
                userToSet = {
                    id: existing.id,
                    name: existing.name,
                    email: existing.email,
                    provider: existing.provider as "google" | "email",
                    avatarUrl: account?.avatarUrl || existing.avatar_url || undefined,
                    createdAt: existing.created_at,
                };
            } else {
                const newId = `google_${Date.now()}`;
                const now = Date.now();
                conn.runSync(
                    "INSERT INTO users (id, name, email, password, provider, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [newId, selectedName, selectedEmail, null, "google", account?.avatarUrl || null, now]
                );
                userToSet = {
                    id: newId,
                    name: selectedName,
                    email: selectedEmail,
                    provider: "google",
                    avatarUrl: account?.avatarUrl,
                    createdAt: now,
                };
            }

            conn.runSync(
                "INSERT OR REPLACE INTO app_session (key, user_id) VALUES ('active_user', ?)",
                [userToSet.id]
            );
            setUser(userToSet);
            return;
        }

        try {
            if (GoogleSignin && typeof GoogleSignin.signIn === "function") {
                await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
                try {
                    await GoogleSignin.signOut();
                } catch {}
                const signInResult = await GoogleSignin.signIn();
                const idToken =
                    (signInResult as any).data?.idToken ||
                    (signInResult as any).idToken;

                if (idToken) {
                    const { data, error } = await supabase.auth.signInWithIdToken({
                        provider: "google",
                        token: idToken,
                    });

                    if (error) throw new Error(error.message);

                    if (data?.user) {
                        const cloudProfile: UserProfile = {
                            id: data.user.id,
                            name:
                                data.user.user_metadata?.full_name ||
                                data.user.user_metadata?.name ||
                                data.user.email?.split("@")[0] ||
                                "Usuario",
                            email: (data.user.email || "").toLowerCase(),
                            provider: "google",
                            avatarUrl:
                                data.user.user_metadata?.avatar_url ||
                                data.user.user_metadata?.picture ||
                                undefined,
                            createdAt:
                                new Date(data.user.created_at).getTime() || Date.now(),
                        };
                        persistUserSession(cloudProfile);
                        setUser(cloudProfile);
                        void syncAll(cloudProfile.id);
                        return;
                    }
                }
            }
        } catch (nativeErr: any) {
            if (
                nativeErr?.code === statusCodes?.SIGN_IN_CANCELLED ||
                nativeErr?.message?.includes("cancelled") ||
                nativeErr?.message?.includes("canceled")
            ) {
                return;
            }
            console.warn("Native Google Sign-In not available or error, falling back to Web OAuth:", nativeErr);
            if (nativeErr?.code === (statusCodes as any)?.DEVELOPER_ERROR || nativeErr?.code === "10") {
                throw new Error("Error de configuración de Google (SHA-1 o Client ID incorrecto en Google Cloud).");
            }
        }

        const redirectUrl = Linking.createURL("auth");

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: redirectUrl,
                skipBrowserRedirect: true,
                queryParams: {
                    prompt: "select_account",
                },
            },
        });

        if (error) {
            throw new Error(error.message);
        }

        if (data?.url) {
            const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

            if (res.type === "success" && res.url) {
                const parsed = Linking.parse(res.url);

                if (parsed.queryParams?.code) {
                    const { data: sessionData, error: exchangeErr } =
                        await supabase.auth.exchangeCodeForSession(
                            parsed.queryParams.code as string
                        );
                    if (exchangeErr) throw exchangeErr;
                    if (sessionData.user) {
                        const cloudProfile: UserProfile = {
                            id: sessionData.user.id,
                            name:
                                sessionData.user.user_metadata?.full_name ||
                                sessionData.user.user_metadata?.name ||
                                sessionData.user.email?.split("@")[0] ||
                                "Usuario",
                            email: (sessionData.user.email || "").toLowerCase(),
                            provider: "google",
                            avatarUrl:
                                sessionData.user.user_metadata?.avatar_url ||
                                sessionData.user.user_metadata?.picture ||
                                undefined,
                            createdAt:
                                new Date(sessionData.user.created_at).getTime() || Date.now(),
                        };
                        persistUserSession(cloudProfile);
                        setUser(cloudProfile);
                        void syncAll(cloudProfile.id);
                    }
                } else if (res.url.includes("access_token=")) {
                    const hash = res.url.split("#")[1];
                    if (hash) {
                        const params = new URLSearchParams(hash);
                        const access_token = params.get("access_token");
                        const refresh_token = params.get("refresh_token");
                        if (access_token && refresh_token) {
                            const { data: sessionData, error: sessionErr } =
                                await supabase.auth.setSession({
                                    access_token,
                                    refresh_token,
                                });
                            if (sessionErr) throw sessionErr;
                            if (sessionData.user) {
                                const cloudProfile: UserProfile = {
                                    id: sessionData.user.id,
                                    name:
                                        sessionData.user.user_metadata?.full_name ||
                                        sessionData.user.user_metadata?.name ||
                                        sessionData.user.email?.split("@")[0] ||
                                        "Usuario",
                                    email: (sessionData.user.email || "").toLowerCase(),
                                    provider: "google",
                                    avatarUrl:
                                        sessionData.user.user_metadata?.avatar_url ||
                                        sessionData.user.user_metadata?.picture ||
                                        undefined,
                                    createdAt:
                                        new Date(sessionData.user.created_at).getTime() ||
                                        Date.now(),
                                };
                                persistUserSession(cloudProfile);
                                setUser(cloudProfile);
                                void syncAll(cloudProfile.id);
                            }
                        }
                    }
                }
            }
        }
    };

    const validateCredentials = async (
        email: string,
        password?: string,
        isRegister = false
    ): Promise<{ ok: boolean; error?: string }> => {
        const normEmail = email.trim().toLowerCase();

        if (isSupabaseConfigured()) {
            return { ok: true };
        }

        if (isRegister) {
            const existing = conn.getFirstSync<{ id: string }>(
                "SELECT id FROM users WHERE email = ? LIMIT 1",
                [normEmail]
            );
            if (existing) {
                return {
                    ok: false,
                    error: "Si ya tienes una cuenta registrada con este correo, inicia sesión. Si eres nuevo, revisa los datos introducidos.",
                };
            }
            return { ok: true };
        }

        const row = conn.getFirstSync<{ id: string; password: string | null }>(
            "SELECT id, password FROM users WHERE email = ? LIMIT 1",
            [normEmail]
        );

        if (!row) {
            return {
                ok: false,
                error: "El correo o la contraseña no son correctos.",
            };
        }

        if (password && row.password) {
            const matches = await verifyLocalPassword(password, row.password);
            if (!matches) {
                return {
                    ok: false,
                    error: "El correo o la contraseña no son correctos.",
                };
            }
        }

        return { ok: true };
    };

    const loginWithEmail = async (email: string, password?: string) => {
        const normEmail = email.trim().toLowerCase();

        if (isSupabaseConfigured() && password) {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: normEmail,
                password,
            });

            if (error) {
                throw new Error(error.message);
            }

            if (data.user) {
                const profile: UserProfile = {
                    id: data.user.id,
                    name:
                        data.user.user_metadata?.name ||
                        data.user.email?.split("@")[0] ||
                        "Usuario",
                    email: normEmail,
                    provider: "email",
                    createdAt: new Date(data.user.created_at).getTime() || Date.now(),
                };
                persistUserSession(profile);
                setUser(profile);
                void syncAll(profile.id);
            }
            return;
        }

        const row = conn.getFirstSync<{
            id: string;
            name: string;
            email: string;
            password: string | null;
            provider: string;
            avatar_url: string | null;
            created_at: number;
        }>("SELECT * FROM users WHERE email = ? LIMIT 1", [normEmail]);

        if (!row) {
            throw new Error("No existe ninguna cuenta registrada con este correo.");
        }

        if (password && row.password) {
            const matches = await verifyLocalPassword(password, row.password);
            if (!matches) {
                throw new Error("Contraseña incorrecta.");
            }
        }

        conn.runSync(
            "INSERT OR REPLACE INTO app_session (key, user_id) VALUES ('active_user', ?)",
            [row.id]
        );

        const profile: UserProfile = {
            id: row.id,
            name: row.name,
            email: row.email,
            provider: row.provider as "google" | "email",
            avatarUrl: row.avatar_url || undefined,
            createdAt: row.created_at,
        };
        setUser(profile);
    };

    const register = async (name: string, email: string, password?: string) => {
        const normEmail = email.trim().toLowerCase();

        if (isSupabaseConfigured() && password) {
            const { data, error } = await supabase.auth.signUp({
                email: normEmail,
                password,
                options: {
                    data: { name: name.trim() || "Usuario" },
                },
            });

            if (error) {
                throw new Error(error.message);
            }

            if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
                throw new Error("User already registered");
            }

            if (data.session && data.user) {
                const profile: UserProfile = {
                    id: data.user.id,
                    name: name.trim() || "Usuario",
                    email: normEmail,
                    provider: "email",
                    createdAt: Date.now(),
                };
                persistUserSession(profile);
                setUser(profile);
                void syncToCloud(profile.id);
            }
            return;
        }

        const existing = conn.getFirstSync<{ id: string }>(
            "SELECT id FROM users WHERE email = ? LIMIT 1",
            [normEmail]
        );

        if (existing) {
            throw new Error("User already registered");
        }

        const userId = `user_${Date.now()}`;
        const now = Date.now();
        const hashedPassword = password ? await hashLocalPassword(password) : null;
        conn.runSync(
            "INSERT INTO users (id, name, email, password, provider, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [userId, name.trim() || "Usuario", normEmail, hashedPassword, "email", null, now]
        );

        conn.runSync(
            "INSERT OR REPLACE INTO app_session (key, user_id) VALUES ('active_user', ?)",
            [userId]
        );

        const newUser: UserProfile = {
            id: userId,
            name: name.trim() || "Usuario",
            email: normEmail,
            provider: "email",
            createdAt: now,
        };
        setUser(newUser);
    };

    const verifyOtp = async (email: string, token: string, type: "signup" | "email" | "recovery" = "signup") => {
        const normEmail = email.trim().toLowerCase();
        if (isSupabaseConfigured()) {
            const { data, error } = await supabase.auth.verifyOtp({
                email: normEmail,
                token,
                type,
            });

            if (error) {
                throw new Error(error.message);
            }

            if (data.user) {
                const profile: UserProfile = {
                    id: data.user.id,
                    name:
                        data.user.user_metadata?.name ||
                        data.user.email?.split("@")[0] ||
                        "Usuario",
                    email: normEmail,
                    provider: "email",
                    createdAt: new Date(data.user.created_at).getTime() || Date.now(),
                };
                persistUserSession(profile);
                setUser(profile);
                void syncAll(profile.id);
            }
        }
    };

    const resetPasswordForEmail = async (email: string) => {
        const normEmail = email.trim().toLowerCase();
        if (isSupabaseConfigured()) {
            const { error } = await supabase.auth.resetPasswordForEmail(normEmail);
            if (error) throw new Error(error.message);
            return;
        }

        const row = conn.getFirstSync<{ id: string }>(
            "SELECT id FROM users WHERE email = ? LIMIT 1",
            [normEmail]
        );
        if (!row) {
            throw new Error("User not found");
        }
    };

    const updatePasswordWithOtp = async (email: string, token: string, newPassword: string) => {
        const normEmail = email.trim().toLowerCase();
        if (isSupabaseConfigured()) {
            const { error: otpErr } = await supabase.auth.verifyOtp({
                email: normEmail,
                token,
                type: "recovery",
            });
            if (otpErr) throw new Error(otpErr.message);

            const { data, error: updateErr } = await supabase.auth.updateUser({
                password: newPassword,
            });
            if (updateErr) throw new Error(updateErr.message);

            if (data.user) {
                const profile: UserProfile = {
                    id: data.user.id,
                    name:
                        data.user.user_metadata?.name ||
                        data.user.email?.split("@")[0] ||
                        "Usuario",
                    email: normEmail,
                    provider: "email",
                    createdAt: new Date(data.user.created_at).getTime() || Date.now(),
                };
                setUser(profile);
                conn.runSync(
                    "INSERT OR REPLACE INTO app_session (key, user_id) VALUES ('active_user', ?)",
                    [profile.id]
                );
                void syncAll(profile.id);
            }
            return;
        }

        const row = conn.getFirstSync<{ id: string }>(
            "SELECT id FROM users WHERE email = ? LIMIT 1",
            [normEmail]
        );
        if (!row) {
            throw new Error("User not found");
        }

        const hashedPassword = await hashLocalPassword(newPassword);
        conn.runSync("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, row.id]);
        conn.runSync(
            "INSERT OR REPLACE INTO app_session (key, user_id) VALUES ('active_user', ?)",
            [row.id]
        );
        const userRow = conn.getFirstSync<{
            id: string;
            name: string;
            email: string;
            provider: string;
            avatar_url: string | null;
            created_at: number;
        }>("SELECT * FROM users WHERE id = ? LIMIT 1", [row.id]);
        if (userRow) {
            setUser({
                id: userRow.id,
                name: userRow.name,
                email: userRow.email,
                provider: userRow.provider as any,
                avatarUrl: userRow.avatar_url || undefined,
                createdAt: userRow.created_at,
            });
        }
    };

    const logout = async () => {
        if (GoogleSignin && typeof GoogleSignin.signOut === "function") {
            try {
                await GoogleSignin.signOut();
            } catch (e) {
                console.warn("Google native signOut error:", e);
            }
        }
        if (isSupabaseConfigured()) {
            try {
                await supabase.auth.signOut();
            } catch (e) {
                console.warn("Supabase signOut error:", e);
            }
        }
        setUser(null);
        setIsLocked(false);
        try {
            conn.runSync("DELETE FROM app_session WHERE key = 'active_user'");
            conn.runSync("DELETE FROM transactions");
            conn.runSync("DELETE FROM budgets");
            conn.runSync("DELETE FROM savings_goals");
            conn.runSync("DELETE FROM categories");
            conn.runSync("DELETE FROM sync_deletions");
            conn.runSync("DELETE FROM app_flags WHERE key LIKE 'categories_reset_%'");
        } catch (e) {
            console.error("Error clearing session on logout:", e);
        }
    };

    const setBiometricsEnabled = async (enabled: boolean): Promise<boolean> => {
        if (enabled) {
            const hasHw = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            if (!hasHw || !enrolled) {
                return false;
            }

            const authResult = await LocalAuthentication.authenticateAsync({
                promptMessage: "Confirma tu identidad para activar el bloqueo",
                cancelLabel: "Cancelar",
            });

            if (!authResult.success) {
                return false;
            }
        }

        setBiometricsEnabledState(enabled);
        if (Platform.OS !== "web") {
            try {
                await SecureStore.setItemAsync(BIOMETRICS_KEY, enabled ? "true" : "false");
            } catch {
                conn.runSync(
                    "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
                    [BIOMETRICS_KEY, enabled ? "true" : "false"]
                );
            }
        }

        return true;
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: user !== null,
                biometricsEnabled,
                isLocked: biometricsEnabled && isLocked,
                hasBiometricsHardware,
                biometricTypeLabel,
                isCloudAuth: isSupabaseConfigured(),
                loginWithGoogle,
                loginWithEmail,
                register,
                verifyOtp,
                validateCredentials,
                resetPasswordForEmail,
                updatePasswordWithOtp,
                logout,
                setBiometricsEnabled,
                unlockApp,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
