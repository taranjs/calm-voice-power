// js/games/gentleOnset.js
// Listens to how the word *starts*. A hard glottal attack slams to full volume
// in a frame or two; an easy onset ramps in. That difference is measurable from
// amplitude alone, which means the child finally gets feedback on the actual
// motor target instead of a button that says "Amazing!" whatever happened.
import { navigate } from '../modules/router.js';
import { state, awardRep, saveState, recordPractice, addOnsetSample } from '../modules/state.js';
import { playSuccess, playClick, playGentleRamp } from '../modules/audio.js';
import { cancelSpeech } from '../modules/speech.js';
import { playWordModel, stopModel, customWords } from '../modules/myWords.js';
import { dailyGentleWords } from '../modules/content.js';
import {
  acquireMic, releaseMic, isMicSupported, calibrateNoiseFloor, createVoiceTracker,
  onsetTargetFrom, ONSET_GOAL_MS,
} from '../modules/voice.js';
import { createMicPanel } from '../components/micPanel.js';
import { toast, praiseToast } from '../modules/toast.js';

const INSTRUCTIONS = [
  'Let the word start very softly – like a feather landing 🪶',
  'Breathe out a little bit first, then gently begin the word',
  'Imagine your voice is a gentle wave starting far away 🌊',
];

const FEEDBACK = {
  gentle: {
    icon: '🪶',
    line: 'Feather-soft start! That’s exactly it.',
    tone: 'good',
  },
  okay: {
    icon: '🌤️',
    line: 'Lovely try – see if you can slide in even softer.',
    tone: '',
  },
  hard: {
    icon: '💙',
    line: 'That one jumped in quickly. Breathe out first, then let the word float in.',
    tone: '',
  },
};

