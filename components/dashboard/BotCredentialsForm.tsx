"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function BotCredentialsForm({
  botId,
  hasToken,
  inviteUrl,
}: {
  botId: string;
  hasToken: boolean;
  inviteUrl: string | null;
}) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/bots/${botId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Échec de la connexion Discord");
        setLoading(false);
        return;
      }
      setToken("");
      setMessage("Token enregistré. Le bot démarre…");
      router.refresh();
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-ink-600 bg-ink-900/70 p-5">
      <h2 className="font-display text-lg text-mist-100">Connexion Discord</h2>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-mist-400">
        <li>
          Crée une application sur{" "}
          <a
            className="text-signal underline"
            href="https://discord.com/developers/applications"
            target="_blank"
            rel="noreferrer"
          >
            Discord Developer Portal
          </a>
        </li>
        <li>Bot → Reset Token → copie le token</li>
        <li>
          Active Privileged Gateway Intents (Server Members + Message Content)
        </li>
        <li>Colle le token ici (stocké chiffré, jamais en clair)</li>
      </ol>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="password"
          autoComplete="off"
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={hasToken ? "Remplacer le token…" : "Token du bot"}
          className="w-full rounded-xl border border-ink-600 bg-ink-950 px-3 py-2 text-mist-100 outline-none ring-signal focus:ring-1"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-signal-glow disabled:opacity-60"
        >
          {loading
            ? "Validation…"
            : hasToken
              ? "Mettre à jour le token"
              : "Connecter le bot"}
        </button>
      </form>

      {hasToken && inviteUrl ? (
        <a
          href={inviteUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-full border border-signal/40 px-4 py-2 text-sm text-signal hover:bg-signal/10"
        >
          Inviter le bot sur un serveur
        </a>
      ) : null}

      {message ? <p className="text-sm text-signal">{message}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </section>
  );
}
