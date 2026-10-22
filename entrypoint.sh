#!/bin/sh
set -e

# If DATABASE_URL is unset, empty, or contains unexpanded Kubernetes $(...) variable syntax
case "$DATABASE_URL" in
  *'$('*|"")
    if [ -n "$POSTGRES_USER" ] && [ -n "$POSTGRES_PASSWORD" ] && [ -n "$DATABASE_HOST" ]; then
      export DATABASE_URL=$(node -e '
        const user = encodeURIComponent(process.env.POSTGRES_USER || "");
        const pass = encodeURIComponent(process.env.POSTGRES_PASSWORD || "");
        const host = process.env.DATABASE_HOST || "db";
        const port = process.env.DATABASE_PORT || "5432";
        const db = process.env.POSTGRES_DB || "webbudget";
        process.stdout.write(`postgresql://${user}:${pass}@${host}:${port}/${db}`);
      ')
      echo "Resolved DATABASE_URL from environment variables."
    fi
    ;;
esac

# Run migrations
echo "Running database migrations..."
prisma migrate deploy

# Run seed data
echo "Running database seeding..."
prisma db seed

# Start the application
echo "Starting application..."
exec node server.js
