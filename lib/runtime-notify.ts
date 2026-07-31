/**
 * Notify the bot-runtime process to reload a bot.
 * In local/dev without RUNTIME_URL, this is a no-op (runtime polls DB).
 */
export async function notifyRuntimeReload(botId: string): Promise<void> {
  const baseUrl = process.env.BOT_RUNTIME_URL;
  const secret = process.env.BOT_RUNTIME_SECRET;

  if (!baseUrl || !secret) {
    return;
  }

  try {
    await fetch(`${baseUrl.replace(/\/$/, "")}/internal/reload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ botId }),
    });
  } catch {
    // Runtime may be restarting; it will pick up from DB on next poll.
  }
}

export async function notifyRuntimeStop(botId: string): Promise<void> {
  const baseUrl = process.env.BOT_RUNTIME_URL;
  const secret = process.env.BOT_RUNTIME_SECRET;

  if (!baseUrl || !secret) {
    return;
  }

  try {
    await fetch(`${baseUrl.replace(/\/$/, "")}/internal/stop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ botId }),
    });
  } catch {
    // ignore
  }
}
