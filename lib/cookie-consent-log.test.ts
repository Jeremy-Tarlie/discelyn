import { describe, expect, it, vi, beforeEach } from "vitest";

const create = vi.fn();
const updateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cookieConsentLog: {
      create,
      updateMany,
    },
  },
}));

describe("recordCookieConsent", () => {
  beforeEach(() => {
    create.mockReset();
    updateMany.mockReset();
    create.mockResolvedValue({ id: "log_1" });
    updateMany.mockResolvedValue({ count: 2 });
  });

  it("crée un log granulaire et rattache les logs anonymes si userId", async () => {
    const { recordCookieConsent } = await import("@/lib/cookie-consent-log");
    const visitorId = "550e8400-e29b-41d4-a716-446655440000";
    const result = await recordCookieConsent({
      preferences: { analytics: true, sentry: false, affiliate: false },
      visitorId,
      userId: "user_1",
    });
    expect(result.id).toBe("log_1");
    expect(result.choice).toBe(
      'v2.{"analytics":true,"sentry":false,"affiliate":false}'
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          visitorId,
          userId: "user_1",
          choice: 'v2.{"analytics":true,"sentry":false,"affiliate":false}',
        }),
      })
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { visitorId, userId: null },
      data: { userId: "user_1" },
    });
  });

  it("refuse un visitorId invalide", async () => {
    const { recordCookieConsent } = await import("@/lib/cookie-consent-log");
    await expect(
      recordCookieConsent({
        preferences: { analytics: false, sentry: false, affiliate: false },
        visitorId: "bad",
      })
    ).rejects.toThrow("invalid_visitor_id");
  });
});
