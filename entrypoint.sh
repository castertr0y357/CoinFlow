#!/bin/sh
set -e

# Run migrations
echo "Running database migrations..."
npx prisma@6.19.3 migrate deploy

# Start the application
echo "Starting application..."
exec node server.js
