import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/learner-access", () => ({
  appBaseUrl: () => "http://localhost:3000",
}));

import { claimPageUrl, sanitizeClaimToken } from "@/lib/claim-redirect";

describe("sanitizeClaimToken", () => {
  it("accepte tokens URL-safe", () => {
    expect(sanitizeClaimToken("abcDEF123_-xyz")).toBe("abcDEF123_-xyz");
  });

  it("refuse path traversal et charset invalide", () => {
    expect(sanitizeClaimToken("../etc/passwd")).toBeNull();
    expect(sanitizeClaimToken("..%2f..%2fetc")).toBeNull();
    expect(sanitizeClaimToken("a/b")).toBeNull();
    expect(sanitizeClaimToken("short")).toBeNull();
    expect(sanitizeClaimToken(null)).toBeNull();
  });
});

describe("claimPageUrl", () => {
  it("encode le token et fixe le path sous /claim/", () => {
    const url = claimPageUrl("validToken12", { error: "invalid" });
    expect(url.pathname).toBe("/claim/validToken12");
    expect(url.searchParams.get("error")).toBe("invalid");
  });

  it("ne laisse pas un token malveillant sortir de /claim/", () => {
    const url = claimPageUrl("../../etc/passwd", { error: "invalid" });
    expect(url.pathname).toBe("/claim/invalid");
    expect(url.pathname.startsWith("/claim/")).toBe(true);
  });
});
