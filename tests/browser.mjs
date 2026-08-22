// tests/browser.mjs – drives the real app in Chromium with a fake microphone.
//
// Chrome's --use-file-for-fake-audio-capture feeds a WAV in as mic input, so the
// voice detection runs for real rather than being mocked. Run via tests/run.sh,
// which locates Playwright and serves the app.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, 'fixtures');
const BASE = process.env.BASE_URL || 'http://localhost:8137';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);

let ok = true;
const t = (name, cond, detail = '') => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  ok = cond && ok;
};

async function open(wav = 'gentle.wav') {
  const browser = await chromium.launch({ args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${path.join(FIXTURES, wav)}`,
    '--autoplay-policy=no-user-gesture-required',
  ]});
  const ctx = await browser.newContext({ permissions: ['microphone'], viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#nav-bar');
  await page.evaluate(() => import('./js/modules/router.js').then(m => (window.__nav = m.navigate)));
  return { browser, page, errors };
}

// ── Every screen renders, and the mic is handed back on the way out ──
{
  console.log('\nRoutes and microphone handling');
  const { browser, page, errors } = await open();
  const routes = [
    ['home', 'text=What do you want to do?'], ['practice', 'text=Practice Tools'],
    ['games', 'text=Mini Games'], ['streak', 'text=Confidence Road'],
    ['journal', 'text=Voice Journal'], ['powers', 'text=My Voice Powers'],
    ['my-words', 'text=My Words'], ['voice-setup', 'text=Teach me your voice'],
    ['talk', 'text=Talk Together'], ['buddy', 'text=My Buddy'],
    ['rewards', 'text=Rewards Shop'], ['parent', 'text=Parent Dashboard'],
    ['breathing', 'text=Calm Breath'], ['pacing', 'text=Pacing Dots'],
    ['recorder', 'text=Record Me!'], ['block-reset', 'text=Word Stretch'],
    ['challenges', "text=Today's Challenges"], ['game-gentle', 'text=Gentle Start'],
    ['game-stretchy', 'text=Stretchy Speech'], ['game-pause', 'text=Pause Power'],
    ['avatar', 'text=My Avatar'],
  ];
  let allRendered = true;
  for (const [r, sel] of routes) {
    await page.evaluate(x => window.__nav(x), r);
    await page.waitForTimeout(280);
    const seen = await page.locator(sel).first().isVisible().catch(() => false);
    if (!seen) { console.log(`    missing: ${r} -> ${sel}`); allRendered = false; }
  }
  t(`all ${routes.length} routes render`, allRendered);

  await page.evaluate(() => window.__nav('game-stretchy'));
  await page.waitForTimeout(250);
  await page.click('#go-btn');
  // The fixture is mostly silence with one tone burst, so don't assume the
  // burst lands inside a fixed wait — poll until the bar actually moves.
  await page.waitForFunction(
    () => parseFloat(document.querySelector('#stretch-fill').style.width) > 0,
    { timeout: 15000 }).catch(() => {});
  const bar = await page.locator('#stretch-fill').evaluate(el => el.style.width);
  t('sustained voice fills the bar', parseFloat(bar) > 0, bar);
  await page.evaluate(() => window.__nav('home'));
  await page.waitForTimeout(300);
  const live = await page.evaluate(() => import('./js/modules/voice.js').then(m => m.readLevel()));
  t('microphone released when leaving a voice page', live === 0);
  t('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();
}

// ── A hard attack and a gentle one must be told apart ──
{
  console.log('\nGentle-onset detection, end to end');
  const results = {};
  for (const wav of ['hard.wav', 'gentle.wav']) {
    const { browser, page } = await open(wav);
    const seen = [];
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.__nav('game-gentle'));
      await page.waitForTimeout(220);
      await page.click('#action-btn');
      await page.waitForFunction(() => document.querySelector('#action-btn').disabled, { timeout: 10000 }).catch(() => {});
      await page.waitForFunction(() => !document.querySelector('#action-btn').disabled, { timeout: 20000 }).catch(() => {});
      const label = (await page.locator('#phase-label').textContent()).trim();
      seen.push(label.includes('Feather-soft') ? 'gentle' : label.includes('even softer') ? 'okay'
              : label.includes('jumped in') ? 'hard' : 'no-voice');
    }
    results[wav] = seen;
    console.log(`    ${wav} -> ${seen.join(', ')}`);
    await browser.close();
  }
  t('a hard attack is never rewarded as gentle', results['hard.wav'].every(q => q !== 'gentle'));
  t('a real easy onset is recognised', results['gentle.wav'].some(q => q === 'gentle'));
}

// ── Calibration makes a quiet child audible ──
{
  console.log('\nVoice calibration');
  const { browser, page, errors } = await open('soft.wav');
  t('home offers setup when uncalibrated', await page.locator('#voice-setup-cta').isVisible());
  await page.evaluate(() => window.__nav('voice-setup'));
  await page.waitForTimeout(250);
  for (let i = 0; i < 8; i++) {
    await page.click('#go-btn');
    await page.waitForFunction(() => document.querySelector('#go-btn').disabled, { timeout: 10000 }).catch(() => {});
    await page.waitForFunction(() => !document.querySelector('#go-btn').disabled
      || document.querySelector('#result-card').style.display === '', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(700);
    if (await page.locator('#result-card').isVisible()) break;
  }
  t('calibration finishes even when the voices are alike', await page.locator('#result-card').isVisible());
  const prof = await page.evaluate(() => import('./js/modules/state.js').then(s => s.state.voiceProfile));
  t('all three levels stored', prof.quiet > 0 && prof.normal > 0 && prof.loud > 0);
  const th = await page.evaluate(async () => {
    const v = await import('./js/modules/voice.js');
    await v.acquireMic(); await v.calibrateNoiseFloor(700);
    const x = v.voiceThreshold(); v.releaseMic(); return x;
  });
  t('threshold sits below his quiet voice', th < prof.quiet, `${th.toFixed(4)} < ${prof.quiet.toFixed(4)}`);
  t('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();
}

// ── The session loop, which feeds the parent dashboard ──
{
  console.log('\nPractice session');
  const { browser, page, errors } = await open();
  t('no session bar before starting', await page.locator('#session-bar').isHidden());
  await page.click('#emotion-cta');
  await page.waitForTimeout(250);
  await page.locator('.emoji-btn').nth(1).click();
  await page.click('#confirm-emotion');
  await page.waitForTimeout(400);
  t('check-in leads into the practice tools', await page.locator('text=Practice Tools').isVisible());
  for (const a of ['breathing', 'word-stretch', 'gentle-onset']) {
    await page.evaluate(x => import('./js/modules/state.js').then(s => s.recordPractice(x)), a);
    await page.waitForTimeout(120);
  }
  t('bar fills as activities complete', (await page.locator('.session-pip.on').count()) === 3);
  await page.click('#session-finish');
  await page.waitForTimeout(300);
  await page.locator('.emoji-btn').nth(4).click();
  await page.click('#confirm-emotion');
  await page.waitForTimeout(450);
  t('celebration screen shown', await page.locator('text=Session finished!').isVisible());
  const rows = await page.evaluate(() => import('./js/modules/state.js').then(s =>
    s.state.sessions.filter(x => x.type === 'session').map(x => ({ b: x.emotionBefore, a: x.emotionAfter }))));
  t('a session row carries both emotions', rows.length === 1 && rows[0].b === 2 && rows[0].a === 5, JSON.stringify(rows));
  await page.evaluate(() => window.__nav('parent'));
  await page.waitForTimeout(350);
  t('the dashboard emotion trend is no longer empty',
    !(await page.locator('text=Complete sessions to see emotion trends').isVisible()));
  t('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();
}

// ── Coins taper, and personal bests only count when they are bests ──
{
  console.log('\nRewards');
  const { browser, page } = await open();
  const econ = await page.evaluate(async () => {
    const s = await import('./js/modules/state.js');
    const paid = [];
    for (let i = 0; i < 8; i++) paid.push(await s.awardRep('word-stretch'));
    return { paid, other: await s.awardRep('gentle-onset') };
  });
  console.log(`    8 reps paid: ${econ.paid.join(', ')}`);
  t('first reps pay full', econ.paid.slice(0, 3).every(c => c === 5));
  t('later reps taper but never hit zero', econ.paid[7] < econ.paid[0] && econ.paid.every(c => c >= 1));
  t('a different activity pays full again', econ.other === 5);
  t('grinding is not the fast path', econ.paid.reduce((a, b) => a + b, 0) < 40);
  const best = await page.evaluate(async () => {
    const s = await import('./js/modules/state.js');
    return { a: await s.noteBest('holdMs', 2100), b: await s.noteBest('holdMs', 1800),
             c: await s.noteBest('holdMs', 3000), v: s.state.bests.holdMs };
  });
  t('a best is recorded, a worse attempt is not', best.a && !best.b && best.c && best.v === 3000);
  await browser.close();
}

// ── My Words: his own words, in his own voice ──
{
  console.log('\nMy Words');
  const { browser, page, errors } = await open();
  const db = await page.evaluate(async () => {
    const d = await import('./js/modules/db.js');
    await d.setSetting('canary', 'still-here');
    return { stores: [...(await d.openDB()).objectStoreNames], canary: await d.getSetting('canary') };
  });
  t('the v2 upgrade adds the words store', db.stores.includes('words'));
  t('existing stores survive the bump',
    ['sessions', 'settings', 'recordings', 'rewards', 'challenges'].every(s => db.stores.includes(s)));
  t('existing settings survive', db.canary === 'still-here');

  await page.evaluate(() => window.__nav('my-words'));
  await page.waitForTimeout(450);
  t('built-in words are listed', (await page.locator('.word-row').count()) >= 20);
  await page.fill('#word-input', 'Dinosaur');
  await page.click('#add-word-btn');
  await page.waitForTimeout(400);
  t('a word of his own appears', await page.locator('text=My own words ✍️ (1)').isVisible());

  await page.locator('.word-row').filter({ hasText: 'Dinosaur' }).first()
    .locator('button[aria-label^="Record"]').click();
  await page.waitForSelector('#rec-panel:visible', { timeout: 5000 });
  await page.waitForFunction(() => document.querySelector('#rec-panel').style.display === 'none',
    { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);
  const stored = await page.evaluate(() => import('./js/modules/myWords.js').then(m => m.listWords())
    .then(ws => ws.filter(w => w.blob).map(w => ({ id: w.id, size: w.blob.size, rise: w.riseMs }))));
  console.log(`    stored: ${JSON.stringify(stored)}`);
  t('his recording is saved against the word', stored.length === 1 && stored[0].id === 'dinosaur');
  t('the blob holds real audio', (stored[0]?.size || 0) > 1000, `${stored[0]?.size} bytes`);
  t('the take was analysed for onset', stored[0]?.rise !== null && stored[0]?.rise !== undefined);

  t('the games would play his voice',
    (await page.evaluate(() => import('./js/modules/myWords.js').then(m => m.playWordModel('Dinosaur')))) === 'own');
  t('un-recorded words fall back to the synthesiser',
    (await page.evaluate(() => import('./js/modules/myWords.js').then(m => m.playWordModel('Umbrella')))) === 'tts');

  await page.evaluate(() => window.__nav('block-reset'));
  await page.waitForTimeout(550);
  t('his word leads the Word Stretch pool',
    (await page.locator('#word-letters').textContent()).trim().toUpperCase() === 'DINOSAUR');

  await page.evaluate(() => window.__nav('game-gentle'));
  await page.waitForTimeout(550);
  const gw = (await page.locator('#word-prompt').textContent()).trim().toLowerCase();
  t('a consonant word is kept out of Gentle Start', gw !== 'dinosaur', `showing "${gw}"`);

  await page.evaluate(() => import('./js/modules/myWords.js').then(m => m.addCustomWord('Octopus')));
  await page.evaluate(() => window.__nav('home'));
  await page.waitForTimeout(150);
  await page.evaluate(() => window.__nav('game-gentle'));
  await page.waitForTimeout(550);
  t('but a vowel-initial one of his does join it',
    (await page.locator('#word-prompt').textContent()).trim().toLowerCase() === 'octopus');
  t('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();
}

// ── Talk Together: a real person, and turns counted rather than judged ──
{
  console.log('\nTalk Together');
  const { browser, page, errors } = await open();
  await page.evaluate(() => window.__nav('talk'));
  await page.waitForTimeout(350);
  t('it asks him to go and find someone', await page.locator('text=Go and find someone!').isVisible());
  await page.locator('.breath-chip', { hasText: 'Dad' }).first().click();
  await page.click('#begin-btn');
  await page.waitForTimeout(350);
  t('the conversation starts on his turn', (await page.locator('#turn-badge').textContent()).includes('Your turn'));
  const prompt = (await page.locator('#prompt').textContent()).trim();
  console.log(`    prompt: "${prompt}"`);
  t('a conversation prompt is shown, with slots filled', prompt.length > 10 && !prompt.includes('{'));

  await page.click('#turn-btn');
  // The handler awaits the mic before it disables anything, so wait for the
  // listening state to begin before waiting for it to end.
  await page.waitForFunction(() => document.querySelector('#turn-btn').disabled, { timeout: 10000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('#turn-btn').disabled, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(400);
  t('taking a turn hands over to the partner',
    (await page.locator('#turn-badge').textContent()).includes('Dad'));
  t('the turn track filled a dot', (await page.locator('.turn-dot.on').count()) >= 1);

  await page.click('#finish-btn');
  await page.waitForTimeout(400);
  const done = await page.locator('#done-title').textContent();
  console.log(`    ${done.trim()}`);
  t('it counts turns, and nothing about how they sounded', /took \d+ turns? with Dad/.test(done));
  const logged = await page.evaluate(() => import('./js/modules/state.js').then(s =>
    s.state.sessions.filter(x => x.activity === 'talk-together').length));
  t('the conversation counts as practice', logged === 1);
  t('the partner is remembered for next time',
    (await page.evaluate(() => import('./js/modules/db.js').then(d => d.getSetting('talkPartner')))) === 'Dad');
  t('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();
}

// ── The buddy: getting stuck is shown as ordinary and survivable ──
{
  console.log('\nMy Buddy');
  const { browser, page, errors } = await open();
  await page.evaluate(() => window.__nav('buddy'));
  await page.waitForTimeout(350);
  await page.fill('#buddy-name', 'Rex');
  await page.click('#meet-btn');
  await page.waitForTimeout(350);
  t('a scene opens', await page.locator('#scene-view').isVisible());
  await page.click('#next-btn');
  await page.waitForTimeout(2200);
  t('the buddy visibly gets stuck', await page.locator('.stuck-part').isVisible());
  const strategies = await page.locator('.strategy-btn').count();
  t('several ways to help are offered', strategies === 4, `${strategies} options`);
  const labels = await page.locator('.strategy-btn').allTextContents();
  t('one of them is bouncing on the word on purpose',
    labels.some(l => l.toLowerCase().includes('bounce')), labels.join(' | '));
  t('and one is simply carrying on',
    labels.some(l => l.toLowerCase().includes('keep going')));

  await page.locator('.strategy-btn', { hasText: 'keep going' }).first().click();
  await page.waitForTimeout(500);
  const reply = (await page.locator('#scene-msg').textContent()).trim();
  console.log(`    buddy says: "${reply}"`);
  t('the buddy says it anyway, stuck and all', reply.includes('said it anyway'));
  await page.waitForTimeout(2500);
  t('and thanks him for waiting',
    (await page.locator('#scene-msg').textContent()).includes('waiting'));
  const buddySaved = await page.evaluate(() => import('./js/modules/db.js').then(d => d.getSetting('buddy')));
  t('his buddy is remembered by name', buddySaved?.name === 'Rex');
  t('helping counts as practice',
    (await page.evaluate(() => import('./js/modules/state.js').then(s =>
      s.state.sessions.filter(x => x.activity === 'buddy').length))) === 1);
  t('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();
}

// ── Content is generated, not a fixed list ──
{
  console.log('\nGenerated content in the running app');
  const { browser, page } = await open();
  const sets = await page.evaluate(async () => {
    const c = await import('./js/modules/content.js');
    const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
    return [0, 1, 2].map(n => c.dailyGentleWords(10, c.todaySeed(day(n), 1)).join(','));
  });
  t('three consecutive days give three different word sets', new Set(sets).size === 3);
  await page.evaluate(() => window.__nav('challenges'));
  await page.waitForTimeout(350);
  const texts = await page.locator('.challenge-text').allTextContents();
  t('daily challenges render with slots filled',
    texts.length >= 1 && texts.every(x => !x.includes('{')), texts.join(' | '));
  await browser.close();
}

// ── His data is asked to be non-evictable, and the parent is told either way ──
{
  console.log('\nStorage persistence');
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream'] });
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // Watch the real call the app makes at boot, before any of it runs.
  await page.addInitScript(() => {
    window.__persistCalls = 0;
    const s = navigator.storage;
    if (s?.persist) {
      const real = s.persist.bind(s);
      s.persist = () => { window.__persistCalls++; return real(); };
    }
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('#nav-bar');
  await page.evaluate(() => import('./js/modules/router.js').then(m => (window.__nav = m.navigate)));

  t('boot asks the browser not to evict his data',
    (await page.evaluate(() => window.__persistCalls)) >= 1);

  // Already-granted origins must not re-ask; Firefox prompts, and a child
  // should never see that dialog twice.
  const noReask = await page.evaluate(async () => {
    const m = await import('./js/modules/storage.js?v=reask');
    let calls = 0;
    const s = navigator.storage;
    const realPersist = s.persist, realPersisted = s.persisted;
    s.persisted = async () => true;
    s.persist   = async () => { calls++; return true; };
    const r = await m.requestPersistence();
    s.persist = realPersist; s.persisted = realPersisted;
    return { r, calls };
  });
  t('an already-protected origin is not asked again', noReask.r === true && noReask.calls === 0);

  // Insurance must never be a dependency: a browser without the API, or one
  // that throws on it, has to leave the app working.
  const survives = await page.evaluate(async () => {
    const m = await import('./js/modules/storage.js?v=throws');
    const s = navigator.storage;
    const realPersist = s.persist, realPersisted = s.persisted, realEst = s.estimate;
    s.persisted = async () => { throw new Error('nope'); };
    s.persist   = async () => { throw new Error('nope'); };
    s.estimate  = async () => { throw new Error('nope'); };
    const r = await m.requestPersistence();
    const rep = await m.storageReport();
    s.persist = realPersist; s.persisted = realPersisted; s.estimate = realEst;
    return { r, rep };
  });
  t('a browser that refuses or lacks the API degrades quietly',
    survives.r === null && survives.rep.persisted === null);

  const report = await page.evaluate(() =>
    import('./js/modules/storage.js').then(m => m.storageReport()));
  t('it can report how much of his data is stored',
    typeof report.usedMB === 'number' && report.usedMB >= 0,
    `${report.usedMB?.toFixed?.(2)} MB, persisted=${report.persisted}`);

  await page.evaluate(() => window.__nav('parent'));
  await page.waitForFunction(
    () => !document.querySelector('#storage-note')?.textContent.includes('Checking'),
    null, { timeout: 4000 });
  const note = (await page.locator('#storage-note').textContent()).trim();
  t('the parent dashboard says where his progress lives',
    /device/i.test(note) && note.length > 40, note.slice(0, 90) + '…');

  t('no console errors', errors.length === 0, errors.join(' | '));
  await browser.close();
}

console.log(ok ? '\nBROWSER PASS' : '\nBROWSER FAIL');
process.exit(ok ? 0 : 1);
