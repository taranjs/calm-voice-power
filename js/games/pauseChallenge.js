// js/games/pauseChallenge.js
// A pause is silence between two pieces of speech. This used to measure the gap
// between two button taps, which a child could produce perfectly while sitting
// in silence – the one game whose whole subject the app was not listening to.
// Now it hears him speak, hears him stop, and times the actual quiet.
import { navigate } from '../modules/router.js';
import { state, awardRep, saveState, recordPractice, noteBest } from '../modules/state.js';
import { playTone, playSuccess, playClick } from '../modules/audio.js';
import { speakModel, cancelSpeech, isSpeechSupported } from '../modules/speech.js';
import { acquireMic, releaseMic, isMicSupported, calibrateNoiseFloor, createVoiceTracker } from '../modules/voice.js';
import { createMicPanel } from '../components/micPanel.js';
import { toast, praiseToast } from '../modules/toast.js';

const SENTENCES = [
  { text: 'I am … so happy … today!',     pauses: 2, target: 800 },
  { text: 'My name … is … very cool!',    pauses: 2, target: 800 },
  { text: 'I like … cats … and dogs!',    pauses: 2, target: 700 },
  { text: 'Take a … big … deep breath!',  pauses: 2, target: 900 },
  { text: 'Today I … went to … the park!',pauses: 2, target: 800 },
  { text: 'Can I … please have … a turn?',pauses: 2, target: 800 },
];

// How long he must stay quiet after speaking before it counts as a real pause.
// Deliberately forgiving: the point is noticing the pause, not hitting a stopwatch.
const ROUND_TIMEOUT_MS = 25000;

