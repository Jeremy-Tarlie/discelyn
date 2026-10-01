import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/access";
import { listUserActivity } from "@/lib/activity-log";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { prisma } from "@/lib/prisma";
import { formatInTimezone } from "@/lib/timezones";

export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const user = await requireUser();
  if (!user) {
    return NextResponse.json(
      { error: tApi(locale, "unauthenticated") },
      { status: 401 }
    );
  }

  const dbUser = await prisma.user.findFirst({
    where: { id: user.id, deletedAt: null },
    select: { timezone: true },
  });
  const timezone = dbUser?.timezone ?? "Europe/Paris";
  const dateLocale = locale === "en" ? "en-GB" : "fr-FR";

  const rows = await listUserActivity(user.id, 40);
  return NextResponse.json({
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      meta: row.meta,
      createdAt: row.createdAt.toISOString(),
      createdAtLabel: formatInTimezone(row.createdAt, timezone, dateLocale),
    })),
  });
}
