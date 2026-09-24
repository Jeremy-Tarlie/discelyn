"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FORMATION_TEMPLATE } from "@/lib/templates/formation";

type GuildChannel = {
  id: string;
  name: string;
};

const fieldClass =
  "w-full rounded-xl border border-line bg-surface-muted px-3 py-2.5 text-page-fg outline-none ring-signal focus:ring-1";

function pickPreferredChannel(
  channels: GuildChannel[],
  kind: "welcome" | "rules"
): GuildChannel | null {
  if (channels.length === 0) return null;
  const pattern =
    kind === "welcome"
      ? /welcome|bienvenue|général|general|accueil/i
      : /règles|regles|rules|charte|infos/i;
  return channels.find((c) => pattern.test(c.name)) ?? channels[0] ?? null;
}

function StepBadge({ n, done }: { n: number; done?: boolean }) {
  return (
    <span
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ${
        done
          ? "bg-signal text-ink-950"
          : "bg-surface-muted text-soft ring-1 ring-[color:var(--border)]"
      }`}
    >
      {done ? "✓" : n}
    </span>
  );
}

export function WelcomeSetupPanel({
  botId,
  botPresent,
  enabledModules,
  welcomeChannelId,
  rulesChannelId,
  welcomeMessage,
  onWelcomeChannelIdChange,
  onRulesChannelIdChange,
  onWelcomeMessageChange,
  onModulesChange,
  welcomeConfigured,
}: {
  botId: string;
  botPresent: boolean;
  enabledModules: string[];
  welcomeChannelId: string;
  rulesChannelId: string;
  welcomeMessage: string;
  onWelcomeChannelIdChange: (value: string) => void;
  onRulesChannelIdChange: (value: string) => void;
  onWelcomeMessageChange: (value: string) => void;
  onModulesChange: (modules: string[]) => void;
  welcomeConfigured: boolean;
}) {
  const router = useRouter();
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingTemplateRef = useRef(false);
  const welcomeChannelIdRef = useRef(welcomeChannelId);

  useEffect(() => {
    welcomeChannelIdRef.current = welcomeChannelId;
  }, [welcomeChannelId]);

  useEffect(() => {
    if (!botPresent) return;

    let cancelled = false;
    async function loadChannels() {
      setChannelsLoading(true);
      setChannelsError(null);
      try {
        const response = await fetch(`/api/bots/${botId}/channels`);
        const data = (await response.json()) as {
          channels?: GuildChannel[];
          error?: string;
        };
        if (!response.ok) {
          if (!cancelled) {
            setChannelsError(data.error ?? "Impossible de charger les salons");
          }
          return;
        }
        if (cancelled) return;
        const loaded = data.channels ?? [];
        setChannels(loaded);
        if (pendingTemplateRef.current && !welcomeChannelIdRef.current) {
          const preferred = pickPreferredChannel(loaded, "welcome");
          if (preferred) {
            onWelcomeChannelIdChange(preferred.id);
            pendingTemplateRef.current = false;
          }
        }
      } catch {
        if (!cancelled) setChannelsError("Erreur réseau");
      } finally {
        if (!cancelled) setChannelsLoading(false);
      }
    }
    void loadChannels();
    return () => {
      cancelled = true;
    };
  }, [botId, botPresent, onWelcomeChannelIdChange]);

  function applyFormationTemplate() {
    onWelcomeMessageChange(FORMATION_TEMPLATE.welcomeMessage);
    const welcome = pickPreferredChannel(channels, "welcome");
    const rules = pickPreferredChannel(channels, "rules");
    if (welcome) onWelcomeChannelIdChange(welcome.id);
    if (rules) onRulesChannelIdChange(rules.id);
    if (!welcome) pendingTemplateRef.current = true;
    else pendingTemplateRef.current = false;
    setMessage(
      "Template formation appliqué — choisis les salons # puis enregistre."
    );
  }

  function insertPlaceholder(token: "{mention}" | "{user}" | "{rules}") {
    const base = welcomeMessage.trimEnd();
    if (base.includes(token)) return;
    if (token === "{rules}" && base.length === 0) {
      onWelcomeMessageChange(FORMATION_TEMPLATE.welcomeMessage);
      return;
    }
    const joiner = base.length === 0 ? "" : base.endsWith("\n") ? "" : " ";
    onWelcomeMessageChange(`${base}${joiner}${token}`);
  }

  async function saveWelcome() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const nextModules = enabledModules.includes("welcome")
      ? enabledModules
      : [...enabledModules, "welcome"];
    try {
      const response = await fetch(`/api/bots/${botId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabledModules: nextModules,
          config: {
            welcomeChannelId,
            rulesChannelId,
            welcomeMessage,
          },
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Sauvegarde impossible");
        return;
      }
      onModulesChange(nextModules);
      setMessage("Welcome enregistré — embed formation + mentions # actives.");
      router.refresh();
    } catch {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  if (!botPresent) {
    return null;
  }

  const showChannelSelect = channelsLoading || channels.length > 0;
  const orphanWelcome =
    welcomeChannelId.length > 0 &&
    !channels.some((channel) => channel.id === welcomeChannelId);
  const orphanRules =
    rulesChannelId.length > 0 &&
    !channels.some((channel) => channel.id === rulesChannelId);
  const rulesLabel = channels.find((c) => c.id === rulesChannelId)?.name;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-signal/35 bg-surface shadow-[inset_4px_0_0_0_theme(colors.signal.DEFAULT)]">
      <div className="space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <StepBadge n={3} done={welcomeConfigured} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-signal">
                Étape 3 / 3
              </p>
              <h2 className="mt-1 font-display text-lg text-page-fg">
                Accueil apprenant
              </h2>
              <p className="mt-1 max-w-xl text-sm text-soft">
                Embed formation + salon # cliquable — pas un simple texte comme
                sur un bot hobby.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={applyFormationTemplate}
            className="rounded-full border border-signal/40 px-4 py-2 text-sm text-signal hover:bg-signal/10"
          >
            Template formation
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm text-soft">
            <span className="font-medium text-page-fg">Salon welcome</span>
            <span className="block text-xs">Où poster l’embed d’accueil</span>
            {showChannelSelect ? (
              <select
                value={welcomeChannelId}
                onChange={(e) => onWelcomeChannelIdChange(e.target.value)}
                disabled={channelsLoading && channels.length === 0}
                className={fieldClass}
              >
                <option value="">
                  {channelsLoading && channels.length === 0
                    ? "Chargement…"
                    : "Choisir un salon #"}
                </option>
                {orphanWelcome ? (
                  <option value={welcomeChannelId}>
                    Salon configuré ({welcomeChannelId})
                  </option>
                ) : null}
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={welcomeChannelId}
                onChange={(e) => onWelcomeChannelIdChange(e.target.value)}
                className={fieldClass}
                placeholder="ID salon welcome"
              />
            )}
          </label>

          <label className="block space-y-1.5 text-sm text-soft">
            <span className="font-medium text-page-fg">Salon règles</span>
            <span className="block text-xs">
              Remplace {"{rules}"} par une vraie mention Discord
            </span>
            {showChannelSelect ? (
              <select
                value={rulesChannelId}
                onChange={(e) => onRulesChannelIdChange(e.target.value)}
                disabled={channelsLoading && channels.length === 0}
                className={fieldClass}
              >
                <option value="">
                  {channelsLoading && channels.length === 0
                    ? "Chargement…"
                    : "Choisir #règles / #infos"}
                </option>
                {orphanRules ? (
                  <option value={rulesChannelId}>
                    Salon configuré ({rulesChannelId})
                  </option>
                ) : null}
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={rulesChannelId}
                onChange={(e) => onRulesChannelIdChange(e.target.value)}
                className={fieldClass}
                placeholder="ID salon règles"
              />
            )}
          </label>
        </div>

        <label className="block space-y-1.5 text-sm text-soft">
          <span className="font-medium text-page-fg">Corps du message</span>
          <textarea
            value={welcomeMessage}
            onChange={(e) => onWelcomeMessageChange(e.target.value)}
            rows={4}
            className={fieldClass}
            placeholder={FORMATION_TEMPLATE.welcomeMessage}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2 text-xs text-soft">
          <span>Placeholders :</span>
          {(
            [
              "{mention}",
              "{user}",
              "{rules}",
            ] as const
          ).map((token) => (
            <button
              key={token}
              type="button"
              onClick={() => insertPlaceholder(token)}
              title={`Insérer ${token}`}
              className="rounded-full border border-line bg-surface-muted px-2.5 py-1 font-mono text-page-fg hover:border-signal/40 hover:text-signal"
            >
              {token}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-line bg-ink-900 px-4 py-3 text-sm text-mist-100">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-signal">
            Aperçu Discord (embed)
          </p>
          <p className="mt-2 font-display text-base">Bienvenue — config</p>
          <p className="mt-1 whitespace-pre-wrap text-mist-200">
            {(welcomeMessage || FORMATION_TEMPLATE.welcomeMessage)
              .replaceAll("{mention}", "@apprenant")
              .replaceAll("{user}", "apprenant")
              .replaceAll(
                "{rules}",
                rulesLabel ? `#${rulesLabel}` : "#règles (à lier)"
              )}
          </p>
          <p className="mt-3 border-t border-white/10 pt-2 text-xs text-mist-300">
            Support formation · /ticket → accès · facturation · contenu
          </p>
        </div>

        {channelsError ? (
          <p className="text-sm text-warn">{channelsError}</p>
        ) : null}

        <button
          type="button"
          onClick={() => void saveWelcome()}
          disabled={saving || !welcomeChannelId}
          className="rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-signal-glow disabled:opacity-60"
        >
          {saving ? "Enregistrement…" : "Enregistrer le welcome"}
        </button>
        {message ? <p className="text-sm text-signal">{message}</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>
    </section>
  );
}
