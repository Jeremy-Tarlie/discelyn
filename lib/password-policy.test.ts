import { describe, expect, it } from "vitest";
import {
  evaluatePasswordRules,
  passwordLoginSchema,
  passwordMeetsAllRules,
  passwordSchema,
  zodErrorIndicatesWeakPassword,
} from "@/lib/password-policy";

const STRONG = "Correct-horse1!";

describe("password-policy", () => {
  it("evaluatePasswordRules couvre chaque classe", () => {
    expect(evaluatePasswordRules("short")).toEqual({
      minLength: false,
      upper: false,
      lower: true,
      digit: false,
      special: false,
    });
    expect(evaluatePasswordRules(STRONG)).toEqual({
      minLength: true,
      upper: true,
      lower: true,
      digit: true,
      special: true,
    });
    expect(passwordMeetsAllRules(STRONG)).toBe(true);
    expect(passwordMeetsAllRules("abcdefghijkl")).toBe(false);
    expect(passwordMeetsAllRules(`${STRONG}${"x".repeat(200)}`)).toBe(false);
  });


  it("passwordSchema exige longueur + complexité", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("a".repeat(12)).success).toBe(false);
    expect(passwordSchema.safeParse("Abcdefghijk1").success).toBe(false);
    expect(passwordSchema.safeParse("ABCDEFGHIJK1!").success).toBe(false);
    expect(passwordSchema.safeParse("abcdefghijk1!").success).toBe(false);
    expect(passwordSchema.safeParse("Abcdefghijk!").success).toBe(false);
    expect(passwordSchema.safeParse("a".repeat(129)).success).toBe(false);
    expect(passwordSchema.safeParse(STRONG).success).toBe(true);
  });

  it("passwordSchema marque weak_password pour Zod", () => {
    const result = passwordSchema.safeParse("abcdefghijkl");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(zodErrorIndicatesWeakPassword(result.error)).toBe(true);
    }
  });

  it("passwordLoginSchema n'exige pas la complexité", () => {
    expect(passwordLoginSchema.safeParse("a".repeat(12)).success).toBe(true);
    expect(passwordLoginSchema.safeParse("Pentest123456").success).toBe(true);
    expect(passwordLoginSchema.safeParse("").success).toBe(false);
    expect(passwordLoginSchema.safeParse("a".repeat(129)).success).toBe(false);
  });
});
