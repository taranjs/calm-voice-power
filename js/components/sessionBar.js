// js/components/sessionBar.js
// A quiet progress strip that only exists while a practice session is running,
// so "three things and we're done" is visible the whole way through instead of
// the child having to guess when he's finished.
import { session, sessionTarget, on } from '../modules/state.js';
import { navigate } from '../modules/router.js';
import { playClick } from '../modules/audio.js';

export function renderSessionBar() {
  const bar = document.createElement('div');
  bar.id = 'session-bar';
  bar.hidden = true;

  function paint() {
    const target = sessionTarget();
    const done = session.done.length;
    const complete = done >= target;
    bar.hidden = !session.active;
    // Keep the page scrollable clear of the bar while it's up.
    document.getElementById('app')?.classList.toggle('session-on', session.active);
    if (!session.active) return;

    bar.className = complete ? 'complete' : '';
    bar.innerHTML = `
      <div class="session-bar-inner">
        <span class="session-bar-label">${complete ? 'Session complete!' : 'Practice session'}</span>
        <span class="session-pips" aria-label="${done} of ${target} done">
          ${Array.from({ length: target }, (_, i) =>
            `<span class="session-pip${i < done ? ' on' : ''}"></span>`).join('')}
        </span>
        <button class="session-bar-btn" type="button" id="session-finish">
          ${complete ? 'Finish ✨' : 'Finish early'}
        </button>
      </div>
    `;
    bar.querySelector('#session-finish').addEventListener('click', () => {
      playClick();
      navigate('emotion-after');
    });
  }

  on('sessionChanged', paint);
  paint();
  return bar;
}
