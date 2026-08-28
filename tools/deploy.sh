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
# so name the destination before anything is uploaded. With direnv set up, the
# project token decides this; without one, wrangler falls back to whatever you
# last logged into globally — which is exactly the case worth showing.
if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  who=$(curl -sS https://api.cloudflare.com/client/v4/accounts \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        | sed 's/.*"name":"\([^"]*\)".*/\1/' | head -1)
  echo "Cloudflare account: ${who:-unknown} (project token via direnv)"
else
  echo "Cloudflare account: from your global wrangler login — no project token set."
  echo "                    ./tools/cf-auth.sh pins this repo to one account."
  npx wrangler whoami 2>&1 | grep -E "associated with the email" || true
fi
echo
read -r -p "Deploy '$PROJECT' to this account? [y/N] " reply
[ "$reply" = "y" ] || [ "$reply" = "Y" ] || { echo "Nothing was uploaded."; exit 1; }

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

cp index.html features.html manifest.json sw.js "$STAGE/"
cp -R css js icons shots "$STAGE/"

# cp -R brings the dotfiles along: macOS .DS_Store droppings and shots/.captured,
# which is the screenshot fingerprint and no business of anyone's browser.
find "$STAGE" -name '.*' -print -delete | sed 's|^'"$STAGE"'/|  dropped |'

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
