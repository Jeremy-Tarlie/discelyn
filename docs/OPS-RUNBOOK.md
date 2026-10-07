# Runbook ops — Discelyn

## Services

| Service | Rôle | Health |
|---------|------|--------|
| `web` | Next.js API + dashboard | Compose : `GET /api/health/live` · Uptime : `GET /api/health` |
| `runtime` | discord.js plateforme | `GET {BOT_RUNTIME_URL}/health` |
| `db` | Postgres | compose healthcheck |
| `redis` | rate-limit | ping via `/api/health` |
| `access-cron` | claim / expiry / onboarding (15 min) | logs HTTP 200 |
| `retention-cron` | RGPD analytics/leads (1 h) | logs HTTP 200 |

## Alertes minimales

1. `/api/health/live` → Compose liveness (DB only). Un blip Discord ne doit **pas** stopper les crons.
2. `/api/health` → readiness produit : HTTP **503** si `status=degraded|error` (uptime externe).
3. `platformBot.status=error` ou `runtime.status=error` → bot / join cassés (503 readiness, pas liveness).
4. `access-cron` HTTP ≠ 200 → plus d’expiry ni relances claim.
5. Sentry : spikes `learner-join`, `access-webhook`, unseal secrets.
6. Logs `[access-webhook] handler error (claim released)` en boucle → config price/produit/guild à corriger (Stripe retente).

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

## Discord « Used disallowed intents » (4014)

Le runtime demande des intents **privilégiés**. Sans eux Discord coupe le gateway → crash / restart loop.

1. [Discord Developer Portal](https://discord.com/developers/applications) → ton app → **Bot**
2. **Privileged Gateway Intents** → active :
   - **SERVER MEMBERS INTENT**
   - **MESSAGE CONTENT INTENT**
3. Save → sur le VPS : `docker compose … restart runtime`

Sans Message Content : préfixe / automod / mods texte cassés.  
Sans Server Members : joins / grants rôle incomplets.

## Redis / runtime « failed to start »

Compose affiche souvent `Error dependency redis/runtime failed to start` :
ce n’est **pas** une dépendance circulaire. En pratique :

1. **redis** n’est pas devenu `healthy` (exit / crash / healthcheck) → **web** ne démarre pas.
2. **web** unhealthy (`/api/health/live`) → **runtime**, crons et caddy (TLS overlay) restent bloqués.

### Diagnostiquer (sur le VPS)

```bash
cd /opt/discelyn   # ou REMOTE_DIR
docker compose -f docker-compose.yml -f docker-compose.tls.yml ps -a
docker compose -f docker-compose.yml -f docker-compose.tls.yml logs redis --tail 80
docker compose -f docker-compose.yml -f docker-compose.tls.yml logs runtime --tail 80
```

### Causes fréquentes

| Service | Symptôme logs | Fix |
|---------|---------------|-----|
| **redis** | `Bad file format` / `Fatal error loading the DB` | AOF/RDB corrompu après arrêt brutal — voir ci-dessous |
| **redis** | `Permission denied` sur `/data` | droits volume ; recreating volume si vide OK |
| **redis** | OOM / exit immédiat | RAM VPS trop juste |
| **runtime** | `DISCORD_BOT_TOKEN manquant` / `BOT_RUNTIME_SECRET manquant` | `.env` incomplet |
| **runtime** | login Discord fail | token révoqué / invalide |
| **runtime** | healthcheck timeout | rebuild avec le fix « /health avant login » (`--build`) — un build en **2 s** = cache, pas forcément le nouveau code |

### Réparer Redis (AOF corrompu)

```bash
# 1) Arrêt redis
docker compose stop redis

# 2a) Réparer l’AOF (conserve les données si possible)
docker compose run --rm --entrypoint sh redis -c \
  "redis-check-aof --fix /data/appendonlydir/appendonly.aof.manifest || redis-check-aof --fix /data/appendonly.aof || true"

# 2b) Si irrécupérable (DEV / staging OK — PERTE du rate-limit store uniquement) :
# docker volume rm discelyn_redis   # nom exact : docker volume ls | grep redis

docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d redis
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build runtime web
```

### Rebuild forcé runtime (après fix health)

```bash
docker compose -f docker-compose.yml -f docker-compose.tls.yml build --no-cache runtime
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d runtime
docker compose -f docker-compose.yml -f docker-compose.tls.yml logs -f runtime
```

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
