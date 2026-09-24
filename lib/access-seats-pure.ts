export function parseOnboardingSteps(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .slice(0, 5);
}

export function isProductSoldOut(product: {
  maxSeats: number | null;
  seatsUsed: number;
}): boolean {
  return product.maxSeats != null && product.seatsUsed >= product.maxSeats;
}
