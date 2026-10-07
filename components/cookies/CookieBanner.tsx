"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  clearAffiliateCookie,
  EMPTY_CONSENT,
  ensureVisitorId,
  FULL_CONSENT,
  readConsentFromDocument,
  writeConsentCookie,
  type ConsentPreferences,
} from "@/lib/consent";

type ConsentContextValue = {
  consent: ConsentPreferences | null;
  openPrefs: () => void;
  setConsent: (value: ConsentPreferences) => void;
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
  const [consent, setConsentState] = useState<ConsentPreferences | null>(null);
  const [ready, setReady] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [draft, setDraft] = useState<ConsentPreferences>(EMPTY_CONSENT);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const t = useTranslations("cookies");
  const tc = useTranslations("common");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      const current = readConsentFromDocument();
      setConsentState(current);
      setDraft(current ?? EMPTY_CONSENT);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyConsent = useCallback(async (prefs: ConsentPreferences) => {
    setSaving(true);
    setSaveError(null);
    const visitorId = ensureVisitorId();

    try {
      const response = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: prefs, visitorId }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setSaveError(data.error ?? t("saveFailed"));
        setSaving(false);
        return;
      }

      writeConsentCookie(prefs);
      if (!prefs.affiliate) {
        clearAffiliateCookie();
      }
      setConsentState(prefs);
      setPrefsOpen(false);
      window.location.reload();
    } catch {
      setSaveError(tc("networkError"));
      setSaving(false);
    }
  }, [t, tc]);

  const openPrefs = useCallback(() => {
    setDraft(consent ?? EMPTY_CONSENT);
    setSaveError(null);
    setPrefsOpen(true);
  }, [consent]);

  const closePrefs = useCallback(() => {
    setPrefsOpen(false);
  }, []);

  useEffect(() => {
    if (!prefsOpen) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setPrefsOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [prefsOpen]);

  return (
    <ConsentContext.Provider
      value={{ consent, openPrefs, setConsent: (v) => void applyConsent(v) }}
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
              {saveError ? (
                <p className="mt-2 text-xs text-warn">{saveError}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void applyConsent(EMPTY_CONSENT)}
                className="rounded-full border border-[color:var(--border)] px-4 py-2.5 text-sm font-semibold text-[color:var(--page-fg)] transition hover:bg-[color:var(--surface-muted)] disabled:opacity-50"
              >
                {t("necessary")}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={openPrefs}
                className="rounded-full border border-[color:var(--border)] px-4 py-2.5 text-sm font-semibold text-[color:var(--page-fg)] transition hover:bg-[color:var(--surface-muted)] disabled:opacity-50"
              >
                {t("customize")}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void applyConsent(FULL_CONSENT)}
                className="rounded-full bg-signal px-4 py-2.5 text-sm font-bold text-ink-950 transition hover:bg-signal-glow disabled:opacity-50"
              >
                {saving ? tc("loading") : t("acceptAll")}
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
          aria-labelledby={titleId}
          onClick={(e) => {
            if (e.target === e.currentTarget) closePrefs();
          }}
        >
          <div
            ref={dialogRef}
            className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-2xl"
          >
            <h2
              id={titleId}
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
              {(
                [
                  ["analytics", "analyticsLabel", "analyticsDesc"],
                  ["sentry", "sentryLabel", "sentryDesc"],
                  ["affiliate", "affiliateLabel", "affiliateDesc"],
                ] as const
              ).map(([key, labelKey, descKey]) => (
                <li
                  key={key}
                  className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-3"
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={draft[key]}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [key]: e.target.checked,
                        }))
                      }
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-[color:var(--page-fg)]">
                        {t(labelKey)}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-[color:var(--muted)]">
                        {t(descKey)}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {saveError ? (
              <p className="mt-3 text-sm text-warn">{saveError}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closePrefs}
                disabled={saving}
                className="rounded-full px-4 py-2.5 text-sm text-[color:var(--muted)] hover:text-[color:var(--page-fg)]"
              >
                {t("close")}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void applyConsent(draft)}
                className="rounded-full bg-signal px-4 py-2.5 text-sm font-bold text-ink-950 disabled:opacity-50"
              >
                {saving ? tc("loading") : t("save")}
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
