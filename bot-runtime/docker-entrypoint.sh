#!/bin/sh
set -e
# Pas de migrate ici — le service web est le seul migrator au boot.
cd /app/bot-runtime
exec node dist/bot-runtime/src/index.js
