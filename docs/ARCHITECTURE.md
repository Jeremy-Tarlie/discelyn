# Architecture — flux réels

Document destiné à un lecteur technique. Il décrit ce que le code fait aujourd’hui, pas une cible idéale.

## Vue d’ensemble

Trois processus applicatifs + deux stores :

| Composant | Rôle |
|-----------|------|
| **web** (Next.js) | OAuth, dashboard, API, **double Stripe** (SaaS Botly + formation orga), claim, crons |
| **bot-runtime** | Un client discord.js (`DISCORD_BOT_TOKEN`), configs par `guildId` en mémoire, join → grant |
| **PostgreSQL** | Source de vérité (users, bots, accès apprenants, org Stripe, leads…) |
| **Redis** | Rate-limit distribué uniquement (fallback mémoire si absent) |

Cœur produit : **paiement formation (Stripe client) → claim Discord → rôle(s) → revoke**.  
Le socle ops (welcome, tickets, mod) est secondaire.  
Il n’y a **pas** de token Discord bot client en base : un bot plateforme unique agit sur les serveurs liés.

---

## 1. Accès formation (wedge)

### Setup orga

1. Dashboard → contrôle d’accès : `bootstrapOrgStripe` (`lib/org-stripe.ts`) exige `TOKEN_ENCRYPTION_KEY`, stocke `sk_` / `whsec_` chiffrés (`enc:v1:`).
2. Crée (ou réutilise) un webhook Stripe → `POST /api/access/webhook/{pathToken}`.
3. Produit : price Stripe → rôle Discord (+ grants multi-serveur optionnels via `AccessProductGuildGrant`).
4. Payment Link généré via l’API Stripe orga (`createAccessPaymentLink`).

### Paiement → claim

1. Checkout / Payment Link payé → webhook orga.
2. `openLearnerAccessFromCheckout` : réserve un siège, crée `LearnerAccess` (`PENDING_CLAIM`) + `claimToken`.
3. Si `discord_user_id` déjà en metadata → `fulfillDiscordAccess` immédiat.
4. Sinon l’apprenant ouvre `/claim/{token}` → OAuth Discord → `fulfillDiscordAccess`.

### Grant de rôles (règle multi-guild)

`fulfillDiscordAccess` (`lib/learner-access.ts`) + `decideGrantOutcome` (`lib/grant-outcome-pure.ts`) :

| Résultat des tentatives | Statut |
|-------------------------|--------|
| **Tous** les grants cibles posés (membre présent + rôle OK) | `ACTIVE` |
| Au moins un serveur où le membre est encore absent | `AWAITING_JOIN` (+ invite) |
| Échec dur Discord sans serveur manquant | inchangé + erreur (`blocked`) |

On ne passe **pas** `ACTIVE` dès qu’un seul serveur a réussi.

### Join Discord

1. Runtime `GuildMemberAdd` → **uniquement** `POST /api/internal/learner-join` (Bearer `BOT_RUNTIME_SECRET`, rate-limit) → `grantPendingOnJoin` → `fulfillDiscordAccess`.
2. **Pas de fallback** Discord.js local : si le web est down, le grant échoue (log + Sentry) ; retry au prochain join / re-claim / cron.
3. Variable runtime : `WEB_INTERNAL_URL` (compose : `http://web:3000`).

### Revoke

- Remboursement / unpaid / canceled / fin de cohorte → `revokeLearnerAccess` (tous les grants).
- Cron `POST /api/cron/access` (~15 min) : expiry, relances claim, J-N, onboarding.
- Cron `POST /api/cron/retention` (1 h) : purge analytics / leads RGPD uniquement.

### Codes manuels

Création : clair renvoyé **une fois** ; stocké en `codeHash` (SHA-256) + `codePrefix`.

---

## 2. Connexion orga → serveur lié → runtime

1. `/api/auth/signin` (NextAuth Discord, sessions DB).
2. Création user → abonnement `FREE`. `User.discordId` au link Account.
3. `POST /api/bots` → `Bot` `PENDING` ; liaison guild via `POST /api/bots/[id]/guild`.
4. `provisionBot` → invite si besoin, sinon `notifyRuntimeReload` → `POST {BOT_RUNTIME_URL}/internal/reload`.
5. Runtime : sync Prisma → Map mémoire ; poll ~30s si reload manqué.

---

## 3. Checkout Stripe SaaS Botly (plans)

1. `POST /api/stripe/checkout` / portal / `POST /api/stripe/webhook`.
2. `syncSubscription` → `enforcePlanLimits` → reload runtime.
3. Plans : `lib/plans.ts` (web) + `bot-runtime/src/plan-limits.ts` (parity testée).

Hors `APP_ENV=production`, `sk_live_` refusée.

---

## 4. RGPD — export et suppression

**Export** `GET /api/account` : user, accounts sans jetons, subscription, bots, compte de warnings.

**Suppression** `DELETE /api/account` : cancel Stripe → delete user (cascade) → deprovision bots → best-effort delete customer.

---

## 5. Où vit l’état

| Emplacement | Contenu |
|-------------|---------|
| PostgreSQL | Users, OAuth (chiffrés si clé), sessions, subscriptions, bots, **OrgStripeConfig**, **AccessProduct** / grants / codes hashés, **LearnerAccess**, affiliés tracking, webhooks sortants |
| Redis | Rate-limit |
| Mémoire runtime | Map guild → config, client discord.js |
| Secrets env | `DISCORD_BOT_TOKEN`, Stripe Botly, `TOKEN_ENCRYPTION_KEY`, `BOT_RUNTIME_SECRET`, `CRON_SECRET` |

---

## Ancien modèle (supprimé)

Tokens bot clients (`tokenCiphertext`) retirés par `20260908120000_platform_bot_gdpr`.

---

## Limites assumées

- Un seul bot plateforme (SPOF).
- Message Content Intent encore requis pour préfixes / automod texte.
- Affiliés = tracking / attribution, **pas de payout**.
- Preuve money path : `npm run test:e2e` (Postgres + Discord mock) — pas d’E2E Stripe live.
- Secrets Stripe formation : toujours `enc:v1:` ; migration legacy : `npm run seal-org-stripe`.
- Release / ops : `docs/RELEASE.md`, `docs/OPS-RUNBOOK.md`, `npm run preflight:prod`.

---

## État produit

Wedge accès formation + plans FREE/STARTER/OPS/SCALE + Diagnostic/Setup. Voir README.
