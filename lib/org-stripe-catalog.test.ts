import { describe, expect, it } from "vitest";
import { extractPriceIdFromPaymentLinkUrl } from "@/lib/org-stripe-catalog";
import { extractAccessProductIdFromSession } from "@/lib/learner-access-parse";
import { accessProductCreateSchemaFor } from "@/lib/access-validation";
import type Stripe from "stripe";

function session(
  partial: Partial<Stripe.Checkout.Session> & {
    metadata?: Record<string, string>;
  }
): Stripe.Checkout.Session {
  return partial as Stripe.Checkout.Session;
}

describe("extractPriceIdFromPaymentLinkUrl", () => {
  it("accepte un price_ brut", () => {
    expect(extractPriceIdFromPaymentLinkUrl("price_1ABC")).toBe("price_1ABC");
  });

  it("lit price dans la query", () => {
    expect(
      extractPriceIdFromPaymentLinkUrl(
        "https://buy.stripe.com/test_xxx?price=price_1ABC"
      )
    ).toBe("price_1ABC");
  });

  it("retourne null pour une URL buy sans price", () => {
    expect(
      extractPriceIdFromPaymentLinkUrl("https://buy.stripe.com/test_xxx")
    ).toBeNull();
  });
});

describe("extractAccessProductIdFromSession", () => {
  it("lit discelyn_access_product_id", () => {
    expect(
      extractAccessProductIdFromSession(
        session({
          metadata: { discelyn_access_product_id: "cmvcxproduct01" },
        })
      )
    ).toBe("cmvcxproduct01");
  });

  it("refuse un id trop court", () => {
    expect(
      extractAccessProductIdFromSession(
        session({ metadata: { discelyn_access_product_id: "ab" } })
      )
    ).toBeNull();
  });
});

describe("accessProductCreateSchema create/bind", () => {
  const schema = accessProductCreateSchemaFor("fr");

  it("accepte mode create", () => {
    const parsed = schema.safeParse({
      mode: "create",
      name: "Formation SEO",
      discordRoleId: "123456789012345678",
      amountCents: 4900,
      currency: "eur",
      billingMode: "ONE_TIME",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepte mode bind avec price_", () => {
    const parsed = schema.safeParse({
      mode: "bind",
      name: "Formation SEO",
      discordRoleId: "123456789012345678",
      stripePriceId: "price_1ABC",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepte legacy stripePriceId sans mode", () => {
    const parsed = schema.safeParse({
      name: "Formation SEO",
      discordRoleId: "123456789012345678",
      stripePriceId: "price_1ABC",
    });
    expect(parsed.success).toBe(true);
  });

  it("refuse bind sans price ni lien", () => {
    const parsed = schema.safeParse({
      mode: "bind",
      name: "Formation SEO",
      discordRoleId: "123456789012345678",
    });
    expect(parsed.success).toBe(false);
  });

  it("refuse RECURRING sans intervalle", () => {
    const parsed = schema.safeParse({
      mode: "create",
      name: "Formation SEO",
      discordRoleId: "123456789012345678",
      amountCents: 4900,
      currency: "eur",
      billingMode: "RECURRING",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepte RECURRING avec month", () => {
    const parsed = schema.safeParse({
      mode: "create",
      name: "Formation SEO",
      discordRoleId: "123456789012345678",
      amountCents: 4900,
      currency: "eur",
      billingMode: "RECURRING",
      recurringInterval: "month",
    });
    expect(parsed.success).toBe(true);
  });
});
