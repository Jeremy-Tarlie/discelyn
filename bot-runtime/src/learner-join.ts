/**
 * Délègue le grant-on-join au web (source unique : fulfillDiscordAccess).
 * Retry court si le web est momentanément down ; le cron `retryStuckGrants`
 * reprend les cas plus longs.
 */

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestOnce(input: {
  guildId: string;
  discordUserId: string;
  secret: string;
}): Promise<number> {
  const base =
    process.env.WEB_INTERNAL_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  if (!base) {
    throw new Error(
      "WEB_INTERNAL_URL (ou NEXTAUTH_URL) requis pour grant-on-join"
    );
  }

  const response = await fetch(`${base}/api/internal/learner-join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.secret}`,
    },
    body: JSON.stringify({
      guildId: input.guildId,
      discordUserId: input.discordUserId,
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`learner-join HTTP ${response.status}`);
  }

  const data = (await response.json()) as { granted?: number };
  if (typeof data.granted !== "number") {
    throw new Error("learner-join réponse invalide");
  }
  return data.granted;
}

export async function requestGrantOnJoinViaWeb(input: {
  guildId: string;
  discordUserId: string;
  secret: string;
}): Promise<number> {
  const maxAttempts = 3;
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await requestOnce(input);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts - 1) {
        await sleep(400 * (attempt + 1));
      }
    }
  }
  throw lastError ?? new Error("learner-join failed");
}
