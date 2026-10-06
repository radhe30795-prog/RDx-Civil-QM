#!/bin/sh
# Container entrypoint: run DB migrations, then start the server.
set -e

if [ -n "$DATABASE_URL" ]; then
  node /app/dist/migrate.js || echo "[entrypoint] WARNING: migrations failed, starting server anyway"
else
  echo "[entrypoint] DATABASE_URL not set - skipping migrations"
fi

exec node /app/dist/index.js
