import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { requireOrg, listUserOrganizations } from "@/lib/org-access";
import { deniedAuthResponse } from "@/lib/http-auth";
import {
  ACTIVE_ORG_COOKIE,
  activeOrgCookieOptions,
} from "@/lib/active-org";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const bodySchema = z.object({
  organizationId: z.string().min(1).max(64),
});

/** Liste les orgs + org active (cookie / heuristique). */
export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const org = await requireOrg({ minRole: "MEMBER" });
  if (!org) return deniedAuthResponse(locale);

  const organizations = await listUserOrganizations(org.userId);
  return NextResponse.json({
    activeOrganizationId: org.organizationId,
    organizations,
  });
}

/** Définit l’organisation active (cookie httpOnly). */
export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const org = await requireOrg({ minRole: "MEMBER" });
  if (!org) return deniedAuthResponse(locale);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: tApi(locale, "invalidJson") },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const membership = await prisma.organizationMembership.findFirst({
    where: {
      userId: org.userId,
      organizationId: parsed.data.organizationId,
      organization: { deletedAt: null },
    },
    select: { organizationId: true, role: true },
  });
  if (!membership) {
    return NextResponse.json(
      { error: tApi(locale, "unauthorized"), code: "unauthorized" },
      { status: 403 }
    );
  }

  const jar = await cookies();
  jar.set(
    ACTIVE_ORG_COOKIE,
    membership.organizationId,
    activeOrgCookieOptions()
  );

  return NextResponse.json({
    ok: true,
    activeOrganizationId: membership.organizationId,
    orgRole: membership.role,
  });
}
