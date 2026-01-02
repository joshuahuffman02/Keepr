#!/bin/sh
# Don't use set -e so we can handle failures gracefully

echo "=== CAMPRESERV API STARTUP SCRIPT ==="
echo "Date: $(date)"
echo "Working dir: $(pwd)"

echo "=== Schema check (Site model) ==="
grep -A 10 "model Site {" prisma/schema.prisma | head -15

# Wait for database to be ready (Railway internal networking can take a moment)
echo "=== Waiting for database connection ==="
MAX_RETRIES=10
RETRY_COUNT=0
DB_READY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if echo "SELECT 1" | npx prisma db execute --stdin 2>/dev/null; then
        DB_READY=true
        echo "Database is ready!"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Waiting for database... attempt $RETRY_COUNT/$MAX_RETRIES"
    sleep 3
done

if [ "$DB_READY" = true ]; then
    echo "=== Database is ready ==="
    # NOTE: Schema changes should be applied via migrations before deployment
    # DO NOT use 'prisma db push --accept-data-loss' in production
    # Use 'prisma migrate deploy' for production schema updates
    echo "Skipping schema push - use migrations for production deployments"
else
    echo "WARNING: Database not reachable after $MAX_RETRIES attempts"
    echo "The app will attempt to connect when handling requests"
fi

echo "=== Checking Prisma client ==="
# Check if Prisma client was already generated at build time
PRISMA_CLIENT_PATH=$(find /app/node_modules/.pnpm -name ".prisma" -type d 2>/dev/null | grep "@prisma+client" | head -1)

if [ -n "$PRISMA_CLIENT_PATH" ] && [ -f "$PRISMA_CLIENT_PATH/client/default.js" ]; then
    echo "Prisma client found at: $PRISMA_CLIENT_PATH"
    echo "Skipping regeneration - using pre-built client"
else
    echo "Prisma client not found, generating..."
    cd /app/platform/apps/api && npx prisma generate
    cd /app/platform/apps/api
fi

echo "=== Linking Prisma client for pnpm ==="
node /app/scripts/link-prisma-client.js || echo "Link script not found, skipping"

echo "=== Starting app ==="
cd /app/platform/apps/api
exec node dist/main.js
