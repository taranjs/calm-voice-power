// js/components/gamesHub.js
import { navigate } from '../modules/router.js';
import { playClick } from '../modules/audio.js';

const GAMES = [
  { route: 'game-gentle',  icon: '🌱', label: 'Gentle Start', sub: 'Begin words super gently',   color: '#78D9A4', bg: '#C3F0D8' },
  { route: 'game-stretchy', icon: '🌈', label: 'Stretchy Speech', sub: 'Make words last longer', color: '#6EC6F0', bg: '#C5E9FA' },
  { route: 'game-pause',    icon: '⏸️', label: 'Pause Power', sub: 'Pause master challenge',     color: '#C3B1E1', bg: '#EDE8F7' },
  { route: 'buddy',         icon: '🦕', label: 'My Buddy',    sub: 'Help a friend who gets stuck', color: '#FFA552', bg: '#FFF3CC' },
];

export function renderGamesHub() {
  const page = document.createElement('div');
  page.className = 'page';
  page.innerHTML = `
    <div class="page-header">
      <h2>Mini Games 🎮</h2>
      <p class="subtitle">Practice through play – no wrong answers!</p>
    </div>
    <div id="games-list"></div>
  `;

  const list = page.querySelector('#games-list');
  GAMES.forEach(g => {
    const btn = document.createElement('button');
    btn.style.cssText = `
      width:100%; display:flex; align-items:center; gap:16px; padding:24px 20px;
      background:${g.bg}; border:2px solid transparent; border-radius:20px;
      margin-bottom:12px; cursor:pointer; text-align:left;
      font-family:var(--font-body); transition:all 0.2s ease;
      touch-action:manipulation;
    `;
    btn.innerHTML = `
      <span style="font-size:3rem;line-height:1;flex-shrink:0">${g.icon}</span>
      <div style="flex:1">
        <div style="font-weight:800;font-size:1.1rem;color:var(--ink)">${g.label}</div>
        <div style="font-size:0.85rem;color:var(--ink-faint);margin-top:4px">${g.sub}</div>
      </div>
      <span style="background:${g.color};color:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">▶</span>
    `;
    btn.addEventListener('pointerenter', () => { btn.style.border = `2px solid ${g.color}`; });
    btn.addEventListener('pointerleave', () => { btn.style.border = '2px solid transparent'; });
    btn.addEventListener('click', () => { playClick(); navigate(g.route); });
    list.appendChild(btn);
  });

  return page;
}
