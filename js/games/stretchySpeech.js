// js/games/stretchySpeech.js
// The bar fills from *sustained voice*, not from how long a button is held.
// Silence moves nothing, so there is no way to score without speaking.
import { navigate } from '../modules/router.js';
import { awardRep, saveState, recordPractice, noteBest } from '../modules/state.js';
import { playSuccess, playClick } from '../modules/audio.js';
import { speakModel, cancelSpeech, isSpeechSupported } from '../modules/speech.js';
import { acquireMic, releaseMic, isMicSupported, calibrateNoiseFloor, createVoiceTracker } from '../modules/voice.js';
import { createMicPanel } from '../components/micPanel.js';
import { dailyStretchPhrases } from '../modules/content.js';
import { toast, praiseToast } from '../modules/toast.js';

const PHRASES = dailyStretchPhrases();

export function renderStretchySpeech() {
  const page = document.createElement('div');
  page.className = 'page';

  let idx = 0, score = 0, listening = false, micReady = false, loggedToday = false;
  let tracker = null;

  function currentPhrase() { return PHRASES[idx % PHRASES.length]; }

  page.innerHTML = `
    <div class="page-header flex-between">
      <h2>Stretchy Speech 🌈</h2>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
    </div>

    <div class="game-arena">
      <p style="font-size:0.85rem;color:var(--sky);font-weight:700;margin-bottom:4px" id="hint">${currentPhrase().hint}</p>
      <div class="game-prompt" id="phrase">${currentPhrase().text}</div>

      <button class="btn btn-ghost" id="model-btn" style="min-height:42px;padding:8px 18px;font-size:0.9rem">
        🔊 Hear it stretched
      </button>

      <div id="stretch-bar-wrap" style="margin:20px 0">
        <div class="prog-bar" style="height:20px;border-radius:10px">
          <div class="prog-fill" id="stretch-fill" style="width:0%;transition:none"></div>
        </div>
        <div class="flex-between mt-8" style="font-size:0.8rem;color:var(--ink-faint);font-weight:700">
          <span>Short</span><span>🌟 Stretched!</span>
        </div>
      </div>

      <div id="mic-slot"></div>
      <p id="stretch-msg" style="font-weight:700;color:var(--ink-soft);min-height:24px"></p>
    </div>

    <div class="text-center mt-16">
      <button class="btn btn-primary btn-lg" id="go-btn"
        style="width:180px;height:180px;border-radius:50%;font-size:1.1rem;flex-direction:column;gap:8px">
        <span style="font-size:2.5rem">🌈</span>
        <span>My Turn!</span>
      </button>
    </div>

    <div class="flex-between mt-24">
      <div class="game-score" id="score">${score} ⭐</div>
      <button class="btn btn-ghost" id="next-btn">Next →</button>
    </div>
  `;

  const goBtn    = page.querySelector('#go-btn');
  const fill     = page.querySelector('#stretch-fill');
  const msg      = page.querySelector('#stretch-msg');
  const scoreEl  = page.querySelector('#score');
  const modelBtn = page.querySelector('#model-btn');

  const mic = createMicPanel({ status: 'Tap “My Turn!” and I’ll listen 👂' });
  page.querySelector('#mic-slot').appendChild(mic.el);

  if (!isSpeechSupported()) modelBtn.style.display = 'none';

  function setBar(pct, colour) {
    fill.style.width = Math.min(pct, 100) + '%';
    if (colour) fill.style.background = colour;
  }

  function resetBar() {
    setBar(0, 'linear-gradient(90deg,var(--sky),var(--mint))');
    msg.textContent = '';
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
    } catch (e) {
      return false;
    }
  }

  function finishTake() {
    listening = false;
    mic.listening(false);
    tracker?.stop();
    goBtn.disabled = false;
    goBtn.querySelector('span:last-child').textContent = 'My Turn!';

    const target = currentPhrase().target;
    const held = tracker?.voicedMs || 0;

    if (!tracker?.everVoiced) {
      // Never a failure state – the app just couldn't hear him.
      mic.setStatus('I couldn’t quite hear that – come a bit closer 🎤');
      msg.textContent = 'Have another go whenever you’re ready 💙';
      return;
    }

    if (held >= target * 0.85) {
      setBar(100, 'var(--mint)');
      playSuccess(); praiseToast();
      score++;
      scoreEl.textContent = `${score} ⭐`;
      msg.textContent = `🌟 You held that for ${(held / 1000).toFixed(1)} seconds!`;
      mic.setStatus('Beautiful long sound 🌈', 'good');
      awardIfDue(held);
    } else {
      msg.textContent = `Nice try! You held it ${(held / 1000).toFixed(1)}s – aim for ${(target / 1000).toFixed(1)}s 🐢`;
      mic.setStatus('Try letting the sound float a little longer');
    }
  }

  async function awardIfDue(held) {
    if (!loggedToday) {
      loggedToday = true;
      await recordPractice('stretchy-speech');
    }
    if (await noteBest('holdMs', held)) {
      toast(`🏅 New best hold: ${(held / 1000).toFixed(1)}s!`, 'reward');
    }
    const coins = await awardRep('stretchy-speech');
    await saveState();
    if (coins) toast(`🪙 +${coins} coins!`, 'reward');
  }

  async function startTake() {
    if (listening) return;
    listening = true;                 // claim before awaiting the mic
    goBtn.disabled = true;
    playClick();
    cancelSpeech();
    resetBar();

    const ok = await ensureMic();
    if (!ok) {
      listening = false;
      goBtn.disabled = false;
      mic.setStatus('No microphone here – you can still practise out loud! 💙');
      msg.textContent = 'Say it stretched anyway, then tap Next.';
      return;
    }

    listening = true;
    mic.listening(true);
    goBtn.disabled = true;
    goBtn.querySelector('span:last-child').textContent = 'Go!';
    mic.setStatus('Go – stretch it out! 🌈', 'good');
    msg.textContent = 'Strrrretch…';

    tracker = createVoiceTracker({
      silenceToEndMs: 900,
      onFrame: ({ level, threshold, voicedMs }) => {
        mic.setLevel(level, threshold);
        setBar((voicedMs / currentPhrase().target) * 100);
      },
      onSettled: finishTake,
    });
    tracker.reset();
    tracker.start();

    // Safety net if he goes quiet without the tracker settling.
    setTimeout(() => { if (listening) finishTake(); }, 12000);
  }

  goBtn.addEventListener('click', startTake);

  modelBtn.addEventListener('click', async () => {
    playClick();
    modelBtn.disabled = true;
    mic.setStatus('Listen to how long the sound lasts… 🔊');
    await speakModel(currentPhrase().text, { rate: 0.45 });
    modelBtn.disabled = false;
    mic.setStatus('Now your turn – tap “My Turn!” 👂');
  });

  page.querySelector('#next-btn').addEventListener('click', () => {
    playClick();
    cancelSpeech();
    tracker?.stop();
    listening = false;
    mic.listening(false);
    goBtn.disabled = false;
    idx++;
    page.querySelector('#phrase').textContent = currentPhrase().text;
    page.querySelector('#hint').textContent   = currentPhrase().hint;
    resetBar();
    mic.setStatus('Tap “My Turn!” and I’ll listen 👂');
  });

  page.querySelector('#exit-btn').addEventListener('click', () => { playClick(); navigate('games'); });

  page.__cleanup = () => {
    tracker?.stop();
    cancelSpeech();
    if (micReady) releaseMic();
  };

  return page;
}
