"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { DashboardLearner } from "@/lib/dashboard-data";

export function LearnersPanel({
  initialLearners,
  status,
  q,
}: {
  initialLearners: DashboardLearner[];
  status: string;
  q: string;
}) {
  const t = useTranslations("dashboard.learners");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [learners, setLearners] = useState(initialLearners);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(q);

  useEffect(() => {
    setLearners(initialLearners);
  }, [initialLearners]);

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  function pushFilters(nextStatus: string, nextQ: string) {
    const params = new URLSearchParams();
    if (nextStatus) params.set("status", nextStatus);
    if (nextQ) params.set("q", nextQ);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/dashboard/learners?${qs}` : "/dashboard/learners");
    });
  }

  async function act(
    accessId: string,
    action: "revoke" | "refresh_claim" | "open_portal"
  ) {
    if (action === "revoke" && !window.confirm(t("revokeConfirm"))) {
      return;
    }
    setMessage(null);
    const res = await fetch("/api/learners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessId, action }),
    });
    const data = (await res.json()) as {
      claimUrl?: string;
      url?: string;
      error?: string;
    };
    if (!res.ok) {
      setError(data.error ?? t("actionFailed"));
      return;
    }
    if (data.url) {
      window.open(data.url, "_blank", "noopener,noreferrer");
      setMessage(t("portalOpened"));
      return;
    }
    if (data.claimUrl) {
      await navigator.clipboard.writeText(data.claimUrl);
      setMessage(t("claimCopied"));
    } else {
      setMessage(t("revoked"));
    }
    startTransition(() => {
      router.refresh();
    });
  }

  async function exportCsv() {
    const params = new URLSearchParams({ export: "1" });
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    const res = await fetch(`/api/learners?${params}`);
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? t("exportFailed"));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `learners-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(t("exported"));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-page-fg">{t("title")}</h1>
          <p className="mt-1 text-sm text-soft">{t("body")}</p>
        </div>
        <button
          type="button"
          onClick={() => void exportCsv()}
          className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-signal"
        >
          {t("exportCsv")}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="learners-status">
          {t("filterStatus")}
        </label>
        <select
          id="learners-status"
          value={status}
          onChange={(e) => pushFilters(e.target.value, q)}
          className="rounded-xl border border-line bg-surface-muted px-3 py-2 text-sm"
        >
          <option value="">{t("filterAll")}</option>
          <option value="PENDING_CLAIM">PENDING_CLAIM</option>
          <option value="AWAITING_JOIN">AWAITING_JOIN</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="REVOKED">REVOKED</option>
          <option value="EXPIRED">EXPIRED</option>
        </select>
        <label className="sr-only" htmlFor="learners-search">
          {t("searchLabel")}
        </label>
        <input
          id="learners-search"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") pushFilters(status, searchDraft.trim());
          }}
          onBlur={() => {
            if (searchDraft.trim() !== q) {
              pushFilters(status, searchDraft.trim());
            }
          }}
          placeholder={t("search")}
          className="rounded-xl border border-line bg-surface-muted px-3 py-2 text-sm"
        />
      </div>

      {pending ? <p className="text-sm text-soft">{t("loading")}</p> : null}
      {error ? <p className="text-sm text-warn">{error}</p> : null}
      {message ? <p className="text-sm text-signal">{message}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-surface-muted text-xs uppercase text-soft">
            <tr>
              <th className="px-3 py-2">{t("colProduct")}</th>
              <th className="px-3 py-2">{t("colEmail")}</th>
              <th className="px-3 py-2">{t("colStatus")}</th>
              <th className="px-3 py-2">{t("colAmount")}</th>
              <th className="px-3 py-2">{t("colAffiliate")}</th>
              <th className="px-3 py-2">{t("colActions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {learners.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2">
                  <p className="font-medium text-page-fg">{row.product.name}</p>
                  <p className="text-xs text-soft">
                    {row.source}
                    {row.product.billingMode === "RECURRING" ? " · abo" : ""}
                    {row.accessEndsAt
                      ? ` · exp. ${row.accessEndsAt.slice(0, 10)}`
                      : ""}
                  </p>
                </td>
                <td className="px-3 py-2 text-soft">
                  {row.customerEmail ?? "—"}
                  {row.discordUserId ? (
                    <span className="block text-xs">{row.discordUserId}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs">
                    {row.status}
                  </span>
                  {row.claimReminderCount > 0 ? (
                    <span className="ml-1 text-xs text-soft">
                      (relance ×{row.claimReminderCount})
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-soft">
                  {row.amountTotal != null
                    ? `${(row.amountTotal / 100).toFixed(2)} ${
                        row.currency?.toUpperCase() ?? ""
                      }`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-soft">
                  {row.affiliate?.code ?? "—"}
                </td>
                <td className="space-x-2 px-3 py-2">
                  {row.stripeCustomerId ? (
                    <button
                      type="button"
                      className="text-xs text-[#5865F2] underline"
                      onClick={() => void act(row.id, "open_portal")}
                    >
                      {t("portal")}
                    </button>
                  ) : null}
                  {row.status === "PENDING_CLAIM" || row.claimUrl ? (
                    <button
                      type="button"
                      className="text-xs text-[#5865F2] underline"
                      onClick={() => void act(row.id, "refresh_claim")}
                    >
                      {t("copyClaim")}
                    </button>
                  ) : null}
                  {row.status === "ACTIVE" ||
                  row.status === "PENDING_CLAIM" ||
                  row.status === "AWAITING_JOIN" ? (
                    <button
                      type="button"
                      className="text-xs text-warn underline"
                      onClick={() => void act(row.id, "revoke")}
                    >
                      {t("revoke")}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {learners.length === 0 ? (
          <p className="p-4 text-sm text-soft">{t("empty")}</p>
        ) : null}
      </div>
    </div>
  );
}
