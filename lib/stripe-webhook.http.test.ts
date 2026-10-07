import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const constructEvent = vi.fn();
const claimStripeEvent = vi.fn();
const releaseStripeEventClaim = vi.fn();

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent },
    subscriptions: { retrieve: vi.fn() },
  }),
}));

vi.mock("@/lib/stripe-idempotency", () => ({
  claimStripeEvent: (...args: unknown[]) => claimStripeEvent(...args),
  releaseStripeEventClaim: (...args: unknown[]) =>
    releaseStripeEventClaim(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: { findFirst: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    organizationMembership: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/plan-enforcement", () => ({
  enforcePlanLimits: vi.fn(),
}));

vi.mock("@/lib/runtime-notify", () => ({
  notifyRuntimeReload: vi.fn(),
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

describe("POST /api/stripe/webhook HTTP", () => {
  const prevSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_smoke";
    constructEvent.mockReset();
    claimStripeEvent.mockReset();
    releaseStripeEventClaim.mockReset();
  });

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = prevSecret;
    vi.resetModules();
  });

  it("400 sans signature / secret", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("400 si constructEvent échoue", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad sig");
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=x" },
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("200 duplicate si claim refuse", async () => {
    constructEvent.mockReturnValue({
      id: "evt_1",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", metadata: {}, items: { data: [] } } },
    });
    claimStripeEvent.mockResolvedValue(false);

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=x" },
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { duplicate?: boolean };
    expect(body.duplicate).toBe(true);
  });
});
