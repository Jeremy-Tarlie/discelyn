/**
 * Notify the bot-runtime process to reload / stop a bot.
 * Without BOT_RUNTIME_URL, no-op (runtime polls DB every 30s).
 *
 * `/internal/reload` resynchronise toujours toutes les configs en mémoire ;
 * le body (`botId` ou `userId`) sert au tracing côté runtime.
 */

export type NotifyResult = {
  ok: boolean;
  skipped: boolean;
  error: string | null;
};

export type RuntimeReloadTarget =
  | { botId: string }
  | { userId: string };

async function notify(
  path: "/internal/reload" | "/internal/stop",
  body: Record<string, string | null>
): Promise<NotifyResult> {
  const baseUrl = process.env.BOT_RUNTIME_URL;
  const secret = process.env.BOT_RUNTIME_SECRET;

  if (!baseUrl || !secret) {
    return { ok: true, skipped: true, error: null };
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      return {
        ok: false,
        skipped: false,
        error: `runtime HTTP ${response.status}`,
      };
    }
    return { ok: true, skipped: false, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "runtime unreachable";
    return { ok: false, skipped: false, error: message };
  }
}

export async function notifyRuntimeReload(
  target: RuntimeReloadTarget
): Promise<NotifyResult> {
  if ("userId" in target) {
    return notify("/internal/reload", {
      userId: target.userId,
      botId: null,
    });
  }
  return notify("/internal/reload", {
    botId: target.botId,
    userId: null,
  });
}

export async function notifyRuntimeStop(
  botId: string,
  guildId: string | null = null
): Promise<NotifyResult> {
  return notify("/internal/stop", { botId, guildId });
}