export function renderGentleOnset() {
  const page = document.createElement('div');
  page.className = 'page';

  let score = 0, tries = 0, wordIdx = 0;
  // Only his vowel-initial words join this list. Gentle-onset work targets the
  // hard glottal attack that happens on vowels, so "Pizza" would not serve it.
  let words = dailyGentleWords();
  let listening = false, micReady = false, loggedToday = false;
  let tracker = null;

  page.innerHTML = `
    <div class="page-header flex-between">
      <h2>Gentle Start 🌱</h2>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
    </div>

    <div class="game-arena">
      <p style="font-size:0.85rem;color:var(--sky);font-weight:700;margin-bottom:8px" id="instruction">
        ${INSTRUCTIONS[0]}
      </p>
      <div class="game-prompt" id="word-prompt">${dailyGentleWords()[0]}</div>

      <div class="action-row mb-16">
        <button class="btn btn-ghost" id="ramp-btn" style="font-size:0.85rem">🌬️ Soft start</button>
        <button class="btn btn-ghost" id="model-btn" style="font-size:0.85rem">🔊 The word</button>
      </div>

      <div id="phase-visual" style="margin:8px 0;min-height:80px;display:flex;align-items:center;justify-content:center">
        <div style="font-size:4rem" id="phase-icon">🌬️</div>
      </div>

      <div id="mic-slot"></div>
      <p id="phase-label" style="font-weight:700;color:var(--ink-soft);margin-bottom:8px">Take a soft breath, then say it</p>
      <p id="rise-note" style="font-size:0.8rem;color:var(--ink-faint);min-height:18px"></p>
    </div>

    <div class="action-stack mt-16">
      <button class="btn btn-primary btn-lg" id="action-btn">🎤 My Turn</button>
      <div class="action-row">
        <button class="btn btn-ghost" id="skip-btn">Next word →</button>
      </div>
    </div>

    <div class="flex-between mt-24">
      <div>
        <div class="game-score" id="score">${score}</div>
        <div style="font-size:0.75rem;color:var(--ink-faint);font-weight:700">gentle starts</div>
      </div>
      <div class="card card-sun text-center" style="padding:12px 16px">
        <div style="font-size:0.75rem;font-weight:700;color:var(--sun-warm)">WORD</div>
        <div style="font-family:var(--font-display);font-size:1.4rem" id="word-num">1/${dailyGentleWords().length}</div>
      </div>
    </div>
  `;

  const actionBtn  = page.querySelector('#action-btn');
  const phaseIcon  = page.querySelector('#phase-icon');
  const phaseLabel = page.querySelector('#phase-label');
  const riseNote   = page.querySelector('#rise-note');
  const wordPrompt = page.querySelector('#word-prompt');
  const scoreEl    = page.querySelector('#score');
  const wordNum    = page.querySelector('#word-num');
  const modelBtn   = page.querySelector('#model-btn');
  const rampBtn    = page.querySelector('#ramp-btn');

  const mic = createMicPanel({ status: 'Tap “My Turn” when you’re ready 👂' });
  page.querySelector('#mic-slot').appendChild(mic.el);


  function currentWord() { return words[wordIdx]; }

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
    actionBtn.disabled = false;
    actionBtn.textContent = '🎤 My Turn';

    if (!tracker?.everVoiced) {
      phaseIcon.textContent = '🎤';
      phaseLabel.textContent = 'I couldn’t quite hear that one';
      riseNote.textContent = '';
      mic.setStatus('Come a little closer and try again 💙');
      return;
    }

    // Hold him to his own current goal, which sits a little beyond where he
    // actually is and moves as he improves – not to a number picked by ear.
    const goalMs = onsetTargetFrom(state.voiceProfile.onsetSamples);
    const onset = tracker.analyzeOnset({ gentleMs: goalMs });
    const quality = onset?.quality || 'okay';
    const fb = FEEDBACK[quality];

    tries++;
    if (onset) await addOnsetSample(onset.riseMs);

    phaseIcon.textContent = fb.icon;
    phaseLabel.textContent = fb.line;
    riseNote.textContent = onset
      ? `Your start took ${onset.riseMs}ms to build up · aiming for ${goalMs}ms${goalMs < ONSET_GOAL_MS ? '' : ' 🏅'}`
      : '';
    mic.setStatus(quality === 'gentle' ? 'That was a soft one 🪶' : 'Good try – have another go', fb.tone);

    if (quality === 'gentle') {
      score++;
      scoreEl.textContent = score;
      playSuccess();
      praiseToast();
      await award();
    } else {
      // No penalty, no red, no sad sound – just the cue and another turn.
      playGentleRamp(294, 0.5, 0.3, 0.14);
    }
  }

  async function award() {
    if (!loggedToday) {
      loggedToday = true;
      await recordPractice('gentle-onset');
    }
    const coins = await awardRep('gentle-onset');
    await saveState();
    if (coins) toast(`🪙 +${coins} coins!`, 'reward');
  }

  async function startTake() {
    if (listening) return;
    listening = true;                 // claim before awaiting the mic
    actionBtn.disabled = true;
    playClick();
    cancelSpeech();
    riseNote.textContent = '';

    const ok = await ensureMic();
    if (!ok) {
      listening = false;
      actionBtn.disabled = false;
      mic.setStatus('No microphone here – practise out loud anyway! 💙');
      phaseLabel.textContent = 'Say it gently, then tap Next word.';
      return;
    }

    listening = true;
    mic.listening(true);
    actionBtn.disabled = true;
    actionBtn.textContent = 'Listening…';
    phaseIcon.textContent = '😮';
    phaseLabel.textContent = `Breathe out… then say “${currentWord()}”`;
    mic.setStatus('Go whenever you’re ready 🌱', 'good');

    tracker = createVoiceTracker({
      silenceToEndMs: 800,
      onFrame: ({ level, threshold }) => mic.setLevel(level, threshold),
      onSettled: finishTake,
    });
    tracker.reset();
    tracker.start();

    setTimeout(() => { if (listening) finishTake(); }, 10000);
  }

  function loadWord() {
    wordPrompt.textContent = currentWord();
    wordNum.textContent = `${wordIdx + 1}/${words.length}`;
    page.querySelector('#instruction').textContent =
      INSTRUCTIONS[Math.floor(Math.random() * INSTRUCTIONS.length)];
    phaseIcon.textContent = '🌬️';
    phaseLabel.textContent = 'Take a soft breath, then say it';
    riseNote.textContent = '';
    mic.reset();
    mic.setStatus('Tap “My Turn” when you’re ready 👂');
  }

  // Mix in any of his own words that start on a vowel sound.
  customWords({ vowelInitial: true }).then(mine => {
    if (!mine.length) return;
    words = [...mine, ...dailyGentleWords()];
    wordIdx = 0;
    loadWord();
  }).catch(() => { /* built-ins are a fine fallback */ });

  actionBtn.addEventListener('click', startTake);

  rampBtn.addEventListener('click', () => {
    playClick();
    mic.setStatus('Hear how it fades in instead of banging in? 🌬️');
    playGentleRamp();
  });

  modelBtn.addEventListener('click', async () => {
    playClick();
    modelBtn.disabled = true;
    const source = await playWordModel(currentWord(), { rate: 0.6 });
    modelBtn.disabled = false;
    if (source === 'own') mic.setStatus('That was your own voice! 🎤', 'good');
  });

  page.querySelector('#skip-btn').addEventListener('click', () => {
    playClick();
    cancelSpeech();
    tracker?.stop();
    listening = false;
    mic.listening(false);
    actionBtn.disabled = false;
    actionBtn.textContent = '🎤 My Turn';
    wordIdx = (wordIdx + 1) % words.length;
    loadWord();
  });

  page.querySelector('#exit-btn').addEventListener('click', () => { playClick(); navigate('games'); });

  page.__cleanup = () => {
    tracker?.stop();
    cancelSpeech();
    stopModel();
    if (micReady) releaseMic();
  };

  return page;
}
