import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { enqueueCampaign } from "@/lib/admin-campaigns";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { deniedAuthResponse } from "@/lib/http-auth";

const createSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  bodyText: z.string().trim().min(10).max(20_000),
  audience: z.enum(["leads", "customers", "both"]),
});

export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "admin-campaigns",
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const admin = await requirePlatformAdmin();
  if (!admin) return deniedAuthResponse(locale);

  const campaigns = await prisma.marketingCampaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      subject: true,
      audience: true,
      status: true,
      sentCount: true,
      createdAt: true,
      sentAt: true,
    },
  });

  return NextResponse.json({ campaigns });
}

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "admin-campaigns-write",
    limit: 5,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const admin = await requirePlatformAdmin();
  if (!admin) return deniedAuthResponse(locale);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: tApi(locale, "invalidData") },
      { status: 400 },
    );
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: tApi(locale, "invalidData") },
      { status: 400 },
    );
  }

  const result = await enqueueCampaign({
    ...parsed.data,
    createdById: admin.id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result, { status: 202 });
}
