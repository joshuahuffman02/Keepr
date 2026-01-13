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

# Quick check for pending migrations first (30s timeout)
echo "Checking for pending migrations..."
MIGRATE_STATUS=$(timeout 30 npx prisma migrate status 2>&1) || true
if echo "$MIGRATE_STATUS" | grep -q "Database schema is up to date"; then
    echo "No pending migrations - skipping migrate deploy"
    SKIP_MIGRATE=true
else
    echo "Migration status: $MIGRATE_STATUS"
    SKIP_MIGRATE=false
fi

# Run migrations with 10-minute timeout (large SEO migration needs time)
if [ "$SKIP_MIGRATE" = "true" ] || timeout 600 npx prisma migrate deploy; then
    echo "Migrations completed successfully"
else
    MIGRATE_EXIT=$?
    echo "Migrations exited with code $MIGRATE_EXIT"

    # Exit codes: 124 = timeout killed it, 143 = SIGTERM (128+15)
    if [ $MIGRATE_EXIT -eq 124 ] || [ $MIGRATE_EXIT -eq 143 ]; then
        echo "Migration was killed (timeout or SIGTERM). This may leave DB in inconsistent state."
        echo "Marking last migration as rolled-back so it can be re-applied..."

        if [ -n "$LAST_MIGRATION" ]; then
            # Mark the migration as rolled back so Prisma will try again
            if npx prisma migrate resolve --rolled-back "$LAST_MIGRATION" 2>&1; then
                echo "Marked $LAST_MIGRATION as rolled back. Retrying migration..."
                if timeout 600 npx prisma migrate deploy; then
                    echo "Migration retry succeeded!"
                else
                    echo "FATAL: Migration retry also failed. Cannot start app."
                    exit 1
                fi
            else
                echo "WARNING: Could not mark migration as rolled back (may not have been applied yet)"
            fi
        fi
    else
        # Non-timeout failure - check pending status
        echo "Checking migration status..."
        if timeout 30 npx prisma migrate status 2>&1 | grep -q "have not yet been applied"; then
            echo "FATAL: There are pending migrations that failed to apply. Cannot start app."
            echo "Schema mismatch will cause P2022 errors. Exiting."
            exit 1
        fi
        echo "No pending migrations - safe to start app"
    fi
fi

echo "=== Starting app ==="
cd /app/platform/apps/api
exec node dist/main.js
