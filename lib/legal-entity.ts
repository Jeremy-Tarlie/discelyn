/**
 * Identité du responsable de traitement (affichée privacy / CGU).
 * Remplir via NEXT_PUBLIC_LEGAL_* dans .env — ne jamais inventer une société.
 */

export type LegalEntity = {
  name: string | null;
  address: string | null;
  country: string | null;
  supportEmail: string | null;
  hostingProvider: string | null;
  hostingRegion: string | null;
};

function trimEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

export function getLegalEntity(): LegalEntity {
  return {
    name: trimEnv("NEXT_PUBLIC_LEGAL_ENTITY_NAME"),
    address: trimEnv("NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS"),
    country: trimEnv("NEXT_PUBLIC_LEGAL_ENTITY_COUNTRY"),
    supportEmail: trimEnv("NEXT_PUBLIC_SUPPORT_EMAIL"),
    hostingProvider: trimEnv("NEXT_PUBLIC_HOSTING_PROVIDER"),
    hostingRegion: trimEnv("NEXT_PUBLIC_HOSTING_REGION"),
  };
}

export function legalEntityConfigured(entity: LegalEntity = getLegalEntity()): boolean {
  return Boolean(entity.name && entity.address);
}
