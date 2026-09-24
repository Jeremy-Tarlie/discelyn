"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_MAX_ATTEMPTS = 40; // ~2 min à 3 s

/**
 * Refresh client pendant le catch-up webhook Stripe.
 * S’arrête après maxAttempts pour éviter un polling infini.
 */
export function ClaimSessionRefresh({
  intervalMs = 3000,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  onExhausted,
}: {
  intervalMs?: number;
  maxAttempts?: number;
  onExhausted?: () => void;
}) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const exhausted = attempts >= maxAttempts;

  useEffect(() => {
    if (exhausted) {
      onExhausted?.();
      return;
    }
    const id = window.setInterval(() => {
      setAttempts((n) => n + 1);
      router.refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs, exhausted, onExhausted]);

  return null;
}
