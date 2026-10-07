import { describe, expect, it, vi, beforeEach } from "vitest";

const getServerSession = vi.fn();
const userNeedsMfaChallenge = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/mfa-session", () => ({
  userNeedsMfaChallenge: (...args: unknown[]) =>
    userNeedsMfaChallenge(...args),
}));

describe("deniedAuthResponse", () => {
  beforeEach(() => {
    getServerSession.mockReset();
    userNeedsMfaChallenge.mockReset();
  });

  it("renvoie 403 mfa_required si challenge MFA en attente", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1" } });
    userNeedsMfaChallenge.mockResolvedValue(true);

    const { deniedAuthResponse } = await import("@/lib/http-auth");
    const res = await deniedAuthResponse("fr");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("mfa_required");
  });

  it("renvoie 401 si non authentifié", async () => {
    getServerSession.mockResolvedValue(null);
    const { deniedAuthResponse } = await import("@/lib/http-auth");
    const res = await deniedAuthResponse("fr");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("unauthenticated");
  });

  it("renvoie 403 unauthorized si session OK mais accès refusé", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1" } });
    userNeedsMfaChallenge.mockResolvedValue(false);

    const { deniedAuthResponse } = await import("@/lib/http-auth");
    const res = await deniedAuthResponse("fr");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("unauthorized");
  });
});
