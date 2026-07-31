import { notifyRuntimeReload, notifyRuntimeStop } from "@/lib/runtime-notify";

/**
 * Local/prod model:
 * - Tokens are stored encrypted in Postgres
 * - `bot-runtime` process loads bots from DB and runs discord.js
 * - Optional BOT_RUNTIME_URL notifies the runtime immediately
 */

export type ProvisionResult = {
  status: "ONLINE" | "PROVISIONING" | "PENDING" | "ERROR";
  containerId: string | null;
  inviteUrl: string | null;
  error: string | null;
};

export async function provisionBot(input: {
  botId: string;
  hasToken: boolean;
}): Promise<ProvisionResult> {
  if (!input.hasToken) {
    return {
      status: "PENDING",
      containerId: null,
      inviteUrl: null,
      error: null,
    };
  }

  await notifyRuntimeReload(input.botId);

  return {
    status: "PROVISIONING",
    containerId: `runtime-${input.botId.slice(0, 8)}`,
    inviteUrl: null,
    error: null,
  };
}

export async function deprovisionBot(botId: string): Promise<void> {
  await notifyRuntimeStop(botId);
}
