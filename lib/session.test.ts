import { describe, expect, it } from "vitest";
import { hasSessionCookie } from "@/lib/session";
import type { NextRequest } from "next/server";

function fakeRequest(cookies: Record<string, string>): NextRequest {
  return {
    cookies: {
      get(name: string) {
        const value = cookies[name];
        return value ? { name, value } : undefined;
      },
    },
  } as NextRequest;
}

describe("hasSessionCookie", () => {
  it("détecte le cookie session standard", () => {
    expect(
      hasSessionCookie(fakeRequest({ "next-auth.session-token": "abc" }))
    ).toBe(true);
  });

  it("détecte le cookie secure", () => {
    expect(
      hasSessionCookie(
        fakeRequest({ "__Secure-next-auth.session-token": "abc" })
      )
    ).toBe(true);
  });

  it("retourne false sans cookie", () => {
    expect(hasSessionCookie(fakeRequest({}))).toBe(false);
  });
});
