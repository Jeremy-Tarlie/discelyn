import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { leadSchemaFor } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/analytics";
import { requireUser } from "@/lib/access";
import { isLeadsAdmin } from "@/lib/leads-admin";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";

export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "leads-list",
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: tApi(locale, "unauthorized") },
      { status: 403 }
    );
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { discordId: true },
  });

  if (
    !isLeadsAdmin({
      email: user.email,
      discordId: dbUser?.discordId,
    })
  ) {
    return NextResponse.json(
      { error: tApi(locale, "unauthorized") },
      { status: 403 }
    );
  }

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ leads });
}

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "leads",
    limit: 8,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: tApi(locale, "invalidJson") }, { status: 400 });
  }

  const parsed = leadSchemaFor(locale).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const lead = await prisma.lead.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      company: parsed.data.company,
      role: parsed.data.role,
      message: parsed.data.message,
      offer: parsed.data.offer,
      source: parsed.data.source ?? "landing",
      marketingConsentAt: new Date(),
    },
  });

  await trackEvent({
    name: "lead_submitted",
    path: "/api/leads",
    meta: {
      offer: parsed.data.offer ?? null,
      leadId: lead.id,
    },
  });

  return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
}
