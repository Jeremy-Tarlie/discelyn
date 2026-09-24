FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY scripts/mark-prisma-esm.mjs ./scripts/mark-prisma-esm.mjs
COPY scripts/rewrite-prisma-dist-imports.mjs ./scripts/rewrite-prisma-dist-imports.mjs
# prisma.config.ts exige DATABASE_URL même pour generate
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public
RUN npm ci --omit=dev --ignore-scripts \
  && npx prisma generate \
  && node scripts/mark-prisma-esm.mjs
COPY bot-runtime/package.json ./bot-runtime/package.json
COPY bot-runtime/tsconfig.json ./bot-runtime/tsconfig.json
COPY bot-runtime/src ./bot-runtime/src
WORKDIR /app/bot-runtime
RUN npm install
# rootDir implicite = /app (src + generated) → sortie dist/bot-runtime/src + dist/generated
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY scripts/mark-prisma-esm.mjs ./scripts/mark-prisma-esm.mjs
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public
RUN npm ci --omit=dev --ignore-scripts \
  && npx prisma generate \
  && node scripts/mark-prisma-esm.mjs
COPY bot-runtime/package.json ./bot-runtime/package.json
WORKDIR /app/bot-runtime
RUN npm install --omit=dev
COPY --from=builder /app/bot-runtime/dist ./dist
COPY bot-runtime/docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh
ENV BOT_RUNTIME_PORT=4001
EXPOSE 4001
CMD ["sh", "./docker-entrypoint.sh"]
