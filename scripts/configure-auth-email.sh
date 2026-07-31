#!/usr/bin/env bash
#
# Configure Supabase Auth's own email delivery via the Management API.
#
# Supabase Auth does NOT use lib/email.ts. Sign-up confirmations and magic
# links are sent by Supabase's own mailer, which by default only delivers to
# members of the Supabase org and is capped at a couple of messages an hour.
# This points that mailer at Resend and fixes the redirect settings that decide
# where the links in those emails actually go.
#
# Reads SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN and RESEND_API_KEY from
# .env.local. Secrets are never echoed.
#
# Usage:
#   scripts/configure-auth-email.sh show        # read current config back
#   scripts/configure-auth-email.sh smtp        # site_url + Resend SMTP + rate limit
#   scripts/configure-auth-email.sh allow-list  # redirect allow-list
#
# ORDER MATTERS. Run `allow-list` only once a build containing the
# safeRelativePath() guard in app/auth/callback/route.ts is live. Allow-listing
# the callback before that guard ships lets an attacker who can trigger an auth
# email choose where the recipient lands after signing in.

set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=".env.local"
if [[ ! -f "$ENV_FILE" ]]; then
  # .env.local is gitignored, so a git worktree has none of its own. Fall back
  # to the main checkout, which is the parent of the shared .git directory.
  MAIN_CHECKOUT="$(dirname "$(git rev-parse --git-common-dir)")"
  if [[ -f "$MAIN_CHECKOUT/.env.local" ]]; then
    ENV_FILE="$MAIN_CHECKOUT/.env.local"
    echo "note: using $ENV_FILE"
  else
    echo "error: no .env.local in $(pwd) or $MAIN_CHECKOUT" >&2
    exit 1
  fi
fi

set -a
# shellcheck disable=SC1091
. "$ENV_FILE"
set +a

: "${SUPABASE_PROJECT_REF:?not set in .env.local}"
: "${SUPABASE_ACCESS_TOKEN:?not set in .env.local}"

API="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/config/auth"

# The address Supabase Auth sends from. Must be on a domain verified in the
# Resend account whose key is used as the SMTP password, or every auth email
# is silently refused.
SENDER_EMAIL="${AUTH_SMTP_SENDER:-hello@bazarrealestate.com}"
SENDER_NAME="Bazar Real Estate"
SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://bazar-real-estate-cms.vercel.app}"

# GoTrue matches the whole redirect_to string with glob semantics, where `*`
# does not cross `.` or `/`. Both call sites append a query string, so every
# entry has to end in `/**` or it silently fails to match and Supabase falls
# back to site_url with no error anywhere.
ALLOW_LIST="${SITE_URL}/**,https://bazar-real-estate-cms-*-ayushkbhatia-7383s-projects.vercel.app/**,http://localhost:3000/**"

show() {
  curl -sS "$API" -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    | python3 -c '
import json, sys
d = json.load(sys.stdin)
if "message" in d:
    print("error:", d["message"]); raise SystemExit(1)
for k in ["site_url", "uri_allow_list", "smtp_host", "smtp_port", "smtp_user",
          "smtp_admin_email", "smtp_sender_name", "rate_limit_email_sent",
          "mailer_autoconfirm"]:
    print(f"{k:24} = {d.get(k)!r}")
print("smtp_pass".ljust(24), "=", "<set>" if d.get("smtp_pass") else None)
'
}

patch() {
  curl -sS -X PATCH "$API" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$1" \
    | python3 -c '
import json, sys
d = json.load(sys.stdin)
if "message" in d:
    print("error:", d["message"]); raise SystemExit(1)
print("applied.")
'
}

case "${1:-show}" in
  show)
    show
    ;;

  smtp)
    : "${RESEND_API_KEY:?not set in .env.local}"
    echo "Pointing Supabase Auth at Resend SMTP, sending as ${SENDER_EMAIL}"
    body=$(
      SENDER_EMAIL="$SENDER_EMAIL" SENDER_NAME="$SENDER_NAME" \
      SITE_URL="$SITE_URL" RESEND_API_KEY="$RESEND_API_KEY" \
      python3 -c '
import json, os
print(json.dumps({
    "site_url": os.environ["SITE_URL"],
    "smtp_host": "smtp.resend.com",
    "smtp_port": "465",
    "smtp_user": "resend",
    "smtp_pass": os.environ["RESEND_API_KEY"],
    "smtp_admin_email": os.environ["SENDER_EMAIL"],
    "smtp_sender_name": os.environ["SENDER_NAME"],
    # Shared hourly counter across sign-up confirmations and magic links.
    # Supabase pins this to 2 while the built-in mailer is in use, and does
    # not raise it for you when you switch to custom SMTP.
    "rate_limit_email_sent": 60,
}))'
    )
    patch "$body"
    echo
    show
    ;;

  allow-list)
    echo "Allow-listing: ${ALLOW_LIST}"
    echo "Confirm the safeRelativePath() guard in app/auth/callback/route.ts is deployed first."
    body=$(ALLOW_LIST="$ALLOW_LIST" SITE_URL="$SITE_URL" python3 -c '
import json, os
print(json.dumps({
    "site_url": os.environ["SITE_URL"],
    "uri_allow_list": os.environ["ALLOW_LIST"],
}))')
    patch "$body"
    echo
    show
    ;;

  *)
    echo "usage: $0 {show|smtp|allow-list}" >&2
    exit 2
    ;;
esac
