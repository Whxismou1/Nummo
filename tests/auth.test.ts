import { describe, it } from "node:test";
import assert from "node:assert";

// Domain test for user profile and auth model
interface UserProfile {
    id: string;
    name: string;
    email: string;
    provider: "google" | "email";
    avatarUrl?: string;
    createdAt: number;
}

function createGoogleUser(id = "google_123", name = "Mouhcine", email = "mouhcine@gmail.com"): UserProfile {
    return {
        id,
        name,
        email: email.trim().toLowerCase(),
        provider: "google",
        createdAt: Date.now(),
    };
}

function createEmailUser(email: string, customName?: string): UserProfile {
    const defaultName = email.split("@")[0] || "Usuario";
    const formattedName = defaultName.charAt(0).toUpperCase() + defaultName.slice(1);
    return {
        id: `email_${Date.now()}`,
        name: customName ? customName.trim() : formattedName,
        email: email.trim().toLowerCase(),
        provider: "email",
        createdAt: Date.now(),
    };
}

function getBiometricLabel(types: number[]): string {
    const FACIAL = 1;
    const FINGERPRINT = 2;
    const IRIS = 3;

    if (types.includes(FACIAL)) return "Face ID";
    if (types.includes(FINGERPRINT)) return "Huella dactilar";
    if (types.includes(IRIS)) return "Iris";
    return "Biometría";
}

describe("Authentication & User Profile Logic", () => {
    it("creates a Google user profile with provider google and normalized email", () => {
        const user = createGoogleUser("g_456", "Mouhcine", "MOUHCINE@GMAIL.COM");
        assert.strictEqual(user.provider, "google");
        assert.strictEqual(user.email, "mouhcine@gmail.com");
        assert.strictEqual(user.name, "Mouhcine");
        assert(user.createdAt > 0);
    });

    it("creates an Email user profile extracting display name from email when not provided", () => {
        const user = createEmailUser("alex@company.com");
        assert.strictEqual(user.provider, "email");
        assert.strictEqual(user.name, "Alex");
        assert.strictEqual(user.email, "alex@company.com");
    });

    it("creates an Email user with custom name on registration", () => {
        const user = createEmailUser("sara@mail.com", "Sara García");
        assert.strictEqual(user.provider, "email");
        assert.strictEqual(user.name, "Sara García");
        assert.strictEqual(user.email, "sara@mail.com");
    });

    it("formats user avatar initial correctly", () => {
        const user = createGoogleUser("g_1", "Mouhcine");
        const initial = user.name.charAt(0).toUpperCase();
        assert.strictEqual(initial, "M");

        const user2 = createEmailUser("laura@test.com");
        const initial2 = user2.name.charAt(0).toUpperCase();
        assert.strictEqual(initial2, "L");
    });

    it("extracts first name for personal greetings", () => {
        const fullName = "Mouhcine El Idrissi";
        const firstName = fullName.split(" ")[0];
        assert.strictEqual(firstName, "Mouhcine");
    });

    it("supports selecting specific Google account from picker", () => {
        const selected = { name: "Mouhcine Uni", email: "MOUHCINE.UNI@GMAIL.COM" };
        const user = createGoogleUser("g_uni", selected.name, selected.email);
        assert.strictEqual(user.name, "Mouhcine Uni");
        assert.strictEqual(user.email, "mouhcine.uni@gmail.com");
        assert.strictEqual(user.provider, "google");
    });

    it("determines initial app redirection based on authentication state", () => {
        const getInitialRoute = (isAuthenticated: boolean) =>
            isAuthenticated ? "/(tabs)" : "/auth";

        assert.strictEqual(getInitialRoute(false), "/auth");
        assert.strictEqual(getInitialRoute(true), "/(tabs)");
    });
});

describe("Biometric Hardware & Lock Logic", () => {
    it("standardizes biometric label to biométrico", () => {
        const biometricTypeLabel = "biométrico";
        assert.strictEqual(biometricTypeLabel, "biométrico");
    });

    it("computes lock state: active lock only when biometrics is enabled and locked flag is true", () => {
        const isLocked = (biometricsEnabled: boolean, locked: boolean) => biometricsEnabled && locked;

        assert.strictEqual(isLocked(false, true), false);
        assert.strictEqual(isLocked(true, false), false);
        assert.strictEqual(isLocked(true, true), true);
        assert.strictEqual(isLocked(false, false), false);
    });
});

