import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  oversoldFindMany,
  oversoldUpdate,
  getOrgStripeClient,
  refundsCreate,
  subscriptionsCancel,
} = vi.hoisted(() => ({
  oversoldFindMany: vi.fn(),
  oversoldUpdate: vi.fn(),
  getOrgStripeClient: vi.fn(),
  refundsCreate: vi.fn(),
  subscriptionsCancel: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accessOversoldEvent: {
      findMany: (...args: unknown[]) => oversoldFindMany(...args),
      update: (...args: unknown[]) => oversoldUpdate(...args),
    },
  },
}));

vi.mock("@/lib/org-stripe", () => ({
  getOrgStripeClient: (...args: unknown[]) => getOrgStripeClient(...args),
}));

vi.mock("@/lib/money-path-sentry", () => ({
  captureMoneyPathError: vi.fn(),
}));

describe("retryOversoldRefunds", () => {
  beforeEach(() => {
    oversoldFindMany.mockReset();
    oversoldUpdate.mockReset();
    getOrgStripeClient.mockReset();
    refundsCreate.mockReset();
    subscriptionsCancel.mockReset();
    oversoldUpdate.mockResolvedValue({});
    getOrgStripeClient.mockResolvedValue({
      refunds: { create: refundsCreate },
      subscriptions: { cancel: subscriptionsCancel },
    });
    refundsCreate.mockResolvedValue({ id: "re_test_123" });
  });

  afterEach(() => {
    vi.resetModules();
  });

  async function importRetry() {
    const { retryOversoldRefunds } = await import("@/lib/learner-access-open");
    return retryOversoldRefunds;
  }

  it("ne charge que pending et refund_failed", async () => {
    oversoldFindMany.mockResolvedValue([]);
    const retry = await importRetry();
    await retry();
    expect(oversoldFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { refundStatus: { in: ["pending", "refund_failed"] } },
        take: 30,
      })
    );
  });

  it("retourne 0 si aucun événement à traiter", async () => {
    oversoldFindMany.mockResolvedValue([]);
    const retry = await importRetry();
    await expect(retry()).resolves.toBe(0);
    expect(oversoldUpdate).not.toHaveBeenCalled();
  });

  it("incrémente le compteur uniquement pour les remboursements réussis", async () => {
    oversoldFindMany.mockResolvedValue([
      {
        id: "ev-1",
        organizationId: "org-1",
        stripePaymentIntentId: "pi_ok",
        stripeCheckoutSessionId: "cs_1",
      },
      {
        id: "ev-2",
        organizationId: "org-2",
        stripePaymentIntentId: "pi_fail",
        stripeCheckoutSessionId: "cs_2",
      },
    ]);
    refundsCreate
      .mockResolvedValueOnce({ id: "re_1" })
      .mockRejectedValueOnce(new Error("card_declined"));

    const retry = await importRetry();
    const fixed = await retry();

    expect(fixed).toBe(1);
    expect(oversoldUpdate).toHaveBeenCalledTimes(2);
    expect(oversoldUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "ev-1" },
      data: {
        refundStatus: "refunded",
        stripeRefundId: "re_1",
        refundError: null,
      },
    });
    expect(oversoldUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "ev-2" },
      data: expect.objectContaining({
        refundStatus: "refund_failed",
        stripeRefundId: null,
      }),
    });
  });

  it("marque skipped sans compter si Stripe org non configuré", async () => {
    oversoldFindMany.mockResolvedValue([
      {
        id: "ev-skip",
        organizationId: "org-no-stripe",
        stripePaymentIntentId: "pi_x",
        stripeCheckoutSessionId: "cs_x",
      },
    ]);
    getOrgStripeClient.mockResolvedValue(null);

    const retry = await importRetry();
    const fixed = await retry();

    expect(fixed).toBe(0);
    expect(refundsCreate).not.toHaveBeenCalled();
    expect(oversoldUpdate).toHaveBeenCalledWith({
      where: { id: "ev-skip" },
      data: {
        refundStatus: "skipped",
        stripeRefundId: null,
        refundError: "stripe_not_configured",
      },
    });
  });
});
