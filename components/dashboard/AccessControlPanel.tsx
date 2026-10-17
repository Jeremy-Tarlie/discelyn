"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { redirectIfMfaRequired } from "@/lib/api-client-auth";

type AccessProduct = {
  id: string;
  name: string;
  stripePriceId: string;
  discordRoleId: string;
  active: boolean;
  pitch?: string | null;
  welcomeDm?: string | null;
  paymentLinkUrl?: string | null;
  billingMode?: string;
  paymentSource?: string;
  amountCents?: number | null;
  currency?: string | null;
  maxSeats?: number | null;
  seatsUsed?: number;
  accessEndsAt?: string | null;
};

type DiscordRole = { id: string; name: string };
type DiscordChannel = { id: string; name: string };

type StripeConfigState = {
  configured: boolean;
  hasStripeSecretKey: boolean;
};

type OfferMode = "create" | "bind";
type WizardStep = 1 | 2 | 3 | 4;

export function AccessControlPanel({
  botId,
  maxAccessProducts,
  guildLinked,
}: {
  botId: string;
  maxAccessProducts: number;
  guildLinked: boolean;
}) {
  const t = useTranslations("dashboard.access");
  const tc = useTranslations("common");

  const [step, setStep] = useState<WizardStep>(1);
  const [stripeConfig, setStripeConfig] = useState<StripeConfigState | null>(
    null
  );
  const [products, setProducts] = useState<AccessProduct[]>([]);
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [discordRoleId, setDiscordRoleId] = useState("");
  const [offerMode, setOfferMode] = useState<OfferMode>("create");
  const [name, setName] = useState("");
  const [pitch, setPitch] = useState("");
  const [welcomeDm, setWelcomeDm] = useState("");
  const [maxSeats, setMaxSeats] = useState("");
  const [accessEndsAt, setAccessEndsAt] = useState("");
  const [onboardingRaw, setOnboardingRaw] = useState("");
  const [amountEuros, setAmountEuros] = useState("49");
  const [currency, setCurrency] = useState<"eur" | "usd">("eur");
  const [billingMode, setBillingMode] = useState<"ONE_TIME" | "RECURRING">(
    "ONE_TIME"
  );
  const [recurringInterval, setRecurringInterval] = useState<"month" | "year">(
    "month"
  );
  const [bindPriceId, setBindPriceId] = useState("");
  const [bindPaymentLinkUrl, setBindPaymentLinkUrl] = useState("");
  const [shopChannelId, setShopChannelId] = useState("");
  const [lastPaymentLink, setLastPaymentLink] = useState<string | null>(null);

  const fieldClass =
    "w-full rounded-xl border border-line bg-surface-muted px-3 py-2 text-page-fg outline-none ring-signal focus:ring-1";

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfgRes, prodRes] = await Promise.all([
        fetch("/api/access/stripe-config"),
        fetch(`/api/bots/${botId}/access`),
      ]);
      const cfg = (await cfgRes.json()) as StripeConfigState & {
        error?: string;
      };
      const prod = (await prodRes.json()) as {
        products?: AccessProduct[];
        error?: string;
      };
      if (!cfgRes.ok) throw new Error(cfg.error ?? t("loadFailed"));
      if (!prodRes.ok) throw new Error(prod.error ?? t("loadFailed"));
      setStripeConfig(cfg);
      setProducts(prod.products ?? []);
      if ((prod.products ?? []).some((p) => p.paymentLinkUrl || p.stripePriceId)) {
        setStep(4);
      } else if (cfg.configured && cfg.hasStripeSecretKey) {
        setStep(2);
      } else {
        setStep(1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tc("networkError"));
    } finally {
      setLoading(false);
    }
  }, [botId, t, tc]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (!cancelled) await reload();
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    if (!guildLinked || step < 2) return;
    void (async () => {
      const rRes = await fetch(`/api/bots/${botId}/roles`);
      const rData = (await rRes.json()) as {
        roles?: DiscordRole[];
        error?: string;
      };
      if (rRes.ok) setRoles(rData.roles ?? []);
    })();
  }, [step, botId, guildLinked]);

  useEffect(() => {
    if (step !== 4 || !guildLinked) return;
    void (async () => {
      const res = await fetch(`/api/bots/${botId}/channels`);
      const data = (await res.json()) as {
        channels?: DiscordChannel[];
        error?: string;
      };
      if (res.ok) setChannels(data.channels ?? []);
    })();
  }, [step, botId, guildLinked]);

  async function runSetup() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/access/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stripeSecretKey }),
      });
      const data = (await response.json()) as { error?: string; code?: string };
      if (redirectIfMfaRequired(data)) return;
      if (!response.ok) {
        setError(data.error ?? t("saveFailed"));
        return;
      }
      setStripeSecretKey("");
      setMessage(t("setupDone"));
      setStep(2);
      await reload();
    } catch {
      setError(tc("networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function createProduct() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const amountCents = Math.round(Number(amountEuros.replace(",", ".")) * 100);
      const body =
        offerMode === "create"
          ? {
              mode: "create" as const,
              name: name || "Formation",
              discordRoleId,
              amountCents,
              currency,
              billingMode,
              recurringInterval:
                billingMode === "RECURRING" ? recurringInterval : null,
              pitch: pitch || null,
              welcomeDm: welcomeDm || null,
              maxSeats: maxSeats ? Number(maxSeats) : null,
              accessEndsAt: accessEndsAt
                ? new Date(`${accessEndsAt}T23:59:59.000Z`).toISOString()
                : null,
              onboardingSteps: onboardingRaw
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 5),
              revokeOnRefund: true,
            }
          : {
              mode: "bind" as const,
              name: name || "Formation",
              discordRoleId,
              stripePriceId: bindPriceId.trim() || null,
              paymentLinkUrl: bindPaymentLinkUrl.trim() || null,
              pitch: pitch || null,
              welcomeDm: welcomeDm || null,
              maxSeats: maxSeats ? Number(maxSeats) : null,
              accessEndsAt: accessEndsAt
                ? new Date(`${accessEndsAt}T23:59:59.000Z`).toISOString()
                : null,
              onboardingSteps: onboardingRaw
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 5),
              revokeOnRefund: true,
            };

      const response = await fetch(`/api/bots/${botId}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as {
        error?: string;
        code?: string;
        product?: AccessProduct;
      };
      if (redirectIfMfaRequired(data)) return;
      if (!response.ok) {
        setError(data.error ?? t("saveFailed"));
        return;
      }
      const link = data.product?.paymentLinkUrl ?? null;
      setLastPaymentLink(link);
      setMessage(t("productCreated"));
      setStep(4);
      setName("");
      setPitch("");
      setWelcomeDm("");
      setMaxSeats("");
      setAccessEndsAt("");
      setOnboardingRaw("");
      setBindPriceId("");
      setBindPaymentLinkUrl("");
      await reload();
    } catch {
      setError(tc("networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function postShop() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/bots/${botId}/access/shop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: shopChannelId }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? t("saveFailed"));
        return;
      }
      setMessage(t("shopPosted"));
    } catch {
      setError(tc("networkError"));
    } finally {
      setBusy(false);
    }
  }

  function copyLink(url: string) {
    void navigator.clipboard.writeText(url);
    setMessage(t("linkCopied"));
  }

  const createReady =
    Boolean(discordRoleId) &&
    Boolean(name.trim()) &&
    Number(amountEuros.replace(",", ".")) >= 0.5;
  const bindReady =
    Boolean(discordRoleId) &&
    Boolean(name.trim()) &&
    (Boolean(bindPriceId.trim()) || Boolean(bindPaymentLinkUrl.trim()));

  if (loading) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-soft">{t("loading")}</p>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-2xl border border-signal/50 bg-surface p-5 shadow-[0_0_0_1px_rgba(61,207,176,0.15)]">
      <div>
        <p className="text-xs uppercase tracking-wide text-signal">
          {t("badge")}
        </p>
        <h2 className="mt-1 font-display text-xl text-page-fg">
          {t("wizardTitle")}
        </h2>
        <p className="mt-1 text-sm text-soft">{t("wizardBody")}</p>
        <p className="mt-2 text-xs font-medium text-signal">{t("zeroFee")}</p>
        <p className="mt-2 text-xs text-soft">
          {t("quota", { used: products.length, max: maxAccessProducts })}
        </p>
      </div>

      <ol className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
        {([1, 2, 3, 4] as const).map((n) => (
          <li
            key={n}
            className={`rounded-full px-3 py-1 ${
              step === n
                ? "bg-signal text-ink-950"
                : step > n
                  ? "bg-signal/20 text-signal"
                  : "bg-surface-muted text-soft"
            }`}
          >
            {n}. {t(`step${n}Label`)}
          </li>
        ))}
      </ol>

      {!guildLinked ? (
        <p className="text-sm text-warn">{t("needGuild")}</p>
      ) : null}

      {step === 1 ? (
        <div className="space-y-3">
          <p className="text-sm text-soft">{t("step1Body")}</p>
          <label className="block space-y-1 text-sm text-soft">
            {t("stripeKey")}
            <input
              type="password"
              value={stripeSecretKey}
              onChange={(e) => setStripeSecretKey(e.target.value)}
              className={fieldClass}
              placeholder="sk_test_… ou sk_live_…"
              autoComplete="off"
            />
          </label>
          <p className="text-xs text-soft">{t("step1Hint")}</p>
          <button
            type="button"
            disabled={busy || stripeSecretKey.length < 20}
            onClick={() => void runSetup()}
            className="rounded-full bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t("step1Cta")}
          </button>
          {stripeConfig?.configured ? (
            <button
              type="button"
              className="block text-sm text-signal underline"
              onClick={() => setStep(2)}
            >
              {t("skipToStep2")}
            </button>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <p className="text-sm text-soft">{t("step2Body")}</p>
          <label className="block space-y-1 text-sm text-soft">
            {t("pickRole")}
            <select
              value={discordRoleId}
              onChange={(e) => setDiscordRoleId(e.target.value)}
              className={fieldClass}
            >
              <option value="">{t("pickRolePlaceholder")}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-warn">{t("roleHierarchyHint")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!discordRoleId}
              onClick={() => setStep(3)}
              className="rounded-full bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {t("step2Cta")}
            </button>
            <button
              type="button"
              className="text-sm text-soft underline"
              onClick={() => setStep(1)}
            >
              {t("backStep")}
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <p className="text-sm text-soft">{t("step3Body")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOfferMode("create")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                offerMode === "create"
                  ? "bg-signal text-ink-950"
                  : "border border-line text-soft"
              }`}
            >
              {t("modeCreate")}
            </button>
            <button
              type="button"
              onClick={() => setOfferMode("bind")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                offerMode === "bind"
                  ? "bg-signal text-ink-950"
                  : "border border-line text-soft"
              }`}
            >
              {t("modeBind")}
            </button>
          </div>
          <p className="text-xs text-soft">
            {offerMode === "create" ? t("modeCreateHint") : t("modeBindHint")}
          </p>

          <label className="block space-y-1 text-sm text-soft">
            {t("productName")}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
              placeholder={t("productNamePlaceholder")}
            />
          </label>

          {offerMode === "create" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm text-soft">
                  {t("amount")}
                  <input
                    type="number"
                    min={0.5}
                    step={0.01}
                    value={amountEuros}
                    onChange={(e) => setAmountEuros(e.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className="block space-y-1 text-sm text-soft">
                  {t("currency")}
                  <select
                    value={currency}
                    onChange={(e) =>
                      setCurrency(e.target.value === "usd" ? "usd" : "eur")
                    }
                    className={fieldClass}
                  >
                    <option value="eur">EUR</option>
                    <option value="usd">USD</option>
                  </select>
                </label>
              </div>
              <label className="block space-y-1 text-sm text-soft">
                {t("billingMode")}
                <select
                  value={billingMode}
                  onChange={(e) =>
                    setBillingMode(
                      e.target.value === "RECURRING" ? "RECURRING" : "ONE_TIME"
                    )
                  }
                  className={fieldClass}
                >
                  <option value="ONE_TIME">{t("billingOneTime")}</option>
                  <option value="RECURRING">{t("billingRecurring")}</option>
                </select>
              </label>
              {billingMode === "RECURRING" ? (
                <label className="block space-y-1 text-sm text-soft">
                  {t("recurringInterval")}
                  <select
                    value={recurringInterval}
                    onChange={(e) =>
                      setRecurringInterval(
                        e.target.value === "year" ? "year" : "month"
                      )
                    }
                    className={fieldClass}
                  >
                    <option value="month">{t("intervalMonth")}</option>
                    <option value="year">{t("intervalYear")}</option>
                  </select>
                </label>
              ) : null}
            </>
          ) : (
            <>
              <label className="block space-y-1 text-sm text-soft">
                {t("bindPriceId")}
                <input
                  value={bindPriceId}
                  onChange={(e) => setBindPriceId(e.target.value)}
                  className={fieldClass}
                  placeholder="price_…"
                />
              </label>
              <label className="block space-y-1 text-sm text-soft">
                {t("bindPaymentLink")}
                <input
                  value={bindPaymentLinkUrl}
                  onChange={(e) => setBindPaymentLinkUrl(e.target.value)}
                  className={fieldClass}
                  placeholder="https://buy.stripe.com/…"
                />
              </label>
            </>
          )}

          <label className="block space-y-1 text-sm text-soft">
            {t("pitch")}
            <textarea
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              className={fieldClass}
              rows={2}
              maxLength={280}
              placeholder={t("pitchPlaceholder")}
            />
          </label>
          <label className="block space-y-1 text-sm text-soft">
            {t("welcomeDm")}
            <textarea
              value={welcomeDm}
              onChange={(e) => setWelcomeDm(e.target.value)}
              className={fieldClass}
              rows={2}
              maxLength={1000}
              placeholder={t("welcomeDmPlaceholder")}
            />
          </label>
          <label className="block space-y-1 text-sm text-soft">
            {t("maxSeats")}
            <input
              type="number"
              min={1}
              value={maxSeats}
              onChange={(e) => setMaxSeats(e.target.value)}
              className={fieldClass}
              placeholder={t("maxSeatsPlaceholder")}
            />
          </label>
          <label className="block space-y-1 text-sm text-soft">
            {t("accessEndsAt")}
            <input
              type="date"
              value={accessEndsAt}
              onChange={(e) => setAccessEndsAt(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="block space-y-1 text-sm text-soft">
            {t("onboardingSteps")}
            <textarea
              value={onboardingRaw}
              onChange={(e) => setOnboardingRaw(e.target.value)}
              className={fieldClass}
              rows={3}
              placeholder={t("onboardingPlaceholder")}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={
                busy ||
                !guildLinked ||
                products.length >= maxAccessProducts ||
                (offerMode === "create" ? !createReady : !bindReady)
              }
              onClick={() => void createProduct()}
              className="rounded-full bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {t("step3Cta")}
            </button>
            <button
              type="button"
              className="text-sm text-soft underline"
              onClick={() => setStep(2)}
            >
              {t("backStep")}
            </button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-4">
          <p className="text-sm text-page-fg">{t("step4Body")}</p>
          {(lastPaymentLink ||
            products.find((p) => p.paymentLinkUrl)?.paymentLinkUrl) && (
            <div className="flex flex-wrap items-center gap-2">
              <code className="max-w-full truncate rounded-lg bg-surface-muted px-2 py-1 text-xs">
                {lastPaymentLink ??
                  products.find((p) => p.paymentLinkUrl)?.paymentLinkUrl}
              </code>
              <button
                type="button"
                onClick={() =>
                  copyLink(
                    lastPaymentLink ??
                      products.find((p) => p.paymentLinkUrl)?.paymentLinkUrl ??
                      ""
                  )
                }
                className="rounded-full border border-line px-3 py-1 text-xs hover:border-signal"
              >
                {t("copyLink")}
              </button>
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-line bg-surface-muted/40 p-3">
            <p className="text-sm font-medium text-page-fg">{t("shopTitle")}</p>
            <p className="text-xs text-soft">{t("shopBody")}</p>
            <label className="block space-y-1 text-sm text-soft">
              {t("shopChannel")}
              <select
                value={shopChannelId}
                onChange={(e) => setShopChannelId(e.target.value)}
                className={fieldClass}
              >
                <option value="">{t("shopChannelPlaceholder")}</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={
                busy ||
                !shopChannelId ||
                !products.some((p) => p.paymentLinkUrl)
              }
              onClick={() => void postShop()}
              className="rounded-full bg-[#5865F2] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {t("shopCta")}
            </button>
            <p className="text-xs text-soft">{t("boutiqueHint")}</p>
          </div>

          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {products.map((p) => (
              <li key={p.id} className="space-y-1 px-3 py-3 text-sm">
                <p className="font-medium text-page-fg">
                  {p.name}
                  {p.billingMode === "RECURRING" ? (
                    <span className="ml-2 text-xs text-signal">abo</span>
                  ) : null}
                  {p.paymentSource === "EXTERNAL_STRIPE" ? (
                    <span className="ml-2 text-xs text-soft">
                      {t("sourceExternal")}
                    </span>
                  ) : null}
                </p>
                {p.amountCents != null && p.currency ? (
                  <p className="text-xs text-soft">
                    {(p.amountCents / 100).toFixed(2)}{" "}
                    {p.currency.toUpperCase()}
                  </p>
                ) : null}
                {p.pitch ? (
                  <p className="text-xs text-soft">{p.pitch}</p>
                ) : null}
                {p.maxSeats != null ? (
                  <p className="text-xs text-soft">
                    {t("seatsLine", {
                      used: p.seatsUsed ?? 0,
                      max: p.maxSeats,
                    })}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {p.paymentLinkUrl ? (
                    <button
                      type="button"
                      className="text-xs text-[#5865F2] underline"
                      onClick={() => copyLink(p.paymentLinkUrl!)}
                    >
                      {t("copyLink")}
                    </button>
                  ) : (
                    <p className="text-xs text-soft">{p.stripePriceId}</p>
                  )}
                  <a
                    href="/dashboard/learners"
                    className="text-xs text-soft underline"
                  >
                    {t("viewLearners")}
                  </a>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="text-sm text-soft underline"
            onClick={() => setStep(3)}
          >
            {t("addAnother")}
          </button>
        </div>
      ) : null}

      {message ? <p className="text-sm text-signal">{message}</p> : null}
      {error ? <p className="text-sm text-warn">{error}</p> : null}
    </section>
  );
}
