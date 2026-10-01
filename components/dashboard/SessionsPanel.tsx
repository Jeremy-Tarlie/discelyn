"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type SessionRow = {
  id: string;
  expires: string;
  mfaVerified: boolean;
  current: boolean;
};

export function SessionsPanel() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError(null);
    try {
      const response = await fetch("/api/account/sessions");
      const data = (await response.json()) as {
        sessions?: SessionRow[];
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? t("sessionsLoadFailed"));
        return;
      }
      setSessions(data.sessions ?? []);
    } catch {
      setError(tc("networkError"));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function revokeOthers() {
    if (!window.confirm(t("sessionsRevokeConfirm"))) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/account/sessions", { method: "DELETE" });
      const data = (await response.json()) as {
        revoked?: number;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? t("sessionsRevokeFailed"));
        return;
      }
      setMessage(t("sessionsRevoked", { count: data.revoked ?? 0 }));
      await load();
    } catch {
      setError(tc("networkError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-display text-xl text-page-fg">{t("sessionsTitle")}</h2>
      <p className="mt-2 text-sm text-soft">{t("sessionsIntro")}</p>

      <ul className="mt-5 space-y-2">
        {sessions.map((session) => (
          <li
            key={session.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-page px-4 py-3 text-sm"
          >
            <span className="text-page-fg">
              {session.current
                ? t("sessionsCurrent")
                : t("sessionsOther")}
              {" · "}
              <span className="text-soft">
                {t("sessionsExpires", {
                  date: new Date(session.expires).toLocaleString(),
                })}
              </span>
            </span>
            {session.current ? (
              <span className="text-xs text-signal">{t("sessionsThisDevice")}</span>
            ) : null}
          </li>
        ))}
        {sessions.length === 0 ? (
          <li className="text-sm text-soft">{t("sessionsEmpty")}</li>
        ) : null}
      </ul>

      <button
        type="button"
        disabled={busy || sessions.length <= 1}
        onClick={() => void revokeOthers()}
        className="mt-4 rounded-full border border-line px-5 py-2.5 text-sm text-page-fg hover:border-signal disabled:opacity-50"
      >
        {t("sessionsRevokeOthers")}
      </button>

      {message ? <p className="mt-3 text-sm text-signal">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-warn">{error}</p> : null}
    </section>
  );
}
