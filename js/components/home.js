// js/components/home.js
import { state, hasVoiceProfile } from '../modules/state.js';
import { navigate } from '../modules/router.js';
import { playClick } from '../modules/audio.js';
import { dbGetAll } from '../modules/db.js';

// How long before we invite him back to re-record a journal prompt.
const STALE_DAYS = 7;

export function renderHome() {
  const page = document.createElement('div');
  page.className = 'page';

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const hour  = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  page.innerHTML = `
    <div class="page-header flex-between">
      <div>
        <h1>${greeting}! 👋</h1>
        <p class="subtitle">${today} · ${state.avatar.name || 'Brave Voice'}</p>
      </div>
      <div class="avatar-preview" style="width:64px;height:64px;font-size:2.5rem;border-width:3px">
        ${state.avatar.body || '🐱'}
      </div>
    </div>

    <!-- Coin + Streak Row -->
    <div class="flex-between mb-16 gap-8">
      <span class="coin-display">🪙 <span id="home-coins">${state.coins}</span> coins</span>
      <span class="pill pill-sky">🔥 ${state.streak} day streak</span>
    </div>

    ${hasVoiceProfile() ? '' : `
    <!-- One-off voice calibration, so detection is tuned to this child -->
    <div class="card card-sun mb-16" id="voice-setup-cta" style="cursor:pointer">
      <div class="flex-between">
        <div>
          <div style="font-family:var(--font-display);font-size:1.1rem">Teach me your voice 🎤</div>
          <p style="font-size:0.85rem;margin-top:4px">Three silly voices so I never miss you when you talk</p>
        </div>
        <span style="font-size:2rem">🦁</span>
      </div>
    </div>`}

    <!-- Emotion check-in CTA -->
    <div class="card card-soft mb-16" id="emotion-cta" style="cursor:pointer">
      <div class="flex-between">
        <div>
          <div style="font-family:var(--font-display);font-size:1.1rem">How are you feeling?</div>
          <p style="font-size:0.85rem;margin-top:4px">Tap to check in before your session</p>
        </div>
        <span style="font-size:2rem">${state.emotionBefore ? ['😔','😕','😐','🙂','😄'][state.emotionBefore-1] : '🤔'}</span>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="section-title">What do you want to do?</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <button class="card" data-nav="breathing" style="cursor:pointer;text-align:center;border-color:var(--sky-light)">
        <div style="font-size:2.2rem">🌬️</div>
        <div style="font-weight:800;margin-top:6px;font-size:0.95rem">Calm Breath</div>
        <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:2px">3 min session</div>
      </button>
      <button class="card" data-nav="pacing" style="cursor:pointer;text-align:center;border-color:var(--sun)">
        <div style="font-size:2.2rem">🎵</div>
        <div style="font-weight:800;margin-top:6px;font-size:0.95rem">Pacing Dots</div>
        <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:2px">Speech rhythm</div>
      </button>
      <button class="card" data-nav="recorder" style="cursor:pointer;text-align:center;border-color:var(--mint)">
        <div style="font-size:2.2rem">🎙️</div>
        <div style="font-weight:800;margin-top:6px;font-size:0.95rem">Record Me!</div>
        <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:2px">Hear yourself</div>
      </button>
      <button class="card" data-nav="block-reset" style="cursor:pointer;text-align:center;border-color:var(--lavender)">
        <div style="font-size:2.2rem">✨</div>
        <div style="font-weight:800;margin-top:6px;font-size:0.95rem">Word Stretch</div>
        <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:2px">Block reset</div>
      </button>
    </div>

    <!-- Journal ritual: filled in asynchronously if a prompt has gone stale -->
    <div id="journal-nudge"></div>

    <!-- Voice powers -->
    <div class="card card-lavender mb-16" id="powers-cta" style="cursor:pointer">
      <div class="flex-between">
        <div>
          <div style="font-family:var(--font-display);font-size:1.1rem">My Voice Powers ⚡</div>
          <p style="font-size:0.85rem;margin-top:4px">See how much stronger your voice is getting</p>
        </div>
        <span style="font-size:2rem">🪶</span>
      </div>
    </div>

    <!-- Streak Road preview -->
    <div class="section-title">Your Confidence Road 🛤️</div>
    <div class="card mb-16" id="streak-preview" style="cursor:pointer">
      <div style="font-size:0.85rem;color:var(--ink-faint);margin-bottom:8px">${state.practiceDays.length} days practised · tap to see your full journey</div>
      <div id="mini-road"></div>
    </div>

    <!-- Daily Challenge -->
    <div class="section-title">Today's Brave Challenges 🌟</div>
    <div id="challenge-preview"></div>
  `;

  // Mini road – total days practised, so the stars never disappear on him
  const miniRoad = page.querySelector('#mini-road');
  const dots = Math.min(state.practiceDays.length, 10);
  const miniHtml = Array.from({length: 10}, (_,i) =>
    `<span style="font-size:1.6rem">${i < dots ? '⭐' : '○'}</span>`
  ).join(' ');
  miniRoad.innerHTML = miniHtml;

  // Challenge preview (first one)
  const cPrev = page.querySelector('#challenge-preview');
  state.todayChallenges.slice(0, 2).forEach(ch => {
    const el = document.createElement('div');
    el.className = `challenge-item${ch.done ? ' done' : ''}`;
    el.innerHTML = `
      <div class="challenge-check">${ch.done ? '✅' : ''}</div>
      <span class="challenge-icon">${ch.icon}</span>
      <span class="challenge-text"></span>
    `;
    el.querySelector('.challenge-text').textContent = ch.text;
    cPrev.appendChild(el);
  });

  // Events
  page.querySelector('#voice-setup-cta')?.addEventListener('click', () => {
    playClick();
    navigate('voice-setup');
  });
  page.querySelector('#emotion-cta').addEventListener('click', () => {
    playClick();
    navigate('emotion-check');
  });
  page.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      playClick();
      navigate(btn.dataset.nav);
    });
  });
  page.querySelector('#streak-preview').addEventListener('click', () => {
    playClick();
    navigate('streak');
  });
  page.querySelector('#powers-cta').addEventListener('click', () => {
    playClick();
    navigate('powers');
  });

  // Then vs Now only pays off if he actually records the same thing again, and
  // nothing ever asked him to. Once a prompt has gone stale, invite him back to
  // it – the reward is hearing his own progress, which never wears off the way
  // coins do.
  buildJournalNudge(page.querySelector('#journal-nudge'));

  return page;
}

