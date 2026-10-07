import { prisma } from "@/lib/prisma";
import { COOKIE_POLICY_VERSION } from "@/i18n/config";
import {
  isValidVisitorId,
  serializeConsent,
  type ConsentPreferences,
} from "@/lib/consent";

export async function recordCookieConsent(input: {
  preferences: ConsentPreferences;
  visitorId: string;
  userId?: string | null;
}): Promise<{ id: string; choice: string }> {
  if (!isValidVisitorId(input.visitorId)) {
    throw new Error("invalid_visitor_id");
  }

  const userId = input.userId ?? null;
  const choice = serializeConsent(input.preferences);

  const log = await prisma.cookieConsentLog.create({
    data: {
      visitorId: input.visitorId,
      userId,
      choice,
      policyVersion: COOKIE_POLICY_VERSION,
    },
    select: { id: true },
  });

  if (userId) {
    await linkVisitorConsentsToUser(input.visitorId, userId);
  }

  return { id: log.id, choice };
}

/** Rattache les logs récents du même visitorId à l’utilisateur connecté. */
export async function linkVisitorConsentsToUser(
  visitorId: string,
  userId: string
): Promise<number> {
  if (!isValidVisitorId(visitorId)) return 0;
  const result = await prisma.cookieConsentLog.updateMany({
    where: {
      visitorId,
      userId: null,
    },
    data: { userId },
  });
  return result.count;
}

export async function anonymizeUserCookieConsents(
  userId: string
): Promise<number> {
  const result = await prisma.cookieConsentLog.updateMany({
    where: { userId },
    data: { userId: null },
  });
  return result.count;
}
