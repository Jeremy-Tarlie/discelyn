import type { OrgRole } from "@/generated/prisma/client";

/** Cookie httpOnly : organisation active pour requireOrg / session. */
export const ACTIVE_ORG_COOKIE = "discelyn_active_org";

export const ACTIVE_ORG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type MembershipPick = {
  organizationId: string;
  role: OrgRole;
};

/**
 * Choisit la membership active.
 * 1) Cookie / préférence si membership valide
 * 2) sinon première OWNER
 * 3) sinon première membership (ordre fourni)
 */
export function pickActiveMembership<T extends MembershipPick>(
  memberships: T[],
  preferredOrganizationId: string | null | undefined
): T | null {
  if (memberships.length === 0) return null;
  if (preferredOrganizationId) {
    const match = memberships.find(
      (m) => m.organizationId === preferredOrganizationId
    );
    if (match) return match;
  }
  return memberships.find((m) => m.role === "OWNER") ?? memberships[0];
}

export function activeOrgCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  path: string;
  secure: boolean;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.APP_ENV === "production",
    maxAge: ACTIVE_ORG_COOKIE_MAX_AGE,
  };
}
