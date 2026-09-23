#!/usr/bin/env bash
# Decide whether Vercel should build this commit. Wired up as `ignoreCommand`
# in vercel.json.
#
# Vercel's convention is inverted and worth stating plainly, because getting it
# backwards silently stops production deploying:
#
#   exit 0  -> SKIP the build
#   exit 1  -> RUN  the build
#
# Why this exists: every push ran five full builds of this app at once — the
# four GitHub Actions jobs (lint/typecheck/unit/build, E2E, and both Lighthouse
# runs) plus Vercel's own preview. All five prerender hundreds of pages against
# the ONE Supabase project, and on 2026-09-23 the pile-up starved it: every
# table answered `no response in 10000ms` and the Vercel build died on an
# AbortError prerendering an Arabic article's opengraph-image. The four CI jobs
# survived only because the app retries its reads.
#
# A preview build is also a second billed build per push, for a URL nobody
# opens on most commits.
#
# So previews become opt-in. Production is untouched: `main` still deploys on
# every merge, which is the whole point of the deploy.
#
# To get a preview when you actually want one, put [preview] anywhere in the
# commit message:
#
#   git commit -m "feat(home): new hero [preview]"
#
# or redeploy that commit by hand from the Vercel dashboard, which ignores this
# script entirely.

set -uo pipefail

# --- Fail open -------------------------------------------------------------
# Every unexpected state below falls through to "build". A skipped build that
# should have run is an unshipped change; this script is not worth a missed
# production deploy, so anything it does not positively recognise as a
# skippable preview gets built.

# Production always builds. VERCEL_ENV is set by Vercel itself, so an empty
# value means something changed about the runner — build, and let the deploy
# tell us.
if [ "${VERCEL_ENV:-}" != "preview" ]; then
  echo "VERCEL_ENV=${VERCEL_ENV:-<unset>} — not a preview, building."
  exit 1
fi

# An explicit opt-in in the commit message.
case "${VERCEL_GIT_COMMIT_MESSAGE:-}" in
  *"[preview]"*)
    echo "Commit message asks for a preview, building."
    exit 1
    ;;
esac

echo "Preview build skipped (no [preview] in the commit message)."
echo "Add [preview] to the commit message, or redeploy from the dashboard."
exit 0
