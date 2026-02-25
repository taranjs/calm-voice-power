// js/components/streakRoad.js
import { state } from '../modules/state.js';
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

const ROAD_LENGTH = 50;
const PER_ROW = 5;

export function renderStreakRoad() {
  const page = document.createElement('div');
  page.className = 'page';
  const streak = state.streak;

  page.innerHTML = `
    <div class="page-header flex-between">
      <div>
        <h2>Confidence Road 🛤️</h2>
        <p class="subtitle">🔥 ${streak} day streak – keep going!</p>
      </div>
      <button class="btn btn-ghost" id="back-btn" style="padding:10px 16px;font-size:0.85rem">← Back</button>
    </div>

    <div class="card card-soft mb-16">
      <div class="flex-center gap-12" style="flex-wrap:wrap">
        ${MILESTONES.map(m => `
          <div style="text-align:center;opacity:${streak >= m.day ? 1 : 0.35}">
            <div style="font-size:1.8rem">${streak >= m.day ? m.icon : '🔒'}</div>
            <div style="font-size:0.65rem;font-weight:700;color:var(--ink-faint);margin-top:2px">${m.day}d</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="section-title">Your journey so far:</div>
    <div id="road-container" class="card" style="padding:16px"></div>
  `;

  page.querySelector('#back-btn').addEventListener('click', () => { playClick(); navigate('home'); });

  const road = page.querySelector('#road-container');
  const rows = Math.ceil(ROAD_LENGTH / PER_ROW);

  for (let r = 0; r < rows; r++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'road-row';
    rowEl.style.marginBottom = '8px';

    const startNode = r * PER_ROW + 1;
    const nodes = Array.from({ length: PER_ROW }, (_, i) => startNode + i);
    if (r % 2 === 1) nodes.reverse();

    nodes.forEach((n, i) => {
      const node = document.createElement('div');
      const status = n <= streak ? 'done' : n === streak + 1 ? 'current' : 'locked';
      node.className = `road-node ${status}`;
      node.title = `Day ${n}`;

      const milestone = MILESTONES.find(m => m.day === n);
      node.innerHTML = streak >= n
        ? (milestone ? milestone.icon : '⭐')
        : n === streak + 1
          ? '👣'
          : milestone ? '🔒' : '';
      rowEl.appendChild(node);

      if (i < PER_ROW - 1) {
        const conn = document.createElement('div');
        conn.className = `road-connector${n <= streak ? ' done' : ''}`;
        rowEl.appendChild(conn);
      }
    });

    road.appendChild(rowEl);
  }

  // Scroll to current position
  setTimeout(() => {
    const current = road.querySelector('.road-node.current');
    if (current) current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 200);

  return page;
}
