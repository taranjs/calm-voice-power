// js/modules/voice.js – the microphone as the game controller
//
// Deliberately NOT speech recognition. ASR scores word accuracy and treats
// repetitions, prolongations and blocks as garbage input, which is exactly the
// wrong feedback loop for a child who stammers. Everything here works off the
// raw amplitude envelope instead, so activities respond to *how* a sound was
// made – how gently it started, how long it was held – and never to whether a
// word came out "correctly". There is no wrong answer the mic can detect.

import { getAudioContext } from './audio.js';

// Heuristics tuned by ear on a phone held at arm's length, not clinical
// measurements. Adjust freely if they feel wrong for your child.
const NOISE_FLOOR_DEFAULT = 0.010;  // rms of a quiet room
const NOISE_FLOOR_MAX     = 0.055;  // never let a noisy room raise it past this
const VOICE_MARGIN        = 2.5;    // voice must sit this far above the floor
const MIN_THRESHOLD       = 0.020;  // never trust a floor lower than this
const GAP_TOLERANCE_MS    = 180;    // a breath-sized dip doesn't end an utterance
const ONSET_WINDOW_MS     = 450;    // how much of the attack we analyse
const GENTLE_RISE_MS      = 110;    // 10%→90% rise slower than this reads as gentle
const HARD_RISE_MS        = 55;     // faster than this is a hard glottal attack

let _stream = null, _source = null, _analyser = null, _buf = null;
let _users = 0;                     // refcount – screens can share one mic grant
let _noiseFloor = NOISE_FLOOR_DEFAULT;

export function isMicSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export async function acquireMic() {
  _users++;
  if (_analyser) return _analyser;
  _stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      // Both of these fight what we're measuring: AGC flattens loudness, and
      // noise suppression gates the quiet breathy start of a gentle onset –
      // the exact thing the child is practising.
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
  const ctx = getAudioContext();
  _source   = ctx.createMediaStreamSource(_stream);
  _analyser = ctx.createAnalyser();
  _analyser.fftSize = 1024;
  _analyser.smoothingTimeConstant = 0.2;
  _buf = new Uint8Array(_analyser.fftSize);
  _source.connect(_analyser);
  return _analyser;
}

export function releaseMic() {
  _users = Math.max(0, _users - 1);
  if (_users > 0) return;
  _stream?.getTracks().forEach(t => t.stop());
  try { _source?.disconnect(); } catch (e) { /* already gone */ }
  _stream = null; _source = null; _analyser = null; _buf = null;
}

/** Root-mean-square loudness of the current frame, roughly 0–1. */
export function readLevel() {
  if (!_analyser || !_buf) return 0;
  _analyser.getByteTimeDomainData(_buf);
  let sum = 0;
  for (let i = 0; i < _buf.length; i++) {
    const v = (_buf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / _buf.length);
}

/** Listen to the quiet room for a moment so a noisy kitchen doesn't score points. */
export function calibrateNoiseFloor(ms = 600) {
  return new Promise(resolve => {
    const samples = [];
    const started = performance.now();
    (function sample() {
      samples.push(readLevel());
      if (performance.now() - started < ms) return requestAnimationFrame(sample);

      // Median rather than peak: a door closing during calibration must not
      // deafen the app for the whole session. And hard-capped, because a
      // genuinely noisy room could otherwise push the threshold above anything
      // a child's voice can reach – which fails silently, the worst way to fail.
      samples.sort((a, b) => a - b);
      const median = samples[Math.floor(samples.length / 2)] || 0;
      _noiseFloor = Math.min(NOISE_FLOOR_MAX, Math.max(NOISE_FLOOR_DEFAULT, median));
      resolve(_noiseFloor);
    })();
  });
}

export function voiceThreshold() {
  return Math.max(MIN_THRESHOLD, _noiseFloor * VOICE_MARGIN);
}

/**
 * Classify the shape of a voice onset from its amplitude envelope.
 *
 * A hard glottal attack slams to full volume in a frame or two; an easy onset
 * ramps in. Measured as the 10%→90% rise time, the standard way to describe how
 * abruptly a signal starts. It's a proxy for gentleness rather than a clinical
 * measurement – but it responds to the actual motor target, which a text
 * instruction like "start softly, like a feather" never can.
 *
 * @param {{t:number, level:number}[]} envelope samples from the onset window
 */
export function classifyOnset(envelope) {
  if (!envelope || envelope.length < 4) return null;
  const max = envelope.reduce((m, e) => Math.max(m, e.level), 0);
  if (max <= 0) return null;

  const lo = max * 0.1, hi = max * 0.9;
  const tLo = envelope.find(e => e.level >= lo)?.t ?? 0;
  const tHi = envelope.find(e => e.level >= hi)?.t ?? envelope[envelope.length - 1].t;
  const riseMs = Math.max(0, tHi - tLo);

  return {
    riseMs: Math.round(riseMs),
    peak: max,
    quality: riseMs >= GENTLE_RISE_MS ? 'gentle' : riseMs <= HARD_RISE_MS ? 'hard' : 'okay',
  };
}

/**
 * Follows one utterance and reports it frame by frame.
 *
 *   onFrame({ level, threshold, voicedMs, peak, voicing, everVoiced, silenceMs })
 *   onVoiceStart()  – first moment sound crossed the threshold
 *   onSettled()     – fired once, after the child has finished and gone quiet
 */
export function createVoiceTracker({
  onFrame, onVoiceStart, onVoiceEnd, onSettled, silenceToEndMs = 900,
} = {}) {
  let raf = null, running = false, lastTs = 0;
  let voicedMs = 0, peak = 0, gapMs = 0;
  let voicing = false, everVoiced = false, settled = false;
  let utteranceStart = 0, envelope = [];

  function frame(ts) {
    if (!running) return;
    const dt = lastTs ? Math.min(ts - lastTs, 100) : 0;   // clamp tab-switch jumps
    lastTs = ts;

    const level = readLevel();
    const threshold = voiceThreshold();
    peak = Math.max(peak, level);

    if (level >= threshold) {
      if (!voicing) {
        voicing = true;
        gapMs = 0;
        if (!everVoiced) { everVoiced = true; utteranceStart = ts; envelope = []; }
        onVoiceStart?.();
      }
      voicedMs += dt;
    } else if (voicing) {
      gapMs += dt;
      if (gapMs >= GAP_TOLERANCE_MS) { voicing = false; onVoiceEnd?.(); }
      else voicedMs += dt;                                // ride through the dip
    } else if (everVoiced) {
      gapMs += dt;
    }

    if (everVoiced && ts - utteranceStart <= ONSET_WINDOW_MS) {
      envelope.push({ t: ts - utteranceStart, level });
    }

    onFrame?.({
      level, threshold, voicedMs, peak, voicing, everVoiced,
      silenceMs: voicing ? 0 : gapMs,
    });

    if (!settled && everVoiced && !voicing && gapMs >= silenceToEndMs) {
      settled = true;
      onSettled?.();
    }

    raf = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true; lastTs = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    },
    reset() {
      voicedMs = 0; peak = 0; gapMs = 0;
      voicing = false; everVoiced = false; settled = false;
      envelope = []; lastTs = 0;
    },
    get voicedMs()   { return voicedMs; },
    get peak()       { return peak; },
    get everVoiced() { return everVoiced; },

    /** How gently this utterance started. See classifyOnset(). */
    analyzeOnset() { return classifyOnset(envelope); },

    /** Raw onset samples, exposed for tuning the thresholds against real takes. */
    get onsetEnvelope() { return envelope.slice(); },
  };
}
