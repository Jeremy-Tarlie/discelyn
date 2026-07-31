import { describe, expect, it } from "vitest";
import { checkoutSchema, createBotSchema } from "@/lib/validation";

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
    expect(checkoutSchema.safeParse({ planId: "PRO" }).success).toBe(true);
    expect(checkoutSchema.safeParse({ planId: "BUSINESS" }).success).toBe(true);
  });

  it("refuse Free et les valeurs invalides", () => {
    expect(checkoutSchema.safeParse({ planId: "FREE" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ planId: "GOLD" }).success).toBe(false);
  });
});
