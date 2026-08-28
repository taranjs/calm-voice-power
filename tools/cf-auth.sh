#!/usr/bin/env bash
# tools/cf-auth.sh – store the Cloudflare API token this project deploys with.
#
#   ./tools/cf-auth.sh          # store or replace the token
#   ./tools/cf-auth.sh --show   # who does the stored token belong to?
#   ./tools/cf-auth.sh --forget # remove it from the keychain
#
# Create the token at: https://dash.cloudflare.com/profile/api-tokens
#   Create Token → Custom token
#   Permissions:  Account · Cloudflare Pages · Edit
#                 Account · Account Settings · Read
# Nothing broader is needed to publish this app, and a token that can only do
# one thing is the whole point of using one instead of a login session.
set -uo pipefail
cd "$(dirname "$0")/.."

SERVICE=calm-voice-power
API=https://api.cloudflare.com/client/v4

kc_get()  { security find-generic-password -s "$SERVICE" -a "$1" -w 2>/dev/null; }
kc_set()  { security add-generic-password -U -s "$SERVICE" -a "$1" -w "$2" -T /usr/bin/security; }
kc_del()  { security delete-generic-password -s "$SERVICE" -a "$1" >/dev/null 2>&1; }

case "${1:-}" in
  --forget)
    kc_del CLOUDFLARE_API_TOKEN; kc_del CLOUDFLARE_ACCOUNT_ID
    echo "Removed. This project falls back to your global wrangler login."
    exit 0 ;;
  --show)
    TOKEN="$(kc_get CLOUDFLARE_API_TOKEN)"
    [ -z "$TOKEN" ] && { echo "No token stored. Run $0 to add one."; exit 1; } ;;
  *)
    echo "Paste the Cloudflare API token (input is hidden):"
    read -r -s TOKEN
    echo
    [ -z "$TOKEN" ] && { echo "Nothing entered; nothing stored."; exit 1; } ;;
esac

# Verify before storing, so a mistyped token fails here rather than mid-deploy.
verify=$(curl -sS "$API/user/tokens/verify" -H "Authorization: Bearer $TOKEN")
if ! grep -q '"success":true' <<<"$verify"; then
  echo "Cloudflare rejected that token:"
  sed 's/^/  /' <<<"$verify" | head -5
  exit 1
fi

# The token can tell us its own account, so nobody has to go hunting for an id.
accounts=$(curl -sS "$API/accounts" -H "Authorization: Bearer $TOKEN")
names=$(sed 's/},{/}\n{/g' <<<"$accounts" | grep -o '"id":"[0-9a-f]\{32\}","name":"[^"]*"' || true)
count=$(grep -c . <<<"$names" 2>/dev/null || echo 0)

if [ "$count" -eq 0 ]; then
  echo "Token is valid, but it cannot see any account."
  echo "Add the 'Account Settings · Read' permission and try again."
  exit 1
fi

echo "This token belongs to:"
i=0
while IFS= read -r line; do
  i=$((i+1))
  id=$(sed 's/.*"id":"\([0-9a-f]*\)".*/\1/' <<<"$line")
  nm=$(sed 's/.*"name":"\([^"]*\)".*/\1/' <<<"$line")
  echo "  $i) $nm   ($id)"
  eval "ID_$i=$id"; eval "NM_$i=\$nm"
done <<<"$names"

if [ "$count" -eq 1 ]; then
  pick=1
else
  read -r -p "Which account should this project deploy to? [1-$count] " pick
fi
eval "ACCOUNT_ID=\$ID_$pick"; eval "ACCOUNT_NAME=\$NM_$pick"
[ -z "${ACCOUNT_ID:-}" ] && { echo "No such choice; nothing stored."; exit 1; }

[ "${1:-}" = "--show" ] && exit 0

kc_set CLOUDFLARE_API_TOKEN "$TOKEN"
kc_set CLOUDFLARE_ACCOUNT_ID "$ACCOUNT_ID"

echo
echo "Stored in the login keychain for '$ACCOUNT_NAME'."
echo "Now run:  direnv allow"
echo "Then any wrangler command in this directory uses that account — and only here."
