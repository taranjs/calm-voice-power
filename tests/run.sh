#!/usr/bin/env bash
# tests/run.sh – the whole suite.
#
#   ./tests/run.sh          # unit + browser
#   ./tests/run.sh unit     # pure logic only, no browser needed
#
# Browser tests need Playwright's chromium. If it isn't installed:
#   npx playwright install chromium
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD
MODE=${1:-all}
FAILED=0

# ── Syntax and wiring checks ────────────────────
echo "Checking syntax and imports"
TMP=tests/.tmp
rm -rf "$TMP" && mkdir -p "$TMP"
bad=0
for f in $(find js -name '*.js'); do
  mkdir -p "$TMP/check/$(dirname "$f")"
  cp "$f" "$TMP/check/${f%.js}.mjs"
done
for f in $(find "$TMP/check" -name '*.mjs'); do
  node --check "$f" >/dev/null 2>&1 || { echo "  FAIL syntax: ${f#$TMP/check/}"; bad=1; }
done
node --check sw.js >/dev/null 2>&1 || { echo "  FAIL syntax: sw.js"; bad=1; }

for f in $(find js -name '*.js'); do
  d=$(dirname "$f")
  grep -oE "from '[^']+'" "$f" | sed "s/from '//;s/'//" | while read -r p; do
    case "$p" in ./*|../*) [ -f "$d/$p" ] || echo "  FAIL missing import: $f -> $p";; esac
  done
done
for f in $(find js css icons -type f \( -name '*.js' -o -name '*.css' -o -name '*.png' \) | sort); do
  grep -q "'\./$f'" sw.js || { echo "  FAIL not cached by sw.js: $f"; bad=1; }
done
# Every screenshot the guided tour points at must exist. Renaming one in
# tools/screenshots.mjs and forgetting the page is the easy mistake here.
grep -oE 'src="shots/[^"]+"' features.html | sed 's/src="//;s/"//' | sort -u | while read -r img; do
  [ -f "$img" ] || { echo "  FAIL features.html references missing $img"; exit 1; }
done || bad=1

[ $bad -eq 0 ] && echo "  PASS syntax, imports, sw manifest and tour screenshots" || FAILED=1

# ── Are the guided tour's screenshots still current? ─────
# A warning rather than a failure: plenty of changes to js/ move no pixels at
# all, and a check that cried wolf would get ignored. Naming the changed files
# lets you judge in a second whether any of it was visual.
if [ -f shots/.captured ]; then
  drift=$(diff <(cat shots/.captured) \
               <(find js css -type f \( -name '*.js' -o -name '*.css' \) | sort | xargs shasum -a 256) \
          | grep -E '^[<>]' | awk '{print $NF}' | sort -u)
  if [ -n "$drift" ]; then
    echo
    echo "NOTE  the tour screenshots were taken before these files changed:"
    echo "$drift" | sed 's/^/        /'
    echo "      If any of that was visual, refresh them:  ./tools/screenshots.sh"
  else
    echo "  PASS tour screenshots match the current app"
  fi
else
  echo "  NOTE no shots/.captured — run ./tools/screenshots.sh to enable staleness checks"
fi

# ── Unit tests ──────────────────────────────────
# state.js reaches for IndexedDB, which node has no opinion about; stub only the
# import so the algorithms under test are the real ones, character for character.
sed "s|import { getSetting, setSetting, dbPut, dbGetAll } from './db.js';|const getSetting=async(k,f)=>f, setSetting=async()=>{}, dbPut=async()=>{}, dbGetAll=async()=>[];|" \
  js/modules/state.js > "$TMP/state.mjs"
cp js/modules/voice.js "$TMP/voice.mjs"
cp js/modules/content.js "$TMP/content.js"
cp js/modules/content.js "$TMP/content.mjs"
# voice.js pulls in the AudioContext, which node has no use for. The functions
# under test here never touch it.
printf 'export function getAudioContext(){ return null; }\n' > "$TMP/audio.js"
node tests/unit.mjs || FAILED=1
[ "$MODE" = "unit" ] && { rm -rf "$TMP"; exit $FAILED; }

# ── Browser tests ───────────────────────────────
PW=$(node -e '
const fs=require("fs"),path=require("path"),os=require("os");
const roots=[process.cwd(),os.homedir()+"/.npm/_npx"];
const hits=[];
for (const r of roots) {
  if (r.endsWith("_npx")) { try { for (const d of fs.readdirSync(r)) hits.push(path.join(r,d,"node_modules/playwright/index.mjs")); } catch(e){} }
  else hits.push(path.join(r,"node_modules/playwright/index.mjs"));
}
try { hits.unshift(require.resolve("playwright").replace(/index\.js$/,"index.mjs")); } catch(e){}
console.log(hits.find(p => { try { return fs.existsSync(p); } catch(e){ return false; } }) || "");
' 2>/dev/null)

if [ -z "$PW" ]; then
  echo
  echo "SKIP browser tests — Playwright not found."
  echo "     Install with: npx playwright install chromium"
  rm -rf "$TMP"; exit $FAILED
fi

python3 tests/make-fixtures.py >/dev/null
PORT=8137
python3 -m http.server $PORT >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1.5

PLAYWRIGHT_MODULE="$PW" BASE_URL="http://localhost:$PORT" node tests/browser.mjs || FAILED=1

rm -rf "$TMP"
echo
[ $FAILED -eq 0 ] && echo "ALL SUITES PASS" || echo "SOME SUITES FAILED"
exit $FAILED
