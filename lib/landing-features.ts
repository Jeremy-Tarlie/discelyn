export const LANDING_FEATURES = [
  {
    t: "Paiement → accès Discord",
    d: "Sur TON Stripe. L’apprenant paie, réclame son Discord, reçoit le rôle. Remboursement = accès coupé.",
    icon: "access" as const,
    detail:
      "Le contrôle d’accès est le cœur : ouvrir et fermer Discord selon le paiement.",
  },
  {
    t: "Welcome apprenant",
    d: "Message d’accueil + rôle promo dès l’arrivée sur le serveur.",
    icon: "welcome" as const,
    detail: "Onboarding propre dès le premier message — après le claim.",
  },
  {
    t: "Tickets support",
    d: "Salon privé `/ticket` (accès, facturation, contenu).",
    icon: "ticket" as const,
    detail: "Support formation hors chat général.",
  },
  {
    t: "Modération traçable",
    d: "Warns en base + preview ; export audit dès Starter.",
    icon: "mod" as const,
    detail: "Historique exploitable en cas de litige ou d’audit interne.",
  },
  {
    t: "RGPD & facture UE",
    d: "Export / suppression compte, rétention, Stripe EUR.",
    icon: "rgpd" as const,
    detail: "Cadre orga prêt pour vendre en FR/UE.",
  },
  {
    t: "Dashboard accès",
    d: "Tu configures Stripe→rôle sans coller de token.",
    icon: "dashboard" as const,
    detail: "Le premier écran utile : brancher l’accès, suivre les apprenants.",
  },
] as const;
