/** Horloge système — isolée pour les Server Components (règle de pureté React). */
export function currentTimeMs(): number {
  return Date.now();
}

export function daysFromNow(days: number, fromMs: number = currentTimeMs()): Date {
  return new Date(fromMs + days * 24 * 60 * 60 * 1000);
}
