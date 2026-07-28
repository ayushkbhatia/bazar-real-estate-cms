#!/usr/bin/env bash
# Regenerate db/types.ts from the live Supabase schema.
# Requires SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF (read from .env.local).
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
ENV_FILE="$ROOT/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Copy .env.example and fill in values." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN missing from .env.local}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF missing from .env.local}"

# Write to a temp file first. Redirecting straight into db/types.ts truncates it
# the instant the shell sets up the redirect — so a failed curl (expired
# SUPABASE_ACCESS_TOKEN, network blip) would leave an empty types.ts behind.
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

curl -fsSL \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/types/typescript?included_schemas=public" \
  | jq -r .types > "$TMP"

if [[ ! -s "$TMP" ]]; then
  echo "ERROR: type generation returned nothing; db/types.ts left unchanged." >&2
  exit 1
fi

mv "$TMP" "$ROOT/db/types.ts"
trap - EXIT

echo "✓ Wrote $(wc -l < "$ROOT/db/types.ts") lines to db/types.ts"
