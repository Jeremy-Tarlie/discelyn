import { describe, expect, it } from "vitest";
import {
  getPlan,
  planAllowsModule,
  PLANS,
  type PlanId,
} from "@/lib/plans";

describe("PLANS", () => {
  it("expose les 4 plans attendus", () => {
    expect(Object.keys(PLANS).sort()).toEqual([
      "BUSINESS",
      "FREE",
      "PRO",
      "STARTER",
    ]);
  });

  it("a des prix mensuels corrects", () => {
    expect(PLANS.FREE.priceMonthlyEur).toBe(0);
    expect(PLANS.STARTER.priceMonthlyEur).toBe(2.99);
    expect(PLANS.PRO.priceMonthlyEur).toBe(6.99);
    expect(PLANS.BUSINESS.priceMonthlyEur).toBe(12.99);
  });

  it("force le branding uniquement sur Free", () => {
    expect(PLANS.FREE.forceBranding).toBe(true);
    expect(PLANS.STARTER.forceBranding).toBe(false);
    expect(PLANS.PRO.forceBranding).toBe(false);
    expect(PLANS.BUSINESS.forceBranding).toBe(false);
  });

  it("limite Free à welcome uniquement", () => {
    expect(PLANS.FREE.modules).toEqual(["welcome"]);
    expect(PLANS.FREE.maxCustomCommands).toBe(0);
    expect(PLANS.FREE.maxBots).toBe(1);
  });
});

describe("planAllowsModule", () => {
  it("autorise welcome sur tous les plans", () => {
    (Object.keys(PLANS) as PlanId[]).forEach((planId) => {
      expect(planAllowsModule(planId, "welcome")).toBe(true);
    });
  });

  it("refuse tickets sur Free et Starter", () => {
    expect(planAllowsModule("FREE", "tickets")).toBe(false);
    expect(planAllowsModule("STARTER", "tickets")).toBe(false);
    expect(planAllowsModule("PRO", "tickets")).toBe(true);
  });

  it("réserve automod à Business", () => {
    expect(planAllowsModule("FREE", "automod")).toBe(false);
    expect(planAllowsModule("STARTER", "automod")).toBe(false);
    expect(planAllowsModule("PRO", "automod")).toBe(false);
    expect(planAllowsModule("BUSINESS", "automod")).toBe(true);
  });
});

describe("getPlan", () => {
  it("retourne la définition demandée", () => {
    expect(getPlan("PRO").name).toBe("Pro");
    expect(getPlan("PRO").highlighted).toBe(true);
  });
});
