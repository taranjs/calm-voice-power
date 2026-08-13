// js/components/recorder.js
// Every take is now kept. The `recordings` store has existed in db.js since the
// first commit and was never written to – so every recording he ever made was
// thrown away the moment he tapped Discard, and the one thing most likely to
// motivate him ("listen to how you sounded a month ago") didn't exist.
import { navigate } from '../modules/router.js';
import {
  startRecording, stopRecording, drawWaveform, createAudioFromBlob,
  rmsFrom, playSuccess, playClick,
} from '../modules/audio.js';
import { awardRep, addMinutes, saveState, recordPractice } from '../modules/state.js';
import { dbPut } from '../modules/db.js';
import { toast, praiseToast } from '../modules/toast.js';

// A fixed set of prompts, so the journal can compare like with like. Free talk
// is lovely but you can't hear progress between two different sentences.
export const JOURNAL_PROMPTS = [
  { id: 'name',    text: 'My name is…',        icon: '🙋' },
  { id: 'count',   text: 'Count to five',      icon: '🖐️' },
  { id: 'today',   text: 'Today I…',           icon: '☀️' },
  { id: 'favourite', text: 'My favourite thing is…', icon: '💛' },
  { id: 'free',    text: 'Anything I like!',   icon: '🎈' },
];

const MIN_KEEPABLE_MS = 1500;
const VOICE_PEAK_MIN  = 0.035;

