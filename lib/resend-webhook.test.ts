import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const emailEventCreate = vi.fn();
const userUpdateMany = vi.fn();
const leadUpdateMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailEvent: { create: (...args: unknown[]) => emailEventCreate(...args) },
    user: { updateMany: (...args: unknown[]) => userUpdateMany(...args) },
    lead: { updateMany: (...args: unknown[]) => leadUpdateMany(...args) },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/demo", () => ({
  getAppEnvironment: () => "development",
}));

describe("POST /api/webhooks/resend", () => {
  const prevSecret = process.env.RESEND_WEBHOOK_SECRET;

  beforeEach(() => {
    emailEventCreate.mockReset().mockResolvedValue({});
    userUpdateMany.mockReset().mockResolvedValue({ count: 1 });
    leadUpdateMany.mockReset().mockResolvedValue({ count: 1 });
    delete process.env.RESEND_WEBHOOK_SECRET;
    vi.resetModules();
  });

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
    else process.env.RESEND_WEBHOOK_SECRET = prevSecret;
  });

  it("accepte sans secret en development", async () => {
    const { POST } = await import("@/app/api/webhooks/resend/route");
    const req = new NextRequest("http://localhost/api/webhooks/resend", {
      method: "POST",
      body: JSON.stringify({
        type: "email.opened",
        data: { to: "a@ex.com", email_id: "re_1" },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(emailEventCreate).toHaveBeenCalled();
  });

  it("refuse signature Bearer invalide si secret défini", async () => {
    process.env.RESEND_WEBHOOK_SECRET = "s3cret";
    const { POST } = await import("@/app/api/webhooks/resend/route");
    const req = new NextRequest("http://localhost/api/webhooks/resend", {
      method: "POST",
      headers: { authorization: "Bearer wrong" },
      body: JSON.stringify({
        type: "email.opened",
        data: { to: "a@ex.com" },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("révoque le consentement marketing sur complained", async () => {
    process.env.RESEND_WEBHOOK_SECRET = "s3cret";
    const { POST } = await import("@/app/api/webhooks/resend/route");
    const req = new NextRequest("http://localhost/api/webhooks/resend", {
      method: "POST",
      headers: { "x-resend-secret": "s3cret" },
      body: JSON.stringify({
        type: "email.complained",
        data: { to: "Victim@Ex.com" },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(userUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "victim@ex.com", deletedAt: null },
        data: { marketingConsentAt: null },
      }),
    );
    expect(leadUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "victim@ex.com" },
        data: { marketingConsentAt: null },
      }),
    );
  });
});
