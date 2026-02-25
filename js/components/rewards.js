// js/components/rewards.js
import { state, setState, addCoins, saveState } from '../modules/state.js';
import { navigate } from '../modules/router.js';
import { playCoin, playSuccess, playClick } from '../modules/audio.js';
import { toast } from '../modules/toast.js';
import { AVATARS } from '../modules/avatar.js';

export function renderRewards() {
  const page = document.createElement('div');
  page.className = 'page';

  page.innerHTML = `
    <div class="page-header">
      <h2>Rewards Shop 🏆</h2>
      <p class="subtitle">Spend your coins on cool avatars!</p>
    </div>

    <div class="flex-between mb-24">
      <div class="coin-display" id="coin-count">🪙 ${state.coins} coins</div>
      <div class="pill pill-mint">⭐ ${state.streak} day streak</div>
    </div>

    <div class="section-title">Your Avatars</div>
    <div class="avatar-grid" id="avatar-grid"></div>

    <div class="mt-24 card card-soft text-center">
      <p style="font-size:0.85rem;color:var(--ink-faint)">
        💡 Earn coins by practicing, completing challenges, and keeping your streak going!
      </p>
    </div>
  `;

  function renderGrid() {
    const grid = page.querySelector('#avatar-grid');
    grid.innerHTML = '';
    AVATARS.forEach(av => {
      const unlocked = state.unlockedAvatars.includes(av.id);
      const isSelected = state.avatar.body === av.id;
      const canAfford = state.coins >= av.cost;

      const btn = document.createElement('div');
      btn.className = `avatar-option${isSelected ? ' selected' : ''}${!unlocked ? ' locked' : ''}`;
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
      btn.setAttribute('aria-label', `${av.label}${unlocked ? '' : ` - ${av.cost} coins`}`);
      btn.innerHTML = `
        <span style="font-size:2.8rem">${av.id}</span>
        <span style="font-size:0.7rem;font-weight:700;color:var(--ink-faint)">${av.label}</span>
        ${!unlocked ? `<span class="lock-badge">🪙${av.cost}</span>` : ''}
        ${isSelected ? '<span style="position:absolute;bottom:4px;right:4px;font-size:0.7rem;background:var(--sky);color:white;padding:2px 6px;border-radius:99px;font-weight:700">ON</span>' : ''}
      `;

      btn.addEventListener('click', async () => {
        playClick();
        if (unlocked) {
          // Select
          setState({ avatar: { ...state.avatar, body: av.id } });
          await saveState();
          playSuccess();
          toast(`${av.id} selected!`, 'success');
          renderGrid();
          page.querySelector('#coin-count').textContent = `🪙 ${state.coins} coins`;
        } else if (canAfford && !unlocked) {
          // Buy
          state.unlockedAvatars.push(av.id);
          state.coins -= av.cost;
          setState({ avatar: { ...state.avatar, body: av.id }, unlockedAvatars: state.unlockedAvatars, coins: state.coins });
          await saveState();
          playCoin(); playSuccess();
          toast(`🎉 ${av.label} unlocked!`, 'reward');
          renderGrid();
          page.querySelector('#coin-count').textContent = `🪙 ${state.coins} coins`;
        } else {
          toast(`Need ${av.cost} coins to unlock ${av.label}!`, '');
        }
      });

      grid.appendChild(btn);
    });
  }

  renderGrid();
  return page;
}
