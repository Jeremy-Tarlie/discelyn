import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { isAppTimezone, TIMEZONE_OPTIONS } from "@/lib/timezones";
import { logUserActivity } from "@/lib/activity-log";
import { deniedAuthResponse } from "@/lib/http-auth";

const prefsSchema = z.object({
  timezone: z
    .string()
    .refine(isAppTimezone, { message: "invalid_timezone" })
    .optional(),
  notifyBillingEmail: z.boolean().optional(),
  notifySecurityEmail: z.boolean().optional(),
  notifyProductEmail: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const user = await requireUser();
  if (!user) {
    return deniedAuthResponse(locale);
  }

  const row = await prisma.user.findFirst({
    where: { id: user.id, deletedAt: null },
    select: {
      timezone: true,
      notifyBillingEmail: true,
      notifySecurityEmail: true,
      notifyProductEmail: true,
    },
  });
  if (!row) {
    return NextResponse.json(
      { error: tApi(locale, "unauthenticated") },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ...row,
    timezones: TIMEZONE_OPTIONS,
  });
}

export async function PATCH(request: NextRequest) {
  const locale = getRequestLocale(request);
  const limited = await rateLimit(request, {
    namespace: "account-prefs",
    limit: 20,
    windowMs: 60_000,
  });
  if (!limited.ok) return limited.response;

  const user = await requireUser();
  if (!user) {
    return deniedAuthResponse(locale);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: tApi(locale, "invalidJson") },
      { status: 400 }
    );
  }

  const parsed = prefsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: tApi(locale, "invalidPrefs") },
      { status: 400 }
    );
  }

  const data = parsed.data;
  if (
    data.timezone === undefined &&
    data.notifyBillingEmail === undefined &&
    data.notifySecurityEmail === undefined &&
    data.notifyProductEmail === undefined
  ) {
    return NextResponse.json(
      { error: tApi(locale, "invalidPrefs") },
      { status: 400 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
      ...(data.notifyBillingEmail !== undefined
        ? { notifyBillingEmail: data.notifyBillingEmail }
        : {}),
      ...(data.notifySecurityEmail !== undefined
        ? { notifySecurityEmail: data.notifySecurityEmail }
        : {}),
      ...(data.notifyProductEmail !== undefined
        ? { notifyProductEmail: data.notifyProductEmail }
        : {}),
    },
    select: {
      timezone: true,
      notifyBillingEmail: true,
      notifySecurityEmail: true,
      notifyProductEmail: true,
    },
  });

  await logUserActivity({
    userId: user.id,
    action: "prefs_updated",
    meta: {
      timezone: data.timezone ?? null,
      notifyBillingEmail: data.notifyBillingEmail ?? null,
      notifySecurityEmail: data.notifySecurityEmail ?? null,
      notifyProductEmail: data.notifyProductEmail ?? null,
    },
  });

  return NextResponse.json({ ok: true, prefs: updated });
}
