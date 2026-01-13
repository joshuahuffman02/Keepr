#!/bin/sh
# Don't use set -e so we can handle failures gracefully

echo "=== CAMPRESERV API STARTUP SCRIPT ==="
echo "Date: $(date)"
echo "Working dir: $(pwd)"

echo "=== Schema check (Site model) ==="
grep -A 10 "model Site {" prisma/schema.prisma | head -15

# Skip database wait - let the app handle connection lazily
# The app has built-in connection retry logic via Prisma
echo "=== Skipping database wait (app will connect lazily) ==="
echo "DATABASE_URL host: $(echo $DATABASE_URL | sed 's/.*@\([^:]*\).*/\1/')"

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

echo "=== Running database migrations ==="
echo "DIRECT_URL set: $([ -n "$DIRECT_URL" ] && echo 'yes' || echo 'NO - migrations may hang!')"
cd /app/platform/apps/api && timeout 60 npx prisma migrate deploy && echo "Migrations completed successfully" || echo "Migration failed, timed out, or no pending migrations"

echo "=== Starting app ==="
cd /app/platform/apps/api
exec node dist/main.js
