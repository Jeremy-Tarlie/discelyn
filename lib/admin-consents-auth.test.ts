import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const requireUser = vi.fn();
const deniedAuthResponse = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: vi.fn().mockResolvedValue({
        discordId: "999",
        email: "other@example.com",
      }),
    },
    cookieConsentLog: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/access", () => ({
  requireUser: (...args: unknown[]) => requireUser(...args),
}));

vi.mock("@/lib/http-auth", () => ({
  deniedAuthResponse: (...args: unknown[]) => deniedAuthResponse(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/locale", () => ({
  getRequestLocale: () => "fr",
}));

vi.mock("@/lib/i18n-api", () => ({
  tApi: (_locale: string, key: string) => key,
}));

describe("GET /api/admin/consents auth", () => {
  const prevDiscord = process.env.LEADS_ADMIN_DISCORD_IDS;
  const prevEmail = process.env.LEADS_ADMIN_EMAILS;

  beforeEach(() => {
    process.env.LEADS_ADMIN_DISCORD_IDS = "111";
    delete process.env.LEADS_ADMIN_EMAILS;
    requireUser.mockReset();
    deniedAuthResponse.mockReset();
    requireUser.mockResolvedValue({
      id: "u1",
      email: "other@example.com",
    });
    deniedAuthResponse.mockResolvedValue(
      new Response(JSON.stringify({ code: "unauthenticated" }), { status: 401 })
    );
    vi.resetModules();
  });

  afterEach(() => {
    if (prevDiscord === undefined) delete process.env.LEADS_ADMIN_DISCORD_IDS;
    else process.env.LEADS_ADMIN_DISCORD_IDS = prevDiscord;
    if (prevEmail === undefined) delete process.env.LEADS_ADMIN_EMAILS;
    else process.env.LEADS_ADMIN_EMAILS = prevEmail;
  });

  it("renvoie 401 si challenge MFA / session absente", async () => {
    requireUser.mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/consents/route");
    const req = new NextRequest("http://localhost/api/admin/consents");
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(deniedAuthResponse).toHaveBeenCalled();
  });

  it("renvoie 403 si hors allowlist admin", async () => {
    const { GET } = await import("@/app/api/admin/consents/route");
    const req = new NextRequest("http://localhost/api/admin/consents");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });
});
