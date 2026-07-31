# Botly

SaaS de bots Discord prêts à héberger : auth Discord, Stripe (Free / 2,99 / 6,99 / 12,99 €), tokens chiffrés, runtime discord.js.

## Architecture prod

- **web** : Next.js (dashboard + Stripe + API)
- **runtime** : process Node qui login les bots Discord depuis Postgres
- **db** : PostgreSQL

## CI (GitHub Actions)

Dans **Settings → Secrets and variables → Actions**, crée au minimum :

| Secret | Exemple CI (pas la prod) |
|--------|---------------------------|
| `DATABASE_URL` | `postgresql://botly:botly@localhost:5432/botly?schema=public` |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` |
| `DISCORD_CLIENT_ID` | placeholder Discord |
| `DISCORD_CLIENT_SECRET` | placeholder Discord |
| `BOT_SECRETS_ENCRYPTION_KEY` | `openssl rand -hex 32` |

Pour la prod serveur, utilise d’autres valeurs dans le `.env` du VPS — pas les mêmes que la CI si possible.

## Setup local

1. Copie `.env.example` → `.env`
2. Génère les secrets :
   - `openssl rand -base64 32` → `NEXTAUTH_SECRET`
   - `openssl rand -hex 32` → `BOT_SECRETS_ENCRYPTION_KEY`
   - `openssl rand -hex 32` → `BOT_RUNTIME_SECRET`
3. `docker compose up -d db`
4. `npm install`
5. `npm run db:migrate:deploy` (ou `npm run db:migrate` en dev)
6. `npm run dev`
7. Runtime : `cd bot-runtime && npm install && npm run dev`

### Discord OAuth

Redirect : `http://localhost:3000/api/auth/callback/discord`

### Stripe

3 prices mensuels + webhook :
`stripe listen --forward-to localhost:3000/api/stripe/webhook`

## Prod (Hetzner)

1. VPS + Docker
2. Remplir `.env` (URLs HTTPS, clés Stripe live, Discord prod)
3. `docker compose up -d --build`
4. Santé :
   - `GET /api/health`
   - `GET :4001/health`

Le container `web` exécute `prisma migrate deploy` au démarrage.

## Parcours utilisateur

1. Login Discord
2. Créer un bot
3. Coller le token Developer Portal (chiffré AES-256-GCM)
4. Inviter le bot
5. Activer les modules selon le plan
