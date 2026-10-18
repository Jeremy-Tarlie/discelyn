import { describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const deleteMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailEvent: {
      findMany,
      deleteMany,
    },
  },
}));

describe("purgeExpiredEmailEvents", () => {
  it("supprime les EmailEvent plus vieux que 13 mois (batch ids)", async () => {
    findMany.mockResolvedValue([{ id: "e1" }, { id: "e2" }, { id: "e3" }]);
    deleteMany.mockResolvedValue({ count: 3 });
    const { purgeExpiredEmailEvents, emailEventCutoff } = await import(
      "@/lib/data-retention"
    );
    const now = new Date("2026-10-17T12:00:00.000Z");
    const count = await purgeExpiredEmailEvents(now);
    expect(count).toBe(3);
    expect(findMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: emailEventCutoff(now) } },
      select: { id: true },
      take: 1000,
      orderBy: { createdAt: "asc" },
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["e1", "e2", "e3"] } },
    });
  });
});
