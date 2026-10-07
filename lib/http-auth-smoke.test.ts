import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@/lib/data-retention", () => ({
  purgeExpiredAnalyticsEvents: vi.fn().mockResolvedValue(0),
  purgeExpiredLeads: vi.fn().mockResolvedValue(0),
  purgeExpiredCookieConsents: vi.fn().mockResolvedValue(0),
  anonymizeExpiredLearnerPii: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/learner-access", () => ({
  grantPendingOnJoin: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true }),
}));

describe("cron retention + internal learner-join auth smoke", () => {
  const prevCron = process.env.CRON_SECRET;
  const prevRuntime = process.env.BOT_RUNTIME_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "smoke-cron-secret";
    process.env.BOT_RUNTIME_SECRET = "smoke-runtime-secret";
  });

  afterEach(() => {
    if (prevCron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevCron;
    if (prevRuntime === undefined) delete process.env.BOT_RUNTIME_SECRET;
    else process.env.BOT_RUNTIME_SECRET = prevRuntime;
    vi.resetModules();
  });

  it("POST /api/cron/retention → 401 sans Bearer", async () => {
    const { POST } = await import("@/app/api/cron/retention/route");
    const req = new NextRequest("http://localhost/api/cron/retention", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("POST /api/internal/learner-join → 401 sans Bearer", async () => {
    const { POST } = await import("@/app/api/internal/learner-join/route");
    const req = new NextRequest("http://localhost/api/internal/learner-join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        guildId: "111111111111111111",
        discordUserId: "222222222222222222",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
