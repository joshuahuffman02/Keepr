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
    echo "=== Pushing schema to database ==="
    if npx prisma db push --accept-data-loss; then
        echo "Schema push successful"
    else
        echo "WARNING: Schema push failed, but continuing..."
    fi
else
    echo "WARNING: Database not reachable after $MAX_RETRIES attempts, skipping schema push"
    echo "The app will attempt to connect when handling requests"
fi

echo "=== Generating Prisma client ==="
npx prisma generate

echo "=== Starting app ==="
exec node -r tsconfig-paths/register dist/main.js
