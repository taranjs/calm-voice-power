// js/games/gentleOnset.js
import { navigate } from '../modules/router.js';
import { addCoins, saveState } from '../modules/state.js';
import { playTone, playSuccess, playClick } from '../modules/audio.js';
import { toast, praiseToast } from '../modules/toast.js';

const WORDS = ['Apple', 'Air', 'Open', 'Every', 'Umbrella', 'Easy', 'Only', 'Able', 'Elephant', 'Ice'];
const INSTRUCTIONS = [
  'Let the word start very softly – like a feather landing 🪶',
  'Breathe out a little bit first, then gently begin the word',
  'Imagine your voice is a gentle wave starting far away 🌊',
];

export function renderGentleOnset() {
  const page = document.createElement('div');
  page.className = 'page';
  let score = 0, wordIdx = 0, phase = 'ready'; // ready, inhale, speak

  page.innerHTML = `
    <div class="page-header flex-between">
      <h2>Gentle Start 🌱</h2>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
    </div>

    <div class="game-arena">
      <p style="font-size:0.85rem;color:var(--sky);font-weight:700;margin-bottom:8px" id="instruction">
        ${INSTRUCTIONS[0]}
      </p>
      <div class="game-prompt" id="word-prompt">${WORDS[0]}</div>

      <div id="phase-visual" style="margin:16px 0;min-height:80px;display:flex;align-items:center;justify-content:center">
        <div style="font-size:4rem" id="phase-icon">🌬️</div>
      </div>

      <p id="phase-label" style="font-weight:700;color:var(--ink-soft);margin-bottom:16px">Take a soft breath first…</p>
    </div>

    <div class="flex-center gap-12 mt-16 flex-wrap">
      <button class="btn btn-primary btn-lg" id="action-btn">🌬️ Soft Breath</button>
      <button class="btn btn-ghost" id="skip-btn">Skip word</button>
    </div>

    <div class="flex-between mt-24">
      <div>
        <div class="game-score" id="score">${score}</div>
        <div style="font-size:0.75rem;color:var(--ink-faint);font-weight:700">gentle tries</div>
      </div>
      <div class="card card-sun text-center" style="padding:12px 16px">
        <div style="font-size:0.75rem;font-weight:700;color:var(--sun-warm)">WORD</div>
        <div style="font-family:var(--font-display);font-size:1.4rem" id="word-num">1/${WORDS.length}</div>
      </div>
    </div>
  `;

  const actionBtn = page.querySelector('#action-btn');
  const phaseIcon = page.querySelector('#phase-icon');
  const phaseLabel = page.querySelector('#phase-label');
  const wordPrompt = page.querySelector('#word-prompt');
  const scoreEl = page.querySelector('#score');
  const wordNum = page.querySelector('#word-num');

  function setPhase(p) {
    phase = p;
    if (p === 'ready') {
      phaseIcon.textContent = '🌬️';
      phaseLabel.textContent = 'Take a soft breath first…';
      actionBtn.textContent = '🌬️ Soft Breath';
      actionBtn.className = 'btn btn-primary btn-lg';
    } else if (p === 'inhale') {
      phaseIcon.textContent = '😮';
      phaseLabel.textContent = 'Now – say it gently!';
      actionBtn.textContent = '🌱 Say It Gently';
      actionBtn.className = 'btn btn-mint btn-lg';
      playTone(330, 0.6, 'sine', 0.08);
    } else if (p === 'speak') {
      phaseIcon.textContent = '🌟';
      phaseLabel.textContent = 'Amazing gentle start!';
      actionBtn.textContent = '➡ Next Word';
      actionBtn.className = 'btn btn-sun btn-lg';
      playSuccess(); praiseToast();
      score++;
      scoreEl.textContent = score;
      if (score % 3 === 0) { addCoins(10); saveState(); toast('🪙 +10 coins!', 'reward'); }
    }
  }

  actionBtn.addEventListener('click', () => {
    playClick();
    if (phase === 'ready') { setPhase('inhale'); }
    else if (phase === 'inhale') { setPhase('speak'); }
    else {
      wordIdx = (wordIdx + 1) % WORDS.length;
      wordPrompt.textContent = WORDS[wordIdx];
      wordNum.textContent = `${wordIdx+1}/${WORDS.length}`;
      page.querySelector('#instruction').textContent = INSTRUCTIONS[Math.floor(Math.random()*INSTRUCTIONS.length)];
      setPhase('ready');
    }
  });

  page.querySelector('#skip-btn').addEventListener('click', () => {
    playClick();
    wordIdx = (wordIdx + 1) % WORDS.length;
    wordPrompt.textContent = WORDS[wordIdx];
    wordNum.textContent = `${wordIdx+1}/${WORDS.length}`;
    setPhase('ready');
  });

  page.querySelector('#exit-btn').addEventListener('click', () => { playClick(); navigate('games'); });

  return page;
}
