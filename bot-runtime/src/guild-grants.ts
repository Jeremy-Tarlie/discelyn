/**
 * Résolution rôle Discord pour un grant multi-serveur.
 * Doit rester aligné avec lib/guild-grants-pure.ts (parity test).
 */

export type GuildRoleGrant = {
  guildId: string;
  discordRoleId: string;
};

/** Rôle à poser sur `joinedGuildId` (grant dédié ou rôle primaire). */
export function resolveRoleIdForGuild(input: {
  joinedGuildId: string;
  primaryGuildId: string;
  primaryRoleId: string;
  grants: GuildRoleGrant[];
}): string | null {
  const fromGrant = input.grants.find(
    (g) => g.guildId === input.joinedGuildId
  );
  if (fromGrant) return fromGrant.discordRoleId;
  if (input.joinedGuildId === input.primaryGuildId) {
    return input.primaryRoleId;
  }
  return null;
}

/**
 * Cibles de grant pour un produit : grants explicites, sinon le primaire.
 */
export function expandGuildRoleTargets(input: {
  primaryGuildId: string;
  primaryRoleId: string;
  grants: GuildRoleGrant[];
}): GuildRoleGrant[] {
  if (input.grants.length > 0) return input.grants;
  return [
    {
      guildId: input.primaryGuildId,
      discordRoleId: input.primaryRoleId,
    },
  ];
}
