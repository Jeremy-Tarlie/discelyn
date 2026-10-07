import { describe, expect, it, vi, beforeEach } from "vitest";

const deleteMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cookieConsentLog: {
      deleteMany,
    },
  },
}));

describe("purgeExpiredCookieConsents", () => {
  beforeEach(() => {
    deleteMany.mockReset();
    deleteMany.mockResolvedValue({ count: 3 });
  });

  it("purge les logs plus vieux que 24 mois", async () => {
    const { purgeExpiredCookieConsents, cookieConsentCutoff } = await import(
      "@/lib/data-retention"
    );
    const now = new Date("2026-10-07T12:00:00.000Z");
    const count = await purgeExpiredCookieConsents(now);
    expect(count).toBe(3);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: cookieConsentCutoff(now) } },
    });
    const cutoff = cookieConsentCutoff(now);
    expect(cutoff.toISOString()).toBe("2024-10-07T12:00:00.000Z");
  });
});
