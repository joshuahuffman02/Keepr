FROM node:22-alpine AS base
# COMPLETE CACHE BUST v22 - Added Prisma link script at runtime
ARG CACHE_BUST=v22
RUN corepack enable && corepack prepare pnpm@7.33.6 --activate
WORKDIR /app
RUN echo "Build: ${CACHE_BUST} - $(date)" > /tmp/build-info

# Install dependencies
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY scripts ./scripts
COPY platform/packages/shared/package.json ./platform/packages/shared/
COPY platform/apps/api/package.json ./platform/apps/api/
COPY platform/apps/web/package.json ./platform/apps/web/
RUN pnpm install --frozen-lockfile

# Build shared package
FROM deps AS shared
COPY platform/packages/shared ./platform/packages/shared
RUN pnpm --filter @campreserv/shared build

# Build API
FROM shared AS api-builder
ARG CACHE_BUST=v22
# Force complete rebuild - no cache
RUN echo "Cache bust timestamp: $(date +%s)"
COPY platform/apps/api ./platform/apps/api
# Force prisma regeneration - CACHE_BUST=${CACHE_BUST}
RUN echo "Regenerating Prisma client - ${CACHE_BUST}" && \
    rm -rf node_modules/.prisma node_modules/@prisma/client platform/apps/api/node_modules/.prisma && \
    pnpm --filter @campreserv/api prisma:generate
RUN echo "Building API with forwardRef fix..." && pnpm --filter @campreserv/api build

# Production image for API
FROM base AS api
ARG CACHE_BUST=v22
COPY --from=api-builder /app/node_modules ./node_modules
COPY --from=deps /app/platform ./platform
COPY --from=shared /app/platform/packages/shared/dist ./platform/packages/shared/dist
COPY --from=api-builder /app/platform/apps/api/dist ./platform/apps/api/dist
COPY --from=api-builder /app/platform/apps/api/prisma ./platform/apps/api/prisma
COPY --from=api-builder /app/platform/apps/api/package.json ./platform/apps/api/
COPY --from=api-builder /app/platform/apps/api/prisma.config.ts ./platform/apps/api/

# Copy scripts folder for prisma linking
COPY --from=deps /app/scripts ./scripts

# Prisma client is generated at build time and copied with node_modules
WORKDIR /app/platform/apps/api

# Copy startup script
COPY platform/apps/api/start.sh ./start.sh
RUN chmod +x start.sh

EXPOSE 3001
CMD ["./start.sh"]
