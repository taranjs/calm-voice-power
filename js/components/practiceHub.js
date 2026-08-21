// js/components/practiceHub.js
import { navigate } from '../modules/router.js';
import { playClick } from '../modules/audio.js';
import { state } from '../modules/state.js';

const TOOLS = [
  { route: 'breathing',   icon: '🌬️', label: 'Calm Breath',   sub: '3-min calming session',   color: 'var(--sky)',      bg: 'var(--sky-light)' },
  { route: 'pacing',      icon: '🎵', label: 'Pacing Dots',   sub: 'Speech rhythm trainer',    color: 'var(--sun-warm)', bg: '#FFF3CC' },
  { route: 'recorder',    icon: '🎙️', label: 'Record Me!',    sub: 'Hear your brave voice',    color: 'var(--mint)',     bg: 'var(--mint-light)' },
  { route: 'block-reset', icon: '✨', label: 'Word Stretch',  sub: 'Gently unstick words',     color: 'var(--lavender)', bg: 'var(--lavender-light)' },
  { route: 'talk',        icon: '💛', label: 'Talk Together',   sub: 'Take turns with a real person', color: 'var(--coral)', bg: '#FFE8E4' },
  { route: 'challenges',  icon: '🌍', label: 'Real Challenges', sub: 'Brave everyday tries',   color: 'var(--coral)',    bg: '#FFE8E4' },
  { route: 'journal',     icon: '🎧', label: 'Voice Journal',   sub: 'Hear how far you\'ve come', color: 'var(--sun-warm)', bg: '#FFF3CC' },
  { route: 'my-words',    icon: '✍️', label: 'My Words',           sub: 'Your words, in your own voice', color: 'var(--mint)',  bg: 'var(--mint-light)' },
  { route: 'voice-setup', icon: '🎤', label: 'Teach Me Your Voice', sub: 'Tune the app to how you sound', color: 'var(--sky)', bg: 'var(--sky-light)' },
];

export function renderPracticeHub() {
  const page = document.createElement('div');
  page.className = 'page';

  page.innerHTML = `
    <div class="page-header">
      <h2>Practice Tools 🛠️</h2>
      <p class="subtitle">${state.avatar.name || 'Brave Voice'}'s calm voice kit</p>
    </div>
    <div id="tools-list"></div>
  `;

  const list = page.querySelector('#tools-list');
  TOOLS.forEach(t => {
    const btn = document.createElement('button');
    btn.style.cssText = `
      width:100%; display:flex; align-items:center; gap:16px; padding:18px 20px;
      background:${t.bg}; border:2px solid transparent; border-radius:20px;
      margin-bottom:12px; cursor:pointer; text-align:left;
      font-family:var(--font-body); transition:all 0.2s ease;
      touch-action:manipulation;
    `;
    btn.innerHTML = `
      <span style="font-size:2.4rem;line-height:1;flex-shrink:0">${t.icon}</span>
      <div style="flex:1">
        <div style="font-weight:800;font-size:1.05rem;color:var(--ink)">${t.label}</div>
        <div style="font-size:0.82rem;color:var(--ink-faint);margin-top:2px">${t.sub}</div>
      </div>
      <span style="color:${t.color};font-size:1.4rem">›</span>
    `;
    btn.addEventListener('pointerenter', () => { btn.style.border = `2px solid ${t.color}`; btn.style.transform = 'scale(1.01)'; });
    btn.addEventListener('pointerleave', () => { btn.style.border = '2px solid transparent'; btn.style.transform = ''; });
    btn.addEventListener('click', () => { playClick(); navigate(t.route); });
    list.appendChild(btn);
  });

  return page;
}
