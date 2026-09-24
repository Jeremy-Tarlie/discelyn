import { notifyRuntimeReload, notifyRuntimeStop } from "@/lib/runtime-notify";
import { getPlatformInviteUrl } from "@/lib/invite";

export type ProvisionResult = {
  status: "ONLINE" | "PROVISIONING" | "PENDING" | "ERROR";
  inviteUrl: string | null;
  error: string | null;
};

export async function provisionBot(input: {
  botId: string;
  guildId?: string | null;
  guildLinked: boolean;
  botPresentInGuild: boolean;
}): Promise<ProvisionResult> {
  const inviteUrl = getPlatformInviteUrl(input.guildId ?? undefined);

  if (!input.guildLinked) {
    return {
      status: "PENDING",
      inviteUrl,
      error: null,
    };
  }

  if (!input.botPresentInGuild) {
    return {
      status: "PENDING",
      inviteUrl,
      error: null,
    };
  }

  const notify = await notifyRuntimeReload({ botId: input.botId });

  if (notify.skipped) {
    return {
      status: "PROVISIONING",
      inviteUrl,
      error: null,
    };
  }

  if (!notify.ok) {
    return {
      status: "PROVISIONING",
      inviteUrl,
      error: `Runtime injoignable (${notify.error}). Nouvelle tentative au prochain poll.`,
    };
  }

  return {
    status: "ONLINE",
    inviteUrl,
    error: null,
  };
}

/** Notifie le runtime après suppression DB (leave Discord immédiat). */
export async function deprovisionBot(
  botId: string,
  guildId: string | null = null
): Promise<void> {
  await notifyRuntimeStop(botId, guildId);
}

