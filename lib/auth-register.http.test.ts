import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";
import { passwordSchema } from "@/lib/password-policy";

const { registerCredentialsUser, rateLimitOk } = vi.hoisted(() => ({
  registerCredentialsUser: vi.fn(),
  rateLimitOk: vi.fn(),
}));

vi.mock("@/lib/auth-credentials", () => ({
  registerBodySchema: z.object({
    email: z.string().email().max(254),
    password: passwordSchema,
    name: z.string().trim().min(1).max(80).optional(),
    plan: z.enum(["FREE", "STARTER", "OPS", "SCALE"]),
    interval: z.enum(["month", "year"]).default("month"),
  }),
  registerCredentialsUser: (...args: unknown[]) =>
    registerCredentialsUser(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimitOk(...args),
}));

vi.mock("@/lib/locale", () => ({
  getRequestLocale: () => "fr",
}));

vi.mock("@/lib/credentials-session", () => ({
  setPlanIntentCookieOnResponse: (
    response: { cookies: { set: (name: string, value: string) => void } },
    intent: { plan: string; interval: string }
  ) => {
    response.cookies.set(
      "discelyn_plan_intent",
      `${intent.plan}:${intent.interval}`
    );
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@/lib/auth-timing", () => ({
  AUTH_OPAQUE_FLOOR_MS: 0,
  withOpaqueTimingFloor: async <T>(work: () => Promise<T>) => work(),
}));

vi.mock("@/lib/auth-timing", () => ({
  AUTH_OPAQUE_FLOOR_MS: 0,
  withOpaqueTimingFloor: async <T>(work: () => Promise<T>) => work(),
}));

describe("POST /api/auth/register HTTP anti-enum", () => {
  beforeEach(() => {
    registerCredentialsUser.mockReset();
    rateLimitOk.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.resetModules();
  });

  function registerRequest() {
    return new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "a@example.com",
        password: "Correct-horse1!",
        plan: "FREE",
        interval: "month",
      }),
    });
  }

  async function assertOpaqueSuccessWithPlanCookie(
    mockResult:
      | { ok: true; intent: { plan: "FREE"; interval: "month" } }
      | { ok: false; code: "email_taken" }
      | {
          ok: false;
          code: "mail_failed";
          intent: { plan: "FREE"; interval: "month" };
        }
  ) {
    registerCredentialsUser.mockResolvedValue(mockResult);
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(registerRequest());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      needsVerification: boolean;
    };
    expect(body).toEqual({ ok: true, needsVerification: true });
    const setCookie = res.headers.getSetCookie?.() ?? [];
    const cookieHeader =
      setCookie.length > 0
        ? setCookie.join(";")
        : (res.headers.get("set-cookie") ?? "");
    expect(cookieHeader).toMatch(/discelyn_plan_intent=/);
    expect(cookieHeader).toMatch(/FREE/);
  }

  it("email libre → JSON opaque + cookie plan_intent", async () => {
    await assertOpaqueSuccessWithPlanCookie({
      ok: true,
      intent: { plan: "FREE", interval: "month" },
    });
  });

  it("email_taken → même JSON + même cookie plan_intent", async () => {
    await assertOpaqueSuccessWithPlanCookie({
      ok: false,
      code: "email_taken",
    });
  });

  it("mail_failed → même JSON + cookie plan_intent", async () => {
    await assertOpaqueSuccessWithPlanCookie({
      ok: false,
      code: "mail_failed",
      intent: { plan: "FREE", interval: "month" },
    });
  });
});
