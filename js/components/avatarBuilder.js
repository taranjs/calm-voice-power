// js/components/avatarBuilder.js
import { state, setState, saveState } from '../modules/state.js';
import { navigate } from '../modules/router.js';
import { playClick, playSuccess } from '../modules/audio.js';
import { toast } from '../modules/toast.js';
import { AVATARS } from '../modules/avatar.js';

export function renderAvatarBuilder() {
  const page = document.createElement('div');
  page.className = 'page';

  page.innerHTML = `
    <div class="page-header flex-between">
      <div>
        <h2>My Avatar 🎨</h2>
        <p class="subtitle">Customize your calm voice hero!</p>
      </div>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
    </div>

    <div class="text-center mb-24">
      <div class="avatar-preview float" id="av-preview">${state.avatar.body || '🐱'}</div>
      <div style="margin-top:16px">
        <input class="avatar-name-input" id="name-input" 
          placeholder="Your hero name…" 
          value="${state.avatar.name || ''}" 
          maxlength="20" />
      </div>
    </div>

    <div class="section-title">Choose your character</div>
    <div class="avatar-customize-row" id="body-chooser"></div>

    <div class="text-center mt-24">
      <button class="btn btn-primary btn-lg" id="save-btn">💾 Save My Hero</button>
    </div>
  `;

  const preview = page.querySelector('#av-preview');
  const nameInput = page.querySelector('#name-input');
  let selectedBody = state.avatar.body || '🐱';

  // Only show unlocked avatars
  const bodyChooser = page.querySelector('#body-chooser');
  state.unlockedAvatars.forEach(id => {
    const btn = document.createElement('button');
    btn.className = `avatar-part-btn${id === selectedBody ? ' selected' : ''}`;
    btn.textContent = id;
    btn.setAttribute('aria-label', `Select ${id}`);
    btn.addEventListener('click', () => {
      playClick();
      selectedBody = id;
      preview.textContent = id;
      bodyChooser.querySelectorAll('.avatar-part-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    bodyChooser.appendChild(btn);
  });

  page.querySelector('#save-btn').addEventListener('click', async () => {
    playSuccess();
    const name = nameInput.value.trim() || 'Brave Voice';
    setState({ avatar: { body: selectedBody, name } });
    await saveState();
    toast('✨ Hero saved!', 'success');
    navigate('home');
  });

  page.querySelector('#exit-btn').addEventListener('click', () => { playClick(); navigate('home'); });

  return page;
}
