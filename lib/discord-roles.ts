/**
 * Discord REST — attribution / retrait de rôles via le bot plateforme.
 */

function platformBotToken(): string | null {
  const token = process.env.DISCORD_BOT_TOKEN;
  return token && token.length > 0 ? token : null;
}

export type DiscordRoleActionResult =
  | { ok: true; inGuild: true }
  | { ok: true; inGuild: false }
  | { ok: false; error: string; inGuild: boolean };

async function discordBotFetch(
  path: string,
  init?: RequestInit
): Promise<Response | null> {
  const token = platformBotToken();
  if (!token) return null;
  return fetch(`https://discord.com/api/v10${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

export async function isMemberInGuild(
  guildId: string,
  discordUserId: string
): Promise<boolean | null> {
  const response = await discordBotFetch(
    `/guilds/${guildId}/members/${discordUserId}`
  );
  if (!response) return null;
  if (response.status === 404) return false;
  return response.ok;
}

export async function grantGuildRole(input: {
  guildId: string;
  discordUserId: string;
  roleId: string;
}): Promise<DiscordRoleActionResult> {
  const inGuild = await isMemberInGuild(input.guildId, input.discordUserId);
  if (inGuild === null) {
    return { ok: false, error: "DISCORD_BOT_TOKEN manquant", inGuild: false };
  }
  if (!inGuild) {
    return { ok: true, inGuild: false };
  }

  const response = await discordBotFetch(
    `/guilds/${input.guildId}/members/${input.discordUserId}/roles/${input.roleId}`,
    { method: "PUT" }
  );
  if (!response) {
    return { ok: false, error: "DISCORD_BOT_TOKEN manquant", inGuild: true };
  }
  if (response.ok || response.status === 204) {
    return { ok: true, inGuild: true };
  }
  const body = await response.text().catch(() => "");
  return {
    ok: false,
    error: `Discord ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
    inGuild: true,
  };
}

export async function revokeGuildRole(input: {
  guildId: string;
  discordUserId: string;
  roleId: string;
}): Promise<DiscordRoleActionResult> {
  const inGuild = await isMemberInGuild(input.guildId, input.discordUserId);
  if (inGuild === null) {
    return { ok: false, error: "DISCORD_BOT_TOKEN manquant", inGuild: false };
  }
  if (!inGuild) {
    return { ok: true, inGuild: false };
  }

  const response = await discordBotFetch(
    `/guilds/${input.guildId}/members/${input.discordUserId}/roles/${input.roleId}`,
    { method: "DELETE" }
  );
  if (!response) {
    return { ok: false, error: "DISCORD_BOT_TOKEN manquant", inGuild: true };
  }
  if (response.ok || response.status === 204 || response.status === 404) {
    return { ok: true, inGuild: true };
  }
  const body = await response.text().catch(() => "");
  return {
    ok: false,
    error: `Discord ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
    inGuild: true,
  };
}

export async function listGuildRoles(
  guildId: string
): Promise<Array<{ id: string; name: string; position: number }> | null> {
  const response = await discordBotFetch(`/guilds/${guildId}/roles`);
  if (!response?.ok) return null;
  const roles = (await response.json()) as Array<{
    id: string;
    name: string;
    position: number;
    managed?: boolean;
  }>;
  return roles
    .filter((r) => r.name !== "@everyone" && !r.managed)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name, position: r.position }));
}

/** Invite one-shot (max age 24h, max uses 1) pour rejoindre puis recevoir le rôle. */
export async function createSingleUseInvite(
  guildId: string,
  channelId: string | null
): Promise<string | null> {
  let targetChannelId = channelId;
  if (!targetChannelId) {
    const channels = await discordBotFetch(`/guilds/${guildId}/channels`);
    if (!channels?.ok) return null;
    const list = (await channels.json()) as Array<{
      id: string;
      type: number;
    }>;
    const text = list.find((c) => c.type === 0);
    targetChannelId = text?.id ?? null;
  }
  if (!targetChannelId) return null;

  const response = await discordBotFetch(
    `/channels/${targetChannelId}/invites`,
    {
      method: "POST",
      body: JSON.stringify({
        max_age: 86_400,
        max_uses: 1,
        unique: true,
      }),
    }
  );
  if (!response?.ok) return null;
  const data = (await response.json()) as { code?: string };
  return data.code ? `https://discord.gg/${data.code}` : null;
}

export type ShopProduct = {
  name: string;
  pitch: string | null;
  paymentLinkUrl: string;
};

/** Embed boutique avec boutons lien « Acheter » (jusqu’à 5 produits). */
export async function postAccessShop(input: {
  channelId: string;
  botName: string;
  products: ShopProduct[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const products = input.products.filter((p) => p.paymentLinkUrl).slice(0, 5);
  if (products.length === 0) {
    return { ok: false, error: "Aucun lien de paiement" };
  }

  const description = products
    .map(
      (p, i) =>
        `**${i + 1}. ${p.name}**${p.pitch ? `\n${p.pitch}` : ""}`
    )
    .join("\n\n");

  const components = [
    {
      type: 1,
      components: products.map((p) => ({
        type: 2,
        style: 5,
        label: `Acheter — ${p.name}`.slice(0, 80),
        url: p.paymentLinkUrl,
      })),
    },
  ];

  const response = await discordBotFetch(`/channels/${input.channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      embeds: [
        {
          title: `Boutique formation — ${input.botName}`,
          description: description.slice(0, 4096),
          color: 0x5865f2,
          footer: {
            text: "Paiement sécurisé Stripe · accès Discord automatique via Botly",
          },
        },
      ],
      components,
    }),
  });

  if (!response?.ok) {
    const body = await response?.text().catch(() => "");
    return {
      ok: false,
      error: `Discord ${response?.status ?? "?"}${body ? `: ${body.slice(0, 160)}` : ""}`,
    };
  }
  return { ok: true };
}

export async function sendUserDm(input: {
  discordUserId: string;
  content: string;
}): Promise<boolean> {
  const channelRes = await discordBotFetch("/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: input.discordUserId }),
  });
  if (!channelRes?.ok) return false;
  const channel = (await channelRes.json()) as { id?: string };
  if (!channel.id) return false;

  const msgRes = await discordBotFetch(`/channels/${channel.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ content: input.content.slice(0, 2000) }),
  });
  return Boolean(msgRes?.ok);
}

export async function postGuildLog(input: {
  channelId: string;
  content: string;
}): Promise<void> {
  await discordBotFetch(`/channels/${input.channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content: input.content.slice(0, 2000) }),
  });
}
