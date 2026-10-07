/**
 * Identité du responsable de traitement / éditeur (privacy, mentions légales).
 * Remplir via NEXT_PUBLIC_LEGAL_* — ne jamais inventer une société dans le code.
 */

export type LegalEntity = {
  name: string | null;
  address: string | null;
  country: string | null;
  supportEmail: string | null;
  hostingProvider: string | null;
  hostingRegion: string | null;
  /** SIRET / SIREN optionnel (auto-entreprise, société). */
  siret: string | null;
};

/** Identité légale complète (SIRET toujours optionnel). */
export type ConfiguredLegalEntity = {
  name: string;
  address: string;
  country: string;
  supportEmail: string;
  hostingProvider: string;
  hostingRegion: string;
  siret: string | null;
};

const REQUIRED_LEGAL_ENV = [
  "NEXT_PUBLIC_LEGAL_ENTITY_NAME",
  "NEXT_PUBLIC_LEGAL_ENTITY_ADDRESS",
  "NEXT_PUBLIC_LEGAL_ENTITY_COUNTRY",
  "NEXT_PUBLIC_SUPPORT_EMAIL",
  "NEXT_PUBLIC_HOSTING_PROVIDER",
  "NEXT_PUBLIC_HOSTING_REGION",
] as const;

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
    siret: trimEnv("NEXT_PUBLIC_LEGAL_ENTITY_SIRET"),
  };
}

/** Complet pour affichage public RGPD / LCEN (SIRET optionnel). */
export function legalEntityConfigured(
  entity: LegalEntity = getLegalEntity()
): entity is ConfiguredLegalEntity {
  return Boolean(
    entity.name &&
      entity.address &&
      entity.country &&
      entity.supportEmail &&
      entity.hostingProvider &&
      entity.hostingRegion
  );
}

export function getConfiguredLegalEntity(): ConfiguredLegalEntity | null {
  const entity = getLegalEntity();
  return legalEntityConfigured(entity) ? entity : null;
}

export function missingLegalEnvVars(): string[] {
  return REQUIRED_LEGAL_ENV.filter((name) => !trimEnv(name));
}

/**
 * Fail-fast staging/production : pas de site public sans identité légale.
 */
export function assertLegalEnv(): void {
  const missing = missingLegalEnvVars();
  if (missing.length > 0) {
    throw new Error(
      `Identité légale incomplète (RGPD/LCEN): ${missing.join(", ")}`
    );
  }
}
