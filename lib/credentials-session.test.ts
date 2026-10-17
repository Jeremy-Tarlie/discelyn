import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    session: { create: vi.fn() },
  },
}));

import {
  isSecureSessionCookie,
  parsePlanIntentCookie,
  resolvePostAuthRedirect,
  serializePlanIntent,
  sessionCookieName,
} from "@/lib/credentials-session";

describe("credentials-session cookies", () => {
  const prevUrl = process.env.NEXTAUTH_URL;
  const prevAuthUrl = process.env.AUTH_URL;
  const prevEnv = process.env.APP_ENV;

  afterEach(() => {
    if (prevUrl === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = prevUrl;
    if (prevAuthUrl === undefined) delete process.env.AUTH_URL;
    else process.env.AUTH_URL = prevAuthUrl;
    if (prevEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = prevEnv;
  });

  it("choisit le nom cookie next-auth selon HTTPS / prod", () => {
    process.env.APP_ENV = "development";
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    delete process.env.AUTH_URL;
    expect(sessionCookieName()).toBe("next-auth.session-token");
    expect(isSecureSessionCookie()).toBe(false);

    process.env.AUTH_URL = "https://app.example.com";
    expect(sessionCookieName()).toBe("__Secure-next-auth.session-token");
    expect(isSecureSessionCookie()).toBe(true);
  });

  it("parse / serialize plan intent", () => {
    expect(serializePlanIntent({ plan: "OPS", interval: "year" })).toBe(
      "OPS:year"
    );
    expect(parsePlanIntentCookie("STARTER:month")).toEqual({
      plan: "STARTER",
      interval: "month",
    });
    expect(parsePlanIntentCookie("FREE:month")).toEqual({
      plan: "FREE",
      interval: "month",
    });
    expect(parsePlanIntentCookie("GOLD:month")).toBeNull();
  });

  it("resolvePostAuthRedirect", () => {
    expect(resolvePostAuthRedirect(null)).toBe("/dashboard");
    expect(resolvePostAuthRedirect({ plan: "FREE", interval: "month" })).toBe(
      "/dashboard"
    );
    expect(
      resolvePostAuthRedirect({ plan: "STARTER", interval: "year" })
    ).toBe("/subscribe?plan=STARTER&interval=year");
  });
});
