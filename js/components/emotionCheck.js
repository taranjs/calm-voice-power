// js/components/emotionCheck.js
import { state, setState, saveState, logSession } from '../modules/state.js';
import { navigate } from '../modules/router.js';
import { playSuccess, playClick } from '../modules/audio.js';
import { toast } from '../modules/toast.js';

const EMOJIS = [
  { val: 1, e: '😔', label: 'Not great' },
  { val: 2, e: '😕', label: 'A bit meh' },
  { val: 3, e: '😐', label: 'Okay' },
  { val: 4, e: '🙂', label: 'Pretty good' },
  { val: 5, e: '😄', label: 'Amazing!' },
];

export function renderEmotionCheck({ mode = 'before', onDone } = {}) {
  const page = document.createElement('div');
  page.className = 'page';

  const isBefore = mode === 'before';
  page.innerHTML = `
    <div class="page-header text-center">
      <div style="font-size:3rem;margin-bottom:8px">${isBefore ? '🤔' : '🌟'}</div>
      <h2>${isBefore ? 'How are you feeling?' : 'How do you feel now?'}</h2>
      <p class="mt-8">${isBefore ? 'Before your practice today' : 'After your practice – well done!'}</p>
    </div>

    <div class="card text-center mt-24">
      <p style="font-weight:700;margin-bottom:20px">Pick the emoji that shows how you feel:</p>
      <div class="emoji-scale" id="emoji-scale" role="group" aria-label="Emotion scale"></div>
      <p id="emotion-label" style="height:24px;margin-top:16px;font-weight:700;color:var(--sky);font-size:1.1rem"></p>
    </div>

    <div class="text-center mt-24">
      <button class="btn btn-primary btn-lg" id="confirm-emotion" disabled>
        ${isBefore ? 'Start My Practice ✨' : 'Save & Continue 🌟'}
      </button>
    </div>
    <div class="text-center mt-12">
      <button class="btn btn-ghost" id="skip-emotion">Skip for now</button>
    </div>
  `;

  const scale = page.querySelector('#emoji-scale');
  const label = page.querySelector('#emotion-label');
  const confirmBtn = page.querySelector('#confirm-emotion');
  let selected = null;

  EMOJIS.forEach(({ val, e, label: l }) => {
    const btn = document.createElement('button');
    btn.className = 'emoji-btn';
    btn.setAttribute('aria-label', l);
    btn.innerHTML = e;
    btn.addEventListener('click', () => {
      scale.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selected = val;
      label.textContent = l;
      confirmBtn.disabled = false;
      playClick();
    });
    scale.appendChild(btn);
  });

  confirmBtn.addEventListener('click', async () => {
    playSuccess();
    if (isBefore) {
      setState({ emotionBefore: selected });
      await saveState();
      navigate('home');
      toast('Let\'s have a great session! 🌟', 'success');
    } else {
      setState({ emotionAfter: selected });
      await logSession({ emotionBefore: state.emotionBefore, emotionAfter: selected, date: new Date().toISOString() });
      await saveState();
      if (onDone) onDone();
      else navigate('home');
      toast('Amazing session! You\'re so brave! 🎉', 'success');
    }
  });

  page.querySelector('#skip-emotion').addEventListener('click', () => {
    playClick();
    navigate('home');
  });

  return page;
}
