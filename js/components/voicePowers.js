// js/components/voicePowers.js – "My Voice Powers"
//
// The app has been measuring real progress for a while now – onset rise times,
// longest holds, pauses held – and showing all of it to the *parent* and none of
// it to the child. "Aiming for 85ms" means nothing to a seven-year-old.
//
// Same numbers, translated: four powers that level up, each with the next step
// spelled out in something he can picture. This is the competence half of what
// keeps a child coming back, and it costs nothing to collect because every
// figure here is already in the database.
import { navigate } from '../modules/router.js';
import { state, computeStreak } from '../modules/state.js';
import { playClick } from '../modules/audio.js';

const LEVELS = 5;

// Each power maps a measured value onto five bands. The bands are generous at
// the bottom on purpose: the first level has to be reachable on day one.
const POWERS = [
  {
    key: 'gentle',
    icon: '🪶',
    name: 'Gentle Start',
    blurb: 'Beginning words softly',
    bands: [0, 30, 55, 80, 110],
    titles: ['Getting going', 'Softening', 'Smooth starter', 'Feather touch', 'Gentle master'],
    value: () => {
      const s = state.voiceProfile?.onsetSamples || [];
      if (s.length < 3) return null;
      const sorted = [...s].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    },
    format: v => `${Math.round(v)}ms build-up`,
    next: v => `Let the next one float in even more slowly`,
  },
  {
    key: 'hold',
    icon: '🌈',
    name: 'Long Sound',
    blurb: 'Holding a sound steady',
    bands: [0, 800, 1500, 2500, 4000],
    titles: ['Short and sweet', 'Stretchy', 'Long holder', 'Super stretch', 'Rainbow breath'],
    value: () => state.bests?.holdMs || null,
    format: v => `${(v / 1000).toFixed(1)} seconds`,
    next: v => `Try holding one for ${((v + 700) / 1000).toFixed(1)} seconds`,
  },
  {
    key: 'pause',
    icon: '⏸️',
    name: 'Pause Power',
    blurb: 'Stopping calmly mid-sentence',
    bands: [0, 500, 900, 1400, 2000],
    titles: ['First pauses', 'Steady stopper', 'Calm waiter', 'Cool pauser', 'Pause master'],
    value: () => state.bests?.pauseMs || null,
    format: v => `${(v / 1000).toFixed(1)} second pause`,
    next: v => `See if a pause can last a little longer`,
  },
  {
    key: 'beat',
    icon: '🎵',
    name: 'Steady Beat',
    blurb: 'Speaking right on the rhythm',
    bands: [0, 1, 3, 5, 8],
    titles: ['Finding the beat', 'On the beat', 'Steady', 'Locked in', 'Metronome'],
    value: () => state.bests?.pacedWords || null,
    format: v => `${v} word${v === 1 ? '' : 's'} in a row`,
    next: v => `Try ${v + 1} words in a row without a miss`,
  },
];

function levelFor(value, bands) {
  if (value === null || value === undefined) return 0;
  let lvl = 0;
  bands.forEach((b, i) => { if (value >= b) lvl = i + 1; });
  return Math.min(lvl, LEVELS);
}

/** How far through the current band he is, for the progress bar. */
function bandProgress(value, bands, level) {
  if (value === null || level >= LEVELS) return 1;
  const lo = bands[Math.max(0, level - 1)] ?? 0;
  const hi = bands[level] ?? lo + 1;
  if (hi <= lo) return 1;
  return Math.max(0, Math.min((value - lo) / (hi - lo), 1));
}

export function renderVoicePowers() {
  const page = document.createElement('div');
  page.className = 'page';

  const streak = computeStreak();
  const days = state.practiceDays.length;
  const earned = POWERS.map(p => {
    const v = p.value();
    return { ...p, v, level: levelFor(v, p.bands) };
  });
  const totalLevels = earned.reduce((a, p) => a + p.level, 0);

  page.innerHTML = `
    <div class="page-header flex-between">
      <div>
        <h2>My Voice Powers ⚡</h2>
        <p class="subtitle">${totalLevels} power level${totalLevels === 1 ? '' : 's'} earned so far</p>
      </div>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
    </div>

    <div class="stat-row mb-16">
      <div class="stat-box card card-sun">
        <div class="stat-val" style="color:var(--sun-warm)">🔥 ${streak}</div>
        <div class="stat-key">Day Streak</div>
      </div>
      <div class="stat-box card card-mint">
        <div class="stat-val" style="color:var(--mint)">⭐ ${days}</div>
        <div class="stat-key">Days Practised</div>
      </div>
    </div>

    <div id="powers-list"></div>

    <div class="card card-soft text-center mt-16">
      <p style="font-size:0.88rem;font-weight:700">
        These all come from your own voice 🎤<br>
        <span style="font-weight:400;font-size:0.85rem">Every practice makes one of them grow.</span>
      </p>
    </div>
  `;

  const list = page.querySelector('#powers-list');

  earned.forEach(p => {
    const pct = bandProgress(p.v, p.bands, p.level) * 100;
    const maxed = p.level >= LEVELS;
    const card = document.createElement('div');
    card.className = 'power-card card mb-12';
    card.innerHTML = `
      <div class="power-head">
        <span class="power-icon">${p.icon}</span>
        <div style="flex:1">
          <div class="power-name">${p.name}</div>
          <div class="power-blurb">${p.v === null ? p.blurb : p.titles[Math.max(0, p.level - 1)]}</div>
        </div>
        <div class="power-pips" aria-label="Level ${p.level} of ${LEVELS}">
          ${Array.from({ length: LEVELS }, (_, i) =>
            `<span class="power-pip${i < p.level ? ' on' : ''}"></span>`).join('')}
        </div>
      </div>
      <div class="prog-bar mt-12" style="height:10px">
        <div class="prog-fill" style="width:${pct}%"></div>
      </div>
      <p class="power-note">
        ${p.v === null
          ? `Play to unlock this one!`
          : `${p.format(p.v)}${maxed ? ' — top level! Keep it up ✨' : ` · ${p.next(p.v)}`}`}
      </p>
    `;
    list.appendChild(card);
  });

  page.querySelector('#exit-btn').addEventListener('click', () => { playClick(); navigate('home'); });

  return page;
}
