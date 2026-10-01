# Release & ops — Discelyn

Checklist avant `APP_ENV=production`. À suivre dans l’ordre.

## Gate unique (points 2→7)

```bash
# Docker Desktop doit tourner (migrate / test:db / backup via compose)
npm run release:gate
```

Enchaîne : migrate → preflight → typecheck → lint → test → **test:db money path** → builds → vérif TLS → **backup DB**.

Flags : `--skip-build` · `--skip-e2e` · `--skip-backup`

## 1. Preflight code (si tu ne passes pas par release:gate)

```bash
npm ci
npm run typecheck
npm run typecheck:runtime
npm run lint
npm test
npm run test:db          # money path DB (Postgres test :5433) — pas E2E live
npm run build
npm --prefix bot-runtime run build
npm run preflight:prod    # --env-file=.env
```

## 2. Base de données

```bash
npm run db:migrate:deploy   # inclut soft-delete User/Bot
npm run seal-oauth          # si jetons OAuth legacy en clair
npm run seal-org-stripe     # si sk_/whsec_ formation en clair
npm run backup:db           # snapshot avant cutover (pg_dump local ou docker exec)
```

## 3. Secrets prod (présence)

| Variable | Rôle |
|----------|------|
| `APP_ENV=production` | Active live Stripe + fail-fast |
| `TRUST_PROXY=1` | **Obligatoire** en prod (preflight refuse sinon) |
| `TOKEN_ENCRYPTION_KEY` | OAuth + Stripe formation |
| `CRON_SECRET` | access-cron + retention-cron |
| `BOT_RUNTIME_SECRET` | reload + learner-join |
| `WEB_INTERNAL_URL` | grant-on-join runtime → web |
| `STRIPE_SECRET_KEY` (`sk_live_`) | SaaS Discelyn |
| `STRIPE_WEBHOOK_SECRET` | webhook SaaS |
| `DISCORD_BOT_TOKEN` | bot plateforme |
| `REDIS_URL` | rate-limit multi-instance (**obligatoire** en production) |
| `SENTRY_DSN` | erreurs (**obligatoire** en prod — preflight) |
| `RESEND_API_KEY` + `EMAIL_FROM` | emails claim (recommandé) |
| `STRIPE_PRICE_STARTER` / `OPS` / `SCALE` | checkout SaaS (**obligatoire** en prod) |
| `BOT_RUNTIME_URL` + `WEB_INTERNAL_URL` | runtime + grant-on-join (**obligatoire** en prod) |
| `DOMAIN` + `EMAIL` | Let's Encrypt (deploy:prod) |

Ne jamais committer `.env`. Référence : `.env.example`.

Checklist « produit fini » : **`docs/GO-LIVE.md`**.

## 4. Déploiement compose (TLS uniquement)

Deux modes TLS (`TLS_MODE` dans `.env`) :

| Mode | Overlay | Quand |
|------|---------|--------|
| `caddy` (défaut) | `docker-compose.tls.yml` | tout-Docker |
| `nginx` | `docker-compose.host-nginx.yml` | VPS durci (nginx + fail2ban + UFW + SSH) |

### 4a. Bootstrap hôte nginx + fail2ban (une fois)

Depuis ton PC (clé SSH déjà créée) :

```bash
# Dans .env : SSH_HOST, SSH_USER, SSH_KEY, DOMAIN, EMAIL, TLS_MODE=nginx
npm run provision:remote
# + deploy compose : npm run provision:remote -- --deploy
```

Ou sur le VPS (root) :

```bash
export DOMAIN=… EMAIL=… SSH_PUBKEY='ssh-ed25519 AAAA…'
# Crée user discelyn (sudo), coupe root SSH + auth mot de passe
bash deploy/bootstrap-host.sh
# Ensuite : ssh discelyn@IP  (plus root, plus de mdp)
```

### 4b. App

```bash
# DOMAIN + EMAIL dans .env (ou exportés)
npm run deploy:prod
# Caddy :  docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build
# nginx :  TLS_MODE=nginx + docker-compose.host-nginx.yml (web sur 127.0.0.1:3000)

curl -fsS https://TON_DOMAINE/api/health
docker compose -f docker-compose.yml -f docker-compose.tls.yml logs -f access-cron retention-cron runtime web
```

**Ne pas** lancer le compose nu en production (port 3000 sans TLS, `TRUST_PROXY=0`).

Health attendu : HTTP **200** + `status: "ok"` + `db: "ok"`.  
Si runtime / Redis / bot plateforme en échec → HTTP **503** + `status: "degraded"`.

## 5. Preuve money path

### Automatisée (obligatoire avant tag)

```bash
npm run test:db
```

Couvre : checkout → siège → multi-guild AWAITING_JOIN → grant-on-join → ACTIVE → revoke (Discord mocké).

### Manuelle post-deploy (1× smoke Discord réel)

```bash
npm run smoke:live
```

Puis `docs/SMOKE-LIVE.md` :

1. Brancher Stripe **test** orga via dashboard accès.
2. Créer un produit price → rôle.
3. Payer le Payment Link (carte test).
4. Claim OAuth → rôle Discord.
5. Refund / cancel → rôle retiré.
6. (abo) past_due → badge Apprenants sans revoke immédiat.
7. `POST /api/cron/access` avec Bearer → 200.

## 6. Tag release

```bash
git tag -a v2.x.y -m "Discelyn v2.x.y — accès formation"
git push origin v2.x.y   # seulement quand tu es prêt
```

## Rollback

1. `docker compose` image précédente / tag git précédent.
2. Restaurer dump : `gunzip -c backups/discelyn-….sql.gz | psql "$DATABASE_URL"`.
3. Ne pas rejouer une migration destructive sans backup.
