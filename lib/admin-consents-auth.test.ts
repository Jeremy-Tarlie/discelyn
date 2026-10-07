import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

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

vi.mock("next-auth", () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: "u1", email: "other@example.com" },
  }),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true }),
}));

describe("GET /api/admin/consents auth", () => {
  const prevDiscord = process.env.LEADS_ADMIN_DISCORD_IDS;
  const prevEmail = process.env.LEADS_ADMIN_EMAILS;

  beforeEach(() => {
    process.env.LEADS_ADMIN_DISCORD_IDS = "111";
    delete process.env.LEADS_ADMIN_EMAILS;
    vi.resetModules();
  });

  afterEach(() => {
    if (prevDiscord === undefined) delete process.env.LEADS_ADMIN_DISCORD_IDS;
    else process.env.LEADS_ADMIN_DISCORD_IDS = prevDiscord;
    if (prevEmail === undefined) delete process.env.LEADS_ADMIN_EMAILS;
    else process.env.LEADS_ADMIN_EMAILS = prevEmail;
  });

  it("renvoie 403 si hors allowlist admin", async () => {
    const { GET } = await import("@/app/api/admin/consents/route");
    const req = new NextRequest("http://localhost/api/admin/consents");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });
});
