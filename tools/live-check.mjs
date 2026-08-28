// tools/live-check.mjs – drive a *deployed* site in a real browser.
//
//   node tools/live-check.mjs https://calm-voice-power.pages.dev
//
// The test suite runs against a local static server, which is not the thing
// anyone uses. Hosts differ in ways that only show up once deployed: Cloudflare
// Pages answers /features.html with a 308 to /features, and a service worker
// that precached the redirect then fails every navigation to it with a bare
// ERR_FAILED. Local tests cannot see that. This can.
const BASE = (process.argv[2] || process.env.CHECK_URL || '').replace(/\/$/, '');
if (!BASE) { console.error('usage: node tools/live-check.mjs <url>'); process.exit(2); }
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

let ok = true;
const t = (n, c, d = '') => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok = c && ok; };

const browser = await chromium.launch({ args: [
  '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
  '--autoplay-policy=no-user-gesture-required' ]});
const ctx  = await browser.newContext({ permissions: ['microphone'], viewport: { width: 414, height: 860 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

console.log(`\nChecking ${BASE}`);
await page.goto(BASE, { waitUntil: 'networkidle' });
t('the app boots', await page.locator('#nav-bar').isVisible());

const sw = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return { registered: false };
  await navigator.serviceWorker.ready.catch(() => {});
  return { registered: true, active: !!reg.active };
});
t('the service worker installs and activates', sw.registered && sw.active, JSON.stringify(sw));

const cached = await page.evaluate(async () => {
  const keys = await caches.keys();
  if (!keys.length) return { keys, n: 0 };
  const reqs = await (await caches.open(keys[0])).keys();
  return { keys, n: reqs.length };
});
t('the precache filled', cached.n > 40, `${cached.n} entries in ${cached.keys.join(',')}`);

// The navigation that a redirect + service worker combination breaks.
let tourErr = '';
await page.goto(`${BASE}/features.html`, { waitUntil: 'load' }).catch(e => { tourErr = e.message.split('\n')[0]; });
t('the guided tour opens with the worker in charge', !tourErr, tourErr || page.url());
if (!tourErr) {
  t('the tour is the right page', /guided tour/i.test(await page.title()), await page.title());
  t('its screenshots load', await page.evaluate(() => {
    const i = document.querySelector('.tile-open img');
    return !!i && i.complete && i.naturalWidth > 0;
  }));
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => import('./js/modules/router.js').then(m => (window.__nav = m.navigate)));
await page.evaluate(() => window.__nav('parent'));
await page.waitForSelector('#backup-btn', { timeout: 8000 }).catch(() => {});
t('the parent dashboard offers backup and restore',
  await page.locator('#restore-btn').isVisible().catch(() => false));

// Offline is the entire reason for the precache.
await ctx.setOffline(true);
await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
t('it still works with no network', await page.locator('#nav-bar').isVisible().catch(() => false));
await ctx.setOffline(false);

t('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));
await browser.close();
console.log(ok ? '\nLIVE CHECK PASS' : '\nLIVE CHECK FAIL');
process.exit(ok ? 0 : 1);
