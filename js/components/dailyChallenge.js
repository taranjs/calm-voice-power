// js/components/dailyChallenge.js
import { state, saveState } from '../modules/state.js';
import { addCoins } from '../modules/state.js';
import { navigate } from '../modules/router.js';
import { playSuccess, playClick } from '../modules/audio.js';
import { toast } from '../modules/toast.js';

export function renderDailyChallenge() {
  const page = document.createElement('div');
  page.className = 'page';

  page.innerHTML = `
    <div class="page-header flex-between">
      <div>
        <h2>Today's Challenges 🌟</h2>
        <p class="subtitle">Brave real-world tries!</p>
      </div>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
    </div>

    <div class="card card-sun mb-16">
      <div class="flex-between">
        <div>
          <div style="font-weight:800">Real World Brave Tries</div>
          <p style="font-size:0.85rem;margin-top:4px">Each challenge earns you 15 coins!</p>
        </div>
        <span style="font-size:2rem">🌍</span>
      </div>
    </div>

    <div class="card mb-16">
      <div style="font-weight:800">Type your own challenge ✍️</div>
      <p style="font-size:0.85rem;margin-top:4px">Add something brave you want to try today.</p>
      <div class="challenge-input-row mt-16">
        <input
          id="challenge-input"
          class="challenge-input"
          type="text"
          maxlength="80"
          placeholder="Example: Ask my teacher one question"
          aria-label="Type a custom challenge"
        />
        <button class="btn btn-primary" id="add-challenge-btn" style="min-height:44px;padding:10px 16px;font-size:0.9rem">Add</button>
      </div>
    </div>

    <div id="challenge-list"></div>

    <div class="mt-16 card text-center" style="display:none" id="all-done">
      <div style="font-size:3rem">🏆</div>
      <h3 style="margin:8px 0">All done! You're amazing!</h3>
      <p>You completed all today's brave challenges.</p>
      <button class="btn btn-mint btn-lg mt-16" id="go-home">Back Home 🏠</button>
    </div>
  `;

  const list = page.querySelector('#challenge-list');
  const allDone = page.querySelector('#all-done');
  const challengeInput = page.querySelector('#challenge-input');
  const addChallengeBtn = page.querySelector('#add-challenge-btn');

  async function addCustomChallenge() {
    const text = challengeInput.value.trim().replace(/\s+/g, ' ');
    if (!text) {
      toast('Type a challenge first ✍️');
      return;
    }
    playClick();
    state.todayChallenges.push({ id: Date.now(), text, icon: '✍️', done: false, custom: true });
    challengeInput.value = '';
    list.style.display = '';
    allDone.style.display = 'none';
    await saveState();
    toast('Added! Let\'s do this 💪');
    render();
  }

  function render() {
    list.innerHTML = '';
    state.todayChallenges.forEach((ch, i) => {
      const el = document.createElement('div');
      el.className = `challenge-item${ch.done ? ' done' : ''}`;
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.innerHTML = `
        <div class="challenge-check">${ch.done ? '✅' : ''}</div>
        <span class="challenge-icon">${ch.icon}</span>
        <div>
          <div class="challenge-text"></div>
          ${!ch.done ? '<div style="font-size:0.75rem;color:var(--sky);font-weight:700;margin-top:2px">Tap when done! 🙌</div>' : '<div style="font-size:0.75rem;color:var(--mint);font-weight:700;margin-top:2px">+15 coins earned! ✨</div>'}
        </div>
        ${ch.custom ? '<button class="challenge-delete" type="button" aria-label="Delete challenge">🗑️</button>' : ''}
      `;
      el.querySelector('.challenge-text').textContent = ch.text;

      const deleteBtn = el.querySelector('.challenge-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (event) => {
          event.stopPropagation();
          playClick();
          state.todayChallenges.splice(i, 1);
          await saveState();
          toast('Challenge removed');
          render();
          if (state.todayChallenges.length === 0 || state.todayChallenges.every(c => c.done)) {
            list.style.display = 'none';
            allDone.style.display = '';
          }
        });
      }

      if (!ch.done) {
        el.addEventListener('click', async () => {
          playClick();
          state.todayChallenges[i].done = true;
          await addCoins(15);
          await saveState();
          playSuccess();
          toast(`🌟 Amazing! +15 coins!`, 'reward');
          render();
          if (state.todayChallenges.every(c => c.done)) {
            list.style.display = 'none';
            allDone.style.display = '';
          }
        });
      }
      list.appendChild(el);
    });
  }

  render();

  if (state.todayChallenges.every(c => c.done)) {
    list.style.display = 'none';
    allDone.style.display = '';
  }

  addChallengeBtn.addEventListener('click', addCustomChallenge);
  challengeInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addCustomChallenge();
  });

  page.querySelector('#exit-btn').addEventListener('click', () => { playClick(); navigate('home'); });
  allDone.querySelector('#go-home')?.addEventListener('click', () => { playClick(); navigate('home'); });

  return page;
}