export function renderRecorder({ promptId } = {}) {
  const page = document.createElement('div');
  page.className = 'page';

  let blob = null, analyser = null, timerInt = null, peakRaf = null;
  let secs = 0, peak = 0, saved = false;
  // Arriving from the "say it again" nudge preselects the prompt being compared.
  let promptIdx = Math.max(0, JOURNAL_PROMPTS.findIndex(p => p.id === promptId));

  page.innerHTML = `
    <div class="page-header flex-between">
      <h2>Record Me! 🎙️</h2>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
    </div>
    <p class="text-center" style="margin-bottom:12px">Pick something to say, then record it 😊</p>

    <div class="breath-chips mb-16" id="prompt-chips" role="radiogroup" aria-label="What to say">
      ${JOURNAL_PROMPTS.map((p, i) => `
        <button class="breath-chip ${i === promptIdx ? 'active' : ''}" data-prompt="${p.id}"
          role="radio" aria-checked="${i === promptIdx ? 'true' : 'false'}" type="button">${p.icon} ${p.text}</button>
      `).join('')}
    </div>

    <div class="card mb-16">
      <canvas class="waveform-canvas" id="waveform" width="400" height="80"></canvas>
      <p class="rec-timer text-center mt-12" id="timer">0:00</p>
    </div>

    <div class="rec-controls mb-16">
      <button class="btn btn-lg" id="rec-btn" style="background:var(--coral);color:white;box-shadow:0 4px 16px rgba(255,140,122,0.4)">
        🎙️ Record
      </button>
      <button class="btn btn-ghost btn-lg" id="stop-btn" disabled>⏹ Stop</button>
    </div>

    <div id="playback-section" style="display:none">
      <div class="card card-soft mb-16">
        <h3 style="margin-bottom:12px">🎧 Listen Back</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          <button class="btn btn-primary" id="play-btn">▶ Play</button>
          <button class="btn btn-sun" id="slow-btn">🐢 Slow Play</button>
          <button class="btn btn-ghost" id="discard-btn">🗑 Discard</button>
        </div>
        <p class="text-center mt-12" style="font-size:0.82rem;color:var(--ink-faint)" id="save-note"></p>
      </div>
      <div class="card card-mint text-center">
        <div style="font-size:2rem;margin-bottom:8px">🌟</div>
        <p style="font-weight:700">Wow, listen to your brave voice!</p>
        <p style="font-size:0.85rem;margin-top:4px">Every time you practice, your voice gets stronger.</p>
      </div>
    </div>

    <div class="text-center mt-24">
      <button class="btn btn-ghost" id="journal-btn">🎧 My Voice Journal</button>
    </div>
  `;

  const canvas   = page.querySelector('#waveform');
  const timerEl  = page.querySelector('#timer');
  const recBtn   = page.querySelector('#rec-btn');
  const stopBtn  = page.querySelector('#stop-btn');
  const playback = page.querySelector('#playback-section');
  const saveNote = page.querySelector('#save-note');
  const chipsEl  = page.querySelector('#prompt-chips');

  function currentPrompt() { return JOURNAL_PROMPTS[promptIdx]; }
  function formatTime(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  chipsEl.addEventListener('click', (event) => {
    const btn = event.target.closest('.breath-chip');
    if (!btn || recBtn.disabled) return;
    const i = JOURNAL_PROMPTS.findIndex(p => p.id === btn.dataset.prompt);
    if (i < 0) return;
    promptIdx = i;
    chipsEl.querySelectorAll('.breath-chip').forEach(c => {
      const on = c.dataset.prompt === btn.dataset.prompt;
      c.classList.toggle('active', on);
      c.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    playClick();
  });

  /** Watch loudness during the take so a silent recording isn't paid for. */
  function trackPeak() {
    peak = Math.max(peak, rmsFrom(analyser));
    peakRaf = requestAnimationFrame(trackPeak);
  }

  recBtn.addEventListener('click', async () => {
    playClick();
    try {
      analyser = await startRecording();
      recBtn.disabled = true; stopBtn.disabled = false;
      recBtn.innerHTML = '<span class="rec-dot"></span> Recording…';
      secs = 0; peak = 0; saved = false;
      timerEl.textContent = '0:00';
      timerInt = setInterval(() => {
        secs++;
        timerEl.textContent = formatTime(secs);
        if (secs >= 120) stopBtn.click();   // max 2 min
      }, 1000);
      drawWaveform(canvas, analyser);
      trackPeak();
    } catch (e) {
      toast('Could not access microphone. Please allow permission.', '');
    }
  });

  stopBtn.addEventListener('click', async () => {
    playClick();
    clearInterval(timerInt);
    if (peakRaf) cancelAnimationFrame(peakRaf);
    const durationMs = secs * 1000;
    blob = await stopRecording();
    recBtn.disabled = false; stopBtn.disabled = true;
    recBtn.innerHTML = '🎙️ Record';
    if (!blob) return;

    playback.style.display = '';
    const heardVoice = peak >= VOICE_PEAK_MIN && durationMs >= MIN_KEEPABLE_MS;

    if (heardVoice) {
      const prompt = currentPrompt();
      try {
        await dbPut('recordings', {
          promptId: prompt.id,
          promptText: prompt.text,
          blob,
          date: new Date().toISOString(),
          durationMs,
          peak,
        });
        saved = true;
        saveNote.textContent = `Saved to your journal under “${prompt.text}” ⭐`;
      } catch (e) {
        saveNote.textContent = 'Couldn’t save this one to the journal.';
      }

      playSuccess();
      praiseToast();
      await recordPractice('recording', { promptId: prompt.id, durationMs });
      const coins = await awardRep('recording', 6);
      await addMinutes(Math.max(1, Math.round(secs / 60)));
      await saveState();
      if (coins) toast(`🪙 +${coins} coins! Great recording!`, 'reward');
    } else {
      // Not a failure – just nothing worth keeping. No coins, no telling-off.
      saveNote.textContent = durationMs < MIN_KEEPABLE_MS
        ? 'That one was very short – have another go and I’ll keep it! 💙'
        : 'I couldn’t hear much on that one – try a bit closer to the mic 🎤';
    }
  });

  page.querySelector('#play-btn').addEventListener('click', () => {
    if (!blob) return; playClick();
    createAudioFromBlob(blob, 1).play();
  });
  page.querySelector('#slow-btn').addEventListener('click', () => {
    if (!blob) return; playClick();
    createAudioFromBlob(blob, 0.6).play();
  });
  page.querySelector('#discard-btn').addEventListener('click', () => {
    playClick(); blob = null;
    playback.style.display = 'none';
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    timerEl.textContent = '0:00';
    // Already-journalled takes stay in the journal; this only clears the panel.
    saveNote.textContent = '';
    if (saved) toast('Still safe in your journal 🎧');
  });

  page.querySelector('#journal-btn').addEventListener('click', () => { playClick(); navigate('journal'); });
  page.querySelector('#exit-btn').addEventListener('click', () => { clearInterval(timerInt); playClick(); navigate('home'); });

  page.__cleanup = () => {
    clearInterval(timerInt);
    if (peakRaf) cancelAnimationFrame(peakRaf);
  };

  return page;
}
