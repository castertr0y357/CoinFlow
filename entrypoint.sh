#!/bin/sh
set -e

# Run migrations
echo "Running database migrations..."
prisma migrate deploy

# Run seed data
echo "Running database seeding..."
prisma db seed

# Start the application
echo "Starting application..."
exec node server.js
