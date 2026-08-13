// js/modules/router.js – Simple hash router
const _routes = new Map();
let _current = null;
let _currentEl = null;

export function route(name, component) {
  _routes.set(name, component);
}

export function navigate(name, params = {}) {
  _current = name;
  const root = document.getElementById('app-content');
  if (!root) return;

  // Voice activities hold a live microphone. Give the page a chance to hand it
  // back before it's torn out of the DOM, or the recording indicator stays on.
  try { _currentEl?.__cleanup?.(); } catch (e) { /* leaving anyway */ }
  _currentEl = null;

  root.innerHTML = '';
  const comp = _routes.get(name);
  if (comp) {
    const el = comp(params);
    if (el) { root.appendChild(el); _currentEl = el; }
  }
  // Update nav
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.route === name);
  });
}

export function currentRoute() { return _current; }
