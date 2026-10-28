import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  passwordLoginSchema,
  passwordSchema,
  verifyPasswordOrDummy,
} from "@/lib/password";

import {
  assertEmailAllowedInProduction,
  normalizeEmail,
} from "@/lib/disposable-email";
import { bootstrapOrganizationForUser } from "@/lib/org-access";
import { trackEvent } from "@/lib/analytics";
import {
  authEmailBaseUrl,
  isAuthMailConfigured,
  sendAuthMail,
} from "@/lib/auth-mail";
import {
  resetPasswordTemplate,
  verifyEmailTemplate,
} from "@/lib/auth-mail-templates";
import type { PlanIntentValue } from "@/lib/credentials-session";
import { getAppEnvironment } from "@/lib/demo";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

export const registerBodySchema = z.object({
  email: z.string().email().max(254),
  password: passwordSchema,
  name: z.string().trim().min(1).max(80).optional(),
  plan: z.enum(["FREE", "STARTER", "OPS", "SCALE"]),
  interval: z.enum(["month", "year"]).default("month"),
});

export const loginBodySchema = z.object({
  email: z.string().email().max(254),
  password: passwordLoginSchema,
  callbackUrl: z.string().max(500).optional(),
});

export const emailOnlySchema = z.object({
  email: z.string().email().max(254),
});

export const resetPasswordBodySchema = z.object({
  token: z.string().min(16).max(200),
  password: passwordSchema,
});

export const verifyEmailBodySchema = z.object({
  token: z.string().min(16).max(200),
});

function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

const VERIFY_PREFIX = "email-verify:";
const RESET_PREFIX = "password-reset:";

function verifyIdentifier(email: string): string {
  return `${VERIFY_PREFIX}${normalizeEmail(email)}`;
}

function resetIdentifier(email: string): string {
  return `${RESET_PREFIX}${normalizeEmail(email)}`;
}

function emailFromVerifyIdentifier(identifier: string): string | null {
  if (!identifier.startsWith(VERIFY_PREFIX)) return null;
  const email = identifier.slice(VERIFY_PREFIX.length);
  return email.includes("@") ? normalizeEmail(email) : null;
}

function emailFromResetIdentifier(identifier: string): string | null {
  if (!identifier.startsWith(RESET_PREFIX)) return null;
  const email = identifier.slice(RESET_PREFIX.length);
  return email.includes("@") ? normalizeEmail(email) : null;
}

/** Lookup email actif, case-insensitive (filet avant/après backfill). */
function activeEmailWhere(email: string) {
  return {
    email: { equals: email, mode: "insensitive" as const },
    deletedAt: null,
  };
}

async function replaceVerificationToken(input: {
  identifier: string;
  ttlMs: number;
}): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  const token = hashToken(raw);
  const expires = new Date(Date.now() + input.ttlMs);
  await prisma.$transaction(async (tx) => {
    await tx.verificationToken.deleteMany({
      where: { identifier: input.identifier },
    });
    await tx.verificationToken.create({
      data: {
        identifier: input.identifier,
        token,
        expires,
      },
    });
  });
  return raw;
}

export type RegisterResult =
  | { ok: true; intent: PlanIntentValue }
  | {
      ok: false;
      code: "email_not_allowed" | "email_taken" | "invalid_data";
    }
  | {
      ok: false;
      code: "mail_failed";
      intent: PlanIntentValue;
    };

