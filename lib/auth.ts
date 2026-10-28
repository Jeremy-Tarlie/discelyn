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
import { cookies } from "next/headers";
import { ACTIVE_ORG_COOKIE, pickActiveMembership } from "@/lib/active-org";

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

/** AUTH_* prioritaire ; NEXTAUTH_* accepté en alias. */
export function authSecret(): string | undefined {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    undefined
  );
}

export function authUrl(): string | undefined {
  return (
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    undefined
  );
}

export function assertAuthEnv(): void {
  if (!authSecret()) {
    throw new Error("AUTH_SECRET (ou NEXTAUTH_SECRET) manquant");
  }
  requireEnv("DISCORD_CLIENT_ID");
  requireEnv("DISCORD_CLIENT_SECRET");
}

export const authOptions: NextAuthOptions = {
  // @auth/prisma-adapter types target Prisma 6; Prisma 7 client is API-compatible.
  adapter: PrismaAdapter(prisma as never) as Adapter,
  // Auth email/mdp : sessions DB créées hors CredentialsProvider
  // (lib/credentials-session) — compatible MFA + strategy database.
  // Ne pas ajouter CredentialsProvider (forcerait souvent JWT).
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID ?? "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
      // Discord renvoie `iss=https://discord.com` (RFC 9207). Sans issuer,
      // openid-client lève « issuer must be configured on the issuer ».
      issuer: "https://discord.com",
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
    async signIn({ user, account, profile }) {
      if (account?.provider !== "discord") return true;

      const existingDiscord = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: "discord",
            providerAccountId: account.providerAccountId,
          },
        },
        select: { userId: true },
      });
      if (existingDiscord) return true;

      const profileEmail =
        typeof profile === "object" &&
        profile &&
        "email" in profile &&
        typeof (profile as { email?: string }).email === "string"
          ? (profile as { email: string }).email
          : null;
      const email = user.email ?? profileEmail;
      if (!email) return true;

      const { credentialsUserBlocksDiscordOAuth } = await import(
        "@/lib/auth-credentials"
      );
      const { normalizeEmail } = await import("@/lib/disposable-email");
      const blocked = await credentialsUserBlocksDiscordOAuth(email);
      if (!blocked) return true;

      const { getSessionTokenFromCookies } = await import("@/lib/mfa-session");
      const token = await getSessionTokenFromCookies();
      if (token) {
        const sessionRow = await prisma.session.findUnique({
          where: { sessionToken: token },
          select: { userId: true, expires: true, mfaVerifiedAt: true },
        });
        if (sessionRow && sessionRow.expires.getTime() >= Date.now()) {
          const cred = await prisma.user.findFirst({
            where: {
              email: {
                equals: normalizeEmail(email),
                mode: "insensitive",
              },
              deletedAt: null,
              passwordHash: { not: null },
            },
            select: { id: true, totpEnabled: true },
          });

          const isLinking = cred !== null && sessionRow.userId === cred.id;

          if (isLinking) {
            if (cred.totpEnabled && !sessionRow.mfaVerifiedAt) {
              return "/login/mfa";
            }
            return true;
          }
        }
      }

      return "/login?error=OAuthAccountNotLinked";
    },
    async session({ session, user }) {
      const active = await prisma.user.findFirst({
        where: { id: user.id, deletedAt: null },
        select: { id: true },
      });
      if (!active) {
        await prisma.session.deleteMany({ where: { userId: user.id } });
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

      let preferredOrgId: string | null = null;
      try {
        const jar = await cookies();
        preferredOrgId = jar.get(ACTIVE_ORG_COOKIE)?.value ?? null;
      } catch {
        preferredOrgId = null;
      }

      const preferred = pickActiveMembership(memberships, preferredOrgId);

      const subscription = preferred
        ? await prisma.subscription.findUnique({
            where: { organizationId: preferred.organizationId },
          })
        : null;

      session.user.id = user.id;
      session.user.organizationId = preferred?.organizationId ?? null;
      session.user.orgRole = preferred?.role ?? null;
      session.user.plan = effectivePlan(subscription);
      session.user.subscriptionStatus = subscription?.status ?? "CANCELED";
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id && user.email) {
        const { normalizeEmail } = await import("@/lib/disposable-email");
        const normalized = normalizeEmail(user.email);
        if (normalized !== user.email) {
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { email: normalized },
            });
          } catch (err) {
            console.error(
              "[auth] createUser email normalize failed",
              err instanceof Error ? err.message.slice(0, 120) : "unknown"
            );
          }
        }
      }
      if (!user.id) return;
      const { bootstrapOrganizationForUser } = await import("@/lib/org-access");
      await bootstrapOrganizationForUser({
        userId: user.id,
        name: user.name,
      });
      await trackEvent({ name: "signup", userId: user.id });
    },
    async signIn({ user }) {
      if (user.id) {
        const { logUserActivity } = await import("@/lib/activity-log");
        await logUserActivity({ userId: user.id, action: "login" });
      }
    },
    async linkAccount({ account, user }) {
      if (account.provider === "discord") {
        await prisma.user.update({
          where: { id: user.id },
          data: { discordId: account.providerAccountId },
        });

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
  secret: authSecret(),
};
