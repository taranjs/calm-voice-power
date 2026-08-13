// js/components/streakRoad.js
// The road is now driven by *total days practised*, which only ever goes up.
// It used to be driven by the consecutive-day counter, so a single missed day
// reset it to zero and wiped every star and milestone off the screen – the
// harshest failure state in an app whose whole premise is not having any.
import { state, restAllowance, computeStreak } from '../modules/state.js';
import { navigate } from '../modules/router.js';
import { playClick } from '../modules/audio.js';

const MILESTONES = [
  { day: 1,  icon: '🌱', label: 'Seedling' },
  { day: 5,  icon: '🌿', label: 'Sprout' },
  { day: 10, icon: '🌳', label: 'Tree' },
  { day: 20, icon: '🌟', label: 'Star' },
  { day: 30, icon: '🏆', label: 'Champion' },
  { day: 50, icon: '🦁', label: 'Lion Heart' },
  { day: 100,icon: '🚀', label: 'Rocket' },
];

const PER_ROW = 5;

export function renderStreakRoad() {
  const page = document.createElement('div');
  page.className = 'page';

  const totalDays = state.practiceDays.length;
  const streak    = computeStreak();
  const rest      = restAllowance();
  const best      = state.bestStreak || streak;

  // Always show a stretch of road ahead of him, never a finished board.
  const roadLength = Math.max(50, Math.ceil((totalDays + 10) / PER_ROW) * PER_ROW);
  const nextMilestone = MILESTONES.find(m => m.day > totalDays);

  page.innerHTML = `
    <div class="page-header flex-between">
      <div>
        <h2>Confidence Road 🛤️</h2>
        <p class="subtitle">${totalDays} ${totalDays === 1 ? 'day' : 'days'} of practice – all yours to keep</p>
      </div>
      <button class="btn btn-ghost" id="back-btn" style="padding:10px 16px;font-size:0.85rem">← Back</button>
    </div>

    <div class="stat-row mb-16">
      <div class="stat-box card card-sun">
        <div class="stat-val" style="color:var(--sun-warm)">🔥 ${streak}</div>
        <div class="stat-key">Day Streak</div>
      </div>
      <div class="stat-box card card-mint">
        <div class="stat-val" style="color:var(--mint)">⭐ ${totalDays}</div>
        <div class="stat-key">Days Practised</div>
      </div>
      <div class="stat-box card card-lavender">
        <div class="stat-val" style="color:var(--lavender)">🏅 ${best}</div>
        <div class="stat-key">Best Ever</div>
      </div>
    </div>

    <div class="card card-soft mb-16 text-center">
      <p style="font-size:0.9rem;font-weight:700;color:var(--ink-soft)">
        ${rest > 0
          ? `😴 You have ${rest} rest ${rest === 1 ? 'day' : 'days'} saved up. Take a day off whenever you like – your streak waits for you.`
          : 'Practise 5 days to earn a rest day, so a day off never costs you your streak. 💙'}
      </p>
    </div>

    <div class="card card-soft mb-16">
      <div class="flex-center gap-12" style="flex-wrap:wrap">
        ${MILESTONES.map(m => `
          <div style="text-align:center;opacity:${totalDays >= m.day ? 1 : 0.35}">
            <div style="font-size:1.8rem">${totalDays >= m.day ? m.icon : '🔒'}</div>
            <div style="font-size:0.65rem;font-weight:700;color:var(--ink-faint);margin-top:2px">${m.day}d</div>
          </div>
        `).join('')}
      </div>
      ${nextMilestone ? `
        <p class="text-center mt-12" style="font-size:0.85rem;color:var(--ink-faint);font-weight:700">
          ${nextMilestone.day - totalDays} more ${nextMilestone.day - totalDays === 1 ? 'day' : 'days'} to ${nextMilestone.icon} ${nextMilestone.label}
        </p>` : ''}
    </div>

    <div class="section-title">Every day you've practised:</div>
    <div id="road-container" class="card" style="padding:16px"></div>
  `;

  page.querySelector('#back-btn').addEventListener('click', () => { playClick(); navigate('home'); });

  const road = page.querySelector('#road-container');
  const rows = Math.ceil(roadLength / PER_ROW);

  for (let r = 0; r < rows; r++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'road-row';
    rowEl.style.marginBottom = '8px';

    const startNode = r * PER_ROW + 1;
    const nodes = Array.from({ length: PER_ROW }, (_, i) => startNode + i);
    if (r % 2 === 1) nodes.reverse();

    nodes.forEach((n, i) => {
      const node = document.createElement('div');
      const status = n <= totalDays ? 'done' : n === totalDays + 1 ? 'current' : 'locked';
      node.className = `road-node ${status}`;
      node.title = `Day ${n}`;

      const milestone = MILESTONES.find(m => m.day === n);
      node.innerHTML = totalDays >= n
        ? (milestone ? milestone.icon : '⭐')
        : n === totalDays + 1
          ? '👣'
          : milestone ? '🔒' : '';
      rowEl.appendChild(node);

      if (i < PER_ROW - 1) {
        const conn = document.createElement('div');
        conn.className = `road-connector${n <= totalDays ? ' done' : ''}`;
        rowEl.appendChild(conn);
      }
    });

    road.appendChild(rowEl);
  }

  // Only chase the current node once the road is long enough that it's actually
  // off screen. Otherwise this scrolls straight past his stats and milestones,
  // which are the part worth seeing.
  if (totalDays > 15) {
    setTimeout(() => {
      const current = road.querySelector('.road-node.current');
      if (current) current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  }

  return page;
}
