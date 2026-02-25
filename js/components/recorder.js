// js/components/recorder.js
import { navigate } from '../modules/router.js';
import { startRecording, stopRecording, drawWaveform, createAudioFromBlob, playSuccess, playClick } from '../modules/audio.js';
import { addCoins, addMinutes, saveState } from '../modules/state.js';
import { toast, praiseToast } from '../modules/toast.js';

export function renderRecorder() {
  const page = document.createElement('div');
  page.className = 'page';
  let blob = null, analyser = null, rafId = null, timerInt = null, secs = 0;

  page.innerHTML = `
    <div class="page-header flex-between">
      <h2>Record Me! 🎙️</h2>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
    </div>
    <p class="text-center" style="margin-bottom:16px">Say anything! A sentence, a word, a story 😊</p>

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
      </div>
      <div class="card card-mint text-center">
        <div style="font-size:2rem;margin-bottom:8px">🌟</div>
        <p style="font-weight:700">Wow, listen to your brave voice!</p>
        <p style="font-size:0.85rem;margin-top:4px">Every time you practice, your voice gets stronger.</p>
      </div>
    </div>
  `;

  const canvas   = page.querySelector('#waveform');
  const timerEl  = page.querySelector('#timer');
  const recBtn   = page.querySelector('#rec-btn');
  const stopBtn  = page.querySelector('#stop-btn');
  const playback = page.querySelector('#playback-section');

  function formatTime(s) { return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }

  recBtn.addEventListener('click', async () => {
    playClick();
    try {
      analyser = await startRecording();
      recBtn.disabled = true; stopBtn.disabled = false;
      recBtn.innerHTML = '<span class="rec-dot"></span> Recording…';
      secs = 0;
      timerEl.textContent = '0:00';
      timerInt = setInterval(() => { secs++; timerEl.textContent = formatTime(secs); if (secs >= 120) stopBtn.click(); }, 1000);
      drawWaveform(canvas, analyser);
      // Max 2 min
    } catch (e) {
      toast('Could not access microphone. Please allow permission.', '');
    }
  });

  stopBtn.addEventListener('click', async () => {
    playClick();
    clearInterval(timerInt);
    blob = await stopRecording();
    recBtn.disabled = false; stopBtn.disabled = true;
    recBtn.innerHTML = '🎙️ Record';
    if (blob) {
      playback.style.display = '';
      playSuccess();
      praiseToast();
      await addCoins(8); await addMinutes(Math.max(1, Math.round(secs/60))); await saveState();
      toast('🪙 +8 coins! Great recording!', 'reward');
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
    canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
    timerEl.textContent = '0:00';
  });
  page.querySelector('#exit-btn').addEventListener('click', () => { clearInterval(timerInt); playClick(); navigate('home'); });

  return page;
}
