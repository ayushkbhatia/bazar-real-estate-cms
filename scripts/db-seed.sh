#!/usr/bin/env bash
# Apply supabase/seed.sql to the Supabase project.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
ENV_FILE="$ROOT/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN missing from .env.local}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF missing from .env.local}"

BODY=$(jq -Rs '{query: .}' < "$ROOT/supabase/seed.sql")
RESPONSE=$(curl -fsSL -X POST \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query")

echo "$RESPONSE"
echo "✓ Seed applied"
