# Runbook ops — Discelyn

## Services

| Service | Rôle | Health |
|---------|------|--------|
| `web` | Next.js API + dashboard | `GET /api/health` |
| `runtime` | discord.js plateforme | `GET {BOT_RUNTIME_URL}/health` |
| `db` | Postgres | compose healthcheck |
| `redis` | rate-limit | ping via `/api/health` |
| `access-cron` | claim / expiry / onboarding (15 min) | logs HTTP 200 |
| `retention-cron` | RGPD analytics/leads (1 h) | logs HTTP 200 |

## Alertes minimales

1. `/api/health` → HTTP **503** (`status=degraded|error`) ou `db=error` (page / uptime). Compose exige `"status":"ok"` dans le body.
2. `platformBot.status=error` ou `runtime.status=error` → bot / join cassés (déjà inclus dans le 503).
3. `access-cron` HTTP ≠ 200 → plus d’expiry ni relances claim.
4. Sentry : spikes `learner-join`, `access-webhook`, unseal secrets.
5. Logs `[access-webhook] handler error (claim released)` en boucle → config price/produit/guild à corriger (Stripe retente).

## Incidents fréquents

### Join n’attribue pas le rôle

1. `WEB_INTERNAL_URL` joignable depuis le runtime (`http://web:3000` en compose).
2. Logs runtime : `grant-on-join web failed`.
3. `BOT_RUNTIME_SECRET` identique web ↔ runtime.
4. Produit / grants / statut `AWAITING_JOIN` en DB.

### Webhook formation 500 « secret unseal »

1. `TOKEN_ENCRYPTION_KEY` manquante ou changée.
2. `npm run seal-org-stripe` si secrets encore en clair.
3. Relancer setup accès si clé perdue (recréer webhook).

### Relances claim absentes

1. `CRON_SECRET` défini.
2. Conteneur `access-cron` up.
3. `curl -X POST -H "Authorization: Bearer $CRON_SECRET" …/api/cron/access`.
4. Sans `discordUserId` : email Resend si `RESEND_API_KEY` + `EMAIL_FROM`, sinon webhook orga `claim_reminder`.

## Soft-delete

Suppression compte / bot = soft-delete (`deletedAt`) + revoke Discord + anonymisation user (RGPD).

À la suppression **compte** (`softDeleteUserAccount`) :
- produits accès désactivés, codes / affiliés / webhooks sortants coupés (`secret=revoked`)
- `OrgStripeConfig` **supprimée** (plus de sk_/whsec_ en base ; URL webhook → 404)
- subscription locale → `CANCELED` / `FREE`
- `LearnerAccess` conservés pour audit (pas de cascade hard)

Webhook formation après purge : `200 ignored` (orga/produit/bot morts) ou `404` — pas de retry 500 infini.

## Backup

```bash
npm run backup:db
# Planifier quotidiennement (cron host / CI scheduled) → stocker hors machine
# Exemple : scripts/backup-cron.example
```

Rétention recommandée : 7 j quotidiens + 4 hebdo. Tester un restore 1×/mois.

## Rotations

Voir **`docs/KEY-ROTATION.md`** (TOKEN_ENCRYPTION_KEY, bot token, Stripe).

| Secret | Action |
|--------|--------|
| `TOKEN_ENCRYPTION_KEY` | **Ne pas changer** sans re-seal de toute la DB (OAuth + Org Stripe) |
| `CRON_SECRET` | Update `.env` + recreate crons |
| `BOT_RUNTIME_SECRET` | Update web + runtime ensemble |
| `DISCORD_BOT_TOKEN` | Portal Discord → reset → update env → restart runtime |
| Stripe `sk_` orga | Dashboard accès → re-setup |

## SPOF Discord (mitigé, pas éliminé)

Un seul `DISCORD_BOT_TOKEN`. Ban / revocation token = tous les clients.
Mitigations en place :
- `restart: unless-stopped` + healthchecks
- reconnect shards (`ShardReconnecting` / `ShardResume`)
- `DISCORD_SHARD_COUNT` optionnel (multi-shard **in-process**, même token)
- cron `retryStuckGrants` si le runtime a manqué un join

Procédure incident : `docs/KEY-ROTATION.md` § SPOF bot.
Multi-bot / bot-par-orga = rewrite produit.

## Go-live

Checklist complète : **`docs/GO-LIVE.md`**. DPA modèle : **`docs/DPA.md`**. Smoke : **`docs/SMOKE-LIVE.md`**.
