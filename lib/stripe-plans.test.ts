import { afterEach, describe, expect, it } from "vitest";
import {
  isPlanId,
  mapStripeSubscriptionStatus,
  planFromMetadata,
  planFromPriceId,
  resolveSubscriptionPlan,
} from "@/lib/stripe-plans";

describe("isPlanId", () => {
  it("accepte les plans connus", () => {
    expect(isPlanId("STARTER")).toBe(true);
    expect(isPlanId("FREE")).toBe(true);
    expect(isPlanId("PRO")).toBe(false);
  });
});

describe("planFromMetadata", () => {
  it("mappe PRO/BUSINESS vers SCALE", () => {
    expect(planFromMetadata({ planId: "PRO" })).toBe("SCALE");
    expect(planFromMetadata({ planId: "BUSINESS" })).toBe("SCALE");
  });

  it("ignore FREE dans metadata (réservé au fallback)", () => {
    expect(planFromMetadata({ planId: "FREE" })).toBeNull();
  });
});

describe("planFromPriceId", () => {
  const prev = {
    STARTER: process.env.STRIPE_PRICE_STARTER,
    OPS: process.env.STRIPE_PRICE_OPS,
  };

  afterEach(() => {
    if (prev.STARTER === undefined) delete process.env.STRIPE_PRICE_STARTER;
    else process.env.STRIPE_PRICE_STARTER = prev.STARTER;
    if (prev.OPS === undefined) delete process.env.STRIPE_PRICE_OPS;
    else process.env.STRIPE_PRICE_OPS = prev.OPS;
  });

  it("résout via env price IDs", () => {
    process.env.STRIPE_PRICE_STARTER = "price_starter_test";
    process.env.STRIPE_PRICE_OPS = "price_ops_test";
    expect(planFromPriceId("price_starter_test")).toBe("STARTER");
    expect(planFromPriceId("price_ops_test")).toBe("OPS");
    expect(planFromPriceId("price_unknown")).toBeNull();
  });
});

describe("resolveSubscriptionPlan", () => {
  it("conserve STARTER quand le price est inconnu", () => {
    const result = resolveSubscriptionPlan({
      metadata: {},
      priceId: "price_unknown",
      existingPlan: "STARTER",
    });
    expect(result).toEqual({ plan: "STARTER", conserved: true });
  });

  it("conserve OPS / SCALE / FREE", () => {
    expect(
      resolveSubscriptionPlan({
        metadata: null,
        priceId: null,
        existingPlan: "OPS",
      }).plan
    ).toBe("OPS");
    expect(
      resolveSubscriptionPlan({
        metadata: null,
        priceId: null,
        existingPlan: "SCALE",
      }).plan
    ).toBe("SCALE");
    expect(
      resolveSubscriptionPlan({
        metadata: null,
        priceId: null,
        existingPlan: "FREE",
      }).plan
    ).toBe("FREE");
  });

  it("fallback FREE si plan existant invalide", () => {
    expect(
      resolveSubscriptionPlan({
        metadata: null,
        priceId: null,
        existingPlan: "PRO",
      })
    ).toEqual({ plan: "FREE", conserved: true });
  });

  it("préfère le price ID à la metadata (anti-fraude)", () => {
    const prev = process.env.STRIPE_PRICE_OPS;
    process.env.STRIPE_PRICE_OPS = "price_ops_real";
    try {
      expect(
        resolveSubscriptionPlan({
          metadata: { planId: "SCALE" },
          priceId: "price_ops_real",
          existingPlan: "FREE",
        })
      ).toEqual({ plan: "OPS", conserved: false });
    } finally {
      if (prev === undefined) delete process.env.STRIPE_PRICE_OPS;
      else process.env.STRIPE_PRICE_OPS = prev;
    }
  });

  it("utilise metadata seulement si price inconnu", () => {
    expect(
      resolveSubscriptionPlan({
        metadata: { planId: "STARTER" },
        priceId: "price_unknown",
        existingPlan: "FREE",
      })
    ).toEqual({ plan: "STARTER", conserved: false });
  });
});

describe("mapStripeSubscriptionStatus", () => {
  it("mappe les statuts connus et refuse ACTIVE par défaut", () => {
    expect(mapStripeSubscriptionStatus("active")).toBe("ACTIVE");
    expect(mapStripeSubscriptionStatus("past_due")).toBe("PAST_DUE");
    expect(mapStripeSubscriptionStatus("weird_future_status")).toBe(
      "INCOMPLETE"
    );
  });
});
