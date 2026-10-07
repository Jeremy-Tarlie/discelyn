import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import { requiresMfaForCheckout } from "@/lib/mfa-guards";

const freeNoSub = {
  plan: "FREE",
  status: "ACTIVE",
  stripeSubscriptionId: null,
};

describe("requiresMfaForCheckout", () => {
  it("exige MFA pour one-shot", () => {
    expect(
      requiresMfaForCheckout({ oneShot: true, subscription: freeNoSub })
    ).toBe(true);
  });

  it("exige MFA pour le premier checkout abonnement Free", () => {
    expect(
      requiresMfaForCheckout({ oneShot: false, subscription: freeNoSub })
    ).toBe(true);
  });

  it("exige MFA si un abo Stripe existe", () => {
    expect(
      requiresMfaForCheckout({
        oneShot: false,
        subscription: {
          plan: "STARTER",
          status: "ACTIVE",
          stripeSubscriptionId: "sub_456",
        },
      })
    ).toBe(true);
  });
});
