import { describe, expect, it } from "vitest";
import { hasSessionCookie, getClientIp } from "@/lib/session";
import type { NextRequest } from "next/server";

function fakeRequest(input: {
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}): NextRequest {
  return {
    cookies: {
      get(name: string) {
        const value = input.cookies?.[name];
        return value ? { name, value } : undefined;
      },
    },
    headers: {
      get(name: string) {
        return input.headers?.[name.toLowerCase()] ?? null;
      },
    },
  } as NextRequest;
}

describe("hasSessionCookie", () => {
  it("détecte le cookie session standard", () => {
    expect(
      hasSessionCookie(
        fakeRequest({ cookies: { "next-auth.session-token": "a".repeat(16) } })
      )
    ).toBe(true);
  });

  it("détecte le cookie secure", () => {
    expect(
      hasSessionCookie(
        fakeRequest({
          cookies: { "__Secure-next-auth.session-token": "b".repeat(16) },
        })
      )
    ).toBe(true);
  });

  it("refuse un cookie trop court", () => {
    expect(
      hasSessionCookie(
        fakeRequest({ cookies: { "next-auth.session-token": "short" } })
      )
    ).toBe(false);
  });

  it("retourne false sans cookie", () => {
    expect(hasSessionCookie(fakeRequest({}))).toBe(false);
  });
});

describe("getClientIp", () => {
  it("ignore x-forwarded-for sans TRUST_PROXY", () => {
    const previous = process.env.TRUST_PROXY;
    delete process.env.TRUST_PROXY;
    expect(
      getClientIp(
        fakeRequest({ headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } })
      )
    ).toBe("direct");
    process.env.TRUST_PROXY = previous;
  });

  it("préfère x-real-ip si TRUST_PROXY=1", () => {
    const previous = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = "1";
    expect(
      getClientIp(
        fakeRequest({
          headers: {
            "x-real-ip": "9.9.9.9",
            "x-forwarded-for": "1.2.3.4, 5.6.7.8",
          },
        })
      )
    ).toBe("9.9.9.9");
    process.env.TRUST_PROXY = previous;
  });

  it("prend le dernier hop de x-forwarded-for si TRUST_PROXY=1", () => {
    const previous = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = "1";
    expect(
      getClientIp(
        fakeRequest({ headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } })
      )
    ).toBe("5.6.7.8");
    process.env.TRUST_PROXY = previous;
  });
});
