import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const requirePlatformAdmin = vi.fn();
const deniedAuthResponse = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cookieConsentLog: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("@/lib/platform-admin", () => ({
  requirePlatformAdmin: (...args: []) => requirePlatformAdmin(...args),
}));

vi.mock("@/lib/http-auth", () => ({
  deniedAuthResponse: (...args: []) => deniedAuthResponse(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/locale", () => ({
  getRequestLocale: () => "fr",
}));

describe("GET /api/admin/consents auth", () => {
  beforeEach(() => {
    requirePlatformAdmin.mockReset();
    deniedAuthResponse.mockReset();
    deniedAuthResponse.mockResolvedValue(
      new Response(JSON.stringify({ code: "unauthenticated" }), { status: 401 }),
    );
    vi.resetModules();
  });

  it("renvoie 401 si challenge MFA / session absente", async () => {
    requirePlatformAdmin.mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/consents/route");
    const req = new NextRequest("http://localhost/api/admin/consents");
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(deniedAuthResponse).toHaveBeenCalled();
  });

  it("renvoie 403 via deniedAuthResponse si hors allowlist", async () => {
    requirePlatformAdmin.mockResolvedValue(null);
    deniedAuthResponse.mockResolvedValue(
      new Response(JSON.stringify({ code: "unauthorized" }), { status: 403 }),
    );
    const { GET } = await import("@/app/api/admin/consents/route");
    const req = new NextRequest("http://localhost/api/admin/consents");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });
});
