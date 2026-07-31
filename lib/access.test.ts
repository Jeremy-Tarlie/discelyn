import { describe, expect, it } from "vitest";
import {
  canCreateBot,
  canUseProduct,
  filterModulesForPlan,
} from "@/lib/billing-guards";

describe("canCreateBot", () => {
  it("autorise la création sous la limite Free", () => {
    expect(canCreateBot({ plan: "FREE", status: "ACTIVE" }, 0)).toEqual({
      ok: true,
    });
  });

  it("bloque au-delà de la limite Free", () => {
    const result = canCreateBot({ plan: "FREE", status: "ACTIVE" }, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Free");
    }
  });

  it("autorise 2 bots sur Pro", () => {
    expect(canCreateBot({ plan: "PRO", status: "ACTIVE" }, 1)).toEqual({
      ok: true,
    });
    expect(canCreateBot({ plan: "PRO", status: "ACTIVE" }, 2).ok).toBe(false);
  });

  it("bloque si abonnement PAST_DUE", () => {
    const result = canCreateBot({ plan: "PRO", status: "PAST_DUE" }, 0);
    expect(result.ok).toBe(false);
  });
});

describe("canUseProduct", () => {
  it("accepte ACTIVE et TRIALING", () => {
    expect(canUseProduct({ plan: "FREE", status: "ACTIVE" }).ok).toBe(true);
    expect(canUseProduct({ plan: "PRO", status: "TRIALING" }).ok).toBe(true);
  });

  it("refuse CANCELED", () => {
    expect(canUseProduct({ plan: "PRO", status: "CANCELED" }).ok).toBe(false);
  });
});

describe("filterModulesForPlan", () => {
  it("filtre les modules hors plan Free", () => {
    expect(
      filterModulesForPlan("FREE", ["welcome", "tickets", "automod"])
    ).toEqual(["welcome"]);
  });

  it("garde les modules Pro valides", () => {
    expect(
      filterModulesForPlan("PRO", ["welcome", "tickets", "automod", "logs"])
    ).toEqual(["welcome", "tickets", "logs"]);
  });
});
