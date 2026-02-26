// js/components/breathingSession.js
import { navigate } from '../modules/router.js';
import { addCoins, addMinutes, saveState } from '../modules/state.js';
import { playTone, playSuccess, playClick } from '../modules/audio.js';
import { toast, praiseToast } from '../modules/toast.js';

const BREATH_OPTIONS = [5, 10, 15];
const PHASES = [
  { name: 'Breathe in… 🌬️',  dur: 4000, class: 'inhale' },
  { name: 'Hold it… 🌟',     dur: 2000, class: 'hold' },
  { name: 'Breathe out… 💨', dur: 4000, class: 'exhale' },
  { name: 'Rest 😌',         dur: 2000, class: 'exhale' },
];

export function renderBreathingSession() {
  const page = document.createElement('div');
  page.className = 'page';
  let targetCycles = BREATH_OPTIONS[0];
  let cycle = 0, phaseIdx = 0, running = false, timer = null, startTime = null;

  page.innerHTML = `
    <div class="page-header flex-between">
      <h2>Calm Breath 🌬️</h2>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕ Exit</button>
    </div>
    <p class="text-center" style="margin-bottom:8px">Close your eyes and follow the circle</p>

    <div class="breath-ring" id="breath-ring">
      <div class="breath-ring-inner">🌸</div>
    </div>

    <p class="breath-label" id="breath-label">Ready to begin?</p>

    <div class="breath-chips" id="breath-chips" role="radiogroup" aria-label="Breath count">
      ${BREATH_OPTIONS.map((count, idx) => `
        <button
          class="breath-chip ${idx === 0 ? 'active' : ''}"
          data-breath-count="${count}"
          role="radio"
          aria-checked="${idx === 0 ? 'true' : 'false'}"
          type="button"
        >${count} breaths</button>
      `).join('')}
    </div>

    <div class="breath-progress mt-16">
      <div class="breath-progress-fill" id="breath-prog" style="width:0%"></div>
    </div>
    <p class="text-center" style="font-size:0.85rem;color:var(--ink-faint);margin-top:6px">
      <span id="cycle-count">0</span> / <span id="cycle-target">${targetCycles}</span> breaths
    </p>

    <div class="text-center mt-24">
      <button class="btn btn-primary btn-lg" id="start-btn">Start 🌟</button>
    </div>
  `;

  const ring     = page.querySelector('#breath-ring');
  const label    = page.querySelector('#breath-label');
  const prog     = page.querySelector('#breath-prog');
  const cycleEl  = page.querySelector('#cycle-count');
  const targetEl = page.querySelector('#cycle-target');
  const chipsEl  = page.querySelector('#breath-chips');
  const startBtn = page.querySelector('#start-btn');

  function syncChipState() {
    const chips = chipsEl.querySelectorAll('.breath-chip');
    chips.forEach((chip) => {
      const count = Number(chip.dataset.breathCount);
      const isActive = count === targetCycles;
      chip.classList.toggle('active', isActive);
      chip.setAttribute('aria-checked', isActive ? 'true' : 'false');
      chip.disabled = running;
    });
  }

  chipsEl.addEventListener('click', (event) => {
    if (running) return;
    const btn = event.target.closest('.breath-chip');
    if (!btn) return;
    const selected = Number(btn.dataset.breathCount);
    if (!BREATH_OPTIONS.includes(selected)) return;
    targetCycles = selected;
    targetEl.textContent = String(targetCycles);
    syncChipState();
    playClick();
  });

  function runPhase() {
    if (!running) return;
    if (cycle >= targetCycles) return finish();
    const phase = PHASES[phaseIdx];
    label.textContent = phase.name;
    ring.className = `breath-ring ${phase.class}`;

    // Subtle audio cue
    if (phase.class === 'inhale') playTone(330, 0.3, 'sine', 0.1);
    else if (phase.class === 'exhale') playTone(220, 0.3, 'sine', 0.07);

    timer = setTimeout(() => {
      phaseIdx++;
      if (phaseIdx >= PHASES.length) { phaseIdx = 0; cycle++; }
      cycleEl.textContent = cycle;
      prog.style.width = `${(cycle / targetCycles) * 100}%`;
      runPhase();
    }, phase.dur);
  }

  function start() {
    running = true; startTime = Date.now();
    startBtn.style.display = 'none';
    syncChipState();
    label.textContent = 'Here we go…';
    setTimeout(runPhase, 800);
  }

  async function finish() {
    running = false;
    ring.className = 'breath-ring';
    label.textContent = '🌟 Amazing! Well done!';
    playSuccess();
    praiseToast();
    const mins = Math.round((Date.now() - startTime) / 60000) || 1;
    await addCoins(10);
    await addMinutes(mins);
    await saveState();
    toast('🪙 +10 coins earned!', 'reward');
    startBtn.textContent = '✨ Do it again';
    startBtn.style.display = '';
    startBtn.classList.replace('btn-primary', 'btn-mint');
    syncChipState();
  }

  startBtn.addEventListener('click', () => {
    playClick();
    cycle = 0;
    phaseIdx = 0;
    cycleEl.textContent = '0';
    targetEl.textContent = String(targetCycles);
    prog.style.width = '0%';
    start();
  });
  page.querySelector('#exit-btn').addEventListener('click', () => { running = false; clearTimeout(timer); playClick(); navigate('home'); });

  syncChipState();

  return page;
}
