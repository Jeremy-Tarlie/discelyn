"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

type Stage = "pay" | "claim" | "role" | "pause";

const STAGE_ORDER: Stage[] = ["pay", "claim", "role", "pause"];

const STAGE_MS: Record<Stage, number> = {
  pay: 1600,
  claim: 1600,
  role: 2000,
  pause: 700,
};

function subscribeReducedMotion(onChange: () => void): () => void {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

/**
 * Démo visuelle du cœur produit : paiement → claim Discord → rôle.
 */
export function ClaimFlowPreview() {
  const t = useTranslations("home.claimFlow");
  const [stageIndex, setStageIndex] = useState(0);
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );
  const stage = STAGE_ORDER[stageIndex] ?? "pay";

  useEffect(() => {
    if (reduceMotion) return;
    const current = STAGE_ORDER[stageIndex] ?? "pause";
    const timer = window.setTimeout(() => {
      setStageIndex((i) => (i + 1) % STAGE_ORDER.length);
    }, STAGE_MS[current]);
    return () => window.clearTimeout(timer);
  }, [stageIndex, reduceMotion]);

  const active: Stage = reduceMotion ? "role" : stage;
  const detailByStage = {
    pay: t("detail.pay"),
    claim: t("detail.claim"),
    role: t("detail.role"),
  } as const;

  const steps: { id: "pay" | "claim" | "role"; label: string }[] = [
    { id: "pay", label: t("stepPay") },
    { id: "claim", label: t("stepClaim") },
    { id: "role", label: t("stepRole") },
  ];

  function isDone(id: Stage): boolean {
    if (reduceMotion) return true;
    const order = ["pay", "claim", "role"] as const;
    const activeIdx = order.indexOf(
      active === "pause" ? "role" : (active as "pay" | "claim" | "role")
    );
    const idIdx = order.indexOf(id as "pay" | "claim" | "role");
    return idIdx < activeIdx || active === "role" || active === "pause";
  }

  function isCurrent(id: Stage): boolean {
    if (reduceMotion) return id === "role";
    return active === id;
  }

  return (
    <div
      className="animate-fade-up relative mx-auto w-full max-w-md"
      aria-hidden="true"
    >
      <div className="absolute -inset-3 rounded-[1.75rem] bg-black/20 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-[#1a1c21] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-white/10 bg-[#232428] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
            {t("title")}
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-signal/15 px-2 py-0.5 text-[10px] font-medium text-signal">
            <span className="h-1.5 w-1.5 animate-live-dot rounded-full bg-signal" />
            {t("live")}
          </span>
        </div>

        <ol className="space-y-3 p-4 sm:p-5">
          {steps.map((step, i) => {
            const done = isDone(step.id);
            const current = isCurrent(step.id);
            return (
              <li
                key={step.id}
                className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition duration-300 ${
                  current
                    ? "border-signal/50 bg-signal/10"
                    : done
                      ? "border-white/10 bg-white/5"
                      : "border-white/5 bg-transparent opacity-55"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    done || current
                      ? "bg-signal text-ink-950"
                      : "bg-white/10 text-white/60"
                  }`}
                >
                  {done && !current ? "✓" : i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{step.label}</p>
                  <p className="mt-0.5 text-xs text-white/65">
                    {detailByStage[step.id]}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="border-t border-white/10 bg-[#232428] px-4 py-3">
          <p className="text-center text-xs font-medium text-white/80">
            {(() => {
              if (reduceMotion || active === "role" || active === "pause") {
                return t("footerRole");
              }
              if (active === "claim") return t("footerClaim");
              return t("footerPay");
            })()}
          </p>
        </div>
      </div>
    </div>
  );
}
