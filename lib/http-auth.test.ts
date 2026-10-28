import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSession = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: () => getServerSession(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/mfa-session", () => ({
  userNeedsMfaChallenge: vi.fn(async () => false),
}));

import { userNeedsMfaChallenge } from "@/lib/mfa-session";
import { deniedAuthResponse } from "./http-auth";

describe("deniedAuthResponse", () => {
  beforeEach(() => {
    getServerSession.mockReset();
    vi.mocked(userNeedsMfaChallenge).mockReset();
    vi.mocked(userNeedsMfaChallenge).mockResolvedValue(false);
  });

  it("retourne 401 si pas de session", async () => {
    getServerSession.mockResolvedValue(null);
    const res = await deniedAuthResponse("fr");
    expect(res.status).toBe(401);
  });

  it("retourne 403 mfa_required si challenge MFA", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1" } });
    vi.mocked(userNeedsMfaChallenge).mockResolvedValue(true);
    const res = await deniedAuthResponse("fr");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("mfa_required");
  });

  it("retourne 403 unauthorized si session sans droit", async () => {
    getServerSession.mockResolvedValue({ user: { id: "u1" } });
    const res = await deniedAuthResponse("fr");
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("unauthorized");
  });
});
