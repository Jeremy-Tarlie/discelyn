"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

const fieldClass =
  "w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-3 py-2.5 text-sm text-[color:var(--page-fg)] placeholder:text-[color:var(--muted)] transition focus:border-[#5865F2] focus:outline-none focus:ring-2 focus:ring-[#5865F2]/30";

export function LeadForm({
  defaultOffer = "DEMO",
}: {
  defaultOffer?:
    | "SETUP"
    | "STARTER"
    | "OPS"
    | "SCALE"
    | "DEMO"
    | "DIAGNOSTIC"
    | "OTHER";
}) {
  const t = useTranslations("lead");
  const tg = useTranslations("gdpr");
  const tn = useTranslations("nav");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!marketingConsent) {
      setError(tg("leadConsentRequired"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name || undefined,
          company: company || undefined,
          message: message || undefined,
          offer: defaultOffer,
          source: "landing",
          marketingConsent: true,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? t("sendFailed"));
        return;
      }
      setDone(true);
    } catch {
      setError(t("sendFailed"));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <p className="animate-scale-in rounded-xl border border-signal/40 bg-signal/10 p-4 text-sm text-signal-dim">
        {t("success")}
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
      <input
        required
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("email")}
        className={fieldClass}
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("name")}
        className={fieldClass}
      />
      <input
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        placeholder={t("company")}
        className={fieldClass}
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t("message")}
        rows={3}
        className={fieldClass}
      />
      <label className="flex items-start gap-2.5 text-xs leading-relaxed text-[color:var(--muted)]">
        <input
          type="checkbox"
          checked={marketingConsent}
          onChange={(e) => setMarketingConsent(e.target.checked)}
          className="mt-0.5"
          required
        />
        <span>
          {tg.rich("leadConsent", {
            privacy: (chunks) => (
              <Link href="/privacy" className="text-signal-dim underline">
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-[#5865F2] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#4752c4] disabled:opacity-60"
      >
        {loading ? t("sending") : t("submit")}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <p className="text-[11px] leading-normal text-[color:var(--muted)]">
        <Link
          href="/privacy"
          className="underline hover:text-[color:var(--page-fg)]"
        >
          {tn("privacy")}
        </Link>
        {" · "}
        <Link
          href="/terms"
          className="underline hover:text-[color:var(--page-fg)]"
        >
          {tn("terms")}
        </Link>
      </p>
    </form>
  );
}