async function buildJournalNudge(slot) {
  if (!slot) return;
  try {
    const all = (await dbGetAll('recordings')).filter(r => r && r.blob && r.promptId);
    if (!all.length) return;

    // Oldest last-recorded prompt wins – that's the biggest audible change.
    const latest = new Map();
    all.forEach(r => {
      const t = new Date(r.date).getTime();
      if (!latest.has(r.promptId) || t > latest.get(r.promptId).t) {
        latest.set(r.promptId, { t, text: r.promptText, id: r.promptId });
      }
    });
    const stale = [...latest.values()]
      .map(p => ({ ...p, days: Math.floor((Date.now() - p.t) / 86400000) }))
      .filter(p => p.days >= STALE_DAYS)
      .sort((a, b) => b.days - a.days)[0];
    if (!stale) return;

    slot.innerHTML = `
      <div class="card card-mint mb-16" id="journal-cta" style="cursor:pointer">
        <div class="flex-between">
          <div>
            <div style="font-family:var(--font-display);font-size:1.05rem">Say it again? 🎧</div>
            <p style="font-size:0.85rem;margin-top:4px">
              It's been ${stale.days} days since you recorded
              “${stale.text || 'this one'}”. Record it again and hear the difference!
            </p>
          </div>
          <span style="font-size:2rem">🎙️</span>
        </div>
      </div>
    `;
    slot.querySelector('#journal-cta').addEventListener('click', () => {
      playClick();
      navigate('recorder', { promptId: stale.id });
    });
  } catch (e) {
    /* the nudge is a bonus – never let it break the home screen */
  }
}
