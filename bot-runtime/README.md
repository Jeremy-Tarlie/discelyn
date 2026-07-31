# bot-runtime

Processus Node qui charge les bots depuis Postgres, déchiffre les tokens, et
maintient les clients discord.js.

## Dev

```bash
cp ../.env.example ../.env   # si besoin
npm install
npm run dev
```

Endpoints :

- `GET /health`
- `POST /internal/reload` `{ "botId": "..." }` (Bearer `BOT_RUNTIME_SECRET`)
- `POST /internal/stop` `{ "botId": "..." }`
