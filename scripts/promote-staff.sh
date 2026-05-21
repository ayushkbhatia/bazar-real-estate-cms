#!/usr/bin/env bash
# Promote an existing auth.users user to a staff member.
# Usage: bash scripts/promote-staff.sh <email> <admin|editor|agent|marketing|support> [display_name]
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <email> <admin|editor|agent|marketing|support> [display_name]" >&2
  exit 1
fi

EMAIL="$1"
ROLE="$2"
DISPLAY_NAME="${3:-$EMAIL}"

ROOT=$(cd "$(dirname "$0")/.." && pwd)
ENV_FILE="$ROOT/.env.local"

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN missing from .env.local}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF missing from .env.local}"

SLUG=$(echo "$DISPLAY_NAME" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9' '-' | sed 's/^-*//; s/-*$//')

read -r -d '' SQL <<SQL || true
with u as (
  select id from auth.users where lower(email) = lower('$EMAIL') limit 1
)
insert into public.staff (user_id, display_name, slug, role, status, joined_at)
select id, '$DISPLAY_NAME', '$SLUG', '$ROLE'::public.staff_role, 'active', current_date
from u
on conflict (user_id) do update
  set role = excluded.role, status = 'active', display_name = excluded.display_name
returning user_id, display_name, role, status;
SQL

BODY=$(jq -nc --arg q "$SQL" '{query: $q}')
RESPONSE=$(curl -fsSL -X POST \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/query")

echo "$RESPONSE"
