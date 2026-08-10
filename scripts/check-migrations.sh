#!/usr/bin/env bash
# Guard the migration filenames in supabase/migrations.
#
# Two files sharing an ordering key is the failure this exists for. Migrations
# here are applied by hand, in filename order, and nothing records which ones
# have run — so a duplicate number is not a merge conflict, it is two people
# quietly disagreeing about what "next" means. It has already happened three
# times: PR #260 and PR #262 were both renumbering chores, and PR #263 landed
# on a branch carrying two 0078_* files after a rebase, caught by accident.
#
# `0055a` / `0055b` / `0055c` are deliberate and must keep passing: when three
# migrations genuinely belong at the same point in the sequence, a letter
# suffix is how this repo says so. The ordering key is therefore the digits
# *plus* any suffix, and only an exact repeat is an error.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
DIR="$ROOT/supabase/migrations"
status=0

if [[ ! -d "$DIR" ]]; then
  echo "ERROR: $DIR not found." >&2
  exit 1
fi

names=$(ls "$DIR")

# 1 · shape. A name the pattern can't read has no ordering key at all, so the
# duplicate check below would silently skip it.
malformed=$(printf '%s\n' "$names" | grep -vE '^[0-9]{4}[a-z]?_[a-z0-9_]+\.sql$' || true)
if [[ -n "$malformed" ]]; then
  echo "Migration filenames must look like 0081_short_name.sql (optional letter suffix: 0055a_…):" >&2
  printf '  · %s\n' $malformed >&2
  status=1
fi

# 2 · uniqueness of the ordering key.
dupes=$(printf '%s\n' "$names" | sed -nE 's/^([0-9]{4}[a-z]?)_.*/\1/p' | sort | uniq -d || true)
if [[ -n "$dupes" ]]; then
  echo "Two or more migrations share an ordering key:" >&2
  for key in $dupes; do
    echo "  $key —" >&2
    printf '%s\n' "$names" | grep -E "^${key}_" | sed 's/^/    · /' >&2
  done
  echo >&2
  echo "Renumber the newer one to the next free number, or give them letter" >&2
  echo "suffixes (0055a/0055b) if they genuinely belong at the same point." >&2
  status=1
fi

if [[ $status -eq 0 ]]; then
  echo "✓ $(printf '%s\n' "$names" | wc -l | tr -d ' ') migrations, no duplicate ordering keys"
fi
exit $status
