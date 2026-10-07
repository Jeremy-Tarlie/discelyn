# Web Next.js — runner = standalone uniquement (pas de node_modules monorepo complet).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts \
  && npm cache clean --force \
  && rm -rf /root/.npm

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public
RUN npm run build \
  && npm cache clean --force \
  && rm -rf /root/.npm

FROM node:22-alpine AS prisma-cli
WORKDIR /opt/prisma-cli
RUN npm init -y >/dev/null \
  && npm install --no-save --omit=dev prisma@7.10.0 dotenv \
  && npm cache clean --force \
  && rm -rf /root/.npm

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Évite que Docker HOSTNAME (= ID conteneur) fasse binder Next.js hors de 0.0.0.0
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN apk add --no-cache wget \
  && rm -rf /var/cache/apk/*

COPY --from=prisma-cli /opt/prisma-cli /opt/prisma-cli
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/generated ./generated
# Standalone Next = serveur + deps tracées (pas le monorepo entier)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh
EXPOSE 3000
CMD ["sh", "./docker-entrypoint.sh"]
