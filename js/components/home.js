// js/components/home.js
import { state } from '../modules/state.js';
import { navigate } from '../modules/router.js';
import { playClick } from '../modules/audio.js';

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

  return page;
}
