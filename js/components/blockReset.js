// js/components/blockReset.js
import { navigate } from '../modules/router.js';
import { addCoins, saveState } from '../modules/state.js';
import { playTone, playSuccess, playClick } from '../modules/audio.js';
import { toast, praiseToast } from '../modules/toast.js';

const POWER_WORDS = [
  'EASY', 'SLOW', 'CALM', 'BREATH', 'SMOOTH',
  'GENTLE', 'SOFT', 'BRAVE', 'STRONG', 'READY'
];

export function renderBlockReset() {
  const page = document.createElement('div');
  page.className = 'page';
  let wordIdx = 0, stretching = false;

  page.innerHTML = `
    <div class="page-header flex-between">
      <h2>Word Stretch ✨</h2>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
    </div>

    <div class="card text-center mb-16">
      <p style="margin-bottom:8px;font-size:0.9rem;color:var(--ink-faint)">Stretch this word out like taffy!</p>
      <div class="block-reset-word" id="word-letters"></div>
      <p style="font-size:0.85rem;color:var(--sky);margin-top:8px" id="hint-text">Tap STRETCH to begin</p>
    </div>

    <div class="card card-soft text-center mb-16">
      <p style="font-weight:700;font-size:0.95rem">🌟 How to use this:</p>
      <p style="font-size:0.85rem;margin-top:8px">
        If a word feels stuck, take a breath and say it <strong>slowly and stretched out</strong>.
        Your calm voice is already inside you! ✨
      </p>
    </div>

    <div class="flex-center gap-12 flex-wrap">
      <button class="btn btn-primary btn-lg" id="stretch-btn">🌈 Stretch!</button>
      <button class="btn btn-ghost" id="next-word-btn">Next Word →</button>
    </div>

    <div class="mt-24 card card-lavender text-center" style="display:none" id="praise-box">
      <div style="font-size:2.5rem">🎉</div>
      <p style="font-weight:800;margin-top:8px">Beautiful stretched word!</p>
      <p style="font-size:0.85rem;margin-top:4px">That's exactly how calm speakers talk.</p>
    </div>
  `;

  function loadWord() {
    const word = POWER_WORDS[wordIdx];
    const lettersEl = page.querySelector('#word-letters');
    lettersEl.innerHTML = word.split('').map((l, i) =>
      `<span class="stretch-letter" data-i="${i}" style="transition-delay:${i*0.06}s">${l}</span>`
    ).join('');
    page.querySelector('#hint-text').textContent = 'Tap STRETCH to begin';
    page.querySelector('#praise-box').style.display = 'none';
    stretching = false;
  }

  async function doStretch() {
    if (stretching) return;
    stretching = true;
    playClick();
    const letters = page.querySelectorAll('.stretch-letter');

    // Animate one by one with tone
    letters.forEach((l, i) => {
      setTimeout(() => {
        l.classList.add('stretching');
        playTone(330 + i * 30, 0.25, 'sine', 0.12);
      }, i * 150);
    });

    page.querySelector('#hint-text').textContent = 'Saaaay it slowly… 🐢';

    setTimeout(async () => {
      letters.forEach(l => l.classList.remove('stretching'));
      playSuccess();
      praiseToast();
      page.querySelector('#praise-box').style.display = '';
      await addCoins(5); await saveState();
      toast('🪙 +5 coins! So smooth!', 'reward');
      stretching = false;
    }, letters.length * 150 + 1800);
  }

  loadWord();

  page.querySelector('#stretch-btn').addEventListener('click', doStretch);
  page.querySelector('#next-word-btn').addEventListener('click', () => {
    playClick();
    wordIdx = (wordIdx + 1) % POWER_WORDS.length;
    loadWord();
  });
  page.querySelector('#exit-btn').addEventListener('click', () => { playClick(); navigate('home'); });

  return page;
}
