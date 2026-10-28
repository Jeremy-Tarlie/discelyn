import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const VALID_TOKEN = "validToken12";

const {
  rateLimitOk,
  learnerAccessFindFirst,
  fulfillDiscordAccess,
  fetchMock,
} = vi.hoisted(() => ({
  rateLimitOk: vi.fn(),
  learnerAccessFindFirst: vi.fn(),
  fulfillDiscordAccess: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => rateLimitOk(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    learnerAccess: {
      findFirst: (...args: unknown[]) => learnerAccessFindFirst(...args),
    },
  },
}));

vi.mock("@/lib/learner-access", () => ({
  appBaseUrl: () => "http://localhost:3000",
  fulfillDiscordAccess: (...args: unknown[]) => fulfillDiscordAccess(...args),
}));

describe("GET /api/access/claim/callback", () => {
  const envBackup = {
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
  };

  beforeEach(() => {
    rateLimitOk.mockReset();
    learnerAccessFindFirst.mockReset();
    fulfillDiscordAccess.mockReset();
    fetchMock.mockReset();
    rateLimitOk.mockResolvedValue({ ok: true });
    process.env.DISCORD_CLIENT_ID = "discord-client-id";
    process.env.DISCORD_CLIENT_SECRET = "discord-client-secret";
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    if (envBackup.DISCORD_CLIENT_ID === undefined) {
      delete process.env.DISCORD_CLIENT_ID;
    } else {
      process.env.DISCORD_CLIENT_ID = envBackup.DISCORD_CLIENT_ID;
    }
    if (envBackup.DISCORD_CLIENT_SECRET === undefined) {
      delete process.env.DISCORD_CLIENT_SECRET;
    } else {
      process.env.DISCORD_CLIENT_SECRET = envBackup.DISCORD_CLIENT_SECRET;
    }
  });

  function callbackRequest(query: Record<string, string>) {
    const url = new URL("http://localhost/api/access/claim/callback");
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
    return new NextRequest(url);
  }

  function mockDiscordOAuth(discordUserId: string) {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "oauth-access-token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: discordUserId }),
      });
  }

  it("redirige vers error=oauth si le code OAuth est absent", async () => {
    const { GET } = await import("@/app/api/access/claim/callback/route");
    const res = await GET(
      callbackRequest({ state: VALID_TOKEN, error: "access_denied" })
    );
    expect(res.status).toBe(307);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("/claim/");
    expect(loc).toContain("error=oauth");
    expect(learnerAccessFindFirst).not.toHaveBeenCalled();
  });

  it("redirige vers error=invalid si le claim token est inconnu", async () => {
    learnerAccessFindFirst.mockResolvedValue(null);
    const { GET } = await import("@/app/api/access/claim/callback/route");
    const res = await GET(
      callbackRequest({ code: "oauth-code", state: VALID_TOKEN })
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("error=invalid");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirige vers ok=active après OAuth Discord et grant ACTIVE", async () => {
    learnerAccessFindFirst.mockResolvedValue({
      id: "access-claim-1",
      claimToken: VALID_TOKEN,
    });
    mockDiscordOAuth("987654321012345678");
    fulfillDiscordAccess.mockResolvedValue({ status: "ACTIVE" as const });

    const { GET } = await import("@/app/api/access/claim/callback/route");
    const res = await GET(
      callbackRequest({ code: "oauth-code-xyz", state: VALID_TOKEN })
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("ok=active");
    expect(fulfillDiscordAccess).toHaveBeenCalledWith(
      "access-claim-1",
      "987654321012345678"
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://discord.com/api/oauth2/token"
    );
  });

  it("redirige vers ok=join si le grant reste AWAITING_JOIN", async () => {
    learnerAccessFindFirst.mockResolvedValue({
      id: "access-join-1",
      claimToken: VALID_TOKEN,
    });
    mockDiscordOAuth("111222333444555666");
    fulfillDiscordAccess.mockResolvedValue({ status: "AWAITING_JOIN" as const });

    const { GET } = await import("@/app/api/access/claim/callback/route");
    const res = await GET(
      callbackRequest({ code: "oauth-code-join", state: VALID_TOKEN })
    );

    expect(res.headers.get("location")).toContain("ok=join");
  });
});
