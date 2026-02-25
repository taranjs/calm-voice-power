// js/modules/audio.js – Web Audio helpers
let _ctx = null;
let _mediaRecorder = null;
let _chunks = [];
let _stream = null;
let _analyser = null;
let _source = null;

export function getAudioContext() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

export function playTone(freq = 440, dur = 0.15, type = 'sine', vol = 0.3) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch(e) {}
}

export function playSuccess() {
  playTone(523, 0.12);
  setTimeout(() => playTone(659, 0.12), 120);
  setTimeout(() => playTone(784, 0.2),  240);
}

export function playClick() { playTone(600, 0.08, 'square', 0.15); }
export function playDot()   { playTone(440, 0.1, 'sine', 0.2); }
export function playCoin()  { playTone(880, 0.08); setTimeout(()=>playTone(1100,0.12),90); }

// ── Recording ──────────────────────────────────
export async function startRecording() {
  _stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = getAudioContext();
  _source  = ctx.createMediaStreamSource(_stream);
  _analyser = ctx.createAnalyser();
  _analyser.fftSize = 512;
  _source.connect(_analyser);
  _chunks = [];
  _mediaRecorder = new MediaRecorder(_stream);
  _mediaRecorder.ondataavailable = e => _chunks.push(e.data);
  _mediaRecorder.start(100);
  return _analyser;
}

export function stopRecording() {
  return new Promise(resolve => {
    if (!_mediaRecorder) return resolve(null);
    _mediaRecorder.onstop = () => {
      const blob = new Blob(_chunks, { type: 'audio/webm' });
      _stream?.getTracks().forEach(t => t.stop());
      _analyser = null; _source = null;
      resolve(blob);
    };
    _mediaRecorder.stop();
  });
}

export function getAnalyser() { return _analyser; }

export function drawWaveform(canvas, analyser) {
  if (!analyser || !canvas) return;
  const ctx = canvas.getContext('2d');
  const buf = new Uint8Array(analyser.frequencyBinCount);
  const W = canvas.width, H = canvas.height;

  function draw() {
    if (!getAnalyser()) return;
    requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(buf);
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    ctx.strokeStyle = '#6EC6F0';
    ctx.lineWidth = 2.5;
    const step = W / buf.length;
    buf.forEach((v, i) => {
      const x = i * step;
      const y = (v / 128) * H / 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  draw();
}

export function createAudioFromBlob(blob, rate = 1) {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.playbackRate = rate;
  return audio;
}
