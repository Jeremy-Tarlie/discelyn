import { Prisma } from "@/generated/prisma/client";
import { describe, expect, it, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const updateManyLearner = vi.fn();
const updateManyEvent = vi.fn();
const updateManyOversold = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    learnerAccess: {
      findMany,
      updateMany: updateManyLearner,
    },
    learnerAccessEvent: {
      updateMany: updateManyEvent,
    },
    accessOversoldEvent: {
      updateMany: updateManyOversold,
    },
  },
}));

describe("anonymizeExpiredLearnerPii", () => {
  beforeEach(() => {
    findMany.mockReset();
    updateManyLearner.mockReset();
    updateManyEvent.mockReset();
    updateManyOversold.mockReset();
  });

  it("nullifie PII Stripe + meta events + oversold email", async () => {
    findMany.mockResolvedValueOnce([{ id: "la1" }]).mockResolvedValueOnce([]);
    updateManyLearner.mockResolvedValue({ count: 1 });
    updateManyEvent.mockResolvedValue({ count: 2 });
    updateManyOversold.mockResolvedValue({ count: 1 });

    const {
      anonymizeExpiredLearnerPii,
      LEARNER_PII_NULL,
      learnerPiiCutoff,
    } = await import("@/lib/data-retention");

    const now = new Date("2026-10-18T12:00:00.000Z");
    const count = await anonymizeExpiredLearnerPii(now);
    expect(count).toBe(1);

    expect(updateManyLearner).toHaveBeenCalledWith({
      where: { id: { in: ["la1"] } },
      data: LEARNER_PII_NULL,
    });
    expect(LEARNER_PII_NULL).toMatchObject({
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      stripeSubscriptionId: null,
    });
    expect(updateManyEvent).toHaveBeenCalledWith({
      where: { learnerAccessId: { in: ["la1"] } },
      data: { meta: Prisma.DbNull },
    });
    expect(updateManyOversold).toHaveBeenCalledWith({
      where: {
        createdAt: { lt: learnerPiiCutoff(now) },
        customerEmail: { not: null },
      },
      data: { customerEmail: null },
    });
  });
});

