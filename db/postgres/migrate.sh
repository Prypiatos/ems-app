#!/usr/bin/env bash
set -euo pipefail
 
MIGRATIONS_DIR="./db/postgres/migrations"
DB_URL="postgres://user:password@localhost:5432/ems_db?sslmode=disable"
 
echo "Running PostgreSQL migrations..."
migrate -path "$MIGRATIONS_DIR" -database "$DB_URL" up
 
echo "Migrations complete."