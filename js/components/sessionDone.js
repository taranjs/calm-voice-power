// js/components/sessionDone.js – the end of a practice session
// Closes the loop the app never closed: he checked in, he did the work, and now
// something acknowledges the whole session rather than each tap within it.
import { navigate } from '../modules/router.js';
import { state, computeStreak } from '../modules/state.js';
import { playSuccess, playClick } from '../modules/audio.js';

const EMOJIS = ['😔', '😕', '😐', '🙂', '😄'];

const ACTIVITY_NAMES = {
  'breathing': 'Calm Breath 🌬️',
  'word-stretch': 'Word Stretch ✨',
  'stretchy-speech': 'Stretchy Speech 🌈',
  'gentle-onset': 'Gentle Start 🌱',
  'pause-power': 'Pause Power ⏸️',
  'pacing-dots': 'Pacing Dots 🎵',
  'recording': 'Record Me! 🎙️',
  'challenge': 'Brave Challenge 🌍',
};

export function renderSessionDone(params = {}) {
  const page = document.createElement('div');
  page.className = 'page';

  const { activities = [], emotionBefore = null, emotionAfter = null } = params;
  const streak = computeStreak();
  const moodUp = emotionBefore && emotionAfter && emotionAfter > emotionBefore;

  page.innerHTML = `
    <div class="page-header text-center">
      <div style="font-size:4rem" class="float">🎉</div>
      <h2 style="margin-top:8px">Session finished!</h2>
      <p class="mt-8">${state.avatar.name || 'Brave Voice'}, that was brilliant.</p>
    </div>

    <div class="card card-mint mb-16">
      <div class="section-title" style="margin-bottom:8px">What you did today</div>
      <div id="did-list"></div>
    </div>

    ${emotionBefore && emotionAfter ? `
      <div class="card mb-16 text-center">
        <div class="section-title" style="margin-bottom:8px">How you felt</div>
        <div style="font-size:2.2rem">
          ${EMOJIS[emotionBefore - 1]} <span style="font-size:1.2rem;color:var(--ink-faint)">→</span> ${EMOJIS[emotionAfter - 1]}
        </div>
        ${moodUp ? '<p style="color:var(--mint);font-weight:800;margin-top:8px">Practice made you feel better today! ✨</p>' : ''}
      </div>` : ''}

    <div class="stat-row mb-16">
      <div class="stat-box card card-sun">
        <div class="stat-val" style="color:var(--sun-warm)">🔥 ${streak}</div>
        <div class="stat-key">Day Streak</div>
      </div>
      <div class="stat-box card card-lavender">
        <div class="stat-val" style="color:var(--lavender)">🪙 ${state.coins}</div>
        <div class="stat-key">Coins</div>
      </div>
    </div>

    <div class="action-stack">
      <button class="btn btn-primary btn-lg" id="powers-btn">⚡ See My Voice Powers</button>
      <div class="action-row">
        <button class="btn btn-ghost" id="home-btn">🏠 Home</button>
        <button class="btn btn-ghost" id="again-btn">Practise more</button>
      </div>
    </div>

    <div class="card card-soft text-center mt-24">
      <p style="font-size:0.9rem;font-weight:700">Go and show someone what you can do 💛</p>
      <p style="font-size:0.85rem;margin-top:4px">Your voice is for talking to people, not just to a screen.</p>
      <div class="action-row mt-16"><button class="btn btn-mint" id="talk-btn">💬 Talk Together</button></div>
    </div>
  `;

  const list = page.querySelector('#did-list');
  if (!activities.length) {
    list.innerHTML = '<p style="font-size:0.88rem">You showed up and gave it a go – that counts. 💙</p>';
  } else {
    activities.forEach(a => {
      const row = document.createElement('div');
      row.className = 'challenge-item done';
      row.innerHTML = `<div class="challenge-check">✅</div><span class="challenge-text"></span>`;
      row.querySelector('.challenge-text').textContent = ACTIVITY_NAMES[a] || a;
      list.appendChild(row);
    });
  }

  playSuccess();

  page.querySelector('#powers-btn').addEventListener('click', () => { playClick(); navigate('powers'); });
  page.querySelector('#home-btn').addEventListener('click', () => { playClick(); navigate('home'); });
  page.querySelector('#talk-btn').addEventListener('click', () => { playClick(); navigate('talk'); });
  page.querySelector('#again-btn').addEventListener('click', () => { playClick(); navigate('practice'); });

  return page;
}