export async function registerCredentialsUser(input: {
  email: string;
  password: string;
  name?: string;
  plan: PlanIntentValue["plan"];
  interval: PlanIntentValue["interval"];
  locale: "fr" | "en";
}): Promise<RegisterResult> {
  const email = normalizeEmail(input.email);
  const intent: PlanIntentValue = {
    plan: input.plan,
    interval: input.interval,
  };

  const allowed = assertEmailAllowedInProduction(email);
  if (!allowed.ok) return { ok: false, code: "email_not_allowed" };

  // Prod sans SMTP : refuser avant create (pas d’orphelins).
  // Staging/dev : allow create + log (voir branche sendAuthMail plus bas).
  if (
    getAppEnvironment() === "production" &&
    !isAuthMailConfigured()
  ) {
    console.error("[auth] register refused: SMTP not configured in production");
    return { ok: false, code: "mail_failed", intent };
  }

  const existing = await prisma.user.findFirst({
    where: activeEmailWhere(email),
    select: { id: true },
  });
  if (existing) {
    // Anti-enum timing : même coût CPU qu’un signup réel.
    await hashPassword(input.password);
    return { ok: false, code: "email_taken" };
  }

  const passwordHash = await hashPassword(input.password);
  const displayName =
    input.name && input.name.trim().length > 0
      ? input.name.trim()
      : email.split("@")[0] ?? "Utilisateur";

  let user: { id: string };
  try {
    user = await prisma.user.create({
      data: {
        email,
        name: displayName,
        passwordHash,
        emailVerified: null,
      },
      select: { id: true },
    });
  } catch (err) {
    // Race unique email → même réponse que email_taken.
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      await hashPassword(input.password);
      return { ok: false, code: "email_taken" };
    }
    throw err;
  }

  // Pas d’org / analytics avant emailVerified (évite orphelins).

  const rawToken = await replaceVerificationToken({
    identifier: verifyIdentifier(email),
    ttlMs: VERIFY_TTL_MS,
  });

  const verifyUrl = `${authEmailBaseUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`;
  const template = verifyEmailTemplate({
    verifyUrl,
    locale: input.locale,
  });
  const mailed = await sendAuthMail({
    to: email,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
  if (!mailed.ok) {
    const nonProd = getAppEnvironment() !== "production";
    if (mailed.error === "auth_mail_not_configured" && nonProd) {
      // Pas de dump du token verify dans les logs (activation compte si logs exposés).
      console.warn(
        "[auth] SMTP not configured (non-prod); user kept pending verification"
      );
      return { ok: false, code: "mail_failed", intent };
    }

    // SMTP configuré mais envoi KO (ou prod) : rollback user + token.
    await prisma.$transaction(async (tx) => {
      await tx.verificationToken.deleteMany({
        where: { identifier: verifyIdentifier(email) },
      });
      await tx.user.delete({ where: { id: user.id } });
    });
    return { ok: false, code: "mail_failed", intent };
  }

  return { ok: true, intent };
}

export type VerifyEmailResult =
  | { ok: true; userId: string }
  | { ok: false; code: "invalid_token" };

export async function verifyCredentialsEmail(input: {
  token: string;
}): Promise<VerifyEmailResult> {
  const hashed = hashToken(input.token);

  const row = await prisma.verificationToken.findUnique({
    where: { token: hashed },
  });
  if (!row || row.expires.getTime() < Date.now()) {
    return { ok: false, code: "invalid_token" };
  }

  const email = emailFromVerifyIdentifier(row.identifier);
  if (!email) return { ok: false, code: "invalid_token" };

  const identifier = verifyIdentifier(email);
  if (row.identifier !== identifier) {
    return { ok: false, code: "invalid_token" };
  }

  const user = await prisma.user.findFirst({
    where: {
      ...activeEmailWhere(email),
      passwordHash: { not: null },
    },
    select: { id: true, emailVerified: true, name: true },
  });
  if (!user) return { ok: false, code: "invalid_token" };

  // Opaque : déjà vérifié → même code que token invalide (consomme le jeton).
  if (user.emailVerified) {
    await prisma.verificationToken.deleteMany({ where: { identifier } });
    return { ok: false, code: "invalid_token" };
  }

  // Bootstrap AVANT consommation du token (retry-safe si bootstrap plante).
  // bootstrapOrganizationForUser est idempotent.
  await bootstrapOrganizationForUser({
    userId: user.id,
    name: user.name,
  });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });
    await tx.verificationToken.deleteMany({ where: { identifier } });
  });

  await trackEvent({ name: "signup", userId: user.id });

  return { ok: true, userId: user.id };
}

export type LoginResult =
  | { ok: true; userId: string }
  | {
      ok: false;
      code:
        | "invalid_credentials"
        | "email_not_verified"
        | "account_deleted";
    };

