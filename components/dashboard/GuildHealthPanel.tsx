"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type HealthCheck = {
  id: string;
  status: "ok" | "warn" | "fail" | "skip";
  detail?: string;
};

export function GuildHealthPanel({
  botId,
  inviteUrl,
}: {
  botId: string;
  inviteUrl: string | null;
}) {
  const t = useTranslations("dashboard.health");
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bots/${botId}/health`);
      const data = (await res.json()) as {
        checks?: HealthCheck[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? t("loadFailed"));
        return;
      }
      setChecks(data.checks ?? []);
    } catch {
      setError(t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [botId, t]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (!cancelled) await reload();
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const mark = (status: HealthCheck["status"]) => {
    if (status === "ok") return "✓";
    if (status === "warn") return "!";
    if (status === "fail") return "✗";
    return "–";
  };

  const color = (status: HealthCheck["status"]) => {
    if (status === "ok") return "text-signal";
    if (status === "warn") return "text-amber-500";
    if (status === "fail") return "text-warn";
    return "text-soft";
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-page-fg">{t("title")}</p>
        <button
          type="button"
          onClick={() => void reload()}
          className="text-xs text-soft underline"
        >
          {t("refresh")}
        </button>
      </div>
      <p className="mt-1 text-xs text-soft">{t("body")}</p>
      {loading ? <p className="mt-3 text-soft">{t("loading")}</p> : null}
      {error ? <p className="mt-3 text-warn">{error}</p> : null}
      <ul className="mt-3 space-y-1.5">
        {checks.map((c) => (
          <li key={c.id} className={color(c.status)}>
            <span className="mr-2 font-mono">{mark(c.status)}</span>
            {t(`check.${c.id}`)}
            {c.detail ? (
              <span className="ml-1 text-xs text-soft">({c.detail})</span>
            ) : null}
          </li>
        ))}
      </ul>
      {checks.some((c) => c.status === "fail") && inviteUrl ? (
        <a
          href={inviteUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex rounded-full bg-[#5865F2] px-4 py-2 text-xs font-semibold text-white"
        >
          {t("reinvite")}
        </a>
      ) : null}
    </div>
  );
}
