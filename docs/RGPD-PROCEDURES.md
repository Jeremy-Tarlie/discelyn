# Procédures RGPD opérationnelles (modèle)

## Demandes des personnes (accès, effacement, portabilité)

1. Réception via `NEXT_PUBLIC_SUPPORT_EMAIL` ou ticket support.
2. Vérifier l’identité (email compte / Discord ID).
3. **Accès / portabilité** : orienter vers Dashboard → Compte → Export JSON (inclut consentements cookies). Admin : `/dashboard/consents` si besoin de preuve.
4. **Effacement** : Dashboard → Compte → supprimer le compte (soft-delete + anonymisation consentements).
5. Délai cible : **1 mois** (Art. 12).
6. Journaliser la demande (date, type, issue) hors prod si besoin.

## Violation de données

1. Contenir (rotation secrets, révoquer sessions).
2. Évaluer risque pour les personnes.
3. Si risque : notifier CNIL sous **72 h** + personnes si risque élevé.
4. Documenter (faits, impact, mesures).

## DPA Scale

- Modèle dans `docs/DPA.md` — à adapter et signer contractuellement avant activation Scale si sous-traitance pour le client.

## Cookies

- Bannière + préférences par catégorie (analytics / Sentry / affilié).
- Journal serveur obligatoire avant écriture du cookie (preuve).
- Purge logs > 24 mois via cron retention.
