/**
 * Invite URL du bot plateforme Botly (jamais un token utilisateur).
 * `guildId` pré-sélectionne le serveur dans le flux OAuth Discord.
 */
export function buildPlatformInviteUrl(
  clientId: string,
  options?: { guildId?: string }
): string {
  // Inclut ChangeNickname pour appliquer le nom de config comme pseudo serveur.
  const permissions = "335932496";
  const params = new URLSearchParams({
    client_id: clientId,
    permissions,
    scope: "bot",
  });
  if (options?.guildId) {
    params.set("guild_id", options.guildId);
    params.set("disable_guild_select", "true");
  }
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

export function getPlatformInviteUrl(guildId?: string): string | null {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) return null;
  return buildPlatformInviteUrl(
    clientId,
    guildId ? { guildId } : undefined
  );
}
