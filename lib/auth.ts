import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { prisma } from "@/lib/prisma";
import { trackEvent } from "@/lib/analytics";
import type { PlanId } from "@/lib/plans";
import type { OrgRole, SubscriptionStatus } from "@/generated/prisma/client";
import { effectivePlan } from "@/lib/billing-guards";
import { isTokenEncryptionEnabled, requireSealToken } from "@/lib/token-crypto";
import { bootstrapOrganizationForUser } from "@/lib/org-access";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      /** Plan utilisable (FREE si abonnement inactif / PAST_DUE). */
      plan: PlanId;
      subscriptionStatus: SubscriptionStatus;
      organizationId: string | null;
      orgRole: OrgRole | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    plan?: PlanId;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} manquant`);
  }
  return value;
}

export function assertAuthEnv(): void {
  requireEnv("NEXTAUTH_SECRET");
  requireEnv("DISCORD_CLIENT_ID");
  requireEnv("DISCORD_CLIENT_SECRET");
}

export const authOptions: NextAuthOptions = {
  // @auth/prisma-adapter types target Prisma 6 @prisma/client; Prisma 7 generated client is API-compatible.
  adapter: PrismaAdapter(prisma as never) as Adapter,
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID ?? "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: "identify email guilds",
        },
      },
    }),
  ],
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async session({ session, user }) {
      const active = await prisma.user.findFirst({
        where: { id: user.id, deletedAt: null },
        select: { id: true },
      });
      if (!active) {
        await prisma.session.deleteMany({ where: { userId: user.id } });
        // Force unauthenticated côté clients qui lisent session.user.id.
        session.user.id = "";
        session.user.plan = "FREE";
        session.user.subscriptionStatus = "CANCELED";
        session.user.organizationId = null;
        session.user.orgRole = null;
        return session;
      }

      const memberships = await prisma.organizationMembership.findMany({
        where: {
          userId: user.id,
          organization: { deletedAt: null },
        },
        orderBy: { createdAt: "asc" },
        select: {
          organizationId: true,
          role: true,
        },
      });

      const preferred =
        memberships.find((m) => m.role === "OWNER") ?? memberships[0] ?? null;

      const subscription = preferred
        ? await prisma.subscription.findUnique({
            where: { organizationId: preferred.organizationId },
          })
        : null;

      session.user.id = user.id;
      session.user.organizationId = preferred?.organizationId ?? null;
      session.user.orgRole = preferred?.role ?? null;
      session.user.plan = effectivePlan(subscription);
      session.user.subscriptionStatus = subscription?.status ?? "ACTIVE";
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      await bootstrapOrganizationForUser({
        userId: user.id,
        name: user.name,
      });
      await trackEvent({ name: "signup", userId: user.id });
    },
    async linkAccount({ account, user }) {
      if (account.provider === "discord") {
        await prisma.user.update({
          where: { id: user.id },
          data: { discordId: account.providerAccountId },
        });

        // Chiffre les jetons OAuth juste après l’insertion NextAuth.
        if (isTokenEncryptionEnabled()) {
          const row = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: account.provider,
                providerAccountId: account.providerAccountId,
              },
            },
            select: {
              id: true,
              access_token: true,
              refresh_token: true,
              id_token: true,
            },
          });
          if (row) {
            await prisma.account.update({
              where: { id: row.id },
              data: {
                access_token: row.access_token
                  ? requireSealToken(row.access_token, "oauth_access")
                  : row.access_token,
                refresh_token: row.refresh_token
                  ? requireSealToken(row.refresh_token, "oauth_refresh")
                  : row.refresh_token,
                id_token: row.id_token
                  ? requireSealToken(row.id_token, "oauth_id")
                  : row.id_token,
              },
            });
          }
        }
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
