// js/components/pacingDots.js
import { navigate } from '../modules/router.js';
import { addCoins, addMinutes, saveState } from '../modules/state.js';
import { playDot, playSuccess, playClick } from '../modules/audio.js';
import { praiseToast } from '../modules/toast.js';

const WORD_SETS = [
  { words: ['Rain', 'Sun', 'Star', 'Moon', 'Sky'], syllables: [1,1,1,1,1] },
  { words: ['But-ter', 'Hap-py', 'Pret-ty', 'Sim-ple', 'Eas-y'], syllables: [2,2,2,2,2] },
  { words: ['Beau-ti-ful', 'Won-der-ful', 'Fan-tas-tic', 'Hap-pi-ness', 'Va-ca-tion'], syllables: [3,3,3,3,3] },
  { words: ['A-maz-ing', 'To-mor-row', 'Re-mem-ber', 'To-geth-er', 'Un-der-stand'], syllables: [3,3,3,3,3] },
];

let setIdx = 0, wordIdx = 0, dotIdx = 0, paceTimer = null;

export function renderPacingDots() {
  const page = document.createElement('div');
  page.className = 'page';
  let set = WORD_SETS[setIdx];
  let running = false, doneCount = 0;
  const BPM = 60; // 1 beat per second
  const BEAT = 1000;

  page.innerHTML = `
    <div class="page-header flex-between">
      <h2>Pacing Dots 🎵</h2>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
    </div>
    <p class="text-center" style="margin-bottom:16px">Say each part when a dot lights up!</p>

    <div class="card text-center mb-16">
      <p style="font-size:0.85rem;color:var(--ink-faint);margin-bottom:12px">Tap the word to begin</p>
      <div class="word-display" id="word-display"></div>
      <div class="pacing-dots" id="pacing-dots"></div>
    </div>

    <div class="flex-center gap-12 flex-wrap">
      <button class="btn btn-ghost" id="slower-btn">🐢 Slower</button>
      <button class="btn btn-primary" id="start-btn">▶ Start</button>
      <button class="btn btn-ghost" id="next-btn">Next Word ➡</button>
    </div>

    <div class="mt-24">
      <div class="flex-between mb-8">
        <span class="section-title">Level</span>
        <div style="display:flex;gap:8px">
          ${WORD_SETS.map((_,i) => `<button class="pill pill-sky level-btn" data-level="${i}" style="cursor:pointer">${['1','2','3','4'][i]}</button>`).join('')}
        </div>
      </div>
    </div>
  `;

  let speed = BEAT;

  function loadWord() {
    set = WORD_SETS[setIdx];
    const w = set.words[wordIdx];
    const syl = set.syllables[wordIdx];
    const parts = w.split('-');

    const wordEl = page.querySelector('#word-display');
    wordEl.innerHTML = parts.map((p,i) => `<span class="syllable" data-syl="${i}">${p}</span>`).join('<span style="opacity:0.3"> · </span>');
    wordEl.addEventListener('click', startPacing);

    const dotsEl = page.querySelector('#pacing-dots');
    dotsEl.innerHTML = Array.from({length: syl}, (_,i) =>
      `<div class="pacing-dot" data-dot="${i}">•</div>`
    ).join('');

    dotIdx = 0; running = false;
    clearInterval(paceTimer);
  }

  function startPacing() {
    if (running) return;
    running = true; dotIdx = 0;
    clearInterval(paceTimer);
    beatDot();
    paceTimer = setInterval(() => {
      dotIdx++;
      const set = WORD_SETS[setIdx];
      if (dotIdx >= set.syllables[wordIdx]) {
        clearInterval(paceTimer);
        running = false;
        doneCount++;
        if (doneCount >= 3) rewardCoins();
        return;
      }
      beatDot();
    }, speed);
  }

  function beatDot() {
    playDot();
    page.querySelectorAll('.pacing-dot').forEach((d,i) => {
      d.classList.toggle('active', i === dotIdx);
      if (i < dotIdx) d.classList.add('spoken');
    });
    page.querySelectorAll('.syllable').forEach((s,i) => {
      s.classList.toggle('active', i === dotIdx);
    });
  }

  async function rewardCoins() {
    playSuccess(); praiseToast();
    await addCoins(5); await saveState();
    doneCount = 0;
  }

  loadWord();

  page.querySelector('#start-btn').addEventListener('click', () => { playClick(); startPacing(); });
  page.querySelector('#next-btn').addEventListener('click', () => {
    playClick();
    wordIdx = (wordIdx + 1) % WORD_SETS[setIdx].words.length;
    loadWord();
  });
  page.querySelector('#slower-btn').addEventListener('click', () => {
    playClick();
    speed = Math.min(speed + 200, 2000);
  });
  page.querySelector('#exit-btn').addEventListener('click', () => {
    clearInterval(paceTimer); playClick(); navigate('home');
  });
  page.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playClick();
      setIdx = parseInt(btn.dataset.level);
      wordIdx = 0;
      loadWord();
      page.querySelectorAll('.level-btn').forEach(b => b.style.background = '');
      btn.style.background = 'var(--sky)';
      btn.style.color = 'white';
    });
  });

  return page;
}
