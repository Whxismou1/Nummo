import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { translateAuthError } from "../src/lib/authErrors.ts";

describe("translateAuthError", () => {
    it("translates invalid login credentials to Spanish", () => {
        const result = translateAuthError("Invalid login credentials");
        assert.equal(result, "El correo o la contraseña son incorrectos.");
    });

    it("translates already registered error to Spanish safely (anti-enumeration)", () => {
        const result = translateAuthError("User already registered");
        assert.match(result, /código de verificación|iniciar sesión/);
    });

    it("translates unconfirmed email to Spanish", () => {
        const result = translateAuthError("Email not confirmed");
        assert.match(result, /confirmar tu correo/);
    });

    it("translates expired OTP token to Spanish", () => {
        const result = translateAuthError("Token has expired or is invalid");
        assert.match(result, /ha caducado/);
    });

    it("translates invalid OTP token to Spanish", () => {
        const result = translateAuthError("Invalid OTP");
        assert.match(result, /incorrecto/);
    });

    it("translates rate limit error to Spanish", () => {
        const result = translateAuthError("Email rate limit exceeded");
        assert.match(result, /límite de intentos/);
    });

    it("translates short password to Spanish", () => {
        const result = translateAuthError("Password should be at least 6 characters");
        assert.match(result, /al menos 6 caracteres/);
    });

    it("handles Error objects and undefined gracefully", () => {
        const errObj = new Error("Invalid login credentials");
        assert.equal(translateAuthError(errObj), "El correo o la contraseña son incorrectos.");
        assert.equal(translateAuthError(undefined), "Ha ocurrido un error inesperado.");
    });
});
