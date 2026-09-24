"use client";

import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { useTranslations } from "next-intl";

export function DeleteBotButton({
  botId,
  botName,
  variant = "ghost",
}: {
  botId: string;
  botName: string;
  variant?: "ghost" | "danger";
}) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (loading) return;
    const ok = window.confirm(t("deleteBotConfirm", { name: botName }));
    if (!ok) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/bots/${botId}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string; ok?: boolean };
      if (!response.ok) {
        setError(data.error ?? t("deleteBotFailed"));
        setLoading(false);
        return;
      }
      router.push("/dashboard/bots");
      router.refresh();
    } catch {
      setError(tc("networkError"));
      setLoading(false);
    }
  }

  const className =
    variant === "danger"
      ? "rounded-full border border-red-400/50 px-4 py-2 text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
      : "rounded-full px-3 py-1.5 text-xs font-medium text-soft hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-300";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onDelete}
        disabled={loading}
        className={className}
      >
        {loading ? t("deletingBot") : t("deleteBot")}
      </button>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
