#!/bin/sh
set -e
cd /app
# prisma.config.ts résout "prisma/config" / dotenv via le CLI isolé
NODE_PATH=/opt/prisma-cli/node_modules \
  /opt/prisma-cli/node_modules/.bin/prisma migrate deploy
exec node server.js
