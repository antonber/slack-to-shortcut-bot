FROM node:20-slim AS builder

RUN corepack enable
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/integrations/package.json packages/integrations/
COPY packages/bot/package.json packages/bot/
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/integrations/ packages/integrations/
COPY packages/bot/ packages/bot/
RUN pnpm turbo build --filter=@mission-control/bot

FROM node:20-slim

RUN corepack enable
WORKDIR /app

COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=builder /app/packages/integrations/package.json packages/integrations/
COPY --from=builder /app/packages/integrations/dist packages/integrations/dist
COPY --from=builder /app/packages/bot/package.json packages/bot/
COPY --from=builder /app/packages/bot/dist packages/bot/dist
RUN pnpm install --frozen-lockfile --prod

CMD ["node", "packages/bot/dist/index.js"]
