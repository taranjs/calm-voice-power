#!/usr/bin/env bash
# tools/stage.sh – assemble the publishable site into _site/.
#
# There is no build step in this project, so without staging the whole working
# tree would be published: tests, tooling, the docs and the project notes. This
# copies only what a browser needs.
#
# Used by tools/deploy.sh, and by Cloudflare Pages as its build command:
#     Build command:            bash tools/stage.sh
#     Build output directory:   _site
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=${1:-_site}
rm -rf "$OUT"
mkdir -p "$OUT"

cp index.html features.html manifest.json sw.js "$OUT/"
cp -R css js icons shots "$OUT/"

# cp -R brings the dotfiles along: macOS .DS_Store droppings and shots/.captured,
# which is the screenshot fingerprint and no business of anyone's browser.
find "$OUT" -name '.*' -delete

# A file in the service worker's precache list that is not in the upload makes
# cache.addAll() reject, so the worker never installs and the app breaks on first
# load — in a way that looks nothing like a missing file. Cheaper to catch here.
missing=0
while read -r f; do
  [ -z "$f" ] && continue
  [ -e "$OUT/$f" ] || { echo "  MISSING from build: $f" >&2; missing=1; }
done < <(grep -oE "'\./[^']+'" sw.js | tr -d "'" | sed 's|^\./||' | grep -v '^$')
[ "$missing" -eq 0 ] || { echo "sw.js precaches files that are not being published." >&2; exit 1; }

echo "Staged $(find "$OUT" -type f | wc -l | tr -d ' ') files into $OUT/ ($(du -sh "$OUT" | cut -f1))"
