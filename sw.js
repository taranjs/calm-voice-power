const CACHE_NAME = 'calm-voice-v17';
const ASSETS = [
  './',
  './index.html',
  // The guided tour. Precached so the ❓ link in the parent dashboard still opens
  // something useful offline; its screenshots in shots/ are deliberately left out,
  // because 2MB of images a child never sees does not belong in a child's cache.
  './features.html',
  './manifest.json',
  './css/main.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/main.js',
  './js/modules/db.js',
  './js/modules/state.js',
  './js/modules/router.js',
  './js/modules/audio.js',
  './js/modules/voice.js',
  './js/modules/speech.js',
  './js/modules/toast.js',
  './js/modules/avatar.js',
  './js/components/nav.js',
  './js/components/micPanel.js',
  './js/components/voiceJournal.js',
  './js/components/voiceSetup.js',
  './js/components/voicePowers.js',
  './js/components/sessionDone.js',
  './js/components/sessionBar.js',
  './js/components/myWords.js',
  './js/modules/myWords.js',
  './js/modules/content.js',
  './js/modules/storage.js',
  './js/modules/backup.js',
  './js/components/talkTogether.js',
  './js/components/buddy.js',
  './js/components/emotionCheck.js',
  './js/components/streakRoad.js',
  './js/components/breathingSession.js',
  './js/components/pacingDots.js',
  './js/components/recorder.js',
  './js/components/blockReset.js',
  './js/components/dailyChallenge.js',
  './js/components/rewards.js',
  './js/components/avatarBuilder.js',
  './js/components/parentDashboard.js',
  './js/components/home.js',
  './js/components/practiceHub.js',
  './js/components/gamesHub.js',
  './js/games/gentleOnset.js',
  './js/games/stretchySpeech.js',
  './js/games/pauseChallenge.js',
];
const APP_SHELL_URL = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(ASSETS.map(async url => {
      const res = await fetch(url, { cache: 'reload' });
      if (!res.ok) throw new Error(`precache failed for ${url}: ${res.status}`);
      // Some hosts redirect: Cloudflare Pages answers /features.html with a 308
      // to /features. A cached response that arrived via a redirect carries
      // redirected:true, and Chrome refuses to satisfy a *navigation* from one —
      // so the page fails to open with a bare ERR_FAILED once the worker is in
      // charge. Re-wrapping as a plain 200 keeps it usable offline.
      await cache.put(url, res.redirected
        ? new Response(await res.blob(), { status: 200, statusText: 'OK', headers: res.headers })
        : res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(
      cached => cached || fetch(e.request).catch(() => caches.match(APP_SHELL_URL))
    )
  );
});
