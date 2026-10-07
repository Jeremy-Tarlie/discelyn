# Disque Docker plein (serveur)

Si le build échoue avec `no space left on device`, libérer l’espace **avant** un nouveau `--build`.

```bash
# Images / cache build / conteneurs arrêtés (ne touche pas aux volumes pg/redis nommés en cours d’usage)
docker builder prune -af
docker image prune -af
docker container prune -f

# Voir l’usage
docker system df
df -h
```

Éviter `docker volume prune` sauf si tu acceptes de perdre des volumes orphelins (pas `discelyn_pg` / `discelyn_redis` s’ils sont encore référencés).

Puis rebuild :

```bash
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build
```

## Images allégées

- **runtime** : plus de `npm ci` du monorepo Next ; seulement deps `bot-runtime` + Prisma CLI isolé.
- **web** : runner = Next `standalone` (plus de copie du `node_modules` complet).

## Runtime unhealthy

```bash
docker logs discelyn-runtime-1 --tail 100
docker inspect discelyn-runtime-1 --format '{{json .State.Health}}'
```

Cause fréquente après le slim : `prisma migrate deploy` ne trouvait plus `prisma/config` — corrigé via `NODE_PATH=/opt/prisma-cli/node_modules` dans les entrypoints.
