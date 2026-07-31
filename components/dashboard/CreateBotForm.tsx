"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function CreateBotForm({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = (await response.json()) as {
        bot?: { id: string };
        error?: string;
      };

      if (!response.ok || !data.bot) {
        setError(data.error ?? "Création impossible");
        setLoading(false);
        return;
      }

      router.push(`/dashboard/bots/${data.bot.id}`);
      router.refresh();
    } catch {
      setError("Erreur réseau");
      setLoading(false);
    }
  }

  if (!canCreate) {
    return (
      <div className="rounded-2xl border border-warn/30 bg-warn/5 p-5 text-sm text-mist-200">
        Limite de bots atteinte pour ton plan.{" "}
        <a href="/pricing" className="text-signal underline">
          Passer à un plan supérieur
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-ink-600 bg-ink-900/70 p-5"
    >
      <div>
        <label htmlFor="name" className="mb-1 block text-sm text-mist-300">
          Nom du bot
        </label>
        <input
          id="name"
          required
          maxLength={32}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-ink-600 bg-ink-950 px-3 py-2 text-mist-100 outline-none ring-signal focus:ring-1"
          placeholder="Ex: Gardien Nova"
        />
      </div>
      <div>
        <label
          htmlFor="description"
          className="mb-1 block text-sm text-mist-300"
        >
          Description (optionnel)
        </label>
        <textarea
          id="description"
          maxLength={300}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border border-ink-600 bg-ink-950 px-3 py-2 text-mist-100 outline-none ring-signal focus:ring-1"
          rows={3}
        />
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-signal-glow disabled:opacity-60"
      >
        {loading ? "Création…" : "Créer le bot"}
      </button>
    </form>
  );
}
