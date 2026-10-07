import { prisma } from "@/lib/prisma";
import { sendUserDm } from "@/lib/discord-roles";
import { parseOnboardingSteps } from "@/lib/access-seats";
import { claimUrl } from "@/lib/access-urls";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { captureMoneyPathError } from "@/lib/money-path-sentry";
import { notifyOutbound, recordEvent } from "@/lib/learner-access-events";
import { fulfillDiscordAccess } from "@/lib/learner-access-fulfill";

/** Relances claim 24h / 48h (#5). */
export async function sendClaimReminders(): Promise<number> {
  const now = Date.now();
  const day1 = new Date(now - 24 * 60 * 60 * 1000);
  const day2 = new Date(now - 48 * 60 * 60 * 1000);

  const pending = await prisma.learnerAccess.findMany({
    where: {
      status: "PENDING_CLAIM",
      claimToken: { not: null },
      createdAt: { lte: day1 },
      claimReminderCount: { lt: 2 },
    },
    include: {
      product: { select: { name: true } },
      bot: {
        select: {
          organizationId: true,
          deletedAt: true,
          organization: { select: { deletedAt: true } },
        },
      },
    },
    take: 100,
  });

  const emailReady = isEmailConfigured();
  if (
    !emailReady &&
    pending.some((a) => a.customerEmail && !a.discordUserId)
  ) {
    console.warn(
      "[access] claim reminders: RESEND_API_KEY/EMAIL_FROM absents — relances email-only via webhook orga uniquement"
    );
  }

  let sent = 0;
  for (const access of pending) {
    if (access.bot.deletedAt || access.bot.organization.deletedAt) continue;
    const needsSecond =
      access.claimReminderCount >= 1 && access.createdAt <= day2;
    const needsFirst = access.claimReminderCount === 0;
    if (!needsFirst && !needsSecond) continue;
    if (!access.claimToken) continue;

    const url = claimUrl(access.claimToken);
    let delivered = false;
    let channel = "none";

    if (access.discordUserId) {
      await sendUserDm({
        discordUserId: access.discordUserId,
        content: `Rappel — finalise ton accès « ${access.product.name} » : ${url}`,
      });
      delivered = true;
      channel = "dm";
    }

    if (access.customerEmail) {
      if (emailReady) {
        const mail = await sendEmail({
          to: access.customerEmail,
          subject: `Finalise ton accès « ${access.product.name} »`,
          text: `Bonjour,\n\nFinalise ton accès Discord « ${access.product.name} » en ouvrant ce lien :\n${url}\n\n— Discelyn`,
          html: `<p>Bonjour,</p><p>Finalise ton accès Discord <strong>${access.product.name}</strong> :</p><p><a href="${url}">${url}</a></p><p>— Discelyn</p>`,
        });
        if (mail.ok) {
          delivered = true;
          channel = channel === "dm" ? "dm+email" : "email";
        } else {
          console.warn("[access] claim reminder email failed", mail.error);
        }
      } else if (!access.discordUserId) {
        console.warn(
          `[access] claim reminder sans canal direct access=${access.id} (configure RESEND_API_KEY + EMAIL_FROM)`
        );
      }

      // Toujours notifier l’orga (automation) si email connu.
      await notifyOutbound(access.bot.organizationId, "claim_reminder", {
        accessId: access.id,
        productId: access.accessProductId,
        email: access.customerEmail,
        claimUrl: url,
        productName: access.product.name,
        reminderCount: access.claimReminderCount + 1,
      });
      if (!delivered) {
        delivered = true;
        channel = "outbound";
      }
    }

    // Ne brûle pas le compteur si aucun canal (DM, email Resend, ou outbound).
    if (!delivered) continue;

    await prisma.learnerAccess.update({
      where: { id: access.id },
      data: {
        claimReminderSentAt: new Date(),
        claimReminderCount: { increment: 1 },
      },
    });
    await recordEvent(access.id, "claim_reminder_sent", {
      count: access.claimReminderCount + 1,
      channel,
    });
    sent += 1;
  }
  return sent;
}

/**
 * Reprend les grants bloqués / joins manqués (web down, perms Discord, etc.).
 */
export async function retryStuckGrants(): Promise<number> {
  const rows = await prisma.learnerAccess.findMany({
    where: {
      status: { in: ["PENDING_CLAIM", "AWAITING_JOIN"] },
      discordUserId: { not: null },
    },
    select: { id: true },
    take: 50,
    orderBy: { updatedAt: "asc" },
  });

  let fixed = 0;
  for (const row of rows) {
    try {
      const result = await fulfillDiscordAccess(row.id);
      if (result.status === "ACTIVE") fixed += 1;
    } catch (err) {
      captureMoneyPathError(err, {
        area: "access.retry_stuck_grants",
        accessId: row.id,
      });
    }
  }
  return fixed;
}

