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

# Run migrations with 5-minute timeout (complex migrations can take time)
# If migrations fail, we MUST NOT start the app (schema mismatch causes P2022 errors)
cd /app/platform/apps/api
if timeout 300 npx prisma migrate deploy; then
    echo "Migrations completed successfully"
else
    MIGRATE_EXIT=$?
    if [ $MIGRATE_EXIT -eq 124 ]; then
        echo "ERROR: Migrations timed out after 5 minutes"
    else
        echo "Migrations exited with code $MIGRATE_EXIT (may be no pending migrations, which is OK)"
    fi

    # Check if there are pending migrations that didn't apply
    echo "Checking migration status..."
    if timeout 30 npx prisma migrate status 2>&1 | grep -q "have not yet been applied"; then
        echo "FATAL: There are pending migrations that failed to apply. Cannot start app."
        echo "Schema mismatch will cause P2022 errors. Exiting."
        exit 1
    fi
    echo "No pending migrations - safe to start app"
fi

echo "=== Starting app ==="
cd /app/platform/apps/api
exec node dist/main.js
