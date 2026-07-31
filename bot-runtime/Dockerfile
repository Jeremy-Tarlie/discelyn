FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache wget
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY generated ./generated
RUN npm ci --omit=dev
COPY bot-runtime/package.json ./bot-runtime/package.json
COPY bot-runtime/tsconfig.json ./bot-runtime/tsconfig.json
COPY bot-runtime/src ./bot-runtime/src
WORKDIR /app/bot-runtime
RUN npm install && npm install tsx
ENV BOT_RUNTIME_PORT=4001
EXPOSE 4001
CMD ["npx", "tsx", "src/index.ts"]
