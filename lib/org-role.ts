import type { OrgRole } from "@/generated/prisma/client";

const ROLE_RANK: Record<OrgRole, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function orgRoleAtLeast(role: OrgRole, minRole: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}
