"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { redirectIfMfaRequired } from "@/lib/api-client-auth";

export type OrgSwitcherItem = {
  organizationId: string;
  name: string;
  role: string;
};

export function OrgSwitcher({
  organizations,
  activeOrganizationId,
  label,
  switchingLabel,
}: {
  organizations: OrgSwitcherItem[];
  activeOrganizationId: string;
  label: string;
  switchingLabel: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (organizations.length <= 1) {
    const only = organizations[0];
    if (!only) return null;
    return (
      <p className="mt-2 truncate text-sm text-soft" title={only.name}>
        {only.name}
      </p>
    );
  }

  async function onChange(organizationId: string) {
    if (organizationId === activeOrganizationId || pending) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/org/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const data = (await res.json()) as { code?: string; error?: string };
      if (redirectIfMfaRequired(data)) return;
      if (!res.ok) {
        setError(data.error ?? "error");
        return;
      }
      router.refresh();
    } catch {
      setError("network");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2">
      <label className="sr-only" htmlFor="org-switcher">
        {label}
      </label>
      <select
        id="org-switcher"
        className="w-full max-w-full truncate rounded-md border border-line bg-page px-2 py-1.5 text-sm text-page-fg"
        value={activeOrganizationId}
        disabled={pending}
        onChange={(e) => void onChange(e.target.value)}
      >
        {organizations.map((o) => (
          <option key={o.organizationId} value={o.organizationId}>
            {o.name}
          </option>
        ))}
      </select>
      {pending ? (
        <p className="mt-1 text-xs text-soft">{switchingLabel}</p>
      ) : null}
      {error ? (
        <p className="mt-1 text-xs text-warn" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
