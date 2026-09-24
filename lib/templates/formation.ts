/** Preset welcome pour organismes de formation / promotions. */
export const FORMATION_TEMPLATE = {
  id: "formation" as const,
  label: "Organisme de formation",
  /** Utilise {rules} → mention Discord du salon règles (pas un #texte). */
  welcomeMessage:
    "Tu es bien sur le Discord de la formation.\nLis {rules}, puis ouvre `/ticket` si tu as un souci d’accès, de facturation ou de contenu.",
};

/** @deprecated alias — conserver pour imports existants */
export const GAMING_COMMUNITY_TEMPLATE = FORMATION_TEMPLATE;

export type BotTemplateId = typeof FORMATION_TEMPLATE.id;
