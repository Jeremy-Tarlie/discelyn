"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { DashboardWebhook } from "@/lib/dashboard-data";

const ALL_EVENTS = [
  "payment_received",
  "role_granted",
  "revoked",
  "expired",
  "sold_out",
] as const;

export function WebhooksPanel({
  initialHooks,
}: {
  initialHooks: DashboardWebhook[];
}) {
  const t = useTranslations("dashboard.webhooks");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hooks, setHooks] = useState(initialHooks);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([
    "payment_received",
    "role_granted",
  ]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setHooks(initialHooks);
  }, [initialHooks]);

  async function create() {
    setError(null);
    const res = await fetch("/api/outbound-webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, events }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? t("saveFailed"));
      return;
    }
    setUrl("");
    setMessage(t("created"));
    startTransition(() => {
      router.refresh();
    });
  }

  async function remove(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    setError(null);
    const res = await fetch(`/api/outbound-webhooks?id=${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? t("saveFailed"));
      return;
    }
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-page-fg">{t("title")}</h1>
        <p className="mt-1 text-sm text-soft">{t("body")}</p>
      </div>

      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <div>
          <label htmlFor="webhook-url" className="sr-only">
            {t("url")}
          </label>
          <input
            id="webhook-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("urlPlaceholder")}
            className="w-full rounded-xl border border-line bg-surface-muted px-3 py-2 text-sm"
          />
        </div>
        <fieldset>
          <legend className="mb-2 text-xs text-soft">{t("events")}</legend>
          <div className="flex flex-wrap gap-2">
            {ALL_EVENTS.map((ev) => (
              <label
                key={ev}
                className="flex items-center gap-1 text-xs text-soft"
              >
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
        </fieldset>
        <button
          type="button"
          onClick={() => void create()}
          className="rounded-full bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white"
        >
          {t("create")}
        </button>
      </div>
      {pending ? <p className="text-sm text-soft">{t("loading")}</p> : null}
      {error ? <p className="text-sm text-warn">{error}</p> : null}
      {message ? <p className="text-sm text-signal">{message}</p> : null}

      <ul className="divide-y divide-line rounded-2xl border border-line">
        {hooks.length === 0 ? (
          <li className="px-4 py-3 text-sm text-soft">{t("empty")}</li>
        ) : (
          hooks.map((h) => (
            <li key={h.id} className="space-y-1 px-4 py-3 text-sm">
              <p className="break-all font-medium text-page-fg">{h.url}</p>
              <p className="text-xs text-soft">{h.events.join(", ")}</p>
              <p className="font-mono text-xs text-soft">
                {t("secretPrefix")} {h.secret.slice(0, 8)}…
              </p>
              <button
                type="button"
                className="text-xs text-warn underline"
                onClick={() => void remove(h.id)}
              >
                {t("delete")}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
