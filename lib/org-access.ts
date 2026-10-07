import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { OrgRole } from "@/generated/prisma/client";
import { orgRoleAtLeast } from "@/lib/org-role";
import { userNeedsMfaChallenge } from "@/lib/mfa-session";
import { ACTIVE_ORG_COOKIE, pickActiveMembership } from "@/lib/active-org";

export { orgRoleAtLeast } from "@/lib/org-role";

export type OrgContext = {
  userId: string;
  organizationId: string;
  orgRole: OrgRole;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export type RequireOrgOptions = {
  minRole?: OrgRole;
  /** Autorise l’accès avant challenge TOTP (ex. POST /api/account/mfa/verify). */
  allowUnverifiedMfa?: boolean;
};

async function readPreferredOrganizationId(): Promise<string | null> {
  try {
    const jar = await cookies();
    return jar.get(ACTIVE_ORG_COOKIE)?.value ?? null;
  } catch {
    // Hors request (tests / scripts) — pas de cookie.
    return null;
  }
}

/**
 * Résout l’organisation active de la session.
 * Priorité : cookie `discelyn_active_org` (membership valide) → OWNER → première membership.
 * Bloque si MFA activée et session non challengeée (sauf allowUnverifiedMfa).
 */
export async function requireOrg(
  options?: RequireOrgOptions
): Promise<OrgContext | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const active = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true },
  });
  if (!active) return null;

  if (
    !options?.allowUnverifiedMfa &&
    (await userNeedsMfaChallenge(userId))
  ) {
    return null;
  }

  const memberships = await prisma.organizationMembership.findMany({
    where: {
      userId,
      organization: { deletedAt: null },
    },
    orderBy: { createdAt: "asc" },
    select: {
      organizationId: true,
      role: true,
    },
  });
  if (memberships.length === 0) return null;

  const preferredOrgId = await readPreferredOrganizationId();
  const preferred = pickActiveMembership(memberships, preferredOrgId);
  if (!preferred) return null;

  const minRole = options?.minRole ?? "MEMBER";
  if (!orgRoleAtLeast(preferred.role, minRole)) return null;

  return {
    userId,
    organizationId: preferred.organizationId,
    orgRole: preferred.role,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  };
}

/** Liste les organisations accessibles (non soft-deleted) pour le switcher. */
export async function listUserOrganizations(userId: string): Promise<
  Array<{
    organizationId: string;
    name: string;
    role: OrgRole;
  }>
> {
  const rows = await prisma.organizationMembership.findMany({
    where: {
      userId,
      organization: { deletedAt: null },
    },
    orderBy: { createdAt: "asc" },
    select: {
      organizationId: true,
      role: true,
      organization: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    organizationId: r.organizationId,
    name: r.organization.name,
    role: r.role,
  }));
}

/** Crée une org + membership OWNER + abonnement FREE pour un nouvel utilisateur. */
export async function bootstrapOrganizationForUser(input: {
  userId: string;
  name?: string | null;
}): Promise<{ organizationId: string }> {
  const orgName =
    input.name && input.name.trim().length > 0
      ? input.name.trim()
      : "Organisation";

  const org = await prisma.organization.create({
    data: {
      name: orgName,
      memberships: {
        create: {
          userId: input.userId,
          role: "OWNER",
        },
      },
      subscription: {
        create: {
          plan: "FREE",
          status: "ACTIVE",
        },
      },
    },
    select: { id: true },
  });

  return { organizationId: org.id };
}
