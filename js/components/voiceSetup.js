// js/components/voiceSetup.js – "teach the app your voice"
//
// The detection threshold used to be a guess about a generic child on a generic
// device. This measures the actual child: his whisper, his talking voice and his
// roar, so the line between "the room" and "him" sits where it really is. A soft
// speaker stops going undetected, and a loud room stops swallowing him.
//
// Framed as a game rather than a settings screen, because for a six-year-old
// three silly voices are a reason to open the app, and a form is a reason not to.
import { navigate } from '../modules/router.js';
import { state, saveVoiceProfile, addOnsetSample } from '../modules/state.js';
import { playSuccess, playClick, playGentleRamp } from '../modules/audio.js';
import {
  acquireMic, releaseMic, isMicSupported, calibrateNoiseFloor,
  createVoiceTracker, setVoiceProfile, voiceThreshold,
} from '../modules/voice.js';
import { createMicPanel } from '../components/micPanel.js';
import { toast } from '../modules/toast.js';

const STEPS = [
  { key: 'quiet',  icon: '🐭', title: 'Mouse voice',  say: 'Say “hello” as quietly as a tiny mouse', hint: 'Really soft…' },
  { key: 'normal', icon: '🙂', title: 'Normal voice', say: 'Now say “hello” how you usually talk',   hint: 'Just like talking to me' },
  { key: 'loud',   icon: '🦁', title: 'Lion voice',   say: 'ROAR like a lion!',                      hint: 'As big as you like!' },
  { key: 'onset',  icon: '🌱', title: 'Soft start',   say: 'Last one – say “Apple” nice and gently', hint: 'Let it float in' },
];

