#!/usr/bin/env bash
# tools/screenshots.sh – regenerate shots/ from the real app.
#
#   ./tools/screenshots.sh
#
# Needs Playwright's chromium (npx playwright install chromium) and python3 for
# the static server. Everything captured is synthetic seeded data – see
# tools/screenshots.mjs.
set -euo pipefail
cd "$(dirname "$0")/.."

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
[ -z "$PW" ] && { echo "Playwright not found. npx playwright install chromium"; exit 1; }

mkdir -p shots
PORT=8139
python3 -m http.server $PORT >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1.5

echo "Capturing screenshots"
PLAYWRIGHT_MODULE="$PW" BASE_URL="http://localhost:$PORT" node tools/screenshots.mjs

# Captured at 2x, which is ~7MB for 22 screens. Downscale to 1.5x and flatten to
# a 192-colour palette: still crisp at the widths features.html uses, a third of
# the bytes, and the difference is invisible on flat pastel UI.
python3 - <<'PYEOF'
from PIL import Image
import pathlib
for p in sorted(pathlib.Path('shots').glob('*.png')):
    im = Image.open(p).convert('RGB')
    if im.width > 620:
        im = im.resize((620, round(im.height * 620 / im.width)), Image.LANCZOS)
    if im.height > 1700:
        im = im.crop((0, 0, im.width, 1700))
    im.quantize(colors=192, dither=Image.FLOYDSTEINBERG).save(p, optimize=True)
    print(f"  {p.name} {p.stat().st_size//1024}K")
PYEOF

du -sh shots
