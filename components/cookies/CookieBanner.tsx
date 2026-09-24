"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  parseConsent,
  readConsentFromDocument,
  writeConsentCookie,
  type ConsentValue,
} from "@/lib/consent";

type ConsentContextValue = {
  consent: ConsentValue | null;
  openPrefs: () => void;
  setConsent: (value: ConsentValue) => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function useConsentUi(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error("useConsentUi must be used within ConsentProvider");
  }
  return ctx;
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsentState] = useState<ConsentValue | null>(null);
  const [ready, setReady] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [optional, setOptional] = useState(false);
  const t = useTranslations("cookies");

  useEffect(() => {
    const current = readConsentFromDocument();
    setConsentState(current);
    setOptional(current === "all");
    setReady(true);
  }, []);

  const applyConsent = useCallback((value: ConsentValue) => {
    writeConsentCookie(value);
    setConsentState(value);
    setPrefsOpen(false);
    window.location.reload();
  }, []);

  const openPrefs = useCallback(() => {
    setOptional(consent === "all");
    setPrefsOpen(true);
  }, [consent]);

  return (
    <ConsentContext.Provider
      value={{ consent, openPrefs, setConsent: applyConsent }}
    >
      {children}
      {ready && consent === null ? (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-2xl sm:flex-row sm:items-end">
            <div className="flex-1">
              <p className="font-display text-sm font-semibold text-[color:var(--page-fg)]">
                {t("title")}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
                {t("bannerBody")}{" "}
                <Link
                  href="/privacy"
                  className="text-signal-dim underline-offset-2 hover:underline"
                >
                  {t("privacyLink")}
                </Link>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyConsent("necessary")}
                className="rounded-full border border-[color:var(--border)] px-4 py-2.5 text-sm font-semibold text-[color:var(--page-fg)] transition hover:bg-[color:var(--surface-muted)]"
              >
                {t("necessary")}
              </button>
              <button
                type="button"
                onClick={() => applyConsent("all")}
                className="rounded-full bg-signal px-4 py-2.5 text-sm font-bold text-ink-950 transition hover:bg-signal-glow"
              >
                {t("acceptAll")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {prefsOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="cookie-prefs-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-2xl">
            <h2
              id="cookie-prefs-title"
              className="font-display text-lg font-semibold text-[color:var(--page-fg)]"
            >
              {t("prefsTitle")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted)]">
              {t("prefsBody")}
            </p>
            <ul className="mt-5 space-y-3">
              <li className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3">
                <p className="text-sm font-semibold text-[color:var(--page-fg)]">
                  {t("essentialLabel")}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[color:var(--muted)]">
                  {t("essentialDesc")}
                </p>
              </li>
              <li className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={optional}
                    onChange={(e) => setOptional(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-[color:var(--page-fg)]">
                      {t("optionalLabel")}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-[color:var(--muted)]">
                      {t("optionalDesc")}
                    </span>
                  </span>
                </label>
              </li>
            </ul>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPrefsOpen(false)}
                className="rounded-full px-4 py-2.5 text-sm text-[color:var(--muted)] hover:text-[color:var(--page-fg)]"
              >
                {t("close")}
              </button>
              <button
                type="button"
                onClick={() =>
                  applyConsent(optional ? "all" : "necessary")
                }
                className="rounded-full bg-signal px-4 py-2.5 text-sm font-bold text-ink-950"
              >
                {t("save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConsentContext.Provider>
  );
}

/** Footer / nav trigger that opens prefs without throwing outside provider. */
export function CookiePrefsButton({
  className = "",
}: {
  className?: string;
}) {
  const t = useTranslations("nav");
  const ctx = useContext(ConsentContext);
  if (!ctx) return null;
  return (
    <button
      type="button"
      onClick={ctx.openPrefs}
      className={className}
    >
      {t("cookies")}
    </button>
  );
}

export function hasOptionalConsentFromCookieHeader(
  header: string | null
): boolean {
  if (!header) return false;
  const match = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("botly_consent="));
  if (!match) return false;
  return parseConsent(match.split("=")[1] ?? "") === "all";
}
