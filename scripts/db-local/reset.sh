#!/usr/bin/env bash
# Rebuild the LOCAL Supabase database from supabase/migrations, then seed the
# mortgage module (docs/mortgage/IMPLEMENTATION.md §1.14). Never touches the
# production project: everything here talks to the Docker stack this script
# starts.
#
#   npm run db:local:reset
#
# Why a separate CLI workdir (scripts/db-local/supabase/config.toml, with the
# CLI's own migration runner switched off): the CLI only runs files named
# <digits>_name.sql, so it would silently skip 0055a_…, 0056a_… and the other
# lettered files. This script applies every file in filename order, the way
# production received them.
#
# The history before 0138 does not replay cleanly into an empty database.
# Production was partly shaped by hand (0009 and 0028 both create
# property_embeddings; 0056a–d are catch-ups for drift), so those files are
# applied tolerantly and their errors are listed. From 0138 on — the mortgage
# module — a single error fails the reset.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORKDIR="$ROOT/scripts/db-local"
CONTAINER="supabase_db_bazar-local"
STRICT_FROM="0138"
EXCLUDE="realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"

psql_file() {
  docker exec -i "$CONTAINER" psql -U postgres -d postgres -q "$@"
}

echo "· starting the local stack (first run pulls images)"
supabase start --workdir "$WORKDIR" -x "$EXCLUDE" >/dev/null || {
  echo "supabase start failed — is Docker running?" >&2
  exit 1
}

echo "· resetting to an empty database"
supabase db reset --workdir "$WORKDIR" --no-seed >/dev/null 2>&1 || {
  echo "supabase db reset failed" >&2
  exit 1
}

# Production predates Supabase's change to default privileges: there, a table
# created in `public` is granted to anon, authenticated and service_role and
# RLS decides the rest (CLAUDE.md: "every other table uses table-wide grants
# plus RLS"). The local image's defaults grant API roles almost nothing, so
# restore production's before replaying the history, or the local database
# would refuse queries production allows.
echo "· setting production's default privileges"
psql_file -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
SQL

echo "· applying supabase/migrations"
tolerated=0
while IFS= read -r file; do
  name="$(basename "$file")"
  if [[ "$name" < "$STRICT_FROM" ]]; then
    errors="$(psql_file -v ON_ERROR_STOP=0 -f - <"$file" 2>&1 | grep -E '^psql:.*ERROR:' || true)"
    if [[ -n "$errors" ]]; then
      tolerated=$((tolerated + 1))
      echo "  tolerated  $name"
      echo "$errors" | sed 's/^/             /' | head -5
    fi
  else
    if ! out="$(psql_file -v ON_ERROR_STOP=1 -f - <"$file" 2>&1)"; then
      echo "  FAILED     $name" >&2
      echo "$out" | tail -10 >&2
      exit 1
    fi
    echo "  applied    $name"
  fi
done < <(ls "$ROOT"/supabase/migrations/*.sql | LC_ALL=C sort)
echo "  $tolerated pre-$STRICT_FROM file(s) had errors from the hand-shaped history (listed above)"

if [[ "${SKIP_SEED:-}" == "1" ]]; then
  echo "· seed skipped (SKIP_SEED=1)"
  exit 0
fi

echo "· seeding the mortgage module"
if ! out="$(cd "$ROOT" && npx --no-install tsx scripts/db-local/seed-mortgage.ts | psql_file -v ON_ERROR_STOP=1 -f - 2>&1)"; then
  echo "$out" | tail -10 >&2
  exit 1
fi

echo "· done — API http://127.0.0.1:55321, database postgresql://postgres:postgres@127.0.0.1:55322/postgres"
