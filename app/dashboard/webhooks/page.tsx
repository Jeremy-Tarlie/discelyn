"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Hook = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret: string;
};

const ALL_EVENTS = [
  "payment_received",
  "role_granted",
  "revoked",
  "expired",
] as const;

export default function OutboundWebhooksPage() {
  const t = useTranslations("dashboard.webhooks");
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["payment_received", "role_granted"]);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch("/api/outbound-webhooks");
    const data = (await res.json()) as { webhooks?: Hook[] };
    setHooks(data.webhooks ?? []);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function create() {
    const res = await fetch("/api/outbound-webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, events }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setMessage(data.error ?? t("saveFailed"));
      return;
    }
    setUrl("");
    setMessage(t("created"));
    await reload();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-page-fg">{t("title")}</h1>
        <p className="mt-1 text-sm text-soft">{t("body")}</p>
      </div>

      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://hooks.zapier.com/…"
          className="w-full rounded-xl border border-line bg-surface-muted px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {ALL_EVENTS.map((ev) => (
            <label key={ev} className="flex items-center gap-1 text-xs text-soft">
              <input
                type="checkbox"
                checked={events.includes(ev)}
                onChange={(e) => {
                  setEvents((prev) =>
                    e.target.checked
                      ? [...prev, ev]
                      : prev.filter((x) => x !== ev)
                  );
                }}
              />
              {ev}
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void create()}
          className="rounded-full bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white"
        >
          {t("create")}
        </button>
      </div>
      {message ? <p className="text-sm text-signal">{message}</p> : null}

      <ul className="divide-y divide-line rounded-2xl border border-line">
        {hooks.map((h) => (
          <li key={h.id} className="space-y-1 px-4 py-3 text-sm">
            <p className="font-medium text-page-fg break-all">{h.url}</p>
            <p className="text-xs text-soft">{h.events.join(", ")}</p>
            <p className="font-mono text-xs text-soft">
              secret: {h.secret.slice(0, 8)}…
            </p>
            <button
              type="button"
              className="text-xs text-warn underline"
              onClick={() => {
                void fetch(`/api/outbound-webhooks?id=${h.id}`, {
                  method: "DELETE",
                }).then(() => reload());
              }}
            >
              {t("delete")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
