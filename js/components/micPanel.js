// js/components/micPanel.js – shared "I can hear you" widget
// Used by every voice-driven activity so the child gets one consistent signal
// that the app is listening, and one consistent place for things to go wrong.

const SEGMENTS = 14;

export function createMicPanel({ status = 'Getting the microphone ready…' } = {}) {
  const el = document.createElement('div');
  el.className = 'mic-panel';
  el.innerHTML = `
    <div class="mic-meter" aria-hidden="true">
      ${Array.from({ length: SEGMENTS }, (_, i) => `<span class="mic-seg" data-seg="${i}"></span>`).join('')}
    </div>
    <p class="mic-status" role="status" aria-live="polite"></p>
  `;

  const segs = [...el.querySelectorAll('.mic-seg')];
  const statusEl = el.querySelector('.mic-status');
  statusEl.textContent = status;

  return {
    el,

    /** Light the meter. Threshold sits around segment 2 so "loud enough" is visible. */
    setLevel(level = 0, threshold = 0.02) {
      const scaled = Math.min(level / (threshold * 6), 1);
      const lit = Math.round(scaled * SEGMENTS);
      segs.forEach((s, i) => {
        s.classList.toggle('lit', i < lit);
        s.classList.toggle('over', i < lit && i >= 2);
      });
    },

    setStatus(text, tone = '') {
      statusEl.textContent = text;
      statusEl.className = `mic-status${tone ? ' ' + tone : ''}`;
    },

    listening(on) {
      el.classList.toggle('listening', !!on);
    },

    reset() {
      segs.forEach(s => s.classList.remove('lit', 'over'));
    },
  };
}
