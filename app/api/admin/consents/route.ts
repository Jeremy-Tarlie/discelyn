import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { deniedAuthResponse } from "@/lib/http-auth";

export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "admin-consents",
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const admin = await requirePlatformAdmin();
  if (!admin) {
    return deniedAuthResponse(locale);
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const take = Math.min(
    Number(request.nextUrl.searchParams.get("limit") ?? "50") || 50,
    100
  );

  const where =
    q.length === 0
      ? undefined
      : {
          OR: [
            { visitorId: { contains: q, mode: "insensitive" as const } },
            { userId: { contains: q, mode: "insensitive" as const } },
            {
              user: {
                OR: [
                  { email: { contains: q, mode: "insensitive" as const } },
                  { discordId: { contains: q, mode: "insensitive" as const } },
                  { name: { contains: q, mode: "insensitive" as const } },
                ],
              },
            },
          ],
        };

  const logs = await prisma.cookieConsentLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      visitorId: true,
      userId: true,
      choice: true,
      policyVersion: true,
      createdAt: true,
      user: {
        select: {
          email: true,
          discordId: true,
          name: true,
        },
      },
    },
  });

  return NextResponse.json({ logs });
}
