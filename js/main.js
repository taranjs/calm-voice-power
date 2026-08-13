// js/main.js – App bootstrap
import { openDB } from './modules/db.js';
import { loadState, state } from './modules/state.js';
import { setVoiceProfile } from './modules/voice.js';
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
import { renderVoiceJournal }      from './components/voiceJournal.js';
import { renderVoiceSetup }        from './components/voiceSetup.js';
import { renderVoicePowers }       from './components/voicePowers.js';
import { renderSessionDone }       from './components/sessionDone.js';
import { renderSessionBar }        from './components/sessionBar.js';

// Games
import { renderGentleOnset }   from './games/gentleOnset.js';
import { renderStretchySpeech } from './games/stretchySpeech.js';
import { renderPauseChallenge } from './games/pauseChallenge.js';

async function boot() {
  // Register service worker (disable cache layer during localhost dev)
  if ('serviceWorker' in navigator) {
    const isLocalhost =
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1';

    if (isLocalhost) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(reg => reg.unregister()));
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }
    } else {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  // Open DB & load state
  await openDB();
  await loadState();

  // Detection thresholds come from this child's measured voice, when we have it.
  setVoiceProfile(state.voiceProfile);

  // Build shell
  const app = document.getElementById('app');
  app.innerHTML = `
    <main id="app-content" role="main" aria-live="polite"></main>
  `;
  app.appendChild(renderSessionBar());
  app.appendChild(renderNav());

  // Register routes
  route('home',          renderHome);
  route('emotion-check', () => renderEmotionCheck({ mode: 'before' }));
  // The 'after' check-in was never routed, so logSession() never ran with an
  // emotion and the parent dashboard's trend read an empty table forever.
  route('emotion-after',  () => renderEmotionCheck({ mode: 'after' }));
  route('session-done',   renderSessionDone);
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
  route('journal',       renderVoiceJournal);
  route('voice-setup',   renderVoiceSetup);
  route('powers',        renderVoicePowers);
  route('game-gentle',   renderGentleOnset);
  route('game-stretchy', renderStretchySpeech);
  route('game-pause',    renderPauseChallenge);

  // Go home
  navigate('home');
}

boot();
