// js/components/pacingDots.js
// The metronome still sets the pace – that's the therapeutic point – but the
// score now comes from whether he actually voiced each beat. Previously the
// words played themselves and paid out coins with no input at all.
//
// The tempo can now go *faster* as well as slower. Fading the metronome toward
// natural speech is the goal; the old version could only get more robotic.
import { navigate } from '../modules/router.js';
import { state, awardRep, saveState, recordPractice, noteBest } from '../modules/state.js';
import { playDot, playSuccess, playClick } from '../modules/audio.js';
import { speakModel, cancelSpeech, isSpeechSupported } from '../modules/speech.js';
import { acquireMic, releaseMic, isMicSupported, calibrateNoiseFloor, createVoiceTracker } from '../modules/voice.js';
import { createMicPanel } from '../components/micPanel.js';
import { dailyPacingSets } from '../modules/content.js';
import { toast, praiseToast } from '../modules/toast.js';

const WORD_SETS = dailyPacingSets();

const SLOWEST = 1600, FASTEST = 500, STEP = 150;
const HIT_GRACE_MS = 220;   // voice counts if it lands near the beat

export function renderPacingDots() {
  const page = document.createElement('div');
  page.className = 'page';

  let setIdx = 0, wordIdx = 0, speed = 1000;
  let running = false, micReady = false, loggedToday = false;
  let tracker = null, paceTimer = null;
  let dotIdx = 0, hits = 0, voicedThisBeat = false, streak = 0;

  function set()   { return WORD_SETS[setIdx]; }
  function word()  { return set().words[wordIdx]; }
  function parts() { return word().split('-'); }

  page.innerHTML = `
    <div class="page-header flex-between">
      <h2>Pacing Dots 🎵</h2>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
    </div>
    <p class="text-center" style="margin-bottom:12px">Say each part out loud as its dot lights up!</p>

    <div class="card text-center mb-16">
      <div class="word-display" id="word-display"></div>
      <div class="pacing-dots" id="pacing-dots"></div>
      <div id="mic-slot"></div>
      <p style="font-size:0.9rem;font-weight:700;min-height:22px" id="pace-msg"></p>
    </div>

    <div class="tempo-row mb-16">
      <button class="btn btn-ghost" id="slower-btn">🐢 Slower</button>
      <div class="tempo-read"><span id="tempo-val">60</span><span class="tempo-unit">beats/min</span></div>
      <button class="btn btn-ghost" id="faster-btn">🐇 Faster</button>
    </div>

    <div class="action-stack">
      <button class="btn btn-primary btn-lg" id="start-btn">🎤 Start</button>
      <div class="action-row">
        <button class="btn btn-ghost" id="model-btn">🔊 Hear it</button>
        <button class="btn btn-ghost" id="next-btn">Next Word →</button>
      </div>
    </div>

    <div class="mt-24">
      <div class="flex-between mb-8">
        <span class="section-title" style="margin-bottom:0">Level</span>
        <div style="display:flex;gap:8px" id="level-row">
          ${WORD_SETS.map((_, i) => `<button class="pill pill-sky level-btn" data-level="${i}" style="cursor:pointer">${i + 1}</button>`).join('')}
        </div>
      </div>
      <p style="font-size:0.8rem;color:var(--ink-faint);text-align:right" id="best-note"></p>
    </div>
  `;

  const wordEl   = page.querySelector('#word-display');
  const dotsEl   = page.querySelector('#pacing-dots');
  const msgEl    = page.querySelector('#pace-msg');
  const startBtn = page.querySelector('#start-btn');
  const modelBtn = page.querySelector('#model-btn');
  const tempoVal = page.querySelector('#tempo-val');
  const bestNote = page.querySelector('#best-note');

  const mic = createMicPanel({ status: 'Tap Start and say it with the dots 👂' });
  page.querySelector('#mic-slot').appendChild(mic.el);

  if (!isSpeechSupported()) modelBtn.style.display = 'none';

  function paintTempo() {
    tempoVal.textContent = Math.round(60000 / speed);
    page.querySelector('#slower-btn').disabled = speed >= SLOWEST;
    page.querySelector('#faster-btn').disabled = speed <= FASTEST;
  }

  function paintBest() {
    bestNote.textContent = state.bests?.pacedWords
      ? `Best run: ${state.bests.pacedWords} words in a row`
      : '';
  }

  function loadWord() {
    wordEl.innerHTML = parts()
      .map((p, i) => `<span class="syllable" data-syl="${i}">${p}</span>`)
      .join('<span style="opacity:0.3"> · </span>');
    dotsEl.innerHTML = parts()
      .map((_, i) => `<div class="pacing-dot" data-dot="${i}">•</div>`).join('');
    msgEl.textContent = '';
    dotIdx = 0; hits = 0;
    mic.reset();
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

  function paintBeat() {
    dotsEl.querySelectorAll('.pacing-dot').forEach((d, i) => {
      d.classList.toggle('active', i === dotIdx);
    });
    wordEl.querySelectorAll('.syllable').forEach((s, i) => {
      s.classList.toggle('active', i === dotIdx);
    });
    playDot();
  }

  /** Called when a beat's window closes: did he say anything during it? */
  function scoreBeat() {
    const dot = dotsEl.querySelector(`[data-dot="${dotIdx}"]`);
    if (voicedThisBeat) {
      hits++;
      dot?.classList.add('spoken');
    } else {
      dot?.classList.add('missed');
    }
    voicedThisBeat = false;
  }

  async function finishWord() {
    clearInterval(paceTimer);
    running = false;
    mic.listening(false);
    tracker?.stop();
    startBtn.disabled = false;
    startBtn.textContent = '🎤 Start';
    dotsEl.querySelectorAll('.pacing-dot').forEach(d => d.classList.remove('active'));
    wordEl.querySelectorAll('.syllable').forEach(s => s.classList.remove('active'));

    const total = parts().length;

    if (hits === 0) {
      streak = 0;
      msgEl.textContent = 'I couldn’t hear you – a bit closer and try again 💙';
      mic.setStatus('Ready when you are 🎤');
      return;
    }

    if (hits >= total) {
      streak++;
      msgEl.textContent = `🌟 All ${total} parts, right on the beat!`;
      mic.setStatus('Beautifully paced 🎵', 'good');
      playSuccess(); praiseToast();
      if (await noteBest('pacedWords', streak)) {
        toast(`🏅 New best: ${streak} words in a row!`, 'reward');
      }
      paintBest();
      if (!loggedToday) { loggedToday = true; await recordPractice('pacing-dots'); }
      const coins = await awardRep('pacing-dots', 4);
      await saveState();
      if (coins) toast(`🪙 +${coins} coins!`, 'reward');
    } else {
      streak = 0;
      msgEl.textContent = `You caught ${hits} of ${total} – try saying each part as its dot lights 🐢`;
      mic.setStatus('Good try – go again', '');
    }
  }

  async function start() {
    if (running) return;
    running = true;                   // claim before awaiting the mic
    startBtn.disabled = true;
    playClick();
    cancelSpeech();

    const ok = await ensureMic();
    if (!ok) {
      running = false;
      startBtn.disabled = false;
      mic.setStatus('No microphone here – say it along anyway! 💙');
      return;
    }

    loadWord();
    running = true;
    voicedThisBeat = false;
    mic.listening(true);
    startBtn.disabled = true;
    startBtn.textContent = 'Listening…';
    mic.setStatus('Say each part as it lights 🎵', 'good');

    tracker = createVoiceTracker({
      silenceToEndMs: 60000,     // we control the round length, not silence
      onFrame: ({ level, threshold, voicing }) => {
        mic.setLevel(level, threshold);
        if (voicing) voicedThisBeat = true;
      },
    });
    tracker.reset();
    tracker.start();

    dotIdx = 0;
    paintBeat();
    paceTimer = setInterval(() => {
      scoreBeat();
      dotIdx++;
      if (dotIdx >= parts().length) {
        // Let a late syllable still land before closing the round.
        setTimeout(finishWord, HIT_GRACE_MS);
        clearInterval(paceTimer);
        return;
      }
      paintBeat();
    }, speed);
  }

  function stop() {
    clearInterval(paceTimer);
    tracker?.stop();
    running = false;
    mic.listening(false);
    startBtn.disabled = false;
    startBtn.textContent = '🎤 Start';
  }

  startBtn.addEventListener('click', start);

  modelBtn.addEventListener('click', async () => {
    playClick();
    modelBtn.disabled = true;
    await speakModel(word(), { rate: 0.5 });
    modelBtn.disabled = false;
  });

  page.querySelector('#next-btn').addEventListener('click', () => {
    playClick(); stop();
    wordIdx = (wordIdx + 1) % set().words.length;
    loadWord();
  });

  page.querySelector('#slower-btn').addEventListener('click', () => {
    playClick();
    speed = Math.min(speed + STEP, SLOWEST);
    paintTempo();
  });
  page.querySelector('#faster-btn').addEventListener('click', () => {
    playClick();
    speed = Math.max(speed - STEP, FASTEST);
    paintTempo();
  });

  page.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playClick(); stop();
      setIdx = parseInt(btn.dataset.level, 10);
      wordIdx = 0;
      loadWord();
      page.querySelectorAll('.level-btn').forEach(b => b.classList.remove('level-on'));
      btn.classList.add('level-on');
    });
  });
  page.querySelector('.level-btn').classList.add('level-on');

  page.querySelector('#exit-btn').addEventListener('click', () => { playClick(); stop(); navigate('home'); });

  loadWord();
  paintTempo();
  paintBest();

  page.__cleanup = () => {
    clearInterval(paceTimer);
    tracker?.stop();
    cancelSpeech();
    if (micReady) releaseMic();
  };

  return page;
}
