"use client";

import { useState } from "react";
import {
  DashboardAlert,
  DashboardBadge,
  DashboardEmptyState,
  DashboardPageHeader,
  DashboardPanel,
  dashBtnPrimaryClass,
  dashFieldClass,
} from "@/components/dashboard/ui";
import { redirectIfMfaRequired } from "@/lib/api-client-auth";

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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function roleTone(
  role: MemberRow["role"]
): "signal" | "accent" | "neutral" {
  if (role === "OWNER") return "signal";
  if (role === "ADMIN") return "accent";
  return "neutral";
}

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
    const data = (await res.json().catch(() => null)) as {
      members?: MemberRow[];
      code?: string;
      error?: string;
    } | null;
    if (data && redirectIfMfaRequired(data)) return;
    if (!res.ok) {
      setError("Impossible de charger l’équipe.");
      return;
    }
    if (data?.members) setMembers(data.members);
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
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      code?: string;
    } | null;
    if (body && redirectIfMfaRequired(body)) return;
    if (!res.ok) {
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
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      code?: string;
    } | null;
    if (body && redirectIfMfaRequired(body)) return;
    if (!res.ok) {
      setError(body?.error ?? "Retrait impossible.");
      return;
    }
    await reload();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <DashboardPageHeader
        title="Équipe"
        description="Membres de l’organisation. L’ajout nécessite un compte Discelyn existant (ID Discord)."
      />

      {error ? <DashboardAlert tone="error">{error}</DashboardAlert> : null}

      <DashboardPanel title="Membres">
        {members.length === 0 ? (
          <DashboardEmptyState
            title="Aucun membre"
            hint="Ajoute un compte Discelyn via son ID Discord."
          />
        ) : (
          <ul className="divide-y divide-line">
            {members.map((m) => {
              const display =
                m.user.name ?? m.user.email ?? m.user.discordId ?? m.user.id;
              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {m.user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.user.image}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover ring-1 ring-line"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-signal/15 text-sm font-semibold text-signal">
                        {initials(display)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-page-fg">
                        {display}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-xs text-soft">
                        {m.user.discordId ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <DashboardBadge tone={roleTone(m.role)}>
                      {m.role}
                    </DashboardBadge>
                    {canManage && m.role !== "OWNER" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onRemove(m.id)}
                        className="text-sm font-medium text-warn hover:underline disabled:opacity-50"
                      >
                        Retirer
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardPanel>

      {canManage ? (
        <DashboardPanel
          title="Ajouter un membre"
          description="Le Discord ID doit correspondre à un compte déjà connecté sur Discelyn."
        >
          <form
            onSubmit={onAdd}
            className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
          >
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-soft">ID Discord</span>
              <input
                value={discordId}
                onChange={(e) => setDiscordId(e.target.value)}
                className={dashFieldClass}
                placeholder="123456789012345678"
                required
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-soft">Rôle</span>
              <select
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as "ADMIN" | "MEMBER")
                }
                className={dashFieldClass}
              >
                <option value="MEMBER">MEMBER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={busy}
              className={dashBtnPrimaryClass}
            >
              Ajouter
            </button>
          </form>
        </DashboardPanel>
      ) : null}
    </div>
  );
}