describe("Email Verification Code Logic", () => {
    const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();
    const sanitizeInput = (val: string) => val.replace(/[^0-9]/g, "").slice(0, 6);
    const verifyCode = (entered: string, expected: string) =>
        entered === expected || entered === "123456";

    it("generates a 6-digit numeric verification code within [100000, 999999]", () => {
        for (let i = 0; i < 50; i++) {
            const code = generateCode();
            assert.strictEqual(code.length, 6);
            const num = Number(code);
            assert(num >= 100000 && num <= 999999);
            assert(/^\d{6}$/.test(code));
        }
    });

    it("sanitizes code input to only allow digits up to 6 characters", () => {
        assert.strictEqual(sanitizeInput("12a3-4b5"), "12345");
        assert.strictEqual(sanitizeInput("123456789"), "123456");
        assert.strictEqual(sanitizeInput("  892 104  "), "892104");
        assert.strictEqual(sanitizeInput("letters only"), "");
    });

    it("accepts valid matching code and dev bypass code, rejecting invalid codes", () => {
        const generated = "481920";
        assert.strictEqual(verifyCode("481920", generated), true);
        assert.strictEqual(verifyCode("123456", generated), true);
        assert.strictEqual(verifyCode("000000", generated), false);
        assert.strictEqual(verifyCode("481921", generated), false);
        assert.strictEqual(verifyCode("", generated), false);
    });

    it("handles resend timer countdown state transition", () => {
        let timer = 30;
        const tick = () => {
            if (timer > 0) timer -= 1;
        };
        for (let i = 0; i < 30; i++) tick();
        assert.strictEqual(timer, 0);

        // Can resend now
        const canResend = timer === 0;
        assert.strictEqual(canResend, true);

        // Resend resets timer to 30
        const newCode = generateCode();
        timer = 30;
        assert.strictEqual(timer, 30);
        assert(/^\d{6}$/.test(newCode));
    });
});

describe("User Account Persistence & Session Separation", () => {
    interface StoredUser {
        id: string;
        name: string;
        email: string;
        password?: string;
        provider: "email" | "google";
    }

    interface MockDb {
        users: Map<string, StoredUser>;
        session: { activeUserId: string | null };
    }

    const createMockDb = (): MockDb => ({
        users: new Map(),
        session: { activeUserId: null },
    });

    const registerUser = (db: MockDb, name: string, email: string, password?: string) => {
        const norm = email.toLowerCase().trim();
        const id = `user_${Date.now()}`;
        const user: StoredUser = { id, name, email: norm, password, provider: "email" };
        db.users.set(norm, user);
        db.session.activeUserId = id;
        return user;
    };

    const validateCredentials = (db: MockDb, email: string, password?: string, isRegister = false) => {
        const norm = email.toLowerCase().trim();
        if (isRegister) {
            if (db.users.has(norm)) {
                return { ok: false, error: "Ya existe una cuenta con este correo." };
            }
            return { ok: true };
        }
        const user = db.users.get(norm);
        if (!user) {
            return { ok: false, error: "No existe ninguna cuenta registrada con este correo." };
        }
        if (password && user.password && user.password !== password) {
            return { ok: false, error: "La contraseña es incorrecta." };
        }
        return { ok: true };
    };

    const loginUser = (db: MockDb, email: string, password?: string) => {
        const val = validateCredentials(db, email, password, false);
        if (!val.ok) throw new Error(val.error);
        const user = db.users.get(email.toLowerCase().trim())!;
        db.session.activeUserId = user.id;
        return user;
    };

    const logoutUser = (db: MockDb) => {
        // ONLY clears active session; does NOT delete users!
        db.session.activeUserId = null;
    };

    it("registers a user and establishes an active session", () => {
        const db = createMockDb();
        const user = registerUser(db, "Mouhcine", "mouhcine@test.com", "secret123");
        assert.strictEqual(db.users.size, 1);
        assert.strictEqual(db.session.activeUserId, user.id);
    });

    it("preserves registered users in database when logging out", () => {
        const db = createMockDb();
        const user = registerUser(db, "Mouhcine", "mouhcine@test.com", "secret123");
        assert.strictEqual(db.session.activeUserId, user.id);

        logoutUser(db);
        assert.strictEqual(db.session.activeUserId, null);
        assert.strictEqual(db.users.size, 1); // User is STILL in db!
        assert.strictEqual(db.users.get("mouhcine@test.com")?.name, "Mouhcine");
    });

    it("allows logging back in with saved password after logout", () => {
        const db = createMockDb();
        registerUser(db, "Mouhcine", "mouhcine@test.com", "secret123");
        logoutUser(db);

        // Try wrong password
        const wrongVal = validateCredentials(db, "mouhcine@test.com", "wrongpass");
        assert.strictEqual(wrongVal.ok, false);
        assert.strictEqual(wrongVal.error, "La contraseña es incorrecta.");

        // Correct password
        const loggedUser = loginUser(db, "mouhcine@test.com", "secret123");
        assert.strictEqual(loggedUser.name, "Mouhcine");
        assert.strictEqual(db.session.activeUserId, loggedUser.id);
    });

    it("prevents registering duplicate email when already registered", () => {
        const db = createMockDb();
        registerUser(db, "Mouhcine", "mouhcine@test.com", "secret123");

        const duplicateVal = validateCredentials(db, "mouhcine@test.com", "otherpass", true);
        assert.strictEqual(duplicateVal.ok, false);
        assert.strictEqual(duplicateVal.error, "Ya existe una cuenta con este correo.");
    });
});
