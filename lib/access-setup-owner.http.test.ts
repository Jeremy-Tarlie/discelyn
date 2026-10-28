import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireOrg,
  getOrgSubscription,
  canUseProduct,
  bootstrapOrgStripe,
  rateLimitOk,
  userFindFirst,
} = vi.hoisted(() => ({
  requireOrg: vi.fn(),
  getOrgSubscription: vi.fn(),
  canUseProduct: vi.fn(),
  bootstrapOrgStripe: vi.fn(),
  rateLimitOk: vi.fn(),
  userFindFirst: vi.fn(),
}));

vi.mock("@/lib/access", () => ({
  requireOrg: (...args: unknown[]) => requireOrg(...args),
  getOrgSubscription: (...args: unknown[]) => getOrgSubscription(...args),
  canUseProduct: (...args: unknown[]) => canUseProduct(...args),
}));

vi.mock("@/lib/org-stripe", () => ({
  bootstrapOrgStripe: (...args: unknown[]) => bootstrapOrgStripe(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimitOk(...args),
}));

vi.mock("@/lib/locale", () => ({
  getRequestLocale: () => "fr",
}));

vi.mock("@/lib/plans", () => ({
  getPlan: () => ({ maxAccessProducts: 5 }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: (...args: unknown[]) => userFindFirst(...args) },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/mfa-session", () => ({
  userNeedsMfaChallenge: vi.fn().mockResolvedValue(false),
}));

describe("POST /api/access/setup — secrets formation OWNER only", () => {
  beforeEach(() => {
    requireOrg.mockReset();
    getOrgSubscription.mockReset();
    canUseProduct.mockReset();
    bootstrapOrgStripe.mockReset();
    rateLimitOk.mockResolvedValue({ ok: true });
    userFindFirst.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  function setupRequest() {
    return new NextRequest("http://localhost/api/access/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stripeSecretKey: "sk_test_owner_only_123" }),
    });
  }

  it("refuse si requireOrg échoue (ADMIN / non-OWNER)", async () => {
    requireOrg.mockResolvedValue(null);
    const { POST } = await import("@/app/api/access/setup/route");
    const res = await POST(setupRequest());
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
    expect(bootstrapOrgStripe).not.toHaveBeenCalled();
    expect(requireOrg).toHaveBeenCalledWith({ minRole: "OWNER" });
  });

  it("refuse OWNER sans MFA", async () => {
    requireOrg.mockResolvedValue({
      userId: "owner-1",
      organizationId: "org-1",
      orgRole: "OWNER",
    });
    userFindFirst.mockResolvedValue({ totpEnabled: false });

    const { POST } = await import("@/app/api/access/setup/route");
    const res = await POST(setupRequest());
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBeTruthy();
    expect(bootstrapOrgStripe).not.toHaveBeenCalled();
  });

  it("accepte OWNER avec MFA activée", async () => {
    requireOrg.mockResolvedValue({
      userId: "owner-1",
      organizationId: "org-1",
      orgRole: "OWNER",
    });
    userFindFirst.mockResolvedValue({ totpEnabled: true });
    getOrgSubscription.mockResolvedValue({
      plan: "STARTER",
      status: "ACTIVE",
    });
    canUseProduct.mockReturnValue({ ok: true });
    bootstrapOrgStripe.mockResolvedValue({
      webhookUrl: "https://example.com/hook",
      createdWebhook: true,
    });

    const { POST } = await import("@/app/api/access/setup/route");
    const res = await POST(setupRequest());
    expect(res.status).toBe(200);
    expect(requireOrg).toHaveBeenCalledWith({ minRole: "OWNER" });
    expect(bootstrapOrgStripe).toHaveBeenCalled();
  });
});

describe("PUT /api/access/stripe-config — secrets formation OWNER only", () => {
  beforeEach(() => {
    requireOrg.mockReset();
    rateLimitOk.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("refuse si requireOrg échoue (ADMIN / non-OWNER)", async () => {
    requireOrg.mockResolvedValue(null);
    const { PUT } = await import("@/app/api/access/stripe-config/route");
    const req = new NextRequest("http://localhost/api/access/stripe-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhookSecret: "whsec_test",
        stripeSecretKey: "sk_test_abc",
      }),
    });
    const res = await PUT(req);
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
    expect(requireOrg).toHaveBeenCalledWith({ minRole: "OWNER" });
  });
});
