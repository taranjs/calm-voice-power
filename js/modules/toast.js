// js/modules/toast.js
export function toast(msg, type = '', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

export const praise = [
  '🌟 Amazing effort!', '🎉 You did it!', '💪 So brave!',
  '🌈 Wonderful job!', '⭐ Super speaker!', '🦁 Roar! Great try!',
  '🎊 Brilliant!', '✨ You\'re a star!', '🥳 Woohoo!',
];

export function praiseToast() {
  toast(praise[Math.floor(Math.random() * praise.length)], 'success');
}
