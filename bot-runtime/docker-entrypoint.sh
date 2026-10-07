#!/bin/sh
set -e
cd /app
# Prisma CLI isolé (pas le monorepo Next dans l’image)
/opt/prisma-cli/node_modules/.bin/prisma migrate deploy
cd /app/bot-runtime
exec node dist/bot-runtime/src/index.js
