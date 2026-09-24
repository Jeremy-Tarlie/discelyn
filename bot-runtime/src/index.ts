import "dotenv/config";
import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { PrismaClient } from "../../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Client, Guild } from "discord.js";
import { Events } from "discord.js";
import * as Sentry from "@sentry/node";
import {
  attachPlatformHandlers,
  createPlatformClient,
  type ConfigProvider,
  type GuildBotConfig,
  type WarningRepository,
} from "./bot-factory.js";
import { requestGrantOnJoinViaWeb } from "./learner-join.js";
import {
  filterModulesForLimits,
  resolvePlanLimits,
  trimCustomCommands,
} from "./plan-limits.js";
import { moderationWarningCutoff } from "./moderation-retention.js";

/** Délai avant de quitter un serveur non lié (invite → lien dashboard). */
const UNLINKED_LEAVE_GRACE_MS = 10 * 60 * 1000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} manquant`);
  return value;
}

const databaseUrl = requireEnv("DATABASE_URL");
const runtimeSecret = requireEnv("BOT_RUNTIME_SECRET");
const discordBotToken = requireEnv("DISCORD_BOT_TOKEN");
const port = Number(process.env.BOT_RUNTIME_PORT ?? "4001");

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "production",
    tracesSampleRate: 0.1,
  });
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const guildConfigs = new Map<string, GuildBotConfig>();
/** guildId → timestamp de join (pour grace period). */
const guildJoinedAt = new Map<string, number>();
let client: Client | null = null;
let configFingerprint = "";

function parseCommands(value: unknown): Array<{ name: string; response: string }> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is { name: string; response: string } => {
    if (typeof item !== "object" || item === null) return false;
    const record = item as Record<string, unknown>;
    return typeof record.name === "string" && typeof record.response === "string";
  });
}

function parseConfig(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

const configs: ConfigProvider = {
  getByGuildId(guildId) {
    return guildConfigs.get(guildId) ?? null;
  },
  listGuildIds() {
    return [...guildConfigs.keys()];
  },
};

const warnings: WarningRepository = {
  async add(botId, guildId, targetUserId, entry) {
    await prisma.moderationWarning.create({
      data: {
        botId,
        guildId,
        targetUserId,
        reason: entry.reason,
        moderatorTag: entry.by,
      },
    });
    return prisma.moderationWarning.count({
      where: { botId, guildId, targetUserId },
    });
  },
  async list(botId, guildId, targetUserId) {
    const rows = await prisma.moderationWarning.findMany({
      where: { botId, guildId, targetUserId },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    return rows.map(
      (row: {
        reason: string;
        moderatorTag: string;
        createdAt: Date;
      }) => ({
        reason: row.reason,
        by: row.moderatorTag,
        at: row.createdAt.getTime(),
      })
    );
  },
  async clear(botId, guildId, targetUserId) {
    const result = await prisma.moderationWarning.deleteMany({
      where: { botId, guildId, targetUserId },
    });
    return result.count;
  },
};

async function syncConfigs(): Promise<void> {
  const cutoff = moderationWarningCutoff();
  const purged = await prisma.moderationWarning.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  if (purged.count > 0) {
    console.log(
      `[platform] purged ${purged.count} moderation warning(s) older than retention`
    );
  }

  const rows = await prisma.bot.findMany({
    where: { guildId: { not: null } },
    include: {
      user: { include: { subscription: true } },
      accessProducts: {
        where: { active: true, paymentLinkUrl: { not: null } },
        select: {
          name: true,
          pitch: true,
          paymentLinkUrl: true,
          maxSeats: true,
          seatsUsed: true,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 10,
      },
    },
  });

  const next = new Map<string, GuildBotConfig>();
  const parts: string[] = [];
  const guildsByUser = new Map<string, number>();

  for (const row of rows) {
    const guildId = row.guildId;
    if (!guildId) continue;

    const status = row.user.subscription?.status ?? "ACTIVE";
    if (status !== "ACTIVE" && status !== "TRIALING") {
      await prisma.bot.update({
        where: { id: row.id },
        data: { status: "PAUSED", lastError: "Abonnement inactif" },
      });
      continue;
    }

    // Ne pas ignorer les bots PAUSED : après reprise d’abonnement / upgrade,
    // ils doivent repasser ONLINE s’ils sont dans les plafonds du plan.

    const plan = row.user.subscription?.plan ?? "FREE";
    const limits = resolvePlanLimits(plan);
    const enabledModules = filterModulesForLimits(limits, row.enabledModules);
    const customCommands = trimCustomCommands(
      limits,
      parseCommands(row.customCommands)
    );

    const userGuildCount = guildsByUser.get(row.userId) ?? 0;
    if (userGuildCount >= limits.maxGuilds) {
      await prisma.bot.update({
        where: { id: row.id },
        data: {
          status: "PAUSED",
          lastError: `Limite plan (${limits.maxGuilds} serveur${limits.maxGuilds > 1 ? "s" : ""}).`,
        },
      });
      continue;
    }
    guildsByUser.set(row.userId, userGuildCount + 1);

    const stillInGuild =
      !client?.isReady() || client.guilds.cache.has(guildId);

    await prisma.bot.update({
      where: { id: row.id },
      data: stillInGuild
        ? { status: "ONLINE", lastError: null, lastSeenAt: new Date() }
        : {
            status: "PENDING",
            lastError:
              "Bot absent du serveur — invite Botly ou attends la synchro.",
            lastSeenAt: new Date(),
          },
    });

    if (!stillInGuild) {
      continue;
    }

    const shopItems: GuildBotConfig["shop"] = [];
    for (const product of row.accessProducts) {
      const url = product.paymentLinkUrl;
      if (typeof url !== "string" || url.length === 0) continue;
      if (
        product.maxSeats != null &&
        product.seatsUsed >= product.maxSeats
      ) {
        continue;
      }
      shopItems.push({
        name: product.name,
        pitch: product.pitch,
        url,
      });
      if (shopItems.length >= 5) break;
    }

    next.set(guildId, {
      id: row.id,
      name: row.name,
      guildId,
      enabledModules,
      config: parseConfig(row.config),
      customCommands,
      forceBranding: limits.forceBranding,
      shop: shopItems,
    });
    parts.push(
      `${row.id}:${row.updatedAt.toISOString()}:${row.name}:${enabledModules.join(",")}:${plan}:shop${shopItems.length}`
    );
  }

  guildConfigs.clear();
  for (const [guildId, cfg] of next) {
    guildConfigs.set(guildId, cfg);
  }

  const fp = parts.sort().join("|");
  if (fp !== configFingerprint) {
    configFingerprint = fp;
    console.log(`[platform] configs synced: ${guildConfigs.size} guild(s)`);
    await syncGuildNicknames();
  }

  await leaveUnlinkedGuilds();
}

/** Pseudo Discord = nom de la config (visible dans la liste des membres). */
async function syncGuildNicknames(): Promise<void> {
  if (!client?.isReady()) return;
  for (const [guildId, cfg] of guildConfigs) {
    const guild = client.guilds.cache.get(guildId);
    const me = guild?.members.me;
    if (!me) continue;
    const nick = cfg.name.trim().slice(0, 32);
    if (!nick || me.nickname === nick) continue;
    await me.setNickname(nick).catch((err: unknown) => {
      const detail = err instanceof Error ? err.message : String(err);
      console.warn(
        `[platform] nickname failed guild=${guildId}: ${detail}`
      );
    });
  }
}

async function leaveGuild(guild: Guild, reason: string): Promise<void> {
  console.log(`[platform] leaving guild ${guild.id} (${reason})`);
  await guild.leave().catch(() => undefined);
  guildJoinedAt.delete(guild.id);
}

/**
 * Quitte les serveurs non liés après une période de grâce
 * (laisse le temps de lier depuis le dashboard après invite).
 */
async function leaveUnlinkedGuilds(): Promise<void> {
  if (!client?.isReady()) return;
  const linked = new Set(guildConfigs.keys());
  // Aussi considérer les guildIds en DB même PENDING (lien avant invite).
  const pendingRows = await prisma.bot.findMany({
    where: { guildId: { not: null } },
    select: { guildId: true },
  });
  for (const row of pendingRows) {
    if (row.guildId) linked.add(row.guildId);
  }

  const now = Date.now();
  for (const guild of client.guilds.cache.values()) {
    if (linked.has(guild.id)) continue;
    const joinedAt = guildJoinedAt.get(guild.id) ?? now;
    if (!guildJoinedAt.has(guild.id)) {
      guildJoinedAt.set(guild.id, joinedAt);
    }
    if (now - joinedAt < UNLINKED_LEAVE_GRACE_MS) continue;
    await leaveGuild(guild, "unlinked after grace");
  }
}

async function stopBot(botId: string, guildId: string | null): Promise<void> {
  const targets = new Set<string>();
  if (guildId) targets.add(guildId);
  for (const [gid, cfg] of guildConfigs) {
    if (cfg.id === botId) targets.add(gid);
  }

  for (const gid of targets) {
    guildConfigs.delete(gid);
    guildJoinedAt.delete(gid);
    const guild = client?.guilds.cache.get(gid);
    if (guild) {
      await leaveGuild(guild, `stop botId=${botId}`);
    }
  }
}

function authorize(req: http.IncomingMessage): boolean {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length);
  const expected = Buffer.from(runtimeSecret, "utf8");
  const actual = Buffer.from(provided, "utf8");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function asOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        service: "botly-runtime",
        ready: Boolean(client?.isReady()),
        time: new Date().toISOString(),
      })
    );
    return;
  }

  if (!authorize(req)) {
    res.writeHead(401).end("unauthorized");
    return;
  }

  try {
    if (req.method === "POST" && req.url === "/internal/reload") {
      const body = await readJson(req);
      const botId = asOptionalString(body.botId);
      const userId = asOptionalString(body.userId);
      // Resync global : la Map mémoire doit rester cohérente avec toute la DB.
      // botId / userId sont tracés pour le diagnostic (webhook vs provision).
      console.log(
        `[platform] reload requested botId=${botId ?? "-"} userId=${userId ?? "-"}`
      );
      await syncConfigs();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          guilds: guildConfigs.size,
          botId,
          userId,
        })
      );
      return;
    }

    if (req.method === "POST" && req.url === "/internal/stop") {
      const body = await readJson(req);
      const botId = asOptionalString(body.botId);
      const guildId = asOptionalString(body.guildId);
      if (botId) {
        await stopBot(botId, guildId);
      } else {
        await syncConfigs();
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, guilds: guildConfigs.size }));
      return;
    }

    res.writeHead(404).end("not found");
  } catch (error) {
    Sentry.captureException(error);
    const message = error instanceof Error ? error.message : "error";
    res.writeHead(500).end(message);
  }
});

async function shutdown(signal: string): Promise<void> {
  console.log(`shutdown ${signal}`);
  server.close();
  client?.destroy();
  await prisma.$disconnect();
  await Sentry.close(2000);
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

await syncConfigs();
client = createPlatformClient();

const learnerAccessJoiner = {
  async grantOnJoin(guildId: string, discordUserId: string): Promise<number> {
    try {
      return await requestGrantOnJoinViaWeb({
        guildId,
        discordUserId,
        secret: runtimeSecret,
      });
    } catch (error) {
      console.error(
        "[access] grant-on-join web failed (pas de fallback local)",
        { guildId, discordUserId, error }
      );
      Sentry.captureException(error);
      return 0;
    }
  },
};

attachPlatformHandlers(client, configs, warnings, learnerAccessJoiner);

client.on(Events.GuildCreate, (guild) => {
  guildJoinedAt.set(guild.id, Date.now());
  console.log(`[platform] joined guild ${guild.id} — grace ${UNLINKED_LEAVE_GRACE_MS / 1000}s`);
  void syncConfigs().catch((error) => {
    console.error("[platform] sync after GuildCreate failed", error);
    Sentry.captureException(error);
  });
});

await client.login(discordBotToken);

setInterval(() => {
  void syncConfigs().catch((error) => {
    console.error("[platform] sync failed", error);
    Sentry.captureException(error);
  });
}, 30_000);

server.listen(port, () => {
  console.log(`botly-runtime (platform) listening on :${port}`);
});

