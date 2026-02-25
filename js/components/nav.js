// js/components/nav.js
import { navigate } from '../modules/router.js';
import { playClick } from '../modules/audio.js';

const NAV_ITEMS = [
  { route: 'home',      icon: '🏠', label: 'Home' },
  { route: 'practice',  icon: '🎙️', label: 'Practice' },
  { route: 'games',     icon: '🎮', label: 'Games' },
  { route: 'rewards',   icon: '🏆', label: 'Rewards' },
  { route: 'parent',    icon: '👨‍👩‍👧', label: 'Parent' },
];

export function renderNav() {
  const nav = document.createElement('nav');
  nav.id = 'nav-bar';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Main navigation');

  NAV_ITEMS.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.dataset.route = item.route;
    btn.setAttribute('aria-label', item.label);
    btn.innerHTML = `<span class="nav-icon">${item.icon}</span><span>${item.label}</span>`;
    btn.addEventListener('click', () => {
      playClick();
      navigate(item.route);
    });
    nav.appendChild(btn);
  });

  return nav;
}
