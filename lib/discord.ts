/**
 * Validate a Discord bot token by calling Discord REST /users/@me
 */
export type DiscordBotIdentity = {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
};

export async function fetchDiscordBotIdentity(
  token: string
): Promise<
  { ok: true; bot: DiscordBotIdentity } | { ok: false; error: string }
> {
  try {
    const response = await fetch("https://discord.com/api/v10/users/@me", {
      headers: {
        Authorization: `Bot ${token}`,
      },
      cache: "no-store",
    });

    if (response.status === 401) {
      return { ok: false, error: "Token Discord invalide" };
    }

    if (!response.ok) {
      return {
        ok: false,
        error: `Discord API erreur HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as DiscordBotIdentity;
    if (!data.id || !data.username) {
      return { ok: false, error: "Réponse Discord inattendue" };
    }

    return { ok: true, bot: data };
  } catch {
    return { ok: false, error: "Impossible de joindre Discord" };
  }
}
