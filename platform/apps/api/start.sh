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

cd /app/platform/apps/api

# Get the latest migration name for potential rollback
LAST_MIGRATION=$(ls -1 prisma/migrations/ 2>/dev/null | grep -E '^[0-9]+' | sort | tail -1)
echo "Latest migration: ${LAST_MIGRATION:-none}"

# Quick check for pending migrations first (15s timeout - shorter to fail fast)
echo "Checking for pending migrations..."
MIGRATE_STATUS=$(timeout 15 npx prisma migrate status 2>&1)
MIGRATE_CHECK_EXIT=$?

if [ $MIGRATE_CHECK_EXIT -eq 124 ]; then
    # Timeout - database connection is slow, skip migrations and trust they're up to date
    echo "WARNING: Migration status check timed out (database slow). Skipping migrations."
    echo "Assuming migrations are up to date based on previous successful deployments."
    SKIP_MIGRATE=true
elif echo "$MIGRATE_STATUS" | grep -q "Database schema is up to date"; then
    echo "No pending migrations - skipping migrate deploy"
    SKIP_MIGRATE=true
elif echo "$MIGRATE_STATUS" | grep -q "have not yet been applied"; then
    echo "Pending migrations detected - will run migrate deploy"
    echo "Migration status: $MIGRATE_STATUS"
    SKIP_MIGRATE=false
else
    # Unknown status or connection error - try to start anyway
    echo "WARNING: Could not determine migration status. Attempting to start app anyway."
    echo "Migration status output: $MIGRATE_STATUS"
    SKIP_MIGRATE=true
fi

# Only run migrations if we detected pending ones
if [ "$SKIP_MIGRATE" = "false" ]; then
    echo "Running migrations with 10-minute timeout..."
    if timeout 600 npx prisma migrate deploy; then
        echo "Migrations completed successfully"
    else
        MIGRATE_EXIT=$?
        echo "Migration failed with exit code $MIGRATE_EXIT"

        # If migration timed out or was killed, try to start anyway
        if [ $MIGRATE_EXIT -eq 124 ] || [ $MIGRATE_EXIT -eq 143 ]; then
            echo "WARNING: Migration timed out. Starting app anyway - may have P2022 errors."
        else
            echo "WARNING: Migration failed. Starting app anyway - may have errors."
        fi
    fi
else
    echo "Skipping migrate deploy"
fi

echo "=== Starting app ==="
cd /app/platform/apps/api
exec node dist/main.js
