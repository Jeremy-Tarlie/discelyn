#!/bin/sh
set -e
# Prisma CLI isolé — évite de garder le node_modules monorepo dans l’image
/opt/prisma-cli/node_modules/.bin/prisma migrate deploy
exec node server.js