export async function loginCredentialsUser(input: {
  email: string;
  password: string;
}): Promise<LoginResult> {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: {
      id: true,
      passwordHash: true,
      emailVerified: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt || !user.passwordHash) {
    await verifyPasswordOrDummy(null, input.password);
    return { ok: false, code: "invalid_credentials" };
  }

  const match = await verifyPasswordOrDummy(
    user.passwordHash,
    input.password
  );
  if (!match) {
    return { ok: false, code: "invalid_credentials" };
  }
  if (!user.emailVerified) {
    return { ok: false, code: "email_not_verified" };
  }

  return { ok: true, userId: user.id };
}

export async function resendVerificationEmail(input: {
  email: string;
  locale: "fr" | "en";
}): Promise<{ ok: true } | { ok: false; code: "mail_failed" }> {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findFirst({
    where: {
      ...activeEmailWhere(email),
      passwordHash: { not: null },
      emailVerified: null,
    },
    select: { id: true },
  });
  // Opaque : toujours « ok » côté API sauf échec SMTP réel si user existe.
  if (!user) return { ok: true };

  const rawToken = await replaceVerificationToken({
    identifier: verifyIdentifier(email),
    ttlMs: VERIFY_TTL_MS,
  });
  const verifyUrl = `${authEmailBaseUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`;
  const template = verifyEmailTemplate({
    verifyUrl,
    locale: input.locale,
  });
  const mailed = await sendAuthMail({
    to: email,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
  if (!mailed.ok) return { ok: false, code: "mail_failed" };
  return { ok: true };
}

/** Toujours succès opaque côté appelant — envoie mail seulement si compte credentials vérifié. */
export async function requestPasswordReset(input: {
  email: string;
  locale: "fr" | "en";
}): Promise<void> {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findFirst({
    where: {
      ...activeEmailWhere(email),
      passwordHash: { not: null },
      emailVerified: { not: null },
    },
    select: { id: true },
  });
  if (!user) return;

  const rawToken = await replaceVerificationToken({
    identifier: resetIdentifier(email),
    ttlMs: RESET_TTL_MS,
  });
  const resetUrl = `${authEmailBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const template = resetPasswordTemplate({
    resetUrl,
    locale: input.locale,
  });
  await sendAuthMail({
    to: email,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });
}

export type ResetPasswordResult =
  | { ok: true }
  | { ok: false; code: "invalid_token" };

export async function resetCredentialsPassword(input: {
  token: string;
  password: string;
}): Promise<ResetPasswordResult> {
  const hashed = hashToken(input.token);

  const row = await prisma.verificationToken.findUnique({
    where: { token: hashed },
  });
  if (!row || row.expires.getTime() < Date.now()) {
    return { ok: false, code: "invalid_token" };
  }

  const email = emailFromResetIdentifier(row.identifier);
  if (!email) return { ok: false, code: "invalid_token" };

  const identifier = resetIdentifier(email);
  if (row.identifier !== identifier) {
    return { ok: false, code: "invalid_token" };
  }

  const user = await prisma.user.findFirst({
    where: {
      ...activeEmailWhere(email),
      passwordHash: { not: null },
    },
    select: { id: true },
  });
  if (!user) return { ok: false, code: "invalid_token" };

  const passwordHash = await hashPassword(input.password);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.verificationToken.deleteMany({
      where: {
        OR: [
          { identifier },
          { identifier: verifyIdentifier(email) },
        ],
      },
    });
  });

  return { ok: true };
}

/**
 * True si un user credentials (passwordHash) existe pour cet email
 * sans Account Discord lié — bloque OAuth Discord (anti account takeover).
 * Inclut les comptes **non vérifiés** (évite ATO Discord pendant la fenêtre verify).
 * Lookup case-insensitive (Discord peut renvoyer une autre casse).
 */
export async function credentialsUserBlocksDiscordOAuth(
  email: string | null | undefined
): Promise<boolean> {
  if (!email) return false;
  const normalized = normalizeEmail(email);
  const user = await prisma.user.findFirst({
    where: {
      ...activeEmailWhere(normalized),
      passwordHash: { not: null },
    },
    select: {
      id: true,
      accounts: {
        where: { provider: "discord" },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!user) return false;
  return user.accounts.length === 0;
}
