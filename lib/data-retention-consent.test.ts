import { describe, expect, it, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const deleteMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cookieConsentLog: {
      findMany,
      deleteMany,
    },
  },
}));

describe("purgeExpiredCookieConsents", () => {
  beforeEach(() => {
    findMany.mockReset();
    deleteMany.mockReset();
    findMany.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }]);
    deleteMany.mockResolvedValue({ count: 3 });
  });

  it("purge les logs plus vieux que 24 mois (batch ids)", async () => {
    const { purgeExpiredCookieConsents, cookieConsentCutoff } = await import(
      "@/lib/data-retention"
    );
    const now = new Date("2026-10-07T12:00:00.000Z");
    const count = await purgeExpiredCookieConsents(now);
    expect(count).toBe(3);
    expect(findMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: cookieConsentCutoff(now) } },
      select: { id: true },
      take: 1000,
      orderBy: { createdAt: "asc" },
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["a", "b", "c"] } },
    });
    const cutoff = cookieConsentCutoff(now);
    expect(cutoff.toISOString()).toBe("2024-10-07T12:00:00.000Z");
  });
});
