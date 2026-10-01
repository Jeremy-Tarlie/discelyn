# Accord de sous-traitance (DPA) — modèle Discelyn

> **Modèle** à adapter / faire valider par un conseil juridique avant signature Scale.
> Ne pas présenter ce fichier comme un contrat signé.

## Parties

- **Responsable de traitement** : le client (organisme de formation / orga Discord).
- **Sous-traitant** : l’éditeur de Discelyn (à compléter : raison sociale, adresse, contact DPO / support).

## Objet

Discelyn traite des données pour le compte du client afin de :

- authentifier les utilisateurs (OAuth Discord) ;
- configurer bots / rôles / salons ;
- gérer l’accès formation (paiements Stripe **du client**, claims, grants Discord) ;
- facturer l’abonnement SaaS Discelyn (Stripe éditeur) ;
- journaliser l’activité nécessaire à la sécurité et au support.

## Catégories de données

| Catégorie | Exemples |
|-----------|----------|
| Identité compte | Discord ID, nom, email, avatar |
| Accès formation | email client Stripe, Discord ID apprenant, statuts d’accès |
| Technique | IPs (rate-limit), sessions, logs applicatifs, événements analytics (si consentement) |
| Facturation SaaS | IDs Stripe abonnement Discelyn (pas de PAN carte) |

## Finalités & durée

- Prestation du Service tant que le compte / l’orga est active.
- Soft-delete compte : anonymisation / purge selon `docs/OPS-RUNBOOK.md` et politique privacy.
- Warns modération : max 90 jours. Analytics / leads : max 24 mois (ou plus tôt sur demande).

## Sous-traitants ultérieurs

| Sous-traitant | Rôle |
|---------------|------|
| Stripe | Paiements SaaS Discelyn + (optionnel) paiements formation côté client |
| Discord | Plateforme de livraison des rôles |
| Hébergeur (VPS / cloud) | Hébergement app + Postgres + Redis |
| Resend (si activé) | Emails de claim / relance |
| Sentry (si activé) | Erreurs applicatives |

Le client est informé via la privacy / ce DPA. Changement matériel = notification raisonnable.

## Mesures de sécurité (résumé)

- TLS en production (`TRUST_PROXY=1`)
- Secrets Stripe formation + OAuth chiffrés (`TOKEN_ENCRYPTION_KEY`)
- 2FA TOTP obligatoire pour OWNER sur actions sensibles
- Rate-limit, sessions DB, soft-delete RGPD
- Backups Postgres (responsabilité ops éditeur — fréquence à fixer dans le contrat)

## Obligations du client

- Configurer correctement Stripe formation et les rôles Discord.
- Ne pas coller de secrets hors canaux sécurisés.
- Traiter ses propres obligations RGPD envers ses apprenants (base légale vente formation).

## Demandes personnes concernées

Le client reste l’interlocuteur principal de ses apprenants. Discelyn assiste dans un délai raisonnable (ex. 10 jours ouvrés) via le support.

## Sortie / restitution

À la fin du contrat ou suppression compte : soft-delete, revocation Discord, purge secrets OrgStripe, selon process produit. Export CSV apprenants disponible côté dashboard avant suppression.

## Contact

Support : `NEXT_PUBLIC_SUPPORT_EMAIL` / canal défini au contrat.
