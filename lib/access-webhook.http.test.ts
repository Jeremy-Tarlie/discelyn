import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const findUnique = vi.fn();
const constructEvent = vi.fn();
const claimStripeEvent = vi.fn();
const releaseStripeEventClaim = vi.fn();
const requireUnsealSecret = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    orgStripeConfig: { findUnique: (...args: unknown[]) => findUnique(...args) },
  },
}));

vi.mock("@/lib/token-crypto", () => ({
  requireUnsealSecret: (...args: unknown[]) => requireUnsealSecret(...args),
}));

vi.mock("@/lib/stripe-idempotency", () => {
  class StripeWebhookPermanentIgnore extends Error {
    reason: string;
    constructor(reason: string) {
      super(reason);
      this.reason = reason;
    }
  }
  class StripeWebhookRetryableError extends Error {}
  return {
    claimStripeEvent: (...args: unknown[]) => claimStripeEvent(...args),
    releaseStripeEventClaim: (...args: unknown[]) =>
      releaseStripeEventClaim(...args),
    StripeWebhookPermanentIgnore,
    StripeWebhookRetryableError,
  };
});

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/money-path-sentry", () => ({
  captureMoneyPathError: vi.fn(),
}));

vi.mock("@/lib/learner-access", () => ({
  openLearnerAccessFromCheckout: vi.fn(),
  recordSubscriptionEvent: vi.fn(),
  revokeByPaymentIntentId: vi.fn(),
  revokeBySubscriptionId: vi.fn(),
  syncLearnerBillingStatus: vi.fn(),
  syncLearnerLastPayment: vi.fn(),
}));

vi.mock("stripe", () => {
  class StripeMock {
    webhooks = { constructEvent };
    static create = undefined;
  }
  return { default: StripeMock };
});

describe("POST /api/access/webhook/[token] HTTP", () => {
  beforeEach(() => {
    findUnique.mockReset();
    constructEvent.mockReset();
    claimStripeEvent.mockReset();
    releaseStripeEventClaim.mockReset();
    requireUnsealSecret.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("404 si token inconnu", async () => {
    findUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/access/webhook/[token]/route");
    const req = new NextRequest(
      "http://localhost/api/access/webhook/unknown",
      { method: "POST", body: "{}" }
    );
    const res = await POST(req, {
      params: Promise.resolve({ token: "unknown" }),
    });
    expect(res.status).toBe(404);
  });

  it("200 ignored si orga soft-deleted", async () => {
    findUnique.mockResolvedValue({
      webhookSecret: "enc:v1:x",
      stripeSecretKey: null,
      organizationId: "org1",
      organization: { deletedAt: new Date() },
    });
    const { POST } = await import("@/app/api/access/webhook/[token]/route");
    const req = new NextRequest(
      "http://localhost/api/access/webhook/tok",
      { method: "POST", body: "{}" }
    );
    const res = await POST(req, {
      params: Promise.resolve({ token: "tok" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ignored?: string };
    expect(body.ignored).toBe("org_deleted");
  });

  it("400 sans stripe-signature", async () => {
    findUnique.mockResolvedValue({
      webhookSecret: "enc:v1:x",
      stripeSecretKey: null,
      organizationId: "org1",
      organization: { deletedAt: null },
    });
    requireUnsealSecret.mockReturnValue("whsec_test");
    const { POST } = await import("@/app/api/access/webhook/[token]/route");
    const req = new NextRequest(
      "http://localhost/api/access/webhook/tok",
      { method: "POST", body: "{}" }
    );
    const res = await POST(req, {
      params: Promise.resolve({ token: "tok" }),
    });
    expect(res.status).toBe(400);
  });

  it("400 si signature invalide", async () => {
    findUnique.mockResolvedValue({
      webhookSecret: "enc:v1:x",
      stripeSecretKey: null,
      organizationId: "org1",
      organization: { deletedAt: null },
    });
    requireUnsealSecret.mockReturnValue("whsec_test");
    constructEvent.mockImplementation(() => {
      throw new Error("bad sig");
    });
    const { POST } = await import("@/app/api/access/webhook/[token]/route");
    const req = new NextRequest(
      "http://localhost/api/access/webhook/tok",
      {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=x" },
        body: "{}",
      }
    );
    const res = await POST(req, {
      params: Promise.resolve({ token: "tok" }),
    });
    expect(res.status).toBe(400);
  });

  it("200 duplicate si event déjà claim", async () => {
    findUnique.mockResolvedValue({
      webhookSecret: "enc:v1:x",
      stripeSecretKey: null,
      organizationId: "org1",
      organization: { deletedAt: null },
    });
    requireUnsealSecret.mockReturnValue("whsec_test");
    constructEvent.mockReturnValue({
      id: "evt_access_1",
      type: "ping",
      data: { object: {} },
    });
    claimStripeEvent.mockResolvedValue(false);

    const { POST } = await import("@/app/api/access/webhook/[token]/route");
    const req = new NextRequest(
      "http://localhost/api/access/webhook/tok",
      {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=x" },
        body: "{}",
      }
    );
    const res = await POST(req, {
      params: Promise.resolve({ token: "tok" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { duplicate?: boolean };
    expect(body.duplicate).toBe(true);
  });

  it("500 si unseal échoue", async () => {
    findUnique.mockResolvedValue({
      webhookSecret: "enc:v1:x",
      stripeSecretKey: null,
      organizationId: "org1",
      organization: { deletedAt: null },
    });
    requireUnsealSecret.mockImplementation(() => {
      throw new Error("bad key");
    });
    const { POST } = await import("@/app/api/access/webhook/[token]/route");
    const req = new NextRequest(
      "http://localhost/api/access/webhook/tok",
      {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=x" },
        body: "{}",
      }
    );
    const res = await POST(req, {
      params: Promise.resolve({ token: "tok" }),
    });
    expect(res.status).toBe(500);
  });
});
