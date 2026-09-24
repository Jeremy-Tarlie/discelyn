"use client";

import { useEffect, useState } from "react";

type Stage = "typing" | "welcome" | "ticket" | "warn" | "pause";

const STAGE_ORDER: Stage[] = [
  "typing",
  "welcome",
  "ticket",
  "warn",
  "pause",
];

const STAGE_MS: Record<Stage, number> = {
  typing: 800,
  welcome: 1700,
  ticket: 1700,
  warn: 2200,
  pause: 900,
};

function TypingDots() {
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-signal/20 text-[10px] font-bold text-signal">
        B
      </div>
      <div className="flex items-center gap-1.5 rounded-md bg-[#2b2d31] px-3 py-2">
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#b5bac1]" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#b5bac1]" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#b5bac1]" />
      </div>
    </div>
  );
}

/**
 * Mock Discord façon concurrents (Ticket Tool / MEE6) :
 * rail serveurs + catégories + messages animés.
 */
export function ProductPreview() {
  const [stageIndex, setStageIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const stage = STAGE_ORDER[stageIndex] ?? "welcome";

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(media.matches);
    const onChange = () => setReduceMotion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const current = STAGE_ORDER[stageIndex] ?? "pause";
    const timer = window.setTimeout(() => {
      setStageIndex((i) => (i + 1) % STAGE_ORDER.length);
    }, STAGE_MS[current]);
    return () => window.clearTimeout(timer);
  }, [stageIndex, reduceMotion]);

  const showWelcome =
    reduceMotion ||
    stage === "welcome" ||
    stage === "ticket" ||
    stage === "warn" ||
    stage === "pause";
  const showTicket =
    reduceMotion ||
    stage === "ticket" ||
    stage === "warn" ||
    stage === "pause";
  const showWarn = reduceMotion || stage === "warn" || stage === "pause";
  const showTyping = !reduceMotion && stage === "typing";

  return (
    <div
      className="animate-fade-up relative mx-auto w-full max-w-lg md:mx-0 md:max-w-none"
      aria-hidden="true"
    >
      <div className="absolute -inset-4 rounded-[1.75rem] bg-[#5865F2]/20 blur-3xl md:-inset-6" />
      <div className="relative animate-float-tilt overflow-hidden rounded-2xl border border-white/20 bg-[#1e1f22] shadow-[0_40px_100px_rgba(0,0,0,0.75),0_0_0_1px_rgba(88,101,242,0.15)]">
        <div className="flex h-[22rem] sm:h-[24rem]">
          {/* Server rail */}
          <div className="flex w-14 shrink-0 flex-col items-center gap-2 bg-[#1e1f22] py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-signal text-sm font-bold text-ink-950 transition hover:rounded-xl">
              B
            </div>
            <div className="h-0.5 w-8 rounded-full bg-white/10" />
            <div className="h-10 w-10 rounded-full bg-[#313338]" />
            <div className="h-10 w-10 rounded-full bg-[#313338]" />
            <div className="mt-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#23a559] text-lg text-white">
              +
            </div>
          </div>

          {/* Channels */}
          <aside className="hidden w-[9.5rem] shrink-0 flex-col bg-[#2b2d31] sm:flex">
            <div className="border-b border-black/20 px-3 py-3">
              <p className="truncate text-sm font-semibold text-white">
                Formation Ops
              </p>
            </div>
            <div className="space-y-3 overflow-hidden p-2 text-[11px]">
              <div>
                <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-[#949ba4]">
                  Info
                </p>
                <p className="rounded px-2 py-1 text-[#949ba4]"># bienvenue</p>
                <p className="rounded px-2 py-1 text-[#949ba4]"># annonces</p>
              </div>
              <div>
                <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-[#949ba4]">
                  Support
                </p>
                <p className="animate-channel-pulse rounded bg-white/10 px-2 py-1 font-medium text-white">
                  # ticket-42
                </p>
              </div>
              <div>
                <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-[#949ba4]">
                  Staff
                </p>
                <p className="rounded px-2 py-1 text-[#949ba4]"># mods-log</p>
              </div>
            </div>
          </aside>

          {/* Chat */}
          <div className="flex min-w-0 flex-1 flex-col bg-[#313338]">
            <div className="flex items-center gap-2 border-b border-black/20 px-4 py-3">
              <span className="text-[#949ba4]">#</span>
              <span className="text-sm font-semibold text-white">
                ticket-42
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-signal/15 px-2 py-0.5 text-[10px] font-medium text-signal">
                <span className="h-1.5 w-1.5 animate-live-dot rounded-full bg-signal" />
                live
              </span>
            </div>

            <div className="flex flex-1 flex-col justify-end gap-3 overflow-hidden p-3 sm:p-4">
              {showTyping ? <TypingDots /> : null}

              {showWelcome ? (
                <div key="welcome" className="animate-message-in flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-signal text-[10px] font-bold text-ink-950">
                    B
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-medium text-signal">Botly</span>
                      <span className="ml-2 text-[10px] text-[#949ba4]">
                        à l’instant
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm leading-snug text-[#dbdee1]">
                      Bienvenue promo Mars — rôle{" "}
                      <span className="rounded bg-[#5865F2]/30 px-1 text-[#c9cdfb]">
                        @Apprenant
                      </span>{" "}
                      attribué.
                    </p>
                  </div>
                </div>
              ) : null}

              {showTicket ? (
                <div key="ticket" className="animate-message-in flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5865F2] text-[10px] font-bold text-white">
                    /
                  </div>
                  <div className="min-w-0 flex-1 rounded-lg border-l-4 border-signal bg-[#2b2d31] px-3 py-2">
                    <p className="text-xs font-semibold text-signal">
                      Ticket ouvert
                    </p>
                    <p className="mt-1 text-sm text-[#dbdee1]">
                      Salon privé créé. Staff notifié. Historique conservé.
                    </p>
                  </div>
                </div>
              ) : null}

              {showWarn ? (
                <div key="warn" className="animate-message-in flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warn/30 text-xs font-bold text-warn">
                    !
                  </div>
                  <div className="min-w-0 flex-1 rounded-lg border-l-4 border-warn bg-[#2b2d31] px-3 py-2">
                    <p className="text-xs font-semibold text-warn">
                      /warn · enregistré
                    </p>
                    <p className="mt-1 text-sm text-[#dbdee1]">
                      Infractions exportables (Ops/Scale) — utile audit / litige.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-black/10 px-3 pb-3 pt-2">
              <div className="rounded-lg bg-[#383a40] px-3 py-2.5 text-sm text-[#949ba4]">
                Message #ticket-42
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
