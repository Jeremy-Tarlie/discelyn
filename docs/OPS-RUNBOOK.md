# Runbook ops — Botly

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

1. `/api/health` → `status=error` ou `db=error` (page / uptime).
2. `platformBot.status=error` ou `runtime.status=error` → bot / join cassés.
3. `access-cron` HTTP ≠ 200 → plus d’expiry ni relances claim.
4. Sentry : spikes `learner-join`, `access-webhook`, unseal secrets.

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

## Backup

```bash
npm run backup:db
# Planifier quotidiennement (cron host / CI scheduled) → stocker hors machine
```

Rétention recommandée : 7 j quotidiens + 4 hebdo.

## Rotations

| Secret | Action |
|--------|--------|
| `TOKEN_ENCRYPTION_KEY` | **Ne pas changer** sans re-seal de toute la DB (OAuth + Org Stripe) |
| `CRON_SECRET` | Update `.env` + recreate crons |
| `BOT_RUNTIME_SECRET` | Update web + runtime ensemble |
| `DISCORD_BOT_TOKEN` | Portal Discord → reset → update env → restart runtime |
| Stripe `sk_` orga | Dashboard accès → re-setup |

## SPOF assumé

Un seul `DISCORD_BOT_TOKEN`. Outage Discord / ban / rate-limit = tous les clients. Surveiller `platformBot` dans health.
