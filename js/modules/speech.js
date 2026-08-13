// js/modules/speech.js – spoken models, so the child hears the target
//
// A motor speech target can't be learned from a sentence like "start softly,
// like a feather landing". You need something to imitate. The browser's own
// speech synthesiser gives us that for free, offline, with no recording session:
// rate 0.5 produces a genuinely prolonged, stretched model.
//
// What it can't do is demonstrate a gentle onset – synthesised voices all attack
// identically. For that, audio.js has playGentleRamp(), which models the
// amplitude envelope with a tone instead. If you ever record yourself saying
// these words properly, drop the files in and swap speakModel() out; everything
// calls through here.

let _voice = null;
let _voicesReady = false;

export function isSpeechSupported() {
  return typeof speechSynthesis !== 'undefined'
      && typeof SpeechSynthesisUtterance !== 'undefined';
}

// Prefer a local (offline) English voice; the network ones stall without wifi.
const PREFERRED = ['samantha', 'karen', 'moira', 'google uk english female', 'daniel'];

function pickVoice() {
  if (!isSpeechSupported()) return null;
  const all = speechSynthesis.getVoices();
  if (!all.length) return null;
  _voicesReady = true;

  const english = all.filter(v => (v.lang || '').toLowerCase().startsWith('en'));
  const pool = english.length ? english : all;

  for (const name of PREFERRED) {
    const hit = pool.find(v => (v.name || '').toLowerCase().includes(name));
    if (hit) return hit;
  }
  return pool.find(v => v.localService) || pool[0];
}

if (isSpeechSupported()) {
  _voice = pickVoice();
  speechSynthesis.addEventListener('voiceschanged', () => { _voice = pickVoice(); });
}

/**
 * Speak a model of the target. Resolves when finished (or immediately if the
 * platform can't speak, so callers never hang waiting on it).
 */
export function speakModel(text, { rate = 0.55, pitch = 1.05, volume = 1 } = {}) {
  return new Promise(resolve => {
    if (!isSpeechSupported() || !text) return resolve(false);
    try {
      speechSynthesis.cancel();
      if (!_voice && !_voicesReady) _voice = pickVoice();

      const u = new SpeechSynthesisUtterance(stripCues(text));
      if (_voice) u.voice = _voice;
      u.lang   = _voice?.lang || 'en-GB';
      u.rate   = Math.max(0.1, Math.min(rate, 2));
      u.pitch  = pitch;
      u.volume = volume;

      let done = false;
      const finish = () => { if (!done) { done = true; resolve(true); } };
      u.onend = finish;
      u.onerror = finish;
      // Some mobile browsers silently drop onend; don't leave the UI stuck.
      setTimeout(finish, 8000);

      speechSynthesis.speak(u);
    } catch (e) {
      resolve(false);
    }
  });
}

export function cancelSpeech() {
  if (isSpeechSupported()) {
    try { speechSynthesis.cancel(); } catch (e) { /* nothing playing */ }
  }
}

// The word lists carry visual stretch cues ("Heeey", "But-ter") that read well
// on screen but confuse a synthesiser. Collapse them back to plain words.
function stripCues(text) {
  return String(text)
    .replace(/-/g, '')
    .replace(/([a-z])\1{2,}/gi, '$1$1')
    .replace(/…/g, ', ')
    .trim();
}
