"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type CampaignRow = {
  id: string;
  subject: string;
  audience: string;
  status: string;
  sentCount: number;
  createdAt: string;
  sentAt: string | null;
};

export function CampaignsAdminClient({ initial }: { initial: CampaignRow[] }) {
  const t = useTranslations("admin");
  const [rows, setRows] = useState(initial);
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [audience, setAudience] = useState<"leads" | "customers" | "both">(
    "leads",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, bodyText, audience }),
      });
      const data = (await res.json()) as {
        error?: string;
        campaignId?: string;
        queuedCount?: number;
        status?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "error");
        return;
      }
      setRows((prev) => [
        {
          id: data.campaignId ?? crypto.randomUUID(),
          subject,
          audience,
          status: data.status ?? "queued",
          sentCount: 0,
          createdAt: new Date().toISOString(),
          sentAt: null,
        },
        ...prev,
      ]);
      setSubject("");
      setBodyText("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-soft">{t("marketingNote")}</p>
      <form
        onSubmit={(e) => void onSend(e)}
        className="space-y-3 rounded-xl border border-line bg-surface p-4"
      >
        <label className="block text-sm">
          <span className="text-soft">{t("campaignSubject")}</span>
          <input
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface-muted px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-soft">{t("campaignBody")}</span>
          <textarea
            required
            rows={6}
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface-muted px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-soft">{t("campaignAudience")}</span>
          <select
            value={audience}
            onChange={(e) =>
              setAudience(e.target.value as "leads" | "customers" | "both")
            }
            className="mt-1 w-full rounded-lg border border-line bg-surface-muted px-3 py-2"
          >
            <option value="leads">{t("audienceLeads")}</option>
            <option value="customers">{t("audienceCustomers")}</option>
            <option value="both">{t("audienceBoth")}</option>
          </select>
        </label>
        {error ? (
          <p className="text-sm text-warn" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-signal px-4 py-2.5 text-sm font-semibold text-ink-950 disabled:opacity-60"
        >
          {t("campaignSend")}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="text-soft">{t("campaignEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            >
              <p className="font-medium text-page-fg">{c.subject}</p>
              <p className="text-soft">
                {c.audience} ·{" "}
                {c.status === "sent"
                  ? t("campaignSent", { n: c.sentCount })
                  : c.status === "partial"
                    ? t("campaignPartial", { n: c.sentCount })
                    : c.status === "failed"
                      ? t("campaignFailed")
                      : c.status === "queued"
                        ? t("campaignQueued")
                        : c.status === "sending"
                          ? t("campaignSending", { n: c.sentCount })
                          : c.status}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
