import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platform-admin";

const ACTIVE = ["ACTIVE", "TRIALING", "PAST_DUE"] as const;

export async function getAdminOverviewStats() {
  const admin = await requirePlatformAdmin();
  if (!admin) return null;

  const [orgTotal, paid, pastDue, canceling, free, leads] = await Promise.all([
    prisma.organization.count({ where: { deletedAt: null } }),
    prisma.subscription.count({
      where: {
        plan: { not: "FREE" },
        status: { in: [...ACTIVE] },
        organization: { deletedAt: null },
      },
    }),
    prisma.subscription.count({
      where: { status: "PAST_DUE", organization: { deletedAt: null } },
    }),
    prisma.subscription.count({
      where: {
        cancelAtPeriodEnd: true,
        organization: { deletedAt: null },
      },
    }),
    prisma.subscription.count({
      where: { plan: "FREE", organization: { deletedAt: null } },
    }),
    prisma.lead.count(),
  ]);

  return { orgTotal, paid, pastDue, canceling, free, leads };
}

export type AdminCustomerRow = {
  id: string;
  name: string;
  createdAt: Date;
  plan: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  ownerEmail: string | null;
  ownerId: string | null;
  lastLoginAt: Date | null;
  botLastSeenAt: Date | null;
  lastEmailOpenAt: Date | null;
};

export async function listAdminCustomers(
  take = 100,
): Promise<AdminCustomerRow[] | null> {
  const admin = await requirePlatformAdmin();
  if (!admin) return null;

  const orgs = await prisma.organization.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      createdAt: true,
      subscription: {
        select: {
          plan: true,
          status: true,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: true,
        },
      },
      memberships: {
        where: { role: "OWNER" },
        take: 1,
        select: {
          user: {
            select: {
              id: true,
              email: true,
              activityLogs: {
                where: { action: "login" },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { createdAt: true },
              },
            },
          },
        },
      },
      bots: {
        where: { deletedAt: null },
        orderBy: { lastSeenAt: "desc" },
        take: 1,
        select: { lastSeenAt: true },
      },
    },
  });

  const ownerEmails = orgs
    .map((o) => o.memberships[0]?.user.email)
    .filter((e): e is string => Boolean(e));

  const openEvents =
    ownerEmails.length === 0
      ? []
      : await prisma.emailEvent.findMany({
          where: {
            email: { in: ownerEmails },
            type: "opened",
          },
          orderBy: { createdAt: "desc" },
          distinct: ["email"],
          select: { email: true, createdAt: true },
        });

  const openByEmail = new Map(
    openEvents.map((e) => [e.email.toLowerCase(), e.createdAt]),
  );

  return orgs.map((org) => {
    const owner = org.memberships[0]?.user;
    const email = owner?.email ?? null;
    return {
      id: org.id,
      name: org.name,
      createdAt: org.createdAt,
      plan: org.subscription?.plan ?? "FREE",
      status: org.subscription?.status ?? "ACTIVE",
      cancelAtPeriodEnd: org.subscription?.cancelAtPeriodEnd ?? false,
      currentPeriodEnd: org.subscription?.currentPeriodEnd ?? null,
      ownerEmail: email,
      ownerId: owner?.id ?? null,
      lastLoginAt: owner?.activityLogs[0]?.createdAt ?? null,
      botLastSeenAt: org.bots[0]?.lastSeenAt ?? null,
      lastEmailOpenAt: email
        ? (openByEmail.get(email.toLowerCase()) ?? null)
        : null,
    };
  });
}

export async function getAdminCustomerDetail(organizationId: string) {
  const admin = await requirePlatformAdmin();
  if (!admin) return null;

  return prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: {
      id: true,
      name: true,
      createdAt: true,
      subscription: true,
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              discordId: true,
              marketingConsentAt: true,
              activityLogs: {
                orderBy: { createdAt: "desc" },
                take: 20,
                select: { action: true, createdAt: true, meta: true },
              },
            },
          },
        },
      },
      bots: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          status: true,
          lastSeenAt: true,
          lastError: true,
        },
      },
    },
  });
}
