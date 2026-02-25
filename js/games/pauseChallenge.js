// js/games/pauseChallenge.js
import { navigate } from '../modules/router.js';
import { addCoins, saveState } from '../modules/state.js';
import { playTone, playSuccess, playClick } from '../modules/audio.js';
import { toast, praiseToast } from '../modules/toast.js';

const SENTENCES = [
  { text: 'I am … so happy … today!', pauses: 2, target: [1000, 1000] },
  { text: 'My name … is … very cool!', pauses: 2, target: [900, 900] },
  { text: 'I like … cats … and dogs!', pauses: 2, target: [800, 800] },
  { text: 'Take a … big … deep breath!', pauses: 2, target: [1000, 1200] },
];

export function renderPauseChallenge() {
  const page = document.createElement('div');
  page.className = 'page';
  let idx = 0, pauseIdx = 0, inPause = false, pauseStart = 0, score = 0, complete = false;

  function cur() { return SENTENCES[idx % SENTENCES.length]; }

  page.innerHTML = `
    <div class="page-header flex-between">
      <h2>Pause Power ⏸️</h2>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
    </div>

    <div class="card text-center mb-16">
      <p style="font-size:0.85rem;color:var(--ink-faint);margin-bottom:8px">Say the sentence with natural pauses at the dots</p>
      <div class="game-prompt" id="sentence" style="font-size:1.4rem;line-height:1.8"></div>
    </div>

    <div class="game-arena text-center">
      <div style="font-size:5rem;margin-bottom:12px" id="pause-icon">🎙️</div>
      <p style="font-weight:700;font-size:1.1rem" id="pause-msg">Tap below when you reach a … pause</p>

      <div style="display:flex;gap:8px;justify-content:center;margin:16px 0" id="pause-dots"></div>
    </div>

    <div class="text-center mt-16">
      <button class="btn btn-primary btn-lg" id="pause-btn" style="width:100%;max-width:280px">
        ⏸️ I'm Pausing Now!
      </button>
    </div>

    <div class="flex-between mt-24">
      <div class="game-score" id="score">${score} 🎯</div>
      <button class="btn btn-ghost" id="next-btn">Next →</button>
    </div>
  `;

  function loadSentence() {
    const s = cur();
    page.querySelector('#sentence').textContent = s.text;
    pauseIdx = 0; complete = false;

    const dotsEl = page.querySelector('#pause-dots');
    dotsEl.innerHTML = Array.from({length: s.pauses}, (_,i) =>
      `<div class="pacing-dot" data-p="${i}">⏸️</div>`
    ).join('');

    page.querySelector('#pause-msg').textContent = 'Tap when you reach a … pause';
    page.querySelector('#pause-icon').textContent = '🎙️';
  }

  const pauseBtn = page.querySelector('#pause-btn');
  pauseBtn.addEventListener('click', () => {
    if (complete) return;
    playClick();
    const s = cur();
    const dot = page.querySelector(`[data-p="${pauseIdx}"]`);
    if (!dot) return;

    if (!inPause) {
      inPause = true; pauseStart = Date.now();
      dot.classList.add('active');
      page.querySelector('#pause-icon').textContent = '⏸️';
      page.querySelector('#pause-msg').textContent = 'Holding the pause… ✨';
      pauseBtn.textContent = '▶️ Resume Speaking!';
      pauseBtn.className = 'btn btn-sun btn-lg';
      playTone(330, 0.2, 'sine', 0.1);
    } else {
      const held = Date.now() - pauseStart;
      const target = s.target[pauseIdx] || 1000;
      inPause = false;
      dot.classList.remove('active');
      dot.classList.add('spoken');

      if (held >= target * 0.6) {
        dot.textContent = '✅';
        score++;
        page.querySelector('#score').textContent = `${score} 🎯`;
        playTone(660, 0.15);
        if (score % 3 === 0) { addCoins(10); saveState(); toast('🪙 +10 coins!', 'reward'); }
      } else {
        dot.textContent = '💙';
      }

      pauseIdx++;
      pauseBtn.textContent = '⏸️ I\'m Pausing Now!';
      pauseBtn.className = 'btn btn-primary btn-lg';
      page.querySelector('#pause-icon').textContent = '🎙️';
      page.querySelector('#pause-msg').textContent = pauseIdx < s.pauses
        ? `${s.pauses - pauseIdx} more pause${s.pauses - pauseIdx > 1 ? 's' : ''} to go!`
        : '🌟 Sentence complete!';

      if (pauseIdx >= s.pauses) {
        complete = true;
        page.querySelector('#pause-icon').textContent = '🌟';
        playSuccess(); praiseToast();
      }
    }
  });

  page.querySelector('#next-btn').addEventListener('click', () => {
    playClick(); idx++;
    if (inPause) { inPause = false; pauseBtn.textContent = '⏸️ I\'m Pausing Now!'; pauseBtn.className = 'btn btn-primary btn-lg'; }
    loadSentence();
  });
  page.querySelector('#exit-btn').addEventListener('click', () => { playClick(); navigate('games'); });

  loadSentence();
  return page;
}
