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
[ $bad -eq 0 ] && echo "  PASS syntax, imports and service-worker manifest" || FAILED=1

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
