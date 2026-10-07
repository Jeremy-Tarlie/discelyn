/**
 * URLs publiques liées au contrôle d’accès (claim, webhook orga, affiliés).
 */
export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export function orgWebhookUrl(pathToken: string): string {
  return `${appBaseUrl()}/api/access/webhook/${pathToken}`;
}

export function claimUrl(claimToken: string): string {
  return `${appBaseUrl()}/claim/${claimToken}`;
}

export function affiliateRefUrl(code: string, productId?: string): string {
  const base = `${appBaseUrl()}/r/${encodeURIComponent(code)}`;
  return productId ? `${base}?product=${encodeURIComponent(productId)}` : base;
}
