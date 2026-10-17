import http from "node:http";
import https from "node:https";
import type { IncomingMessage } from "node:http";

export type PinnedFetchResult = {
  status: number;
  ok: boolean;
};

/**
 * HTTP(S) POST vers une IP déjà validée, avec Host + SNI du hostname d’origine.
 * Évite le DNS rebinding entre validation et connexion.
 */
export async function pinnedWebhookPost(input: {
  url: string;
  pinnedIp: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs?: number;
}): Promise<PinnedFetchResult> {
  const parsed = new URL(input.url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("protocol_unsupported");
  }

  const isHttps = parsed.protocol === "https:";
  const ip = input.pinnedIp.replace(/^\[|\]$/g, "");
  const port = parsed.port
    ? Number(parsed.port)
    : isHttps
      ? 443
      : 80;
  const path = `${parsed.pathname}${parsed.search}`;
  const timeoutMs = input.timeoutMs ?? 8_000;

  const headers: Record<string, string> = {
    ...input.headers,
    Host: parsed.host,
    "Content-Length": Buffer.byteLength(input.body, "utf8").toString(),
  };

  return new Promise((resolve, reject) => {
    const onResponse = (res: IncomingMessage) => {
      res.resume();
      const status = res.statusCode ?? 0;
      resolve({ status, ok: status >= 200 && status < 300 });
    };

    const req = isHttps
      ? https.request(
          {
            host: ip,
            port,
            path,
            method: "POST",
            headers,
            servername: parsed.hostname,
            timeout: timeoutMs,
          },
          onResponse
        )
      : http.request(
          {
            host: ip,
            port,
            path,
            method: "POST",
            headers,
            timeout: timeoutMs,
          },
          onResponse
        );

    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", reject);
    req.write(input.body, "utf8");
    req.end();
  });
}
