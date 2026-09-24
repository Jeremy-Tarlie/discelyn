import { describe, expect, it } from "vitest";
import {
  botConfigSchema,
  checkoutSchema,
  createBotSchema,
  sanitizeBotConfig,
} from "@/lib/validation";

describe("createBotSchema", () => {
  it("accepte un nom valide", () => {
    const parsed = createBotSchema.safeParse({ name: "Gardien Nova" });
    expect(parsed.success).toBe(true);
  });

  it("refuse un nom trop court", () => {
    const parsed = createBotSchema.safeParse({ name: "A" });
    expect(parsed.success).toBe(false);
  });

  it("refuse les caractères dangereux", () => {
    const parsed = createBotSchema.safeParse({ name: "<script>" });
    expect(parsed.success).toBe(false);
  });

  it("accepte une description optionnelle", () => {
    const parsed = createBotSchema.safeParse({
      name: "Bot Test",
      description: "Un bot de démo",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("checkoutSchema", () => {
  it("accepte les plans payants", () => {
    expect(checkoutSchema.safeParse({ planId: "STARTER" }).success).toBe(true);
    expect(checkoutSchema.safeParse({ planId: "OPS" }).success).toBe(true);
    expect(checkoutSchema.safeParse({ planId: "SCALE" }).success).toBe(true);
    expect(checkoutSchema.safeParse({ planId: "SETUP" }).success).toBe(true);
    expect(checkoutSchema.safeParse({ planId: "DIAGNOSTIC" }).success).toBe(
      true
    );
  });

  it("refuse Free et les valeurs invalides", () => {
    expect(checkoutSchema.safeParse({ planId: "FREE" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ planId: "GOLD" }).success).toBe(false);
  });
});

describe("botConfigSchema", () => {
  it("accepte une config valide", () => {
    const parsed = botConfigSchema.safeParse({
      welcomeChannelId: "123456789012345678",
      bannedWords: ["spam"],
      modPrefix: "!",
      reactionRoles: [
        {
          messageId: "123456789012345678",
          emoji: "👍",
          roleId: "234567890123456789",
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("refuse un snowflake invalide", () => {
    expect(
      botConfigSchema.safeParse({ welcomeChannelId: "abc" }).success
    ).toBe(false);
  });

  it("sanitize retire les IDs vides", () => {
    const cleaned = sanitizeBotConfig({
      welcomeChannelId: "",
      welcomeMessage: "Salut",
      bannedWords: ["x"],
    });
    expect(cleaned).toEqual({
      welcomeMessage: "Salut",
      bannedWords: ["x"],
    });
  });
});
