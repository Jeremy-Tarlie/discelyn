import { getAppEnvironment } from "@/lib/demo";

/**
 * Accès admin commercial / plateforme.
 * Préférer PLATFORM_ADMIN_* (ou LEADS_ADMIN_* en rétrocompat).
 * Discord IDs prioritaires sur emails. Listes vides → refus.
 * En production : Discord-only (email insuffisant).
 */
export function parseAllowlist(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function discordAllowlist(): string[] {
  const platform = parseAllowlist(process.env.PLATFORM_ADMIN_DISCORD_IDS);
  if (platform.length > 0) return platform;
  return parseAllowlist(process.env.LEADS_ADMIN_DISCORD_IDS);
}

function emailAllowlist(): string[] {
  const platform = parseAllowlist(process.env.PLATFORM_ADMIN_EMAILS);
  if (platform.length > 0) return platform;
  return parseAllowlist(process.env.LEADS_ADMIN_EMAILS);
}

export function isLeadsAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = emailAllowlist();
  if (allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}

export function isLeadsAdminDiscordId(
  discordId: string | null | undefined,
): boolean {
  if (!discordId) return false;
  const allowed = discordAllowlist();
  if (allowed.length === 0) return false;
  return allowed.includes(discordId.trim().toLowerCase());
}

/**
 * Admin si Discord ID listé.
 * Hors production : à défaut email listé si aucune liste Discord.
 * Production : Discord obligatoire (fail-closed si allowlist Discord vide).
 */
export function isLeadsAdmin(input: {
  email?: string | null;
  discordId?: string | null;
}): boolean {
  const discord = discordAllowlist();
  if (getAppEnvironment() === "production") {
    if (discord.length === 0) return false;
    return isLeadsAdminDiscordId(input.discordId);
  }
  if (discord.length > 0) {
    return isLeadsAdminDiscordId(input.discordId);
  }
  return isLeadsAdminEmail(input.email);
}
