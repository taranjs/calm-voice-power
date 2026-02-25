// js/games/stretchySpeech.js
import { navigate } from '../modules/router.js';
import { addCoins, saveState } from '../modules/state.js';
import { playTone, playSuccess, playClick } from '../modules/audio.js';
import { toast, praiseToast } from '../modules/toast.js';

const PHRASES = [
  { text: 'Heeey there!', target: 1200, hint: 'Stretch the H-E-Y!' },
  { text: 'Goood morning!', target: 1000, hint: 'Make the OOO longer' },
  { text: 'Myyy name is…', target: 1100, hint: 'Float on the M-Y' },
  { text: 'I loooove this!', target: 1300, hint: 'Ride the LOVE sound' },
  { text: 'Sooo much fun!', target: 900,  hint: 'Stretch the S gently' },
  { text: 'Niiiice to meet you!', target: 1400, hint: 'Glide through NICE' },
];

export function renderStretchySpeech() {
  const page = document.createElement('div');
  page.className = 'page';
  let idx = 0, held = false, holdStart = 0, holdTimer = null, score = 0;

  function currentPhrase() { return PHRASES[idx % PHRASES.length]; }

  page.innerHTML = `
    <div class="page-header flex-between">
      <h2>Stretchy Speech 🌈</h2>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
    </div>

    <div class="game-arena">
      <p style="font-size:0.85rem;color:var(--sky);font-weight:700;margin-bottom:4px" id="hint">${currentPhrase().hint}</p>
      <div class="game-prompt" id="phrase">${currentPhrase().text}</div>

      <div id="stretch-bar-wrap" style="margin:20px 0">
        <div class="prog-bar" style="height:20px;border-radius:10px">
          <div class="prog-fill" id="stretch-fill" style="width:0%;transition:none"></div>
        </div>
        <div class="flex-between mt-8" style="font-size:0.8rem;color:var(--ink-faint);font-weight:700">
          <span>Short</span><span>🌟 Stretched!</span>
        </div>
      </div>

      <p id="stretch-msg" style="font-weight:700;color:var(--ink-soft);min-height:24px"></p>
    </div>

    <div class="text-center mt-16">
      <button class="btn btn-primary btn-lg" id="hold-btn" 
        style="width:180px;height:180px;border-radius:50%;font-size:1.1rem;flex-direction:column;gap:8px">
        <span style="font-size:2.5rem">🌈</span>
        <span>Hold & Say!</span>
      </button>
    </div>

    <div class="flex-between mt-24">
      <div class="game-score" id="score">${score} ⭐</div>
      <button class="btn btn-ghost" id="next-btn">Next →</button>
    </div>
  `;

  const holdBtn   = page.querySelector('#hold-btn');
  const fill      = page.querySelector('#stretch-fill');
  const msg       = page.querySelector('#stretch-msg');
  const scoreEl   = page.querySelector('#score');
  let rafId = null;

  function updateBar() {
    if (!held) return;
    const elapsed = Date.now() - holdStart;
    const target  = currentPhrase().target;
    const pct     = Math.min((elapsed / target) * 100, 100);
    fill.style.width = pct + '%';

    if (pct >= 100) {
      clearInterval(holdTimer);
      fill.style.background = 'var(--mint)';
      msg.textContent = '🌟 Perfect stretch!';
      playTone(880, 0.3, 'sine', 0.2);
    }
    rafId = requestAnimationFrame(updateBar);
  }

  holdBtn.addEventListener('pointerdown', () => {
    held = true; holdStart = Date.now();
    fill.style.transition = 'none';
    fill.style.width = '0%';
    fill.style.background = 'linear-gradient(90deg,var(--sky),var(--mint))';
    msg.textContent = 'Strrrretch…';
    playTone(330, 10, 'sine', 0.05);
    rafId = requestAnimationFrame(updateBar);
  });

  holdBtn.addEventListener('pointerup', async () => {
    held = false;
    cancelAnimationFrame(rafId);
    const elapsed = Date.now() - holdStart;
    const target  = currentPhrase().target;

    if (elapsed >= target * 0.85) {
      playSuccess(); praiseToast(); score++;
      scoreEl.textContent = `${score} ⭐`;
      if (score % 3 === 0) { await addCoins(10); await saveState(); toast('🪙 +10 coins!', 'reward'); }
    } else {
      msg.textContent = 'Nice try! Hold a little longer 🐢';
    }
  });
  holdBtn.addEventListener('pointerleave', () => { if (held) holdBtn.dispatchEvent(new Event('pointerup')); });

  page.querySelector('#next-btn').addEventListener('click', () => {
    playClick(); idx++;
    page.querySelector('#phrase').textContent = currentPhrase().text;
    page.querySelector('#hint').textContent = currentPhrase().hint;
    fill.style.width = '0%'; msg.textContent = '';
    fill.style.background = 'linear-gradient(90deg,var(--sky),var(--mint))';
  });
  page.querySelector('#exit-btn').addEventListener('click', () => { playClick(); navigate('games'); });

  return page;
}
