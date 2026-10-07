# Architecture — flux réels

Document destiné à un lecteur technique. Il décrit ce que le code fait aujourd’hui, pas une cible idéale.

## Vue d’ensemble

Trois processus applicatifs + deux stores :

| Composant | Rôle |
|-----------|------|
| **web** (Next.js) | OAuth, dashboard, API, **double Stripe** (SaaS Discelyn + formation orga), claim, crons |
| **bot-runtime** | Un client discord.js (`DISCORD_BOT_TOKEN`), configs par `guildId` en mémoire, join → grant |
| **PostgreSQL** | Source de vérité (users, **organizations**, memberships, bots, accès apprenants, org Stripe, leads…) |
| **Redis** | Rate-limit distribué (obligatoire en prod). Absent → mémoire process ; erreur Redis en staging/prod → **fail-closed 429** |

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
2. Retry court (3×) côté runtime ; si le web reste down → cron `retryStuckGrants` / prochain join / re-claim. Pas de fallback Discord.js local.
3. Variable runtime : `WEB_INTERNAL_URL` (compose : `http://web:3000`).

### Revoke

- Remboursement / unpaid / canceled / fin de cohorte → `revokeLearnerAccess` (tous les grants).
- Cron `POST /api/cron/access` (~15 min) : expiry, relances claim (DM ou webhook `claim_reminder`), J-N, onboarding, retry grants, retry refunds oversold, reconcile `seatsUsed`.
- Cron `POST /api/cron/retention` (1 h) : purge analytics / leads / consentements cookies expirés + anonymisation PII apprenants révoqués (365 j).

### Codes manuels

Création : clair renvoyé **une fois** ; stocké en `codeHash` (SHA-256) + `codePrefix`.

---

## 2. Connexion orga → serveur lié → runtime

1. `/api/auth/signin` (NextAuth Discord, sessions DB).
2. Création user → **Organization** + membership `OWNER` + abonnement `FREE` (`bootstrapOrganizationForUser`). `User.discordId` au link Account.
3. Session : `organizationId` + `orgRole` ; plan lu sur la Subscription de l’org.
4. `POST /api/bots` → modèle `Bot` = **binding guild** plateforme (`PENDING`) ; liaison via `POST /api/bots/[id]/guild`.
5. `provisionBot` → invite si besoin, sinon `notifyRuntimeReload` → `POST {BOT_RUNTIME_URL}/internal/reload`.
6. Runtime : sync Prisma → Map mémoire ; poll ~30s si reload manqué.
7. Équipe : `GET/POST/DELETE /api/org/members` (ajout par Discord ID d’un compte Discelyn existant).

---

## 3. Checkout Stripe SaaS Discelyn (plans)

1. `POST /api/stripe/checkout` / portal / `POST /api/stripe/webhook` (metadata `organizationId`).
2. `syncSubscription` → `enforcePlanLimits(organizationId)` → reload runtime.
3. Plans : limites runtime dans `shared/runtime-plan-limits.ts` (source unique) → `lib/plans.ts` (offres web) + `bot-runtime/src/plan-limits.ts` (helpers runtime).

Hors `APP_ENV=production`, `sk_live_` refusée.

---

## 4. RGPD — export et suppression

**Export** `GET /api/account` : user, accounts sans jetons, orgs / memberships, subscription orga, bots, compte de warnings.

**Suppression** `DELETE /api/account` (soft-delete user) :
1. Pour chaque membership `OWNER` sans autre OWNER → `softDeleteOrganization` (revoke Discord, soft-delete bots, purge `OrgStripeConfig`, **anonymisation immédiate PII** `LearnerAccess`, `organization.deletedAt`)
2. Sinon retrait de la membership seulement
3. Anonymisation user (`email`/`discordId` null) + invalidation sessions
4. Best-effort cancel / delete customer Stripe Discelyn (appelant)

**Rétention PII apprenants** (orgs actives) : cron `POST /api/cron/retention` anonymise `LearnerAccess` en `REVOKED`/`EXPIRED` après **365 jours** (`LEARNER_PII_RETENTION_DAYS`) — nullifie email, discordUserId, claimToken, stripeCustomerId, inviteUrl. Les montants / ids Stripe paiement peuvent rester pour audit comptable.

Un webhook Stripe formation qui arrive après purge reçoit `404` (config absente) ou `200 ignored` (orga/produit/bot morts) — **pas** de retry infini 500.

Voir `lib/soft-delete-ops.ts`, `lib/data-retention.ts`.

---

## 5. Où vit l’état

| Emplacement | Contenu |
|-------------|---------|
| PostgreSQL | Users, memberships, **Organizations**, OAuth (chiffrés si clé), sessions, subscriptions **par org**, bots (bindings guild), **OrgStripeConfig**, **AccessProduct** / grants / codes hashés, **LearnerAccess**, affiliés tracking, webhooks sortants |
| Redis | Rate-limit |
| Mémoire runtime | Map guild → config, client discord.js |
| Secrets env | `DISCORD_BOT_TOKEN`, Stripe Discelyn, `TOKEN_ENCRYPTION_KEY`, `BOT_RUNTIME_SECRET`, `CRON_SECRET` |

---

## Ancien modèle (supprimé)

Tokens bot clients (`tokenCiphertext`) retirés par `20260908120000_platform_bot_gdpr`.  
User-as-org remplacé par `Organization` + `OrganizationMembership` (`20260928100000_organization_memberships`).

---

## Limites assumées

- Un seul bot plateforme (SPOF) — procédure : `docs/OPS-RUNBOOK.md` + `docs/KEY-ROTATION.md`.
- Message Content Intent encore requis pour préfixes / automod texte.
- Affiliés = tracking / attribution, **pas de payout**.
- Multi-org : cookie `discelyn_active_org` + switcher dashboard ; pas d’invites email (memberships = Discord ID d’un compte existant).
- Preuve money path : `npm run test:db` + tests HTTP webhooks (`*.http.test.ts`) — **pas** d’E2E Stripe/Discord live (`npm run smoke:live`).
- Secrets Stripe formation : toujours `enc:v1:` ; migration legacy : `npm run seal-org-stripe`.
- Release / ops : `docs/RELEASE.md`, `docs/OPS-RUNBOOK.md`, `npm run preflight:prod`.

---

## État produit

Wedge accès formation + plans FREE/STARTER/OPS/SCALE + Diagnostic/Setup. Voir README.
