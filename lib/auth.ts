import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { prisma } from "@/lib/prisma";
import type { PlanId } from "@/lib/plans";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      plan: PlanId;
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
      const subscription = await prisma.subscription.findUnique({
        where: { userId: user.id },
      });

      session.user.id = user.id;
      session.user.plan = (subscription?.plan ?? "FREE") as PlanId;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      await prisma.subscription.create({
        data: {
          userId: user.id,
          plan: "FREE",
          status: "ACTIVE",
        },
      });
    },
    async linkAccount({ account, user }) {
      if (account.provider === "discord") {
        await prisma.user.update({
          where: { id: user.id },
          data: { discordId: account.providerAccountId },
        });
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export function assertAuthEnv(): void {
  requireEnv("NEXTAUTH_SECRET");
  requireEnv("DISCORD_CLIENT_ID");
  requireEnv("DISCORD_CLIENT_SECRET");
}
