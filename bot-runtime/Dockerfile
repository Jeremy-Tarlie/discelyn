# Image runtime Discord — volontairement sans le monorepo Next (next/react/stripe…).
# Inclut `shared/` (limites plan). Migrations DB : uniquement le service web.

FROM node:22-alpine AS prisma-gen
WORKDIR /app
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY scripts/mark-prisma-esm.mjs ./scripts/mark-prisma-esm.mjs
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public
# Uniquement Prisma pour generate — pas le package.json Next
RUN npm init -y >/dev/null \
  && npm install --no-save --omit=dev prisma@7.10.0 @prisma/client@7.10.0 dotenv \
  && npx prisma generate \
  && node scripts/mark-prisma-esm.mjs \
  && npm cache clean --force \
  && rm -rf /root/.npm

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=prisma-gen /app/generated ./generated
COPY scripts/mark-prisma-esm.mjs ./scripts/mark-prisma-esm.mjs
COPY scripts/rewrite-prisma-dist-imports.mjs ./scripts/rewrite-prisma-dist-imports.mjs
COPY shared ./shared
COPY bot-runtime/package.json bot-runtime/package-lock.json ./bot-runtime/
COPY bot-runtime/tsconfig.json ./bot-runtime/
COPY bot-runtime/src ./bot-runtime/src
WORKDIR /app/bot-runtime
RUN npm ci \
  && npm run build \
  && cp -R /app/generated /app/bot-runtime/dist/generated \
  && node /app/scripts/rewrite-prisma-dist-imports.mjs \
  && npm prune --omit=dev \
  && npm cache clean --force \
  && rm -rf /root/.npm

# Migrations DB : uniquement le service web (évite la course sur _prisma_migrations).
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache wget \
  && rm -rf /var/cache/apk/*
COPY --from=builder /app/bot-runtime/dist ./bot-runtime/dist
COPY --from=builder /app/bot-runtime/node_modules ./bot-runtime/node_modules
COPY --from=builder /app/bot-runtime/package.json ./bot-runtime/package.json
COPY bot-runtime/docker-entrypoint.sh ./bot-runtime/docker-entrypoint.sh
RUN sed -i 's/\r$//' ./bot-runtime/docker-entrypoint.sh \
  && chmod +x ./bot-runtime/docker-entrypoint.sh
ENV BOT_RUNTIME_PORT=4001
WORKDIR /app/bot-runtime
EXPOSE 4001
CMD ["sh", "./docker-entrypoint.sh"]
