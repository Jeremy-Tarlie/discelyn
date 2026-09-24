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
  });

  it("autorise jusqu'à 5 bots sur Scale", () => {
    expect(canCreateBot({ plan: "SCALE", status: "ACTIVE" }, 4)).toEqual({
      ok: true,
    });
    expect(canCreateBot({ plan: "SCALE", status: "ACTIVE" }, 5).ok).toBe(false);
  });

  it("bloque si abonnement PAST_DUE", () => {
    const result = canCreateBot({ plan: "OPS", status: "PAST_DUE" }, 0);
    expect(result.ok).toBe(false);
  });
});

describe("canUseProduct", () => {
  it("accepte ACTIVE et TRIALING", () => {
    expect(canUseProduct({ plan: "FREE", status: "ACTIVE" }).ok).toBe(true);
    expect(canUseProduct({ plan: "OPS", status: "TRIALING" }).ok).toBe(true);
  });

  it("refuse CANCELED", () => {
    expect(canUseProduct({ plan: "OPS", status: "CANCELED" }).ok).toBe(false);
  });
});

describe("filterModulesForPlan", () => {
  it("filtre les modules hors plan Free", () => {
    expect(
      filterModulesForPlan("FREE", [
        "welcome",
        "tickets",
        "moderation",
        "roles",
        "logs",
        "custom_commands",
        "automod",
      ])
    ).toEqual([
      "welcome",
      "tickets",
      "moderation",
      "roles",
      "logs",
      "custom_commands",
    ]);
  });

  it("garde les modules Ops valides", () => {
    expect(
      filterModulesForPlan("OPS", ["welcome", "tickets", "automod", "logs"])
    ).toEqual(["welcome", "tickets", "logs"]);
  });
});
