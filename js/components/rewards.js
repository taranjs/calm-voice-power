// js/components/rewards.js
import { state, setState, saveState } from '../modules/state.js';
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

    <div class="flex-between mt-24 mb-8">
      <div class="section-title" style="margin-bottom:0">Custom Rewards</div>
      <button class="reward-add-btn" id="add-reward-btn" aria-label="Add custom reward" title="Add reward">+</button>
    </div>
    <div id="custom-reward-list" class="custom-reward-list"></div>

    <div class="reward-modal-backdrop" id="reward-modal" hidden>
      <div class="reward-modal card" role="dialog" aria-modal="true" aria-labelledby="reward-modal-title">
        <h3 id="reward-modal-title">Add Reward</h3>
        <p style="font-size:0.85rem;margin-top:4px">Set a reward name and how many coins are needed.</p>
        <label class="reward-field mt-16" for="reward-name-input">Reward name</label>
        <input
          id="reward-name-input"
          class="challenge-input"
          type="text"
          maxlength="60"
          placeholder="Example: Movie night"
        />
        <label class="reward-field mt-12" for="reward-cost-input">Coins needed</label>
        <input
          id="reward-cost-input"
          class="challenge-input"
          type="number"
          min="1"
          step="1"
          inputmode="numeric"
          placeholder="30"
        />
        <div class="reward-modal-actions mt-16">
          <button class="btn btn-ghost" type="button" id="cancel-reward-btn">Cancel</button>
          <button class="btn btn-primary" type="button" id="save-reward-btn">Save Reward</button>
        </div>
      </div>
    </div>

    <div class="mt-24 card card-soft text-center">
      <p style="font-size:0.85rem;color:var(--ink-faint)">
        💡 Earn coins by practicing, completing challenges, and keeping your streak going!
      </p>
    </div>
  `;

  const customRewardList = page.querySelector('#custom-reward-list');
  const addRewardBtn = page.querySelector('#add-reward-btn');
  const rewardModal = page.querySelector('#reward-modal');
  const rewardNameInput = page.querySelector('#reward-name-input');
  const rewardCostInput = page.querySelector('#reward-cost-input');
  const cancelRewardBtn = page.querySelector('#cancel-reward-btn');
  const saveRewardBtn = page.querySelector('#save-reward-btn');

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

  function renderCustomRewards() {
    customRewardList.innerHTML = '';

    if (state.customRewards.length === 0) {
      customRewardList.innerHTML = `
        <div class="card card-soft">
          <p style="font-size:0.9rem;color:var(--ink-faint)">No custom rewards yet. Tap + to add one.</p>
        </div>
      `;
      return;
    }

    state.customRewards.forEach((reward, index) => {
      const canAfford = state.coins >= reward.cost;
      const redeemedCount = reward.redeemedCount || 0;
      const row = document.createElement('div');
      row.className = 'custom-reward-item';
      row.innerHTML = `
        <div>
          <div class="custom-reward-name"></div>
          <div class="custom-reward-cost">🪙 ${reward.cost}</div>
          ${redeemedCount > 0 ? `<div class="custom-reward-redeemed">Redeemed ${redeemedCount} time${redeemedCount === 1 ? '' : 's'}</div>` : ''}
        </div>
        <div class="custom-reward-actions">
          <button class="btn ${canAfford ? 'btn-sun' : 'btn-ghost'}" type="button">${canAfford ? 'Redeem' : 'Need coins'}</button>
          <button class="challenge-delete" type="button" aria-label="Delete reward">🗑️</button>
        </div>
      `;

      row.querySelector('.custom-reward-name').textContent = reward.name;

      const redeemBtn = row.querySelector('.btn');
      redeemBtn.disabled = !canAfford;
      redeemBtn.addEventListener('click', async () => {
        playClick();
        state.coins -= reward.cost;
        reward.redeemedCount = redeemedCount + 1;
        state.customRewards[index] = reward;
        setState({ coins: state.coins });
        await saveState();
        playCoin();
        toast(`Redeemed: ${reward.name} 🎉`, 'reward');
        page.querySelector('#coin-count').textContent = `🪙 ${state.coins} coins`;
        renderCustomRewards();
      });

      row.querySelector('.challenge-delete').addEventListener('click', async () => {
        playClick();
        state.customRewards.splice(index, 1);
        await saveState();
        toast('Reward removed');
        renderCustomRewards();
      });

      customRewardList.appendChild(row);
    });
  }

  function openRewardModal() {
    rewardModal.hidden = false;
    rewardNameInput.value = '';
    rewardCostInput.value = '';
    rewardNameInput.focus();
  }

  function closeRewardModal() {
    rewardModal.hidden = true;
  }

  async function saveCustomReward() {
    const name = rewardNameInput.value.trim().replace(/\s+/g, ' ');
    const cost = Number(rewardCostInput.value);

    if (!name) {
      toast('Type a reward name first');
      rewardNameInput.focus();
      return;
    }
    if (!Number.isInteger(cost) || cost <= 0) {
      toast('Coins needed must be a whole number');
      rewardCostInput.focus();
      return;
    }

    state.customRewards.push({ id: Date.now(), name, cost, redeemedCount: 0 });
    await saveState();
    closeRewardModal();
    toast(`Reward added: ${name} (${cost} coins) ⭐`);
    renderCustomRewards();
  }

  addRewardBtn.addEventListener('click', () => {
    playClick();
    openRewardModal();
  });
  cancelRewardBtn.addEventListener('click', () => {
    playClick();
    closeRewardModal();
  });
  saveRewardBtn.addEventListener('click', async () => {
    playClick();
    await saveCustomReward();
  });
  rewardModal.addEventListener('click', (event) => {
    if (event.target !== rewardModal) return;
    closeRewardModal();
  });
  rewardNameInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    rewardCostInput.focus();
  });
  rewardCostInput.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    await saveCustomReward();
  });

  // Ensure modal never appears until user taps "+"
  closeRewardModal();
  renderGrid();
  renderCustomRewards();
  return page;
}
