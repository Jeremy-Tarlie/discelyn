/**
 * CTA « Rejoindre Discord » : uniquement depuis l’accès en DB + allowlist hôte.
 * Jamais depuis `?invite=` (open-redirect / phishing).
 */
export function isDiscordInviteUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (host === "discord.gg") {
      return parsed.pathname.length > 1 && !parsed.pathname.includes("..");
    }
    if (host === "discord.com" || host === "www.discord.com") {
      return /^\/invite\/[^/]+\/?$/i.test(parsed.pathname);
    }
    return false;
  } catch {
    return false;
  }
}

export function resolveJoinCta(
  access: { status: string; inviteUrl: string | null } | null | undefined
): string | null {
  if (!access) return null;
  if (access.status !== "AWAITING_JOIN") return null;
  const url = access.inviteUrl?.trim();
  if (!url || !isDiscordInviteUrl(url)) return null;
  return url;
}
