import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { OrgRole } from "@/generated/prisma/client";
import { orgRoleAtLeast } from "@/lib/org-role";

export { orgRoleAtLeast } from "@/lib/org-role";

export type OrgContext = {
  userId: string;
  organizationId: string;
  orgRole: OrgRole;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

/**
 * Résout l’organisation active de la session.
 * Priorité : membership OWNER, sinon première membership (org non soft-deleted).
 */
export async function requireOrg(options?: {
  minRole?: OrgRole;
}): Promise<OrgContext | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const active = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true },
  });
  if (!active) return null;

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

  const preferred =
    memberships.find((m) => m.role === "OWNER") ?? memberships[0];

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
