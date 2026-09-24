# Botly

## Description

**Botly** est un SaaS Discord pour les **organismes de formation et infopreneurs FR/UE** dont la communauté vit déjà sur Discord.

Le cœur du produit n’est pas un bot hobby (levels, music, giveaways) : c’est le **contrôle d’accès apprenant**.

1. L’apprenant **paie** sur le Stripe de la formation  
2. Botly lui fait **réclamer son Discord** (OAuth)  
3. Le **rôle** (et donc les salons) s’ouvre  
4. **Remboursement**, fin d’abonnement ou fin de cohorte → l’accès est **retiré**

Autour de ça : socle ops formation (welcome, tickets support, rôles, logs, modération traçable, commandes FAQ), dashboard web, facturation UE, export / suppression compte RGPD, et offres d’accompagnement (Diagnostic, Setup Pilot).

**Pas un MEE6.** MEE6 et Carl animent un serveur ; Botly **relie le paiement à l’accès Discord**.

### Accès formation (features)

- Payment Links + codes promo Stripe (`allow_promotion_codes`)
- Abonnements récurrents (revoke sur unpaid / canceled)
- Places limitées, codes manuels (`/claim/code`), multi-serveurs (grants)
- Boutique Discord (`/boutique` + poster depuis le dashboard)
- DM bienvenue / onboarding / relances claim / rappel J-N avant fin cohorte
- Dashboard apprenants, stats GMV, affiliés tracking (`/r/{code}`), webhooks sortants HMAC
- Branding claim (logo / couleur / nom orga)

Cron (Bearer `CRON_SECRET`) : `POST /api/cron/access` (~15 min — claim / expiry / onboarding) et `POST /api/cron/retention` (horaire — RGPD analytics/leads). Compose : services `access-cron` + `retention-cron`.

Stack : Next.js, Prisma / PostgreSQL, Stripe, runtime discord.js (bot plateforme unique).

## Offre

| Offre | Prix | Contenu |
|-------|------|---------|
| Essai (FREE) | 0 € | **1 produit Stripe→rôle** + socle ops |
| Starter | 19,99 €/mois | Jusqu’à **5** produits accès, export audit, 15 cmds |
| Ops | 49 €/mois | Jusqu’à **20** produits accès, 40 cmds |
| Scale | 99 €/mois | Jusqu’à 5 serveurs, **100** produits, automod, DPA, support |
| Diagnostic | 49 € one-shot | Cadrage 90 min ; déduit du Setup si enchaînement |
| Setup Pilot | 290 € one-shot | Livraison sous 10 jours ouvrés + 1 h formation |

## Différence vs les autres

| | Whop / LaunchPass / PayBot | MEE6 / Carl | **Botly** |
|---|---------------------------|-------------|-----------|
| Job | Communauté payante US | Animer le serveur | **Accès formation FR** |
| Setup | Store / bot Discord | Modules hobby | **3 min : sk_ → rôle → lien** |
| Commission | Souvent un cut | Freemium features | **0 % Botly** (ton Stripe) |
| Webhook | Variable | N/A | **Créé automatiquement** |

## Positionnement

Segment prioritaire : formations / infoproduits francophones déjà sur Discord.  
Interlocuteur FR, facture UE, angle conformité — pas une course aux modules hobby.

## Démarrage local

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db redis
npm install && npm run db:migrate:deploy && npm run dev
```

Second terminal :

```bash
cd bot-runtime && npm install && npm run dev
```

Variables minimales : `NEXTAUTH_SECRET`, `DISCORD_CLIENT_ID`,
`DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `BOT_RUNTIME_SECRET`,
`APP_ENV=development`. Pour le grant-on-join runtime→web : `WEB_INTERNAL_URL`
(défaut local `http://localhost:3000`). Voir `.env.example`.

### Tests

`npm test` / `npm run test:e2e` démarrent (si besoin) un Postgres dédié via
`docker-compose.test.yml` sur le port **5433** (`BOTLY_TEST_DATABASE_URL`).
Docker doit tourner. En CI, `DATABASE_URL` du service Postgres est réutilisé.

En **production** et **staging** : `TOKEN_ENCRYPTION_KEY` + `CRON_SECRET` +
`BOT_RUNTIME_SECRET` (fail-fast au boot). En **production** : `REDIS_URL`
également obligatoire. `TOKEN_ENCRYPTION_KEY` est aussi requis pour brancher le
Stripe formation (`sk_` / `whsec_` chiffrés).

Le compose démarre `access-cron` (15 min) + `retention-cron` (1 h).
Sur une base existante après ajout de la clé :
`npm run seal-oauth` (OAuth) et `npm run seal-org-stripe` (sk_/whsec_ formation).

Aide diagnostic (rapport 49 €) : `node scripts/diagnostic-collect.mjs --help`
(voir `docs/DIAGNOSTIC-TRAME.md`).

Release / ops : `docs/RELEASE.md`, `docs/OPS-RUNBOOK.md`.
Avant prod : `npm run preflight:prod` · `npm run test:e2e` · `npm run backup:db`.

## Sécurité dépôt

Audit historique Git (sept. 2026) : aucun `.env` réel committé ; pas de
`sk_live` / secrets Discord de production trouvés dans l’historique. Ne jamais
committer `.env`. Utiliser uniquement `.env.example` comme référence de noms
de variables.

## Slash commands

`/ticket`, `/warn`, `/kick`, `/ban`, `/close` (+ préfixes `!`). Message Content
Intent encore requis pour préfixes / automod texte.

Licence : MIT — Copyright (c) 2025–2026 Jérémy Tarlié.
