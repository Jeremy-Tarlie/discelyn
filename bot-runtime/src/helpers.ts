export type ModerationAction =
  | { type: "kick"; targetId: string; reason: string }
  | { type: "ban"; targetId: string; reason: string }
  | { type: "timeout"; targetId: string; minutes: number; reason: string }
  | { type: "untimeout"; targetId: string }
  | { type: "warn"; targetId: string; reason: string }
  | { type: "warnings"; targetId: string }
  | { type: "clearwarns"; targetId: string };

export type WarningEntry = {
  reason: string;
  by: string;
  at: number;
};

export type AutomodHit =
  | { kind: "banned_word"; detail: string }
  | { kind: "invite" }
  | { kind: "link" }
  | { kind: "mentions"; count: number }
  | { kind: "spam" };

export type AutomodOptions = {
  bannedWords: string[];
  blockInvites: boolean;
  blockLinks: boolean;
  maxMentions: number;
};

const MENTION_RE = /^<@!?(\d+)>$/;
const INVITE_RE = /(discord\.gg\/|discord\.com\/invite\/)/i;
const LINK_RE = /https?:\/\/|www\./i;
const USER_MENTION_RE = /<@!?\d+>/g;

function parseTargetId(token: string): string | null {
  const mention = token.match(MENTION_RE);
  if (mention?.[1]) return mention[1];
  if (/^\d{17,20}$/.test(token)) return token;
  return null;
}

export function parseModerationCommand(
  content: string,
  prefix: string
): ModerationAction | null {
  if (!content.startsWith(prefix)) return null;
  const body = content.slice(prefix.length).trim();
  const parts = body.split(/\s+/);
  const command = parts[0]?.toLowerCase();
  if (!command) return null;

  if (command === "kick" || command === "ban" || command === "warn") {
    const targetId = parts[1] ? parseTargetId(parts[1]) : null;
    if (!targetId) return null;
    const reason = parts.slice(2).join(" ").trim() || "Aucune raison";
    return { type: command, targetId, reason };
  }

  if (command === "warnings" || command === "clearwarns") {
    const targetId = parts[1] ? parseTargetId(parts[1]) : null;
    if (!targetId) return null;
    return { type: command, targetId };
  }

  if (command === "timeout") {
    const targetId = parts[1] ? parseTargetId(parts[1]) : null;
    const minutes = Number(parts[2]);
    if (!targetId || !Number.isFinite(minutes) || minutes <= 0) return null;
    const reason = parts.slice(3).join(" ").trim() || "Aucune raison";
    return {
      type: "timeout",
      targetId,
      minutes: Math.min(minutes, 60 * 24 * 28),
      reason,
    };
  }

  if (command === "untimeout") {
    const targetId = parts[1] ? parseTargetId(parts[1]) : null;
    if (!targetId) return null;
    return { type: "untimeout", targetId };
  }

  return null;
}

export function normalizeSlashName(name: string): string | null {
  const cleaned = name
    .trim()
    .replace(/^[/!]+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);
  return cleaned.length >= 1 ? cleaned : null;
}

export function matchPrefixCommand(
  content: string,
  commands: Array<{ name: string; response: string }>
): string | null {
  const normalized = content.trim().toLowerCase();
  for (const command of commands) {
    const trigger = normalizeSlashName(command.name);
    if (!trigger) continue;
    if (normalized === `!${trigger}` || normalized === `/${trigger}`) {
      return command.response;
    }
  }
  return null;
}

export type ReactionRole = {
  messageId: string;
  emoji: string;
  roleId: string;
};

export function parseReactionRoles(value: unknown): ReactionRole[] {
  if (!Array.isArray(value)) return [];
  const roles: ReactionRole[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    if (
      typeof record.messageId === "string" &&
      typeof record.emoji === "string" &&
      typeof record.roleId === "string"
    ) {
      roles.push({
        messageId: record.messageId,
        emoji: record.emoji,
        roleId: record.roleId,
      });
    }
  }
  return roles.slice(0, 25);
}

export function emojiMatches(reactionEmoji: string, configured: string): boolean {
  return (
    reactionEmoji === configured ||
    reactionEmoji === configured.replace(/^<|>$/g, "")
  );
}

export function evaluateAutomod(
  content: string,
  options: AutomodOptions
): AutomodHit | null {
  const lower = content.toLowerCase();
  for (const word of options.bannedWords) {
    const needle = word.toLowerCase().trim();
    if (needle && lower.includes(needle)) {
      return { kind: "banned_word", detail: word };
    }
  }
  if (options.blockInvites && INVITE_RE.test(content)) {
    return { kind: "invite" };
  }
  if (options.blockLinks && LINK_RE.test(content)) {
    return { kind: "link" };
  }
  if (options.maxMentions > 0) {
    const mentions = content.match(USER_MENTION_RE)?.length ?? 0;
    if (mentions > options.maxMentions) {
      return { kind: "mentions", count: mentions };
    }
  }
  return null;
}

/** Anti-spam simple : même auteur + même contenu dans une fenêtre courte. */
export class RecentMessageTracker {
  private readonly entries = new Map<string, { content: string; at: number }>();

  constructor(private readonly windowMs: number = 8_000) {}

  isSpam(authorId: string, content: string, now = Date.now()): boolean {
    const key = authorId;
    const normalized = content.trim().toLowerCase();
    if (!normalized) return false;
    const previous = this.entries.get(key);
    this.entries.set(key, { content: normalized, at: now });
    if (!previous) return false;
    return (
      previous.content === normalized && now - previous.at <= this.windowMs
    );
  }
}

export function isTicketChannelName(name: string): boolean {
  return name.toLowerCase().startsWith("ticket-");
}

type ChannelRef = { id: string; name: string };

/**
 * Interpole le welcome : {mention}, {user}, {rules}, et #salon-name → <#id>.
 * Un `#texte` brut n’est jamais une mention Discord cliquable.
 */
export function resolveWelcomeText(input: {
  template: string;
  memberMention: string;
  username: string;
  rulesChannelId: string;
  channels: ChannelRef[];
}): string {
  const byName = new Map(
    input.channels
      .filter((ch) => ch.name.length > 0)
      .map((ch) => [ch.name.toLowerCase(), ch.id])
  );

  let text = input.template
    .replaceAll("{mention}", input.memberMention)
    .replaceAll("{user}", input.username);

  if (input.rulesChannelId) {
    text = text.replaceAll("{rules}", `<#${input.rulesChannelId}>`);
  } else {
    const fallback =
      byName.get("règles") ??
      byName.get("regles") ??
      byName.get("rules");
    text = text.replaceAll(
      "{rules}",
      fallback ? `<#${fallback}>` : "*salon règles non configuré*"
    );
  }

  // #nom-salon → <#id> (ignore déjà <#id>)
  text = text.replace(/#([\w-àâäéèêëïîôùûüç]+)/gi, (match, rawName: string, offset: number, full: string) => {
    if (offset > 0 && full[offset - 1] === "<") return match;
    const id = byName.get(rawName.toLowerCase());
    return id ? `<#${id}>` : match;
  });

  return text;
}
