// tools/screenshots.mjs – real screenshots of every feature, for features.html.
//
// Run via tools/screenshots.sh. Drives the actual app in Chromium rather than
// mocking anything, so the tour can never show a screen the app doesn't have.
//
// Everything it captures is SYNTHETIC. The seed below is invented progress —
// no real child's data, no real recordings, and the avatar keeps its default
// name. These images go on a public page, so that matters more than realism.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const OUT  = path.join(ROOT, 'shots');
const BASE = process.env.BASE_URL || 'http://localhost:8139';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);

// A tablet-ish portrait frame: wide enough that nothing wraps awkwardly, tall
// enough that most screens fit without a scroll seam.
const VIEW = { width: 414, height: 860 };

// Viewport-sized, not fullPage: the nav bar is position:fixed, so a fullPage
// capture pins it halfway down the image and cuts the content in half. A single
// phone screen is also what a reader actually recognises.
// [route, file, waitFor, scrollY, prep] – scrollY pulls a screen's real point
// into frame when it sits below the fold; prep drives past a setup form so the
// tour shows the feature working rather than a name field.
const SHOTS = [
  ['home',          'home',          'text=What do you want to do?', 0],
  ['practice',      'practice',      'text=Practice Tools', 0],
  ['games',         'games',         'text=Mini Games', 0],
  ['voice-setup',   'voice-setup',   null, 0],
  ['game-gentle',   'gentle-start',  null, 0],
  ['game-stretchy', 'stretchy',      null, 0],
  ['game-pause',    'pause-power',   null, 0],
  ['buddy',         'buddy',         null, 0, 'buddy'],
  ['block-reset',   'word-stretch',  null, 0],
  ['breathing',     'calm-breath',   null, 0],
  ['pacing',        'pacing-dots',   null, 0],
  ['my-words',      'my-words',      null, 0],
  ['talk',          'talk-together', null, 0, 'talk'],
  ['challenges',    'challenges',    'text=Challenges', 0],
  ['journal',       'voice-journal', 'text=Voice Journal', 0],
  ['powers',        'voice-powers',  'text=My Voice Powers', 0],
  ['recorder',      'record-me',     null, 0],
  ['streak',        'confidence-road', 'text=Confidence Road', 0],
  ['emotion-check', 'emotion-check', null, 0],
  ['rewards',       'rewards',       null, 0],
  ['avatar',        'avatar',        null, 0],
  ['parent',        'parent-dashboard', 'text=Parent Dashboard', 0],
  // The dashboard's one clinical panel is well below the fold, and it is the
  // screen a therapist will want to see.
  ['parent',        'parent-onset',  'text=Gentle Starts', 640],
];


const browser = await chromium.launch({ args: [
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  '--autoplay-policy=no-user-gesture-required',
  '--force-prefers-reduced-motion',   // freeze animations so shots are stable
]});
const ctx  = await browser.newContext({
  permissions: ['microphone'],
  viewport: VIEW,
  deviceScaleFactor: 2,
  reducedMotion: 'reduce',
});
const page = await ctx.newPage();
page.on('pageerror', e => console.log('  pageerror:', e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#nav-bar');

// ── Seed invented progress ────────────────────────
const seeded = await page.evaluate(async () => {
  const db = await import('./js/modules/db.js');

  const dayKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

  // Twelve days of practice with one gap, so the streak and its rest credits
  // both have something to show.
  const days = [0,1,2,3,4,6,7,8,9,10,11,12].map(n => dayKey(daysAgo(n))).sort();

  await db.setSetting('coins', 245);
  await db.setSetting('practiceDays', days);
  await db.setSetting('bestStreak', 9);
  await db.setSetting('avatar', { body: '🦊', name: 'Brave Voice' });
  await db.setSetting('unlockedAvatars', ['🐱','🦊','🐼','🦄','🐯']);
  await db.setSetting('totalMinutes', 96);
  await db.setSetting('bests', { holdMs: 4200, pauseMs: 3100, pacedWords: 9 });
  await db.setSetting('repsToday', { date: null, counts: {} });

  // Onsets drifting from a hard attack towards an eased one, which is what the
  // dashboard's one clinical panel is for.
  await db.setSetting('voiceProfile', {
    quiet: 0.019, normal: 0.072, loud: 0.21,
    onsetSamples: [38,44,41,52,49,58,55,63,61,70,66,74,79,72,85,81,90,88,95,92],
    updatedAt: Date.now(),
  });

  for (let i = 11; i >= 0; i--) {
    const before = 2 + (i % 3);
    await db.dbPut('sessions', {
      date: daysAgo(i).toISOString(),
      type: i % 4 === 0 ? 'session' : 'activity',
      emotionBefore: before,
      emotionAfter: Math.min(5, before + 1 + (i % 2)),
    });
  }

  for (const w of ['apple','octopus','elephant','school','Grandad','umbrella']) {
    await db.dbPut('words', { id: w.toLowerCase(), word: w, custom: true });
  }

  // A silent one-second WAV per recording: enough for the journal to render a
  // player and a Then-vs-Now pair, and it is not anybody's voice.
  const wav = () => {
    const n = 8000, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0,'RIFF'); v.setUint32(4, 36 + n*2, true); str(8,'WAVEfmt ');
    v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
    v.setUint32(24,8000,true); v.setUint32(28,16000,true);
    v.setUint16(32,2,true); v.setUint16(34,16,true);
    str(36,'data'); v.setUint32(40, n*2, true);
    return new Blob([buf], { type: 'audio/wav' });
  };
  const prompts = [['name','My name is…'], ['count','Count to five'], ['today','Today I…']];
  for (const [id, text] of prompts) {
    for (const ago of [26, 2]) {
      await db.dbPut('recordings', {
        promptId: id, promptText: text, date: daysAgo(ago).toISOString(),
        durationMs: 1000, blob: wav(),
      });
    }
  }
  return days.length;
});
console.log(`  seeded ${seeded} practice days of invented progress`);

// Reload so the app boots from the seeded database rather than being patched.
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('#nav-bar');
await page.evaluate(() => import('./js/modules/router.js').then(m => (window.__nav = m.navigate)));

// ── Capture ───────────────────────────────────────
let n = 0;
for (const [routeName, file, waitFor, scrollY, prep] of SHOTS) {
  await page.evaluate(r => window.__nav(r), routeName);
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 5000 }).catch(() => {});

  // My Buddy and Talk Together both open on a setup form. Shots of those teach
  // a reader nothing, so click through to the part that is the actual feature.
  if (prep === 'buddy') {
    await page.fill('#buddy-name', 'Dino');
    await page.click('#meet-btn');
    // One more click reaches the moment the buddy actually blocks and the ways
    // to help appear – which is the entire point of the feature.
    await page.click('#next-btn');
    await page.waitForSelector('#strategy-list button', { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  if (prep === 'talk') {
    await page.click('#partner-chips button');
    await page.click('#begin-btn');
    await page.waitForSelector('#turn-btn', { timeout: 5000 }).catch(() => {});
  }
  await page.waitForSelector('.page', { timeout: 5000 }).catch(() => {});
  // These screens fade in; let one paint settle before capturing.
  await page.waitForTimeout(650);
  if (scrollY) {
    await page.evaluate(y => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(250);
  }
  await page.screenshot({ path: path.join(OUT, `${file}.png`) });
  console.log(`  ${String(++n).padStart(2)}. ${file}.png  (${routeName}${scrollY ? ` @${scrollY}px` : ''})`);
}

await browser.close();
console.log(`\n${n} screenshots written to shots/`);
