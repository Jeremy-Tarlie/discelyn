#!/bin/sh
set -e
cd /app
# prisma.config.ts résout "prisma/config" / dotenv via le CLI isolé (pas de monorepo à /app)
NODE_PATH=/opt/prisma-cli/node_modules \
  /opt/prisma-cli/node_modules/.bin/prisma migrate deploy
cd /app/bot-runtime
exec node dist/bot-runtime/src/index.js
