import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";

const { verifyCredentialsEmail, rateLimitOk } = vi.hoisted(() => ({
  verifyCredentialsEmail: vi.fn(),
  rateLimitOk: vi.fn(),
}));

vi.mock("@/lib/auth-credentials", () => ({
  verifyEmailBodySchema: z.object({
    token: z.string().min(16).max(200),
  }),
  verifyCredentialsEmail: (...args: unknown[]) =>
    verifyCredentialsEmail(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimitOk(...args),
}));

vi.mock("@/lib/locale", () => ({
  getRequestLocale: () => "fr",
}));

vi.mock("@/lib/credentials-session", () => ({
  PLAN_INTENT_COOKIE: "discelyn_plan_intent",
  parsePlanIntentCookie: () => null,
  resolvePostAuthRedirect: () => "/dashboard",
  createDatabaseSessionForUser: vi.fn(async () => ({
    sessionToken: "tok",
    expires: new Date(Date.now() + 60_000),
  })),
  setSessionCookieOnResponse: vi.fn(),
  clearPlanIntentCookieOnResponse: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: vi.fn().mockResolvedValue({ totpEnabled: false }) },
  },
}));

vi.mock("@/lib/activity-log", () => ({
  logUserActivity: vi.fn(),
}));

describe("POST /api/auth/verify-email HTTP opaque", () => {
  beforeEach(() => {
    verifyCredentialsEmail.mockReset();
    rateLimitOk.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("token invalide → code invalid_token uniquement", async () => {
    verifyCredentialsEmail.mockResolvedValue({
      ok: false,
      code: "invalid_token",
    });
    const { POST } = await import("@/app/api/auth/verify-email/route");
    const req = new NextRequest("http://localhost/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "a".repeat(20) }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("invalid_token");
    expect(JSON.stringify(body)).not.toContain("already_verified");
  });
});