export function renderPauseChallenge() {
  const page = document.createElement('div');
  page.className = 'page';

  let idx = 0, score = 0, pausesDone = 0;
  let listening = false, micReady = false, loggedToday = false;
  let tracker = null, spokenYet = false, creditedThisSilence = false;
  let longestPause = 0, roundTimer = null;

  function cur() { return SENTENCES[idx % SENTENCES.length]; }

  page.innerHTML = `
    <div class="page-header flex-between">
      <h2>Pause Power ⏸️</h2>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
    </div>

    <div class="card text-center mb-16">
      <p style="font-size:0.85rem;color:var(--ink-faint);margin-bottom:8px">Say the sentence out loud. Stop for a moment at each …</p>
      <div class="game-prompt" id="sentence" style="font-size:1.4rem;line-height:1.8"></div>
      <div class="action-row mt-12">
        <button class="btn btn-ghost" id="model-btn" style="font-size:0.85rem">🔊 Hear it</button>
      </div>
    </div>

    <div class="game-arena text-center">
      <div style="font-size:4.5rem;margin-bottom:8px" id="pause-icon">🎙️</div>
      <p style="font-weight:700;font-size:1.05rem" id="pause-msg">Tap below and start talking</p>

      <div class="pause-hold" id="pause-hold" aria-hidden="true">
        <div class="pause-hold-fill" id="pause-hold-fill" style="width:0%"></div>
      </div>

      <div style="display:flex;gap:8px;justify-content:center;margin:12px 0" id="pause-dots"></div>
      <div id="mic-slot"></div>
    </div>

    <div class="action-stack mt-16">
      <button class="btn btn-primary btn-lg" id="start-btn">🎤 Start Talking</button>
      <div class="action-row">
        <button class="btn btn-ghost" id="next-btn">Next sentence →</button>
      </div>
    </div>

    <div class="flex-between mt-24">
      <div>
        <div class="game-score" id="score">${score} 🎯</div>
        <div style="font-size:0.75rem;color:var(--ink-faint);font-weight:700">pauses held</div>
      </div>
      <div class="card card-lavender text-center" style="padding:12px 16px">
        <div style="font-size:0.75rem;font-weight:700;color:var(--lavender)">LONGEST</div>
        <div style="font-family:var(--font-display);font-size:1.4rem" id="longest">–</div>
      </div>
    </div>
  `;

  const startBtn  = page.querySelector('#start-btn');
  const iconEl    = page.querySelector('#pause-icon');
  const msgEl     = page.querySelector('#pause-msg');
  const holdFill  = page.querySelector('#pause-hold-fill');
  const scoreEl   = page.querySelector('#score');
  const longestEl = page.querySelector('#longest');
  const modelBtn  = page.querySelector('#model-btn');

  const mic = createMicPanel({ status: 'Tap Start and say the sentence 👂' });
  page.querySelector('#mic-slot').appendChild(mic.el);

  if (!isSpeechSupported()) modelBtn.style.display = 'none';

  function loadSentence() {
    const s = cur();
    page.querySelector('#sentence').textContent = s.text;
    pausesDone = 0;
    page.querySelector('#pause-dots').innerHTML =
      Array.from({ length: s.pauses }, (_, i) => `<div class="pacing-dot" data-p="${i}">⏸️</div>`).join('');
    iconEl.textContent = '🎙️';
    msgEl.textContent = 'Tap below and start talking';
    holdFill.style.width = '0%';
    mic.reset();
    mic.setStatus('Tap Start and say the sentence 👂');
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
    } catch (e) { return false; }
  }

  function creditPause(heldMs) {
    const s = cur();
    const dot = page.querySelector(`[data-p="${pausesDone}"]`);
    if (dot) { dot.textContent = '✅'; dot.classList.add('spoken'); }
    pausesDone++;
    score++;
    scoreEl.textContent = `${score} 🎯`;
    longestPause = Math.max(longestPause, heldMs);
    longestEl.textContent = `${(longestPause / 1000).toFixed(1)}s`;
    playTone(660, 0.15);

    iconEl.textContent = '⏸️';
    msgEl.textContent = pausesDone >= s.pauses
      ? '🌟 Sentence complete!'
      : `Lovely pause! ${s.pauses - pausesDone} more to go`;
  }

  function onFrame({ level, threshold, voicing, silenceMs, everVoiced }) {
    mic.setLevel(level, threshold);
    const s = cur();

    if (voicing) {
      spokenYet = true;
      creditedThisSilence = false;
      holdFill.style.width = '0%';
      if (pausesDone < s.pauses) {
        iconEl.textContent = '🗣️';
        msgEl.textContent = 'Great – now stop for a moment at the …';
      }
      return;
    }

    if (!spokenYet || !everVoiced) return;

    // Growing bar while he holds the quiet, so the pause itself is the thing
    // on screen rather than a button he pressed.
    holdFill.style.width = `${Math.min((silenceMs / s.target) * 100, 100)}%`;

    if (!creditedThisSilence && silenceMs >= s.target && pausesDone < s.pauses) {
      creditedThisSilence = true;
      creditPause(silenceMs);
    }
  }

  async function finishRound() {
    if (!listening) return;
    listening = false;
    clearTimeout(roundTimer);
    mic.listening(false);
    tracker?.stop();
    startBtn.disabled = false;
    startBtn.textContent = '🎤 Start Talking';
    holdFill.style.width = '0%';

    if (!spokenYet) {
      iconEl.textContent = '🎤';
      msgEl.textContent = 'I couldn’t hear you – have another go 💙';
      mic.setStatus('Come a little closer 🎤');
      return;
    }

    const s = cur();
    if (pausesDone >= s.pauses) {
      iconEl.textContent = '🌟';
      playSuccess(); praiseToast();
      mic.setStatus('You paused like a pro ⏸️', 'good');
      await noteBest('pauseMs', longestPause);
      if (!loggedToday) { loggedToday = true; await recordPractice('pause-power'); }
      const coins = await awardRep('pause-power');
      await saveState();
      if (coins) toast(`🪙 +${coins} coins!`, 'reward');
    } else {
      msgEl.textContent = `You held ${pausesDone} of ${s.pauses} pauses – try stopping a little longer 🐢`;
      mic.setStatus('Nearly! A slightly longer stop', '');
    }
  }

  async function startRound() {
    if (listening) return;
    playClick();
    cancelSpeech();

    const ok = await ensureMic();
    if (!ok) {
      mic.setStatus('No microphone here – say it out loud anyway! 💙');
      msgEl.textContent = 'Say the sentence with a stop at each …';
      return;
    }

    listening = true;
    spokenYet = false;
    creditedThisSilence = false;
    pausesDone = 0;
    loadSentenceDots();
    mic.listening(true);
    startBtn.disabled = true;
    startBtn.textContent = 'Listening…';
    iconEl.textContent = '🗣️';
    msgEl.textContent = 'Off you go!';
    mic.setStatus('Say the sentence 🎤', 'good');

    tracker = createVoiceTracker({
      silenceToEndMs: 3200,      // long enough to hold a pause without ending
      onFrame,
      onSettled: finishRound,
    });
    tracker.reset();
    tracker.start();
    roundTimer = setTimeout(finishRound, ROUND_TIMEOUT_MS);
  }

  function loadSentenceDots() {
    const s = cur();
    page.querySelector('#pause-dots').innerHTML =
      Array.from({ length: s.pauses }, (_, i) => `<div class="pacing-dot" data-p="${i}">⏸️</div>`).join('');
  }

  startBtn.addEventListener('click', startRound);

  modelBtn.addEventListener('click', async () => {
    playClick();
    modelBtn.disabled = true;
    mic.setStatus('Listen for the stops… 🔊');
    await speakModel(cur().text, { rate: 0.5 });
    modelBtn.disabled = false;
    mic.setStatus('Now your turn 👂');
  });

  page.querySelector('#next-btn').addEventListener('click', () => {
    playClick();
    cancelSpeech();
    clearTimeout(roundTimer);
    tracker?.stop();
    listening = false;
    mic.listening(false);
    startBtn.disabled = false;
    startBtn.textContent = '🎤 Start Talking';
    idx++;
    loadSentence();
  });

  page.querySelector('#exit-btn').addEventListener('click', () => { playClick(); navigate('games'); });

  loadSentence();
  longestEl.textContent = state.bests?.pauseMs ? `${(state.bests.pauseMs / 1000).toFixed(1)}s` : '–';
  longestPause = state.bests?.pauseMs || 0;

  page.__cleanup = () => {
    clearTimeout(roundTimer);
    tracker?.stop();
    cancelSpeech();
    if (micReady) releaseMic();
  };

  return page;
}
