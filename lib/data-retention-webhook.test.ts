import { describe, expect, it, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const deleteMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    outboundWebhookDelivery: {
      findMany,
      deleteMany,
    },
  },
}));

describe("purgeExpiredOutboundWebhookDeliveries", () => {
  beforeEach(() => {
    findMany.mockReset();
    deleteMany.mockReset();
  });

  it("purge les livraisons > 90 jours par lots", async () => {
    findMany
      .mockResolvedValueOnce([{ id: "d1" }, { id: "d2" }])
      .mockResolvedValueOnce([]);
    deleteMany.mockResolvedValue({ count: 2 });

    const {
      purgeExpiredOutboundWebhookDeliveries,
      outboundWebhookDeliveryCutoff,
    } = await import("@/lib/data-retention");

    const now = new Date("2026-10-18T12:00:00.000Z");
    const count = await purgeExpiredOutboundWebhookDeliveries(now);
    expect(count).toBe(2);
    expect(findMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: outboundWebhookDeliveryCutoff(now) } },
      select: { id: true },
      take: 1000,
      orderBy: { createdAt: "asc" },
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["d1", "d2"] } },
    });
  });
});
