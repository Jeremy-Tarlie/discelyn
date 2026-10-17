import { describe, expect, it, vi } from "vitest";

const deleteMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailEvent: { deleteMany: (...args: unknown[]) => deleteMany(...args) },
  },
}));

describe("purgeExpiredEmailEvents", () => {
  it("supprime les EmailEvent plus vieux que 13 mois", async () => {
    deleteMany.mockResolvedValue({ count: 3 });
    const { purgeExpiredEmailEvents, emailEventCutoff } = await import(
      "@/lib/data-retention"
    );
    const now = new Date("2026-10-17T12:00:00.000Z");
    const count = await purgeExpiredEmailEvents(now);
    expect(count).toBe(3);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: emailEventCutoff(now) } },
    });
  });
});
