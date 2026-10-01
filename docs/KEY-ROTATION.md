# Rotation des secrets — Discelyn

## `TOKEN_ENCRYPTION_KEY`

Chiffre : jetons OAuth Discord, `sk_` / `whsec_` formation (`OrgStripeConfig`).

### Ne jamais

- Changer la clé en prod **sans** re-seal de toute la DB.
- Perdre l’ancienne clé sans backup des secrets en clair (irréversible → re-setup massif).

### Procédure de rotation (planifiée)

1. Backup DB : `npm run backup:db` + copie hors machine.
2. Générer une nouvelle clé (32+ bytes aléatoires, base64 ou hex).
3. Script de re-seal (à exécuter en maintenance) :
   - unseal avec **ancienne** clé ;
   - seal avec **nouvelle** clé ;
   - update rows `Account` (tokens) + `OrgStripeConfig`.
4. Mettre à jour `.env` / secrets compose **atomiquement** avec le deploy du code qui utilise la nouvelle clé.
5. Restart `web` + `runtime`.
6. Smoke : login OAuth + webhook formation (signature) + Payment Link.

Aujourd’hui les scripts `seal-oauth` / `seal-org-stripe` passent du **clair → seal**. Une rotation clé→clé nécessite un script dédié (ne pas improviser en prod).

### Si la clé est perdue

1. Les `sk_` / `whsec_` formation sont illisibles → chaque orga doit **re-setup** Stripe accès (dashboard).
2. Les OAuth tokens sealés sont morts → users se reconnectent (Discord OAuth).
3. Documenter l’incident ; régénérer une nouvelle clé ; ne pas réutiliser l’ancienne.

## Autres secrets

| Secret | Rotation |
|--------|----------|
| `CRON_SECRET` | Update env + recreate conteneurs cron |
| `BOT_RUNTIME_SECRET` | Update web + runtime **ensemble** |
| `NEXTAUTH_SECRET` | Invalide toutes les sessions ; update + restart |
| `DISCORD_BOT_TOKEN` | Portal Discord → Reset → env → restart runtime |
| `STRIPE_SECRET_KEY` (SaaS) | Stripe Dashboard → roll key → env + webhooks |
| Stripe orga `sk_` | Dashboard accès Discelyn → re-setup |

## SPOF bot Discord

Un seul `DISCORD_BOT_TOKEN` plateforme.

1. Détecter : `/api/health` → `platformBot` / runtime error, Sentry.
2. Reset token Discord Developer Portal.
3. Update `DISCORD_BOT_TOKEN` + restart `runtime`.
4. Vérifier invite bot toujours sur les guilds ; `retryStuckGrants` via cron access.
5. Communiquer aux clients si downtime > 15 min.

Multi-bot par orga = évolution produit (hors v1).
