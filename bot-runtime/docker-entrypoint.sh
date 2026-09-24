#!/bin/sh
set -e
cd /app
npx prisma migrate deploy
cd /app/bot-runtime
exec node dist/bot-runtime/src/index.js
