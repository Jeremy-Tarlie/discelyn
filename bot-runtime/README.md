# bot-runtime

Bot **plateforme** unique (`DISCORD_BOT_TOKEN`) : charge les configs par
`guildId` depuis Postgres. Aucun token utilisateur.

```bash
npm install
npm run dev      # développement
npm run build && npm start
```

- `GET /health`
- `POST /internal/reload` — resync configs (Bearer `BOT_RUNTIME_SECRET`)
- `POST /internal/stop` — idem (resync)
