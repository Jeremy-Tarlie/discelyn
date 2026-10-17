/** Plancher temps de réponse anti-énumération (forgot / resend). */
export const AUTH_OPAQUE_FLOOR_MS = 2500;

/**
 * Exécute `work` puis attend jusqu’à atteindre `floorMs` depuis le début.
 * Égalise known vs unknown quand le coût SMTP/DB domine.
 */
export async function withOpaqueTimingFloor<T>(
  work: () => Promise<T>,
  floorMs: number = AUTH_OPAQUE_FLOOR_MS
): Promise<T> {
  const started = Date.now();
  try {
    return await work();
  } finally {
    const elapsed = Date.now() - started;
    if (elapsed < floorMs) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, floorMs - elapsed);
      });
    }
  }
}
