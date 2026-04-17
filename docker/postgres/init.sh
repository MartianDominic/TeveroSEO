#!/bin/sh
set -euo pipefail

# Require passwords to be provided via env — fail loudly if missing (DOCKER-03).
: "${OPEN_SEO_DB_PASSWORD:?OPEN_SEO_DB_PASSWORD env var is required for postgres initdb}"
: "${ALWRITY_DB_PASSWORD:?ALWRITY_DB_PASSWORD env var is required for postgres initdb}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  ALTER ROLE open_seo_user WITH PASSWORD '${OPEN_SEO_DB_PASSWORD}';
  ALTER ROLE alwrity_user  WITH PASSWORD '${ALWRITY_DB_PASSWORD}';
EOSQL

echo "[init.sh] Passwords set for open_seo_user and alwrity_user"