/** Aligne seatsUsed sur le count réel des accès ouverts. */
export async function reconcileSeatsUsed(): Promise<number> {
  const products = await prisma.accessProduct.findMany({
    select: { id: true, seatsUsed: true },
  });
  let fixed = 0;
  for (const product of products) {
    const count = await prisma.learnerAccess.count({
      where: {
        accessProductId: product.id,
        status: { in: ["PENDING_CLAIM", "AWAITING_JOIN", "ACTIVE"] },
      },
    });
    if (count === product.seatsUsed) continue;
    await prisma.accessProduct.update({
      where: { id: product.id },
      data: { seatsUsed: count },
    });
    fixed += 1;
  }
  return fixed;
}

/** Rappels J-N avant accessEndsAt (#12). */
export async function sendExpiryReminders(): Promise<number> {
  const now = new Date();
  const active = await prisma.learnerAccess.findMany({
    where: {
      status: "ACTIVE",
      expiryReminderSentAt: null,
      discordUserId: { not: null },
      product: { accessEndsAt: { not: null } },
    },
    include: {
      product: {
        select: {
          name: true,
          accessEndsAt: true,
          reminderDaysBefore: true,
        },
      },
    },
    take: 200,
  });

  let sent = 0;
  for (const access of active) {
    const endsAt = access.product.accessEndsAt;
    if (!endsAt || !access.discordUserId) continue;
    const days = access.product.reminderDaysBefore ?? 7;
    const reminderAt = new Date(endsAt.getTime() - days * 24 * 60 * 60 * 1000);
    if (now < reminderAt || now >= endsAt) continue;

    await sendUserDm({
      discordUserId: access.discordUserId,
      content: `Ton accès « ${access.product.name} » expire le ${endsAt.toISOString().slice(0, 10)}.`,
    });
    await prisma.learnerAccess.update({
      where: { id: access.id },
      data: { expiryReminderSentAt: new Date() },
    });
    await recordEvent(access.id, "expiry_reminder_sent", {});
    sent += 1;
  }
  return sent;
}

/** Envoie l’étape onboarding suivante (#6). */
export async function advanceOnboardingSteps(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await prisma.learnerAccess.findMany({
    where: {
      status: "ACTIVE",
      discordUserId: { not: null },
      onboardingLastSentAt: { lte: cutoff },
    },
    include: {
      product: { select: { onboardingSteps: true, name: true } },
    },
    take: 100,
  });

  let sent = 0;
  for (const access of rows) {
    const steps = parseOnboardingSteps(access.product.onboardingSteps);
    if (steps.length === 0) continue;
    if (access.onboardingStep >= steps.length) continue;
    const message = steps[access.onboardingStep];
    if (!message || !access.discordUserId) continue;

    await sendUserDm({
      discordUserId: access.discordUserId,
      content: message,
    });
    await prisma.learnerAccess.update({
      where: { id: access.id },
      data: {
        onboardingStep: { increment: 1 },
        onboardingLastSentAt: new Date(),
      },
    });
    await recordEvent(access.id, "onboarding_step_sent", {
      step: access.onboardingStep,
    });
    sent += 1;
  }
  return sent;
}

export async function recordSubscriptionEvent(
  stripeSubscriptionId: string,
  type: string,
  meta?: Record<string, string | number | boolean | null>
): Promise<void> {
  const rows = await prisma.learnerAccess.findMany({
    where: { stripeSubscriptionId },
    select: { id: true },
  });
  for (const row of rows) {
    await recordEvent(row.id, type, meta);
  }
}

/**
 * Met à jour le statut billing Stripe dénormalisé (UI past_due / filtre).
 */
export async function syncLearnerBillingStatus(
  stripeSubscriptionId: string,
  status: string
): Promise<void> {
  await prisma.learnerAccess.updateMany({
    where: { stripeSubscriptionId },
    data: { stripeBillingStatus: status },
  });
}

/** Marque un paiement abo réussi (invoice.paid). */
export async function syncLearnerLastPayment(
  stripeSubscriptionId: string,
  paidAt: Date = new Date()
): Promise<void> {
  await prisma.learnerAccess.updateMany({
    where: { stripeSubscriptionId },
    data: {
      lastPaymentAt: paidAt,
      stripeBillingStatus: "active",
    },
  });
}
