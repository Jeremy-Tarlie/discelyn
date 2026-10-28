import { prisma } from "@/lib/prisma";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import {
  unsubscribeApiUrlFor,
  unsubscribeUrlFor,
} from "@/lib/marketing-unsubscribe";

export type CampaignAudience = "leads" | "customers" | "both";

export const CAMPAIGN_RECIPIENT_CAP = 500;
export const CAMPAIGN_BATCH_SIZE = 25;
export const CAMPAIGN_STUCK_MS = 15 * 60 * 1000;

export async function resolveCampaignRecipients(
  audience: CampaignAudience,
): Promise<string[]> {
  const emails = new Set<string>();

  if (audience === "leads" || audience === "both") {
    const leads = await prisma.lead.findMany({
      where: { marketingConsentAt: { not: null } },
      select: { email: true },
      take: CAMPAIGN_RECIPIENT_CAP,
    });
    for (const lead of leads) {
      if (lead.email) emails.add(lead.email.trim().toLowerCase());
    }
  }

  if (audience === "customers" || audience === "both") {
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        marketingConsentAt: { not: null },
        email: { not: null },
      },
      select: { email: true },
      take: CAMPAIGN_RECIPIENT_CAP,
    });
    for (const user of users) {
      if (user.email) emails.add(user.email.trim().toLowerCase());
    }
  }

  return [...emails];
}

/** Crée la campagne + file recipients (pas d’envoi synchrone). */
export async function enqueueCampaign(input: {
  subject: string;
  bodyText: string;
  audience: CampaignAudience;
  createdById: string;
}): Promise<
  | { ok: true; campaignId: string; queuedCount: number; status: "queued" }
  | { ok: false; error: string }
> {
  if (!isEmailConfigured()) {
    return { ok: false, error: "email_not_configured" };
  }

  const recipients = await resolveCampaignRecipients(input.audience);
  if (recipients.length === 0) {
    return { ok: false, error: "no_recipients" };
  }

  const campaign = await prisma.marketingCampaign.create({
    data: {
      subject: input.subject,
      bodyText: input.bodyText,
      audience: input.audience,
      status: "queued",
      createdById: input.createdById,
      recipients: {
        create: recipients.map((email) => ({ email, status: "pending" })),
      },
    },
    select: { id: true },
  });

  return {
    ok: true,
    campaignId: campaign.id,
    queuedCount: recipients.length,
    status: "queued",
  };
}

/** @deprecated alias — utiliser enqueueCampaign */
export const sendCampaign = enqueueCampaign;

async function recoverStuckRecipients(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - CAMPAIGN_STUCK_MS);
  const result = await prisma.marketingCampaignRecipient.updateMany({
    where: {
      status: "sending",
      updatedAt: { lt: cutoff },
    },
    data: { status: "pending" },
  });
  return result.count;
}

type ClaimedRow = { id: string; campaignId: string; email: string };

async function claimPendingBatch(limit: number): Promise<ClaimedRow[]> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<ClaimedRow[]>`
      SELECT id, "campaignId", email
      FROM "MarketingCampaignRecipient"
      WHERE status = 'pending'
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    await tx.marketingCampaignRecipient.updateMany({
      where: { id: { in: ids } },
      data: { status: "sending", attempts: { increment: 1 } },
    });
    const campaignIds = [...new Set(rows.map((r) => r.campaignId))];
    await tx.marketingCampaign.updateMany({
      where: {
        id: { in: campaignIds },
        status: { in: ["queued", "sending"] },
      },
      data: { status: "sending" },
    });
    return rows;
  });
}

function buildCampaignText(bodyText: string, unsubPage: string | null): string {
  if (!unsubPage) return bodyText;
  return `${bodyText}\n\n---\nSe désinscrire / Unsubscribe: ${unsubPage}`;
}

async function finalizeCampaign(campaignId: string): Promise<void> {
  const open = await prisma.marketingCampaignRecipient.count({
    where: {
      campaignId,
      status: { in: ["pending", "sending"] },
    },
  });
  if (open > 0) return;

  const campaign = await prisma.marketingCampaign.findUnique({
    where: { id: campaignId },
    select: { sentCount: true, failCount: true },
  });
  if (!campaign) return;

  const status =
    campaign.sentCount === 0
      ? "failed"
      : campaign.failCount > 0
        ? "partial"
        : "sent";

  await prisma.marketingCampaign.update({
    where: { id: campaignId },
    data: { status, sentAt: new Date() },
  });
}

/** Traite un lot de destinataires pending (cron). */
export async function processCampaignBatch(
  batchSize = CAMPAIGN_BATCH_SIZE,
): Promise<{
  recovered: number;
  processed: number;
  sent: number;
  failed: number;
}> {
  const recovered = await recoverStuckRecipients();
  if (!isEmailConfigured()) {
    return { recovered, processed: 0, sent: 0, failed: 0 };
  }

  const claimed = await claimPendingBatch(batchSize);
  let sent = 0;
  let failed = 0;

  const campaignIdsInBatch = [...new Set(claimed.map((r) => r.campaignId))];
  const campaignRows =
    campaignIdsInBatch.length === 0
      ? []
      : await prisma.marketingCampaign.findMany({
          where: { id: { in: campaignIdsInBatch } },
          select: { id: true, subject: true, bodyText: true, status: true },
        });
  const campaignsById = new Map(campaignRows.map((c) => [c.id, c]));

  for (const row of claimed) {
    const campaign = campaignsById.get(row.campaignId);
    if (!campaign || campaign.status === "failed") {
      await prisma.marketingCampaignRecipient.update({
        where: { id: row.id },
        data: { status: "failed", lastError: "campaign_unavailable" },
      });
      failed += 1;
      continue;
    }

    const unsubPage = unsubscribeUrlFor(row.email);
    const unsubApi = unsubscribeApiUrlFor(row.email);
    const headers: Record<string, string> = {};
    if (unsubApi) {
      headers["List-Unsubscribe"] = `<${unsubApi}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }

    const result = await sendEmail({
      to: row.email,
      subject: campaign.subject,
      text: buildCampaignText(campaign.bodyText, unsubPage),
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });

    if (result.ok) {
      sent += 1;
      await prisma.$transaction([
        prisma.marketingCampaignRecipient.update({
          where: { id: row.id },
          data: { status: "sent", sentAt: new Date(), lastError: null },
        }),
        prisma.marketingCampaign.update({
          where: { id: row.campaignId },
          data: { sentCount: { increment: 1 } },
        }),
        prisma.emailEvent.create({
          data: {
            email: row.email,
            type: "accepted",
            campaignId: row.campaignId,
          },
        }),
      ]);
    } else {
      failed += 1;
      await prisma.$transaction([
        prisma.marketingCampaignRecipient.update({
          where: { id: row.id },
          data: {
            status: "failed",
            lastError: result.error.slice(0, 300),
          },
        }),
        prisma.marketingCampaign.update({
          where: { id: row.campaignId },
          data: { failCount: { increment: 1 } },
        }),
      ]);
    }
  }

  const campaignIds = [...new Set(claimed.map((r) => r.campaignId))];
  for (const id of campaignIds) {
    await finalizeCampaign(id);
  }

  return { recovered, processed: claimed.length, sent, failed };
}
