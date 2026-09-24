/**
 * Délègue le grant-on-join au web (source unique : fulfillDiscordAccess).
 * Pas de fallback local — si le web est down, le join est retenté au prochain
 * event ou via cron / re-claim.
 */

export async function requestGrantOnJoinViaWeb(input: {
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
