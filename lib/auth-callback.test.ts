import { describe, expect, it } from "vitest";
import {
  loginWithSubscribeIntent,
  parseSubscribeIntent,
  safeAuthCallbackUrl,
  subscribePath,
} from "@/lib/auth-callback";

describe("safeAuthCallbackUrl", () => {
  it("défaut /dashboard si vide ou invalide", () => {
    expect(safeAuthCallbackUrl(null)).toBe("/dashboard");
    expect(safeAuthCallbackUrl(undefined)).toBe("/dashboard");
    expect(safeAuthCallbackUrl("")).toBe("/dashboard");
    expect(safeAuthCallbackUrl("https://evil.com")).toBe("/dashboard");
    expect(safeAuthCallbackUrl("//evil.com")).toBe("/dashboard");
    expect(safeAuthCallbackUrl("/login")).toBe("/dashboard");
    expect(safeAuthCallbackUrl("/pricing")).toBe("/dashboard");
  });

  it("autorise /dashboard et sous-chemins", () => {
    expect(safeAuthCallbackUrl("/dashboard")).toBe("/dashboard");
    expect(safeAuthCallbackUrl("/dashboard/billing")).toBe(
      "/dashboard/billing"
    );
    expect(safeAuthCallbackUrl("/dashboard/billing?success=1")).toBe(
      "/dashboard/billing?success=1"
    );
  });

  it("autorise /subscribe avec query", () => {
    expect(safeAuthCallbackUrl("/subscribe")).toBe("/subscribe");
    expect(
      safeAuthCallbackUrl("/subscribe?plan=STARTER&interval=month")
    ).toBe("/subscribe?plan=STARTER&interval=month");
  });

  it("rejette les open-redirects classiques", () => {
    expect(safeAuthCallbackUrl("/\\evil.com")).toBe("/dashboard");
    expect(safeAuthCallbackUrl("/dashboard@evil.com")).toBe("/dashboard");
  });
});

describe("subscribePath / loginWithSubscribeIntent", () => {
  it("encode l’intent plan", () => {
    expect(subscribePath("OPS", "year")).toBe(
      "/subscribe?plan=OPS&interval=year"
    );
    expect(loginWithSubscribeIntent("STARTER", "month")).toBe(
      `/login?callbackUrl=${encodeURIComponent("/subscribe?plan=STARTER&interval=month")}`
    );
  });
});

describe("parseSubscribeIntent", () => {
  it("accepte STARTER/OPS/SCALE + interval", () => {
    expect(
      parseSubscribeIntent({ plan: "STARTER", interval: "year" })
    ).toEqual({ plan: "STARTER", interval: "year" });
    expect(
      parseSubscribeIntent({ plan: "SCALE", interval: undefined })
    ).toEqual({ plan: "SCALE", interval: "month" });
  });

  it("refuse FREE et plans inconnus", () => {
    expect(parseSubscribeIntent({ plan: "FREE", interval: "month" })).toBeNull();
    expect(
      parseSubscribeIntent({ plan: "GOLD", interval: "month" })
    ).toBeNull();
    expect(parseSubscribeIntent({ plan: null, interval: "month" })).toBeNull();
  });
});
