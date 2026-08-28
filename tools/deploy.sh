#!/usr/bin/env bash
# tools/deploy.sh – publish the app to Cloudflare Pages.
#
#   ./tools/deploy.sh            # deploy to production
#   ./tools/deploy.sh --preview  # deploy to a preview URL first
#
# Only the files the browser needs are uploaded. tests/, tools/, the docs and
# the git history stay behind — there is no build step here, so without staging
# the whole working tree would be published verbatim.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT=${CF_PAGES_PROJECT:-calm-voice-power}
BRANCH=main
[ "${1:-}" = "--preview" ] && BRANCH=preview

# Deploying to the wrong Cloudflare account is not a mistake you notice quickly,
# so say whose account this is before anything is uploaded.
echo "Cloudflare account:"
npx wrangler whoami 2>&1 | grep -E "associated with the email|Account Name" || true
echo
read -r -p "Deploy '$PROJECT' to this account? [y/N] " reply
[ "$reply" = "y" ] || [ "$reply" = "Y" ] || { echo "Nothing was uploaded."; exit 1; }

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

cp index.html features.html manifest.json sw.js "$STAGE/"
cp -R css js icons shots "$STAGE/"

echo
echo "Staged $(find "$STAGE" -type f | wc -l | tr -d ' ') files ($(du -sh "$STAGE" | cut -f1))"
npx wrangler pages deploy "$STAGE" --project-name "$PROJECT" --branch "$BRANCH" --commit-dirty=true

cat <<'NOTE'

Done. Two things to check before pointing anyone at the new address:

  1. Open the new URL and confirm the app loads and the microphone works.
     Browsers only grant getUserMedia on https, which Pages provides.

  2. His data does NOT come with it. IndexedDB is scoped to the origin, so the
     new address starts empty. Save a backup from the Parent Dashboard on the
     OLD address first, then restore it on the new one.
NOTE
