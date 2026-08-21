// js/components/blockReset.js
// The word stretches because *he* is stretching it. Previously the app played
// the animation for him and paid out coins for watching it – he could earn the
// entire shop by tapping one button without making a sound.
import { navigate } from '../modules/router.js';
import { awardRep, saveState, recordPractice, noteBest } from '../modules/state.js';
import { playTone, playSuccess, playClick } from '../modules/audio.js';
import { cancelSpeech } from '../modules/speech.js';
import { playWordModel, stopModel, customWords } from '../modules/myWords.js';
import { acquireMic, releaseMic, isMicSupported, calibrateNoiseFloor, createVoiceTracker } from '../modules/voice.js';
import { createMicPanel } from '../components/micPanel.js';
import { toast, praiseToast } from '../modules/toast.js';

export const POWER_WORDS = [
  'EASY', 'SLOW', 'CALM', 'BREATH', 'SMOOTH',
  'GENTLE', 'SOFT', 'BRAVE', 'STRONG', 'READY'
];

const FULL_STRETCH_MS = 2000;   // sustained voicing for a complete stretch
const MAX_GAP_PX = 22;

export function renderBlockReset() {
  const page = document.createElement('div');
  page.className = 'page';

  let wordIdx = 0, listening = false, micReady = false, loggedToday = false;
  let tracker = null, lastLit = -1;
  // His own words are mixed in ahead of the built-ins: practising with words he
  // chose beats practising with mine.
  let words = [...POWER_WORDS];

  page.innerHTML = `
    <div class="page-header flex-between">
      <h2>Word Stretch ✨</h2>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
    </div>

    <div class="card text-center mb-16">
      <p style="margin-bottom:8px;font-size:0.9rem;color:var(--ink-faint)">Say this word and hold it – your voice pulls it apart!</p>
      <div class="block-reset-word" id="word-letters"></div>
      <div class="prog-bar mt-8" style="height:10px">
        <div class="prog-fill" id="stretch-prog" style="width:0%;transition:none"></div>
      </div>
      <div id="mic-slot"></div>
      <p style="font-size:0.85rem;color:var(--sky);margin-top:8px" id="hint-text">Tap Stretch and hold the sound</p>
    </div>

    <div class="card card-soft text-center mb-16">
      <p style="font-weight:700;font-size:0.95rem">🌟 How to use this:</p>
      <p style="font-size:0.85rem;margin-top:8px">
        If a word feels stuck, take a breath and say it <strong>slowly and stretched out</strong>.
        Your calm voice is already inside you! ✨
      </p>
    </div>

    <div class="action-stack">
      <button class="btn btn-primary btn-lg" id="stretch-btn">🎤 Stretch!</button>
      <div class="action-row">
        <button class="btn btn-ghost" id="model-btn">🔊 Hear it</button>
        <button class="btn btn-ghost" id="next-word-btn">Next Word →</button>
      </div>
    </div>

    <div class="mt-24 card card-lavender text-center" style="display:none" id="praise-box">
      <div style="font-size:2.5rem">🎉</div>
      <p style="font-weight:800;margin-top:8px">Beautiful stretched word!</p>
      <p style="font-size:0.85rem;margin-top:4px" id="praise-detail">That's exactly how calm speakers talk.</p>
    </div>
  `;

  const lettersEl  = page.querySelector('#word-letters');
  const hintText   = page.querySelector('#hint-text');
  const praiseBox  = page.querySelector('#praise-box');
  const praiseNote = page.querySelector('#praise-detail');
  const progFill   = page.querySelector('#stretch-prog');
  const stretchBtn = page.querySelector('#stretch-btn');
  const modelBtn   = page.querySelector('#model-btn');

  const mic = createMicPanel({ status: 'Tap Stretch and I’ll listen 👂' });
  page.querySelector('#mic-slot').appendChild(mic.el);


  function currentWord() { return words[wordIdx]; }

  function loadWord() {
    lettersEl.innerHTML = currentWord().split('').map((l, i) =>
      `<span class="stretch-letter" data-i="${i}">${l}</span>`
    ).join('');
    lettersEl.style.gap = '4px';
    progFill.style.width = '0%';
    hintText.textContent = 'Tap Stretch and hold the sound';
    praiseBox.style.display = 'none';
    lastLit = -1;
    mic.reset();
    mic.setStatus('Tap Stretch and I’ll listen 👂');
  }

  /** Drive the visual straight from how long he has sustained the sound. */
  function applyStretch(voicedMs) {
    const amount = Math.min(voicedMs / FULL_STRETCH_MS, 1);
    lettersEl.style.gap = `${4 + amount * MAX_GAP_PX}px`;
    progFill.style.width = `${amount * 100}%`;

    const letters = lettersEl.querySelectorAll('.stretch-letter');
    const lit = Math.floor(amount * letters.length);
    letters.forEach((l, i) => l.classList.toggle('stretching', i < lit));

    // One soft rising note per letter as his voice reaches it.
    if (lit > lastLit && lit > 0 && lit <= letters.length) {
      playTone(330 + (lit - 1) * 30, 0.2, 'sine', 0.08);
      lastLit = lit;
    }
    return amount;
  }

  async function ensureMic() {
    if (micReady) return true;
    if (!isMicSupported()) return false;
    try {
      await acquireMic();
      mic.setStatus('Listening to the room for a second…');
      await calibrateNoiseFloor(600);
      micReady = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  async function finishTake() {
    listening = false;
    mic.listening(false);
    tracker?.stop();
    stretchBtn.disabled = false;
    stretchBtn.textContent = '🎤 Stretch!';

    const held = tracker?.voicedMs || 0;
    const amount = Math.min(held / FULL_STRETCH_MS, 1);

    if (!tracker?.everVoiced) {
      hintText.textContent = 'I couldn’t hear that one – try a bit closer 🎤';
      mic.setStatus('Ready when you are 💙');
      return;
    }

    if (amount >= 1) {
      playSuccess();
      praiseToast();
      praiseBox.style.display = '';
      praiseNote.textContent = `You held “${currentWord()}” for ${(held / 1000).toFixed(1)} seconds!`;
      hintText.textContent = 'You stretched the whole word! ✨';
      mic.setStatus('That was a lovely long one 🌈', 'good');
      if (!loggedToday) {
        loggedToday = true;
        await recordPractice('word-stretch');
      }
      if (await noteBest('holdMs', held)) {
        toast(`🏅 New best hold: ${(held / 1000).toFixed(1)}s!`, 'reward');
      }
      const coins = await awardRep('word-stretch');
      await saveState();
      if (coins) toast(`🪙 +${coins} coins! So smooth!`, 'reward');
    } else {
      hintText.textContent = `You stretched ${Math.round(amount * 100)}% of it – hold the sound a bit longer 🐢`;
      mic.setStatus('Nearly! Keep the sound going', '');
    }
  }

  async function startTake() {
    if (listening) return;
    playClick();
    cancelSpeech();
    praiseBox.style.display = 'none';
    lastLit = -1;

    const ok = await ensureMic();
    if (!ok) {
      mic.setStatus('No microphone here – stretch it out loud anyway! 💙');
      hintText.textContent = 'Say it slowly and stretched, then tap Next Word.';
      return;
    }

    listening = true;
    mic.listening(true);
    stretchBtn.disabled = true;
    stretchBtn.textContent = 'Listening…';
    hintText.textContent = 'Saaaay it slowly… 🐢';
    mic.setStatus('Go! Hold the sound 🌈', 'good');

    tracker = createVoiceTracker({
      silenceToEndMs: 800,
      onFrame: ({ level, threshold, voicedMs }) => {
        mic.setLevel(level, threshold);
        applyStretch(voicedMs);
      },
      onSettled: finishTake,
    });
    tracker.reset();
    tracker.start();

    setTimeout(() => { if (listening) finishTake(); }, 12000);
  }

  // Pull his words in, then redraw so the first word can already be one of his.
  customWords().then(mine => {
    if (!mine.length) return;
    words = [...mine, ...POWER_WORDS];
    loadWord();
  }).catch(() => { /* built-ins are a fine fallback */ });

  loadWord();

  stretchBtn.addEventListener('click', startTake);

  modelBtn.addEventListener('click', async () => {
    playClick();
    modelBtn.disabled = true;
    mic.setStatus('Hear how long that sound lasts… 🔊');
    const source = await playWordModel(currentWord(), { rate: 0.4 });
    modelBtn.disabled = false;
    mic.setStatus(source === 'own' ? 'That was you! 🎤' : 'Now your turn 👂',
                  source === 'own' ? 'good' : '');
  });

  page.querySelector('#next-word-btn').addEventListener('click', () => {
    playClick();
    cancelSpeech();
    tracker?.stop();
    listening = false;
    mic.listening(false);
    stretchBtn.disabled = false;
    stretchBtn.textContent = '🎤 Stretch!';
    wordIdx = (wordIdx + 1) % words.length;
    loadWord();
  });

  page.querySelector('#exit-btn').addEventListener('click', () => { playClick(); navigate('home'); });

  page.__cleanup = () => {
    tracker?.stop();
    cancelSpeech();
    stopModel();
    if (micReady) releaseMic();
  };

  return page;
}