export function renderVoiceSetup() {
  const page = document.createElement('div');
  page.className = 'page';

  let stepIdx = 0, micReady = false, listening = false, tracker = null;
  let quietRetries = 0;
  const measured = {};

  page.innerHTML = `
    <div class="page-header flex-between">
      <div>
        <h2>Teach me your voice 🎤</h2>
        <p class="subtitle">Three silly voices and we're done</p>
      </div>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
    </div>

    <div class="setup-dots" id="setup-dots"></div>

    <div class="game-arena" id="step-card">
      <div style="font-size:4rem" id="step-icon">${STEPS[0].icon}</div>
      <div class="game-prompt" id="step-title" style="margin:8px 0 4px">${STEPS[0].title}</div>
      <p style="font-weight:700;color:var(--ink-soft)" id="step-say">${STEPS[0].say}</p>
      <p style="font-size:0.85rem;color:var(--sky);font-weight:700;margin-top:4px" id="step-hint">${STEPS[0].hint}</p>
      <div id="mic-slot"></div>
    </div>

    <div class="action-stack mt-16">
      <button class="btn btn-primary btn-lg" id="go-btn">🎤 Ready!</button>
      <div class="action-row">
        <button class="btn btn-ghost" id="skip-btn">Skip setup</button>
      </div>
    </div>

    <div id="result-card" class="card card-mint mt-24 text-center" style="display:none">
      <div style="font-size:2.5rem">🎉</div>
      <p style="font-weight:800;margin-top:8px">Now I know your voice!</p>
      <div class="voice-range" id="voice-range"></div>
      <p style="font-size:0.85rem;margin-top:10px" id="result-note"></p>
      <div class="action-stack mt-16">
        <button class="btn btn-primary" id="done-btn">Let's practise! ✨</button>
        <div class="action-row">
          <button class="btn btn-ghost" id="redo-btn">Do it again</button>
        </div>
      </div>
    </div>
  `;

  const dotsEl   = page.querySelector('#setup-dots');
  const iconEl   = page.querySelector('#step-icon');
  const titleEl  = page.querySelector('#step-title');
  const sayEl    = page.querySelector('#step-say');
  const hintEl   = page.querySelector('#step-hint');
  const goBtn    = page.querySelector('#go-btn');
  const stepCard = page.querySelector('#step-card');
  const resultCard = page.querySelector('#result-card');

  const mic = createMicPanel({ status: 'Tap “Ready!” when you want to start 👂' });
  page.querySelector('#mic-slot').appendChild(mic.el);

  function paintDots() {
    dotsEl.innerHTML = STEPS.map((s, i) =>
      `<span class="setup-dot${i < stepIdx ? ' done' : i === stepIdx ? ' current' : ''}">${i < stepIdx ? '✓' : s.icon}</span>`
    ).join('');
  }

  function paintStep() {
    const s = STEPS[stepIdx];
    iconEl.textContent = s.icon;
    titleEl.textContent = s.title;
    sayEl.textContent = s.say;
    hintEl.textContent = s.hint;
    goBtn.disabled = false;
    goBtn.textContent = '🎤 Ready!';
    mic.reset();
    mic.setStatus('Tap “Ready!” when you want to start 👂');
    paintDots();
  }

  async function ensureMic() {
    if (micReady) return true;
    if (!isMicSupported()) return false;
    try {
      await acquireMic();
      mic.setStatus('Listening to the room for a second…');
      await calibrateNoiseFloor(700);
      micReady = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  function finishStep(levels) {
    listening = false;
    mic.listening(false);
    tracker?.stop();
    goBtn.disabled = false;

    const s = STEPS[stepIdx];

    if (!tracker?.everVoiced || !levels.length) {
      mic.setStatus('I didn’t catch that – have another go 💙');
      goBtn.textContent = '🎤 Try again';
      return;
    }

    if (s.key === 'onset') {
      const onset = tracker.analyzeOnset();
      if (onset) measured.onsetSamples = [onset.riseMs];
    } else {
      // Median of the frames he was actually voicing, so a stray click or a
      // trailing breath doesn't drag the measurement around.
      const sorted = [...levels].sort((a, b) => a - b);
      measured[s.key] = sorted[Math.floor(sorted.length / 2)];
    }

    playSuccess();

    // A mouse voice as loud as his talking voice usually means he was playing
    // rather than whispering. Offer one redo – but only one. Bouncing a child
    // back to step one every time he fails to whisper convincingly is a trap
    // with no exit, and he'd never tell us he was stuck; he'd just stop.
    if (s.key === 'normal' && measured.quiet >= measured.normal * 0.9) {
      if (quietRetries < 1) {
        quietRetries++;
        mic.setStatus('That mouse was a bit loud! Let’s redo the whisper 🐭');
        stepIdx = 0;
        setTimeout(paintStep, 900);
        return;
      }
      // Take him at his word and keep going. The threshold maths clamps to his
      // quiet level anyway, so a close pair costs sensitivity, never function.
      measured.quiet = Math.min(measured.quiet, measured.normal * 0.85);
      mic.setStatus('Got it – that’s your soft voice 🐭');
    }

    stepIdx++;
    if (stepIdx >= STEPS.length) return complete();
    setTimeout(paintStep, 700);
  }

  async function startStep() {
    if (listening) return;
    playClick();

    const ok = await ensureMic();
    if (!ok) {
      mic.setStatus('No microphone here – the app will use its usual settings 💙');
      goBtn.disabled = true;
      return;
    }

    listening = true;
    mic.listening(true);
    goBtn.disabled = true;
    goBtn.textContent = 'Listening…';
    mic.setStatus('Go! 🎤', 'good');

    const levels = [];
    tracker = createVoiceTracker({
      silenceToEndMs: 900,
      onFrame: ({ level, threshold, voicing }) => {
        mic.setLevel(level, threshold);
        if (voicing) levels.push(level);
      },
      onSettled: () => finishStep(levels),
    });
    tracker.reset();
    tracker.start();

    setTimeout(() => { if (listening) finishStep(levels); }, 9000);
  }

  async function complete() {
    stepCard.style.display = 'none';
    page.querySelector('.action-stack').style.display = 'none';
    resultCard.style.display = '';
    paintDots();

    await saveVoiceProfile({
      quiet: measured.quiet,
      normal: measured.normal,
      loud: measured.loud,
    });
    if (measured.onsetSamples?.length) await addOnsetSample(measured.onsetSamples[0]);
    setVoiceProfile(state.voiceProfile);

    const range = page.querySelector('#voice-range');
    const max = Math.max(measured.loud || 0, 0.001);
    range.innerHTML = [
      { icon: '🐭', v: measured.quiet },
      { icon: '🙂', v: measured.normal },
      { icon: '🦁', v: measured.loud },
    ].map(r => `
      <div class="voice-range-row">
        <span class="voice-range-icon">${r.icon}</span>
        <div class="voice-range-track"><div class="voice-range-fill" style="width:${Math.round((r.v / max) * 100)}%"></div></div>
      </div>
    `).join('');

    page.querySelector('#result-note').textContent =
      `I'll listen for anything above your mouse voice, so I won't miss you even when you're quiet.`;

    playGentleRamp(392, 0.4, 0.4, 0.16);
    toast('🎤 Voice setup saved!', 'success');
  }

  goBtn.addEventListener('click', startStep);

  page.querySelector('#skip-btn').addEventListener('click', () => {
    playClick();
    toast('No problem – you can do this any time from Practice 💙');
    navigate('home');
  });

  page.querySelector('#done-btn').addEventListener('click', () => { playClick(); navigate('practice'); });
  page.querySelector('#redo-btn').addEventListener('click', () => {
    playClick();
    stepIdx = 0;
    Object.keys(measured).forEach(k => delete measured[k]);
    resultCard.style.display = 'none';
    stepCard.style.display = '';
    page.querySelector('.action-stack').style.display = '';
    paintStep();
  });

  page.querySelector('#exit-btn').addEventListener('click', () => { playClick(); navigate('home'); });

  paintStep();

  page.__cleanup = () => {
    tracker?.stop();
    if (micReady) releaseMic();
  };

  return page;
}
