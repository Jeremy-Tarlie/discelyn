"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type ManageableGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
};

function StepBadge({
  n,
  active,
  done,
}: {
  n: number;
  active?: boolean;
  done?: boolean;
}) {
  const tone = done
    ? "bg-signal text-ink-950"
    : active
      ? "bg-[#5865F2] text-white"
      : "bg-surface-muted text-soft ring-1 ring-[color:var(--border)]";
  return (
    <span
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ${tone}`}
    >
      {done ? "✓" : n}
    </span>
  );
}

const fieldClass =
  "w-full rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-page-fg outline-none ring-signal focus:ring-1 disabled:opacity-60";

export function BotGuildLinkForm({
  botId,
  guildId,
  inviteUrl,
  botPresent,
}: {
  botId: string;
  guildId: string | null;
  inviteUrl: string | null;
  botPresent: boolean;
}) {
  const t = useTranslations("dashboard.guildLink");
  const tc = useTranslations("common");
  const router = useRouter();
  const [guilds, setGuilds] = useState<ManageableGuild[]>([]);
  const [guildsLoading, setGuildsLoading] = useState(true);
  const [guildsError, setGuildsError] = useState<string | null>(null);
  const [selectedGuildId, setSelectedGuildId] = useState(guildId ?? "");
  const [manualMode, setManualMode] = useState(false);
  const [manualGuildId, setManualGuildId] = useState(guildId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"ok" | "warn" | "info">(
    "info"
  );
  const [prevGuildId, setPrevGuildId] = useState(guildId);

  function showMessage(text: string, tone: "ok" | "warn" | "info") {
    setMessage(text);
    setMessageTone(tone);
  }

  const messageClass =
    messageTone === "ok"
      ? "text-sm text-signal"
      : messageTone === "warn"
        ? "text-sm text-warn"
        : "text-sm text-soft";

  if (guildId !== prevGuildId) {
    setPrevGuildId(guildId);
    setSelectedGuildId(guildId ?? "");
    setManualGuildId(guildId ?? "");
  }

  useEffect(() => {
    let cancelled = false;
    async function loadGuilds() {
      setGuildsLoading(true);
      setGuildsError(null);
      try {
        const response = await fetch("/api/discord/guilds");
        const data = (await response.json()) as {
          guilds?: ManageableGuild[];
          error?: string;
        };
        if (!response.ok) {
          if (!cancelled) {
            setGuildsError(data.error ?? t("loadGuildsFailed"));
            setManualMode(true);
          }
          return;
        }
        if (!cancelled) {
          setGuilds(data.guilds ?? []);
          if ((data.guilds ?? []).length === 0) {
            setManualMode(true);
          }
        }
      } catch {
        if (!cancelled) {
          setGuildsError(tc("networkError"));
          setManualMode(true);
        }
      } finally {
        if (!cancelled) setGuildsLoading(false);
      }
    }
    void loadGuilds();
    return () => {
      cancelled = true;
    };
  }, [t, tc]);

  const linkedGuildLabel = useMemo(() => {
    if (!guildId) return null;
    const match = guilds.find((guild) => guild.id === guildId);
    return match ? match.name : guildId;
  }, [guildId, guilds]);

  async function linkGuild(guildToLink: string): Promise<boolean> {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/bots/${botId}/guild`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId: guildToLink }),
      });
      const data = (await response.json()) as {
        error?: string;
        bot?: { status: string; lastError: string | null };
      };
      if (!response.ok) {
        setError(data.error ?? t("linkFailed"));
        return false;
      }
      const present =
        data.bot?.status === "ONLINE" || data.bot?.status === "PROVISIONING";
      showMessage(
        present ? t("linkedPresent") : t("linkedInviteNext"),
        present ? "ok" : "info"
      );
      router.refresh();
      return true;
    } catch {
      setError(tc("networkError"));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const guildToLink = manualMode ? manualGuildId.trim() : selectedGuildId;
    if (!guildToLink) {
      setError(t("selectServer"));
      return;
    }
    await linkGuild(guildToLink);
  }

  async function onVerifyPresence() {
    if (!guildId) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/bots/${botId}/guild`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId }),
      });
      const data = (await response.json()) as {
        error?: string;
        bot?: { status: string };
      };
      if (!response.ok) {
        setError(data.error ?? t("linkFailed"));
        return;
      }
      const present =
        data.bot?.status === "ONLINE" || data.bot?.status === "PROVISIONING";
      showMessage(
        present ? t("botDetected") : t("botNotDetected"),
        present ? "ok" : "warn"
      );
      router.refresh();
    } catch {
      setError(tc("networkError"));
    } finally {
      setLoading(false);
    }
  }

  async function onUnlink() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/bots/${botId}/guild`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? t("unlinkFailed"));
        return;
      }
      setSelectedGuildId("");
      setManualGuildId("");
      showMessage(t("unlinked"), "info");
      router.refresh();
    } catch {
      setError(tc("networkError"));
    } finally {
      setLoading(false);
    }
  }

  // Étape 1 uniquement
  if (!guildId) {
    return (
      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[inset_4px_0_0_0_#5865F2]">
        <div className="border-b border-line bg-surface-muted/60 px-6 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5865F2]">
            Étape 1 / 3
          </p>
          <p className="mt-1 text-sm text-soft">
            Bot plateforme — jamais de token à coller.
          </p>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-3">
            <StepBadge n={1} active />
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <h2 className="font-display text-lg text-page-fg">
                  {t("step1Title")}
                </h2>
                <p className="mt-1 text-sm text-soft">{t("step1Body")}</p>
              </div>

              <form onSubmit={onSubmit} className="flex flex-col gap-4">
                {!manualMode ? (
                  <label className="block space-y-1 text-sm text-soft">
                    {t("serverSelect")}
                    <select
                      required
                      value={selectedGuildId}
                      onChange={(e) => setSelectedGuildId(e.target.value)}
                      disabled={guildsLoading}
                      className={fieldClass}
                    >
                      <option value="">
                        {guildsLoading ? t("loading") : t("selectServer")}
                      </option>
                      {guilds.map((guild) => (
                        <option key={guild.id} value={guild.id}>
                          {guild.name}
                          {guild.owner ? ` ${t("ownerSuffix")}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="block space-y-1 text-sm text-soft">
                    {t("manualId")}
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      required
                      value={manualGuildId}
                      onChange={(e) => setManualGuildId(e.target.value)}
                      placeholder={t("manualId")}
                      className={fieldClass}
                    />
                  </label>
                )}

                {guildsError ? (
                  <p className="text-sm text-warn">{guildsError}</p>
                ) : null}

                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="submit"
                    disabled={loading || guildsLoading}
                    className="rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-signal-glow disabled:opacity-60"
                  >
                    {loading ? t("verifying") : t("linkServer")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualMode((prev) => !prev)}
                    className="rounded-full border border-line px-4 py-2.5 text-sm text-soft hover:border-soft hover:text-page-fg"
                  >
                    {manualMode ? t("useList") : t("useManual")}
                  </button>
                </div>
              </form>

              {message ? <p className={messageClass}>{message}</p> : null}
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Étape 2 uniquement (serveur lié, bot pas encore présent)
  if (!botPresent) {
    return (
      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[inset_4px_0_0_0_#5865F2]">
        <div className="border-b border-line bg-surface-muted/60 px-6 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5865F2]">
            Étape 2 / 3
          </p>
          <p className="mt-1 text-sm text-soft">
            {t("linkedLabel")} <strong className="text-page-fg">{linkedGuildLabel}</strong>
          </p>
        </div>

        <div className="space-y-5 p-6">
          <div className="flex items-start gap-3">
            <StepBadge n={1} done />
            <p className="pt-1 text-sm text-soft">
              Serveur lié —{" "}
              <button
                type="button"
                disabled={loading}
                onClick={() => void onUnlink()}
                className="underline underline-offset-2 hover:text-page-fg disabled:opacity-60"
              >
                {t("unlink")}
              </button>
            </p>
          </div>

          <div className="flex items-start gap-3 border-t border-line pt-5">
            <StepBadge n={2} active />
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <h2 className="font-display text-lg text-page-fg">
                  {t("step2Title")}
                </h2>
                <p className="mt-1 text-sm text-soft">{t("inviteHint")}</p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                {inviteUrl ? (
                  <a
                    href={inviteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-full bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4752C4]"
                  >
                    {t("inviteBot")}
                  </a>
                ) : (
                  <p className="text-sm text-warn">{t("inviteMissing")}</p>
                )}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void onVerifyPresence()}
                  className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-page-fg hover:border-soft hover:bg-surface-muted disabled:opacity-60"
                >
                  {loading ? t("verifying") : t("verifyInvite")}
                </button>
              </div>

              {message ? <p className={messageClass}>{message}</p> : null}
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Bot présent : résumé compact (étape 3 ailleurs)
  return (
    <section className="rounded-2xl border border-signal/30 bg-signal/5 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-page-fg">
          <StepBadge n={1} done />
          <StepBadge n={2} done />
          <span>
            {t("linkedLabel")} <strong>{linkedGuildLabel}</strong>
            {" · "}
            <span className="text-signal">{t("botPresent")}</span>
          </span>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void onUnlink()}
          className="rounded-full border border-line px-4 py-2 text-sm text-soft hover:border-red-400/50 hover:text-red-600 disabled:opacity-60"
        >
          {t("unlink")}
        </button>
      </div>
      {message ? <p className={`mt-2 ${messageClass}`}>{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
    </section>
  );
}
