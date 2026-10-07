import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireOrg } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/locale";
import { tApi } from "@/lib/i18n-api";
import { ownerHasMfaEnabled } from "@/lib/mfa-guards";
import { deniedAuthResponse } from "@/lib/http-auth";

export const runtime = "nodejs";

const addMemberSchema = z.object({
  discordId: z.string().regex(/^\d{17,20}$/),
  role: z.enum(["ADMIN", "MEMBER"]),
});

export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const org = await requireOrg({ minRole: "MEMBER" });
  if (!org) {
    return deniedAuthResponse(locale, "unauthorized");
  }

  const members = await prisma.organizationMembership.findMany({
    where: { organizationId: org.organizationId },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          discordId: true,
          deletedAt: true,
        },
      },
    },
  });

  return NextResponse.json({
    members: members
      .filter((m) => m.user.deletedAt === null)
      .map((m) => ({
        id: m.id,
        role: m.role,
        createdAt: m.createdAt.toISOString(),
        user: {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image,
          discordId: m.user.discordId,
        },
      })),
  });
}

export async function POST(request: NextRequest) {
  const locale = getRequestLocale(request);
  const org = await requireOrg({ minRole: "OWNER" });
  if (!org) {
    return deniedAuthResponse(locale, "unauthorized");
  }

  if (!(await ownerHasMfaEnabled(org.userId))) {
    return NextResponse.json(
      { error: tApi(locale, "mfaRequiredForOwner") },
      { status: 403 }
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const target = await prisma.user.findFirst({
    where: { discordId: parsed.data.discordId, deletedAt: null },
    select: { id: true, name: true, email: true, image: true, discordId: true },
  });
  if (!target) {
    return NextResponse.json(
      { error: "Aucun compte Discelyn avec cet ID Discord." },
      { status: 404 }
    );
  }

  if (target.id === org.userId) {
    return NextResponse.json(
      { error: "Vous êtes déjà membre." },
      { status: 400 }
    );
  }

  const existing = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: org.organizationId,
        userId: target.id,
      },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Déjà membre de l’organisation." },
      { status: 409 }
    );
  }

  const membership = await prisma.organizationMembership.create({
    data: {
      organizationId: org.organizationId,
      userId: target.id,
      role: parsed.data.role,
    },
    select: {
      id: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    {
      member: {
        id: membership.id,
        role: membership.role,
        createdAt: membership.createdAt.toISOString(),
        user: target,
      },
    },
    { status: 201 }
  );
}

export async function DELETE(request: NextRequest) {
  const locale = getRequestLocale(request);
  const org = await requireOrg({ minRole: "OWNER" });
  if (!org) {
    return deniedAuthResponse(locale, "unauthorized");
  }

  if (!(await ownerHasMfaEnabled(org.userId))) {
    return NextResponse.json(
      { error: tApi(locale, "mfaRequiredForOwner") },
      { status: 403 }
    );
  }

  const membershipId = request.nextUrl.searchParams.get("id");
  if (!membershipId) {
    return NextResponse.json(
      { error: tApi(locale, "invalidData") },
      { status: 400 }
    );
  }

  const membership = await prisma.organizationMembership.findFirst({
    where: { id: membershipId, organizationId: org.organizationId },
  });
  if (!membership) {
    return NextResponse.json(
      { error: tApi(locale, "accountNotFound") },
      { status: 404 }
    );
  }

  if (membership.role === "OWNER") {
    const ownerCount = await prisma.organizationMembership.count({
      where: { organizationId: org.organizationId, role: "OWNER" },
    });
    if (ownerCount <= 1) {
      return NextResponse.json(
        { error: "Impossible de retirer le dernier OWNER." },
        { status: 400 }
      );
    }
  }

  await prisma.organizationMembership.delete({
    where: { id: membership.id },
  });

  return NextResponse.json({ ok: true });
}
