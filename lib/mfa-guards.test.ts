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
  it("exige MFA pour one-shot même en Free", () => {
    expect(
      requiresMfaForCheckout({ oneShot: true, subscription: freeNoSub })
    ).toBe(true);
  });

  it("n’exige pas MFA pour le premier checkout abonnement Free", () => {
    expect(
      requiresMfaForCheckout({ oneShot: false, subscription: freeNoSub })
    ).toBe(false);
  });

  it("exige MFA si un abo Stripe bloquant existe", () => {
    expect(
      requiresMfaForCheckout({
        oneShot: false,
        subscription: {
          plan: "FREE",
          status: "PAST_DUE",
          stripeSubscriptionId: "sub_123",
        },
      })
    ).toBe(true);
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

  it("exige MFA si plan déjà payant sans Free", () => {
    expect(
      requiresMfaForCheckout({
        oneShot: false,
        subscription: {
          plan: "OPS",
          status: "CANCELED",
          stripeSubscriptionId: null,
        },
      })
    ).toBe(true);
  });
});
