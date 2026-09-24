/**
 * Accès admin commercial (leads).
 * Préférer LEADS_ADMIN_DISCORD_IDS (stable) ; LEADS_ADMIN_EMAILS en complément.
 * Les deux listes sont des allowlists — vide = refus.
 */
export function parseAllowlist(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isLeadsAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = parseAllowlist(process.env.LEADS_ADMIN_EMAILS);
  if (allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}

export function isLeadsAdminDiscordId(
  discordId: string | null | undefined
): boolean {
  if (!discordId) return false;
  const allowed = parseAllowlist(process.env.LEADS_ADMIN_DISCORD_IDS);
  if (allowed.length === 0) return false;
  return allowed.includes(discordId.trim().toLowerCase());
}

/**
 * Admin leads si Discord ID listé, ou à défaut email listé
 * (et aucune liste Discord configurée).
 * Si LEADS_ADMIN_DISCORD_IDS est défini, l’email seul ne suffit pas.
 */
export function isLeadsAdmin(input: {
  email?: string | null;
  discordId?: string | null;
}): boolean {
  const discordAllowlist = parseAllowlist(process.env.LEADS_ADMIN_DISCORD_IDS);
  if (discordAllowlist.length > 0) {
    return isLeadsAdminDiscordId(input.discordId);
  }
  return isLeadsAdminEmail(input.email);
}
