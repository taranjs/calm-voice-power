const CACHE_NAME = 'calm-voice-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/main.css',
  '/js/main.js',
  '/js/modules/db.js',
  '/js/modules/state.js',
  '/js/modules/router.js',
  '/js/modules/audio.js',
  '/js/modules/toast.js',
  '/js/modules/avatar.js',
  '/js/components/nav.js',
  '/js/components/emotionCheck.js',
  '/js/components/streakRoad.js',
  '/js/components/breathingSession.js',
  '/js/components/pacingDots.js',
  '/js/components/recorder.js',
  '/js/components/blockReset.js',
  '/js/components/dailyChallenge.js',
  '/js/components/rewards.js',
  '/js/components/avatarBuilder.js',
  '/js/components/parentDashboard.js',
  '/js/components/home.js',
  '/js/games/gentleOnset.js',
  '/js/games/stretchySpeech.js',
  '/js/games/pauseChallenge.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => caches.match('/index.html')))
  );
});
