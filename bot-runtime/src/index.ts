import "dotenv/config";
import http from "node:http";
import { PrismaClient } from "../../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Client } from "discord.js";
import { decryptSecret } from "./crypto.js";
import { createBotClient, type RuntimeBotConfig } from "./bot-factory.js";

type RunningBot = {
  client: Client;
  fingerprint: string;
};

const running = new Map<string, RunningBot>();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} manquant`);
  return value;
}

const databaseUrl = requireEnv("DATABASE_URL");
const encryptionKey = requireEnv("BOT_SECRETS_ENCRYPTION_KEY");
const runtimeSecret = requireEnv("BOT_RUNTIME_SECRET");
const port = Number(process.env.BOT_RUNTIME_PORT ?? "4001");

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

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

function fingerprint(bot: {
  updatedAt: Date;
  enabledModules: string[];
  tokenCiphertext: string | null;
}): string {
  return `${bot.updatedAt.toISOString()}|${bot.enabledModules.join(",")}|${bot.tokenCiphertext ?? ""}`;
}

async function stopBot(botId: string): Promise<void> {
  const current = running.get(botId);
  if (!current) return;
  current.client.destroy();
  running.delete(botId);
  console.log(`[${botId}] stopped`);
}

async function startOrReloadBot(botId: string): Promise<void> {
  const row = await prisma.bot.findUnique({
    where: { id: botId },
    include: {
      user: {
        include: { subscription: true },
      },
    },
  });

  if (
    !row ||
    !row.hasToken ||
    !row.tokenCiphertext ||
    !row.tokenNonce ||
    !row.tokenAuthTag
  ) {
    await stopBot(botId);
    return;
  }

  const status = row.user.subscription?.status ?? "ACTIVE";
  if (status !== "ACTIVE" && status !== "TRIALING") {
    await stopBot(botId);
    await prisma.bot.update({
      where: { id: botId },
      data: { status: "PAUSED", lastError: "Abonnement inactif" },
    });
    return;
  }

  const fp = fingerprint(row);
  const existing = running.get(botId);
  if (existing?.fingerprint === fp) {
    await prisma.bot.update({
      where: { id: botId },
      data: { lastSeenAt: new Date(), status: "ONLINE", lastError: null },
    });
    return;
  }

  await stopBot(botId);

  try {
    const token = decryptSecret({
      ciphertext: row.tokenCiphertext,
      nonce: row.tokenNonce,
      authTag: row.tokenAuthTag,
      keyHex: encryptionKey,
    });

    const forceBranding = row.user.subscription?.plan === "FREE";
    const config: RuntimeBotConfig = {
      id: row.id,
      name: row.name,
      token,
      enabledModules: row.enabledModules,
      config: parseConfig(row.config),
      customCommands: parseCommands(row.customCommands),
      forceBranding,
    };

    const client = createBotClient(config);
    await client.login(token);
    running.set(botId, { client, fingerprint: fp });

    await prisma.bot.update({
      where: { id: botId },
      data: {
        status: "ONLINE",
        lastError: null,
        lastSeenAt: new Date(),
        containerId: `runtime-${botId.slice(0, 8)}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur runtime";
    console.error(`[${botId}] failed`, message);
    await prisma.bot.update({
      where: { id: botId },
      data: { status: "ERROR", lastError: message },
    });
  }
}

async function syncAll(): Promise<void> {
  const bots = await prisma.bot.findMany({
    where: { hasToken: true },
    select: { id: true },
  });

  const ids = new Set(bots.map((bot) => bot.id));
  for (const runningId of running.keys()) {
    if (!ids.has(runningId)) {
      await stopBot(runningId);
    }
  }

  for (const bot of bots) {
    await startOrReloadBot(bot.id);
  }
}

function authorize(req: http.IncomingMessage): boolean {
  const header = req.headers.authorization;
  return header === `Bearer ${runtimeSecret}`;
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
        bots: running.size,
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
      const botId = typeof body.botId === "string" ? body.botId : null;
      if (!botId) {
        res.writeHead(400).end("botId required");
        return;
      }
      await startOrReloadBot(botId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === "POST" && req.url === "/internal/stop") {
      const body = await readJson(req);
      const botId = typeof body.botId === "string" ? body.botId : null;
      if (!botId) {
        res.writeHead(400).end("botId required");
        return;
      }
      await stopBot(botId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404).end("not found");
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    res.writeHead(500).end(message);
  }
});

await syncAll();
setInterval(() => {
  void syncAll();
}, 30_000);

server.listen(port, () => {
  console.log(`botly-runtime listening on :${port}`);
});
