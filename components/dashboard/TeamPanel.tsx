"use client";

import { useState } from "react";

export type MemberRow = {
  id: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    discordId: string | null;
  };
};

export function TeamPanel({
  canManage,
  initialMembers,
}: {
  canManage: boolean;
  initialMembers: MemberRow[];
}) {
  const [members, setMembers] = useState<MemberRow[]>(initialMembers);
  const [discordId, setDiscordId] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const res = await fetch("/api/org/members");
    if (!res.ok) {
      setError("Impossible de charger l’équipe.");
      return;
    }
    const data = (await res.json()) as { members: MemberRow[] };
    setMembers(data.members);
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/org/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discordId: discordId.trim(), role }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Ajout impossible.");
      return;
    }
    setDiscordId("");
    await reload();
  }

  async function onRemove(id: string) {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/org/members?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Retrait impossible.");
      return;
    }
    await reload();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-page-fg">Équipe</h1>
        <p className="mt-1 text-sm text-soft">
          Membres de l’organisation. L’ajout nécessite un compte Botly existant
          (ID Discord).
        </p>
      </div>

      {error ? <p className="text-sm text-warn">{error}</p> : null}

      <ul className="divide-y divide-line border border-line">
        {members.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-page-fg">
                {m.user.name ?? m.user.email ?? m.user.discordId ?? m.user.id}
              </p>
              <p className="text-xs text-soft">
                {m.role}
                {m.user.discordId ? ` · ${m.user.discordId}` : ""}
              </p>
            </div>
            {canManage && m.role !== "OWNER" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onRemove(m.id)}
                className="text-sm text-warn hover:underline disabled:opacity-50"
              >
                Retirer
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {canManage ? (
        <form onSubmit={onAdd} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-soft">ID Discord</span>
            <input
              value={discordId}
              onChange={(e) => setDiscordId(e.target.value)}
              className="border border-line bg-surface px-3 py-2 text-page-fg"
              placeholder="123456789012345678"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-soft">Rôle</span>
            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "ADMIN" | "MEMBER")
              }
              className="border border-line bg-surface px-3 py-2 text-page-fg"
            >
              <option value="MEMBER">MEMBER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={busy}
            className="bg-signal px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Ajouter
          </button>
        </form>
      ) : null}
    </div>
  );
}
