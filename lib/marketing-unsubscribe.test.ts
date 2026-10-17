import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const userUpdateMany = vi.fn();
const leadUpdateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { updateMany: (...args: unknown[]) => userUpdateMany(...args) },
    lead: { updateMany: (...args: unknown[]) => leadUpdateMany(...args) },
  },
}));

vi.mock("@/lib/access-urls", () => ({
  appBaseUrl: () => "https://app.example",
}));

describe("marketing-unsubscribe", () => {
  const prevAuth = process.env.AUTH_SECRET;
  const prevNext = process.env.NEXTAUTH_SECRET;

  beforeEach(() => {
    userUpdateMany.mockReset().mockResolvedValue({ count: 1 });
    leadUpdateMany.mockReset().mockResolvedValue({ count: 0 });
    process.env.AUTH_SECRET = "test-auth-secret-32chars-minimum!!";
    delete process.env.NEXTAUTH_SECRET;
    vi.resetModules();
  });

  afterEach(() => {
    if (prevAuth === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = prevAuth;
    if (prevNext === undefined) delete process.env.NEXTAUTH_SECRET;
    else process.env.NEXTAUTH_SECRET = prevNext;
  });

  it("signe et vérifie un token", async () => {
    const { signUnsubscribeToken, verifyUnsubscribeToken } = await import(
      "@/lib/marketing-unsubscribe"
    );
    const token = signUnsubscribeToken("A@Ex.com");
    expect(token).toBeTruthy();
    const verified = verifyUnsubscribeToken(token!);
    expect(verified).toEqual({ ok: true, email: "a@ex.com" });
  });

  it("refuse un token altéré", async () => {
    const { signUnsubscribeToken, verifyUnsubscribeToken } = await import(
      "@/lib/marketing-unsubscribe"
    );
    const token = signUnsubscribeToken("a@ex.com");
    expect(verifyUnsubscribeToken(`${token}x`)).toEqual({ ok: false });
  });

  it("révoque User + Lead", async () => {
    const { revokeMarketingConsent } = await import(
      "@/lib/marketing-unsubscribe"
    );
    await revokeMarketingConsent("B@Ex.com");
    expect(userUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "b@ex.com", deletedAt: null },
        data: { marketingConsentAt: null },
      }),
    );
    expect(leadUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "b@ex.com" },
        data: { marketingConsentAt: null },
      }),
    );
  });
});
