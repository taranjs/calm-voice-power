// js/main.js – App bootstrap
import { openDB } from './modules/db.js';
import { loadState } from './modules/state.js';
import { route, navigate } from './modules/router.js';
import { renderNav } from './components/nav.js';

// Pages
import { renderHome }             from './components/home.js';
import { renderEmotionCheck }     from './components/emotionCheck.js';
import { renderStreakRoad }        from './components/streakRoad.js';
import { renderBreathingSession }  from './components/breathingSession.js';
import { renderPacingDots }        from './components/pacingDots.js';
import { renderRecorder }          from './components/recorder.js';
import { renderBlockReset }        from './components/blockReset.js';
import { renderDailyChallenge }    from './components/dailyChallenge.js';
import { renderRewards }           from './components/rewards.js';
import { renderAvatarBuilder }     from './components/avatarBuilder.js';
import { renderParentDashboard }   from './components/parentDashboard.js';
import { renderPracticeHub }       from './components/practiceHub.js';
import { renderGamesHub }          from './components/gamesHub.js';

// Games
import { renderGentleOnset }   from './games/gentleOnset.js';
import { renderStretchySpeech } from './games/stretchySpeech.js';
import { renderPauseChallenge } from './games/pauseChallenge.js';

async function boot() {
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // Open DB & load state
  await openDB();
  await loadState();

  // Build shell
  const app = document.getElementById('app');
  app.innerHTML = `
    <main id="app-content" role="main" aria-live="polite"></main>
  `;
  const nav = renderNav();
  app.appendChild(nav);

  // Register routes
  route('home',          renderHome);
  route('emotion-check', () => renderEmotionCheck({ mode: 'before' }));
  route('streak',        renderStreakRoad);
  route('breathing',     renderBreathingSession);
  route('pacing',        renderPacingDots);
  route('recorder',      renderRecorder);
  route('block-reset',   renderBlockReset);
  route('challenges',    renderDailyChallenge);
  route('rewards',       renderRewards);
  route('avatar',        renderAvatarBuilder);
  route('parent',        renderParentDashboard);
  route('practice',      renderPracticeHub);
  route('games',         renderGamesHub);
  route('game-gentle',   renderGentleOnset);
  route('game-stretchy', renderStretchySpeech);
  route('game-pause',    renderPauseChallenge);

  // Go home
  navigate('home');
}

boot();
