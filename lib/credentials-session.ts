import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppEnvironment } from "@/lib/demo";

export const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 jours

export const PLAN_INTENT_COOKIE = "discelyn_plan_intent";
export const PLAN_INTENT_MAX_AGE_SEC = 60 * 60; // 1 h

export function sessionCookieName(): string {
  const url = process.env.NEXTAUTH_URL ?? "";
  const secure =
    url.startsWith("https://") || getAppEnvironment() === "production";
  return secure
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
}

export function isSecureSessionCookie(): boolean {
  return sessionCookieName().startsWith("__Secure-");
}

export async function createDatabaseSessionForUser(
  userId: string
): Promise<{ sessionToken: string; expires: Date }> {
  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SEC * 1000);
  await prisma.session.create({
    data: {
      sessionToken,
      userId,
      expires,
    },
  });
  return { sessionToken, expires };
}

type CookieJar = Awaited<ReturnType<typeof cookies>>;

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: isSecureSessionCookie(),
    expires,
  };
}

/** Pose le cookie session sur le jar Next (Server Action / RSC). */
export async function setSessionCookieOnJar(
  jar: CookieJar,
  sessionToken: string,
  expires: Date
): Promise<void> {
  jar.set(sessionCookieName(), sessionToken, cookieOptions(expires));
}

/** Pose le cookie session sur une NextResponse (route handlers). */
export function setSessionCookieOnResponse(
  response: NextResponse,
  sessionToken: string,
  expires: Date
): void {
  response.cookies.set(sessionCookieName(), sessionToken, cookieOptions(expires));
}

export function clearSessionCookiesOnResponse(response: NextResponse): void {
  response.cookies.set("next-auth.session-token", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set("__Secure-next-auth.session-token", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: true,
    maxAge: 0,
  });
}

export type PlanIntentValue = {
  plan: "FREE" | "STARTER" | "OPS" | "SCALE";
  interval: "month" | "year";
};

export function serializePlanIntent(intent: PlanIntentValue): string {
  return `${intent.plan}:${intent.interval}`;
}

export function parsePlanIntentCookie(
  raw: string | null | undefined
): PlanIntentValue | null {
  if (!raw) return null;
  const [plan, interval] = raw.split(":");
  if (
    plan !== "FREE" &&
    plan !== "STARTER" &&
    plan !== "OPS" &&
    plan !== "SCALE"
  ) {
    return null;
  }
  if (interval !== "month" && interval !== "year") return null;
  return { plan, interval };
}

export function setPlanIntentCookieOnResponse(
  response: NextResponse,
  intent: PlanIntentValue
): void {
  response.cookies.set(PLAN_INTENT_COOKIE, serializePlanIntent(intent), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isSecureSessionCookie(),
    maxAge: PLAN_INTENT_MAX_AGE_SEC,
  });
}

export function clearPlanIntentCookieOnResponse(response: NextResponse): void {
  response.cookies.set(PLAN_INTENT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function resolvePostAuthRedirect(
  intent: PlanIntentValue | null
): string {
  if (!intent || intent.plan === "FREE") return "/dashboard";
  const params = new URLSearchParams({
    plan: intent.plan,
    interval: intent.interval,
  });
  return `/subscribe?${params.toString()}`;
}
