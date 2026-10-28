import { describe, expect, it } from "vitest";
import { isStripeCheckoutSessionId } from "@/lib/stripe-checkout-session-id";

describe("isStripeCheckoutSessionId", () => {
  it("accepte les IDs Checkout Session Stripe", () => {
    expect(isStripeCheckoutSessionId("cs_test_a1b2c3")).toBe(true);
    expect(isStripeCheckoutSessionId("cs_live_xyz")).toBe(true);
    expect(isStripeCheckoutSessionId("cs_abc123")).toBe(true);
  });

  it("accepte un ID valide après trim des espaces", () => {
    expect(isStripeCheckoutSessionId("  cs_test_a1b2c3  ")).toBe(true);
  });

  it("rejette les placeholders et IDs invalides", () => {
    expect(isStripeCheckoutSessionId("invalid")).toBe(false);
    expect(isStripeCheckoutSessionId("cs_")).toBe(false);
    expect(isStripeCheckoutSessionId("CS_test_x")).toBe(false);
    expect(isStripeCheckoutSessionId("")).toBe(false);
    expect(isStripeCheckoutSessionId(" session ")).toBe(false);
    expect(isStripeCheckoutSessionId("cs_test-abc")).toBe(false);
    expect(isStripeCheckoutSessionId("cs_test/foo")).toBe(false);
  });
});
