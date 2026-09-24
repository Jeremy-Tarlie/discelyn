export type DiscordUserGuild = {
  id: string;
  name?: string;
  icon?: string | null;
  owner: boolean;
  permissions: string;
};

const ADMINISTRATOR = BigInt(8);
const MANAGE_GUILD = BigInt(32);

/** Owner, Administrator ou Manage Guild. */
export function userCanManageGuild(guild: DiscordUserGuild): boolean {
  if (guild.owner) return true;
  try {
    const perms = BigInt(guild.permissions);
    return (
      (perms & ADMINISTRATOR) === ADMINISTRATOR ||
      (perms & MANAGE_GUILD) === MANAGE_GUILD
    );
  } catch {
    return false;
  }
}
