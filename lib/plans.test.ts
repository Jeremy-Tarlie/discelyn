import { describe, expect, it } from "vitest";
import {
  cheapestPlanForAuditExport,
  cheapestPlanForModule,
  DIAGNOSTIC_OFFER,
  formatPriceEur,
  getPlan,
  OPS_CORE_MODULES,
  planAllowsModule,
  planYearlySavingsEur,
  PLANS,
  SETUP_OFFER,
  type PlanId,
} from "@/lib/plans";
import { RUNTIME_PLAN_LIMITS } from "@/shared/runtime-plan-limits";

describe("PLANS", () => {
  it("expose Essai / Starter / Ops / Scale", () => {
    expect(Object.keys(PLANS).sort()).toEqual([
      "FREE",
      "OPS",
      "SCALE",
      "STARTER",
    ]);
  });

  it("a des prix self-serve accessibles", () => {
    expect(PLANS.FREE.priceMonthlyEur).toBe(0);
    expect(PLANS.STARTER.priceMonthlyEur).toBe(19.99);
    expect(PLANS.STARTER.priceYearlyEur).toBe(199.9);
    expect(PLANS.OPS.priceMonthlyEur).toBe(49);
    expect(PLANS.OPS.priceYearlyEur).toBe(490);
    expect(PLANS.SCALE.priceMonthlyEur).toBe(99);
    expect(PLANS.SCALE.priceYearlyEur).toBe(990);
    expect(SETUP_OFFER.priceEur).toBe(290);
    expect(DIAGNOSTIC_OFFER.priceEur).toBe(49);
    expect(DIAGNOSTIC_OFFER.setupCreditEur).toBe(49);
  });

  it("calcule l’économie annuelle (2 mois offerts)", () => {
    expect(planYearlySavingsEur("FREE")).toBe(0);
    expect(planYearlySavingsEur("STARTER")).toBe(39.98);
    expect(planYearlySavingsEur("OPS")).toBe(98);
    expect(planYearlySavingsEur("SCALE")).toBe(198);
  });

  it("expose les env keys mensuel et annuel pour les plans payants", () => {
    expect(PLANS.STARTER.stripePriceEnvKey).toBe("STRIPE_PRICE_STARTER");
    expect(PLANS.STARTER.stripePriceYearlyEnvKey).toBe(
      "STRIPE_PRICE_STARTER_YEARLY"
    );
    expect(PLANS.FREE.stripePriceEnvKey).toBeNull();
    expect(PLANS.FREE.stripePriceYearlyEnvKey).toBeNull();
  });

  it("pousse le freemium avec le socle ops + 1 produit accès", () => {
    expect(PLANS.FREE.modules).toEqual([...OPS_CORE_MODULES]);
    expect(PLANS.FREE.maxCustomCommands).toBe(5);
    expect(PLANS.FREE.auditExport).toBe(false);
    expect(PLANS.FREE.maxAccessProducts).toBe(1);
  });

  it("débloque l’export audit dès Starter et scale les produits accès", () => {
    expect(PLANS.STARTER.auditExport).toBe(true);
    expect(PLANS.STARTER.maxAccessProducts).toBe(5);
    expect(PLANS.OPS.auditExport).toBe(true);
    expect(PLANS.OPS.maxAccessProducts).toBe(20);
    expect(PLANS.OPS.maxCustomCommands).toBe(40);
    expect(PLANS.SCALE.maxAccessProducts).toBe(100);
  });

  it("reste synchronisé avec le runtime", () => {
    (Object.keys(PLANS) as PlanId[]).forEach((planId) => {
      expect(RUNTIME_PLAN_LIMITS[planId].maxGuilds).toBe(PLANS[planId].maxGuilds);
      expect([...RUNTIME_PLAN_LIMITS[planId].modules]).toEqual(
        PLANS[planId].modules
      );
      expect(RUNTIME_PLAN_LIMITS[planId].maxCustomCommands).toBe(
        PLANS[planId].maxCustomCommands
      );
    });
  });
});

describe("formatPriceEur", () => {
  it("formate les décimales à la française", () => {
    expect(formatPriceEur(19.99)).toBe("19,99");
    expect(formatPriceEur(49)).toBe("49");
  });
});

describe("planAllowsModule", () => {
  it("autorise le socle ops dès Essai", () => {
    expect(planAllowsModule("FREE", "tickets")).toBe(true);
    expect(planAllowsModule("FREE", "moderation")).toBe(true);
    expect(planAllowsModule("FREE", "roles")).toBe(true);
    expect(planAllowsModule("FREE", "logs")).toBe(true);
    expect(planAllowsModule("FREE", "custom_commands")).toBe(true);
    expect(planAllowsModule("FREE", "automod")).toBe(false);
    expect(planAllowsModule("STARTER", "roles")).toBe(true);
    expect(planAllowsModule("SCALE", "automod")).toBe(true);
  });

  it("réserve automod à Scale", () => {
    expect(planAllowsModule("OPS", "automod")).toBe(false);
    expect(planAllowsModule("SCALE", "automod")).toBe(true);
  });
});

describe("cheapestPlanForModule", () => {
  it("pointe vers le plan payant le moins cher (upsell)", () => {
    expect(cheapestPlanForModule("tickets")).toBe("STARTER");
    expect(cheapestPlanForModule("moderation")).toBe("STARTER");
    expect(cheapestPlanForModule("roles")).toBe("STARTER");
    expect(cheapestPlanForModule("automod")).toBe("SCALE");
  });
});

describe("cheapestPlanForAuditExport", () => {
  it("pointe Starter", () => {
    expect(cheapestPlanForAuditExport()).toBe("STARTER");
  });
});

describe("getPlan", () => {
  it("retourne Ops en highlight", () => {
    expect(getPlan("OPS").name).toBe("Ops");
    expect(getPlan("OPS").highlighted).toBe(true);
  });
});
