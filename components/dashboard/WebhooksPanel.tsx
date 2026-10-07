"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { DashboardWebhook } from "@/lib/dashboard-data";
import {
  DashboardAlert,
  DashboardBadge,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardPanel,
  dashBtnGhostClass,
  dashBtnPrimaryClass,
  dashFieldClass,
} from "@/components/dashboard/ui";
import { redirectIfMfaRequired } from "@/lib/api-client-auth";

const ALL_EVENTS = [
  "payment_received",
  "role_granted",
  "revoked",
  "expired",
  "sold_out",
  "claim_reminder",
] as const;

type CreateWebhookResponse = {
  error?: string;
  code?: string;
  webhook?: {
    id: string;
    url: string;
    events: string[];
    active: boolean;
    secret: string;
    createdAt: string;
  };
};

export function WebhooksPanel({
  initialHooks,
}: {
  initialHooks: DashboardWebhook[];
}) {
  const t = useTranslations("dashboard.webhooks");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hooks, setHooks] = useState(initialHooks);
  const [hooksSource, setHooksSource] = useState(initialHooks);
  if (initialHooks !== hooksSource) {
    setHooksSource(initialHooks);
    setHooks(initialHooks);
  }
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([
    "payment_received",
    "role_granted",
  ]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  function eventLabel(ev: string): string {
    switch (ev) {
      case "payment_received":
        return t("event_payment_received");
      case "role_granted":
        return t("event_role_granted");
      case "revoked":
        return t("event_revoked");
      case "expired":
        return t("event_expired");
      case "sold_out":
        return t("event_sold_out");
      case "claim_reminder":
        return t("event_claim_reminder");
      default:
        return ev;
    }
  }

  async function create() {
    setError(null);
    setRevealedSecret(null);
    const res = await fetch("/api/outbound-webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, events }),
    });
    const data = (await res.json()) as CreateWebhookResponse;
    if (redirectIfMfaRequired(data)) return;
    if (!res.ok) {
      setError(data.error ?? t("saveFailed"));
      return;
    }
    const plainSecret = data.webhook?.secret;
    if (plainSecret) {
      setRevealedSecret(plainSecret);
      setMessage(t("createdOnce"));
    } else {
      setMessage(t("created"));
    }
    setUrl("");
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
    const data = (await res.json()) as { error?: string; code?: string };
    if (redirectIfMfaRequired(data)) return;
    if (!res.ok) {
      setError(data.error ?? t("saveFailed"));
      return;
    }
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <DashboardPageHeader title={t("title")} description={t("body")} />

      {pending ? <DashboardAlert tone="muted">{t("loading")}</DashboardAlert> : null}
      {error ? <DashboardAlert tone="error">{error}</DashboardAlert> : null}
      {message ? <DashboardAlert tone="ok">{message}</DashboardAlert> : null}
      {revealedSecret ? (
        <DashboardAlert tone="ok">
          <p className="font-medium">{t("secretOnceTitle")}</p>
          <p className="mt-1 break-all font-mono text-sm">{revealedSecret}</p>
          <p className="mt-2 text-sm">{t("secretOnceHint")}</p>
        </DashboardAlert>
      ) : null}

      <DashboardPanel title={t("formTitle")}>
        <div className="space-y-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-soft">{t("url")}</span>
            <input
              id="webhook-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("urlPlaceholder")}
              className={dashFieldClass}
            />
          </label>
          <fieldset>
            <legend className="mb-2.5 text-sm font-medium text-soft">
              {t("events")}
            </legend>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENTS.map((ev) => {
                const checked = events.includes(ev);
                return (
                  <label
                    key={ev}
                    className={`cursor-pointer select-none rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      checked
                        ? "border-signal/40 bg-signal/10 text-signal"
                        : "border-line bg-surface-muted text-soft hover:border-signal/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={(e) => {
                        setEvents((prev) =>
                          e.target.checked
                            ? [...prev, ev]
                            : prev.filter((x) => x !== ev)
                        );
                      }}
                    />
                    {eventLabel(ev)}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <button
            type="button"
            onClick={() => void create()}
            className={dashBtnPrimaryClass}
          >
            {t("create")}
          </button>
        </div>
      </DashboardPanel>

      <DashboardPanel title={t("listTitle")}>
        {hooks.length === 0 ? (
          <DashboardEmptyState title={t("empty")} hint={t("emptyHint")} />
        ) : (
          <ul className="divide-y divide-line">
            {hooks.map((h) => (
              <li
                key={h.id}
                className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-2">
                  <p className="break-all text-sm font-medium text-page-fg">
                    {h.url}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {h.events.map((ev) => (
                      <DashboardBadge key={ev} tone="neutral">
                        {eventLabel(ev)}
                      </DashboardBadge>
                    ))}
                  </div>
                  <p className="text-xs text-soft">{t("secretHidden")}</p>
                </div>
                <button
                  type="button"
                  className={`${dashBtnGhostClass} text-warn hover:border-warn/40 hover:text-warn`}
                  onClick={() => void remove(h.id)}
                >
                  {t("delete")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </DashboardPanel>
    </div>
  );
}
