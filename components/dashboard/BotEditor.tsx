"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MODULE_CATALOG,
  type BotModuleId,
  type PlanDefinition,
} from "@/lib/plans";
import { BotCredentialsForm } from "@/components/dashboard/BotCredentialsForm";

type CustomCommand = {
  name: string;
  response: string;
};

type BotEditorProps = {
  botId: string;
  initialName: string;
  initialDescription: string | null;
  initialModules: string[];
  initialCommands: CustomCommand[];
  plan: PlanDefinition;
  hasToken: boolean;
  inviteUrl: string | null;
  status: string;
  lastError: string | null;
};

export function BotEditor({
  botId,
  initialName,
  initialDescription,
  initialModules,
  initialCommands,
  plan,
  hasToken,
  inviteUrl,
  status,
  lastError,
}: BotEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [modules, setModules] = useState<string[]>(initialModules);
  const [commands, setCommands] = useState<CustomCommand[]>(initialCommands);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allModules = useMemo(
    () => Object.keys(MODULE_CATALOG) as BotModuleId[],
    []
  );

  function toggleModule(moduleId: BotModuleId) {
    const allowed = plan.modules.includes(moduleId);
    if (!allowed) return;
    setModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]
    );
  }

  function addCommand() {
    if (commands.length >= plan.maxCustomCommands) return;
    setCommands((prev) => [...prev, { name: "", response: "" }]);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/bots/${botId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          enabledModules: modules,
          customCommands: commands.filter((c) => c.name && c.response),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Sauvegarde impossible");
        setSaving(false);
        return;
      }
      setMessage("Enregistré");
      router.refresh();
    } catch {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-ink-600 bg-ink-900/70 p-4 text-sm text-mist-300">
        Statut : <span className="text-mist-100">{status}</span>
        {lastError ? (
          <span className="mt-1 block text-red-400">{lastError}</span>
        ) : null}
      </div>

      <BotCredentialsForm
        botId={botId}
        hasToken={hasToken}
        inviteUrl={inviteUrl}
      />

      <section className="space-y-4 rounded-2xl border border-ink-600 bg-ink-900/70 p-5">
        <h2 className="font-display text-lg text-mist-100">Identité</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-ink-600 bg-ink-950 px-3 py-2 text-mist-100 outline-none ring-signal focus:ring-1"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-ink-600 bg-ink-950 px-3 py-2 text-mist-100 outline-none ring-signal focus:ring-1"
          placeholder="Description"
        />
      </section>

      <section className="space-y-4 rounded-2xl border border-ink-600 bg-ink-900/70 p-5">
        <h2 className="font-display text-lg text-mist-100">Modules</h2>
        <p className="text-sm text-mist-400">
          Les modules hors plan restent visibles mais verrouillés.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {allModules.map((moduleId) => {
            const meta = MODULE_CATALOG[moduleId];
            const allowed = plan.modules.includes(moduleId);
            const enabled = modules.includes(moduleId);
            return (
              <button
                key={moduleId}
                type="button"
                disabled={!allowed}
                onClick={() => toggleModule(moduleId)}
                className={`rounded-xl border p-4 text-left transition ${
                  !allowed
                    ? "cursor-not-allowed border-ink-700 bg-ink-950/50 opacity-55"
                    : enabled
                      ? "border-signal/50 bg-signal/10"
                      : "border-ink-600 bg-ink-950 hover:border-mist-400"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-mist-100">{meta.label}</span>
                  {!allowed ? (
                    <span className="text-[11px] uppercase text-warn">
                      Upgrade
                    </span>
                  ) : (
                    <span className="text-[11px] uppercase text-mist-400">
                      {enabled ? "On" : "Off"}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-mist-400">{meta.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-ink-600 bg-ink-900/70 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg text-mist-100">
            Commandes custom
          </h2>
          <button
            type="button"
            onClick={addCommand}
            disabled={
              !plan.modules.includes("custom_commands") ||
              commands.length >= plan.maxCustomCommands
            }
            className="rounded-full border border-ink-600 px-3 py-1 text-xs text-mist-200 disabled:opacity-40"
          >
            Ajouter
          </button>
        </div>
        {!plan.modules.includes("custom_commands") ? (
          <p className="text-sm text-warn">
            Indisponible sur le plan {plan.name}. Passe au Starter ou plus.
          </p>
        ) : null}
        <div className="space-y-3">
          {commands.map((command, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-2">
              <input
                value={command.name}
                onChange={(e) => {
                  const next = [...commands];
                  next[index] = { ...command, name: e.target.value };
                  setCommands(next);
                }}
                placeholder="/commande"
                className="rounded-xl border border-ink-600 bg-ink-950 px-3 py-2 text-mist-100"
              />
              <input
                value={command.response}
                onChange={(e) => {
                  const next = [...commands];
                  next[index] = { ...command, response: e.target.value };
                  setCommands(next);
                }}
                placeholder="Réponse"
                className="rounded-xl border border-ink-600 bg-ink-950 px-3 py-2 text-mist-100"
              />
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-signal-glow disabled:opacity-60"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {message ? <span className="text-sm text-signal">{message}</span> : null}
        {error ? <span className="text-sm text-red-400">{error}</span> : null}
      </div>
    </div>
  );
}
