# Release & ops — Botly

Checklist avant `APP_ENV=production`. À suivre dans l’ordre.

## 1. Preflight code

```bash
npm ci
npm run typecheck
npm run typecheck:runtime
npm run lint
npm test
npm run test:e2e          # money path DB (nécessite DATABASE_URL)
npm run build
npm --prefix bot-runtime run build
npm run preflight:prod    # --env-file=.env
```

## 2. Base de données

```bash
npm run db:migrate:deploy
npm run seal-oauth        # si jetons OAuth legacy en clair
npm run seal-org-stripe   # si sk_/whsec_ formation en clair
npm run backup:db         # snapshot avant cutover
```

## 3. Secrets prod (présence)

| Variable | Rôle |
|----------|------|
| `APP_ENV=production` | Active live Stripe + fail-fast |
| `TOKEN_ENCRYPTION_KEY` | OAuth + Stripe formation |
| `CRON_SECRET` | access-cron + retention-cron |
| `BOT_RUNTIME_SECRET` | reload + learner-join |
| `WEB_INTERNAL_URL` | grant-on-join runtime → web |
| `STRIPE_SECRET_KEY` (`sk_live_`) | SaaS Botly |
| `STRIPE_WEBHOOK_SECRET` | webhook SaaS |
| `DISCORD_BOT_TOKEN` | bot plateforme |
| `REDIS_URL` | rate-limit multi-instance (fortement recommandé) |
| `SENTRY_DSN` | erreurs (recommandé) |

Ne jamais committer `.env`. Référence : `.env.example`.

## 4. Déploiement compose

```bash
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build
# Vérifier :
curl -fsS https://TON_DOMAINE/api/health
docker compose logs -f access-cron retention-cron runtime web
```

Health attendu : `status` `ok` ou `degraded` explicable ; `db: ok` ; `ops.encryption` / `ops.cron` = `configured`.

## 5. Preuve manuelle money path (1×)

1. Brancher Stripe **test** orga (ou live si déjà en prod) via dashboard accès.
2. Créer un produit price → rôle.
3. Payer le Payment Link (carte test).
4. Claim OAuth → rôle Discord.
5. Multi-guild : join 2ᵉ serveur → ACTIVE seulement quand tous les grants OK.
6. Refund / cancel → rôle retiré.
7. Vérifier cron : `POST /api/cron/access` avec Bearer → 200.

## 6. Tag release

```bash
git tag -a v2.x.y -m "Botly v2.x.y — accès formation"
git push origin v2.x.y   # seulement quand tu es prêt
```

## Rollback

1. `docker compose` image précédente / tag git précédent.
2. Restaurer dump : `gunzip -c backups/botly-….sql.gz | psql "$DATABASE_URL"`.
3. Ne pas rejouer une migration destructive sans backup.
