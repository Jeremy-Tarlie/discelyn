import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isLeadsAdmin } from "@/lib/leads-admin";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "admin-consents",
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: tApi(locale, "unauthenticated") },
      { status: 401 }
    );
  }

  const dbUser = await prisma.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { discordId: true, email: true },
  });
  if (
    !isLeadsAdmin({
      email: session.user.email ?? dbUser?.email,
      discordId: dbUser?.discordId,
    })
  ) {
    return NextResponse.json(
      { error: tApi(locale, "unauthorized") },
      { status: 403 }
    );
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
