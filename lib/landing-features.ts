export const LANDING_FEATURES = [
  {
    t: "Paiement → accès Discord",
    d: "Webhook sur TON Stripe. L’apprenant paie, claim Discord, reçoit le rôle. Refund = accès coupé.",
    icon: "access" as const,
    detail:
      "C’est ça la différence avec MEE6 / Carl : eux animent, toi tu gates l’accès.",
  },
  {
    t: "Welcome apprenant",
    d: "Message d’accueil + rôle promo — utile, pas unique.",
    icon: "welcome" as const,
    detail:
      "Socle ops. Tous les bots le font ; chez Botly c’est secondaire derrière l’accès payant.",
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
    detail: "Utile litige — complément, pas le wedge.",
  },
  {
    t: "RGPD & facture UE",
    d: "Export / suppression compte, rétention, Stripe EUR.",
    icon: "rgpd" as const,
    detail: "Cadre orga — invisible dans Discord, utile à la vente.",
  },
  {
    t: "Dashboard accès",
    d: "Tu configures Stripe→rôle sans coller de token.",
    icon: "dashboard" as const,
    detail:
      "Le premier écran utile : contrôle d’accès, pas une grille de modules hobby.",
  },
] as const;
