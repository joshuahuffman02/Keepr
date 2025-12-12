FROM node:20.18-alpine AS base
RUN echo "Build timestamp: $(date)" && corepack enable && corepack prepare pnpm@7.33.6 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY platform/packages/shared/package.json ./platform/packages/shared/
COPY platform/apps/api/package.json ./platform/apps/api/
COPY platform/apps/web/package.json ./platform/apps/web/
RUN pnpm install --no-frozen-lockfile

# Build shared package
FROM deps AS shared
COPY platform/packages/shared ./platform/packages/shared
RUN pnpm --filter @campreserv/shared build

# Build web app
FROM shared AS web-builder
COPY platform/apps/web ./platform/apps/web
RUN pnpm --filter @campreserv/web build

# Production image for web
FROM base AS web
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/platform ./platform
COPY --from=shared /app/platform/packages/shared/dist ./platform/packages/shared/dist
COPY --from=web-builder /app/platform/apps/web/.next ./platform/apps/web/.next
COPY --from=web-builder /app/platform/apps/web/public ./platform/apps/web/public
COPY --from=web-builder /app/platform/apps/web/package.json ./platform/apps/web/
COPY package.json pnpm-workspace.yaml ./

WORKDIR /app/platform/apps/web
EXPOSE 3000
CMD ["/app/node_modules/.bin/next", "start", "-p", "3000"]
