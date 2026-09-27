FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@10.32.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter commerce-core --filter @commerce-core/api
COPY tsconfig.base.json ./
COPY apps/api apps/api
# Generation does not connect to this placeholder database.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm --filter @commerce-core/api db:generate
RUN pnpm --filter @commerce-core/api build

FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Keep Prisma CLI for the deployment pre-start migration command.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
USER node
WORKDIR /app/apps/api
ENV NODE_ENV=production
ENV API_PORT=3001
EXPOSE 3001
CMD ["node", "dist/main.js"]
