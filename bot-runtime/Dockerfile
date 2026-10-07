# Image runtime Discord — volontairement sans le monorepo Next (next/react/stripe…).
# Migrate DB : CLI Prisma isolé dans /opt/prisma-cli (pas npm ci racine).

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
COPY bot-runtime/package.json bot-runtime/package-lock.json ./bot-runtime/
COPY bot-runtime/tsconfig.json ./bot-runtime/
COPY bot-runtime/src ./bot-runtime/src
WORKDIR /app/bot-runtime
RUN npm ci \
  && npm run build \
  && npm prune --omit=dev \
  && npm cache clean --force \
  && rm -rf /root/.npm

# CLI Prisma minimal pour migrate deploy au boot (web peut aussi migrer)
FROM node:22-alpine AS prisma-cli
WORKDIR /opt/prisma-cli
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public
RUN npm init -y >/dev/null \
  && npm install --no-save --omit=dev prisma@7.10.0 dotenv \
  && npm cache clean --force \
  && rm -rf /root/.npm

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache wget \
  && rm -rf /var/cache/apk/*
COPY --from=prisma-cli /opt/prisma-cli /opt/prisma-cli
COPY prisma ./prisma
COPY prisma.config.ts ./
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
