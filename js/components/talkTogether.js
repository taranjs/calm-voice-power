// js/components/talkTogether.js – "Talk Together"
//
// Speech is for talking to people, and until now there was no other person
// anywhere in this app. A child can be fluent alone with a phone and still not
// be able to order an ice cream.
//
// It is also the missing rung of the ladder. The app had isolated words and
// canned phrases, and then jumped straight to "ask your teacher a question".
// Transfer happens in the middle — in real back-and-forth conversation — and
// this is the only activity that lives there.
//
// Deliberately NOT scored on fluency. Conversation is where pressure does the
// most damage, so the app counts turns taken and nothing else: how it sounded
// is none of its business here.
import { navigate } from '../modules/router.js';
import { awardRep, saveState, recordPractice } from '../modules/state.js';
import { playSuccess, playClick, playTone } from '../modules/audio.js';
import { acquireMic, releaseMic, isMicSupported, calibrateNoiseFloor, createVoiceTracker } from '../modules/voice.js';
import { createMicPanel } from '../components/micPanel.js';
import { dailyTalkPrompts } from '../modules/content.js';
import { getSetting, setSetting } from '../modules/db.js';
import { toast } from '../modules/toast.js';

const PARTNERS = ['Mum', 'Dad', 'Grandma', 'Grandad', 'My friend', 'My brother', 'My sister'];
const ROUNDS = 6;
const TURN_TIMEOUT_MS = 30000;

export function renderTalkTogether() {
  const page = document.createElement('div');
  page.className = 'page';

  let partner = 'someone';
  let prompts = dailyTalkPrompts(ROUNDS);
  let round = 0, turns = 0;
  let phase = 'setup';           // setup | mine | theirs | done
  let listening = false, micReady = false, tracker = null, turnTimer = null;

  page.innerHTML = `
    <div class="page-header flex-between">
      <div>
        <h2>Talk Together 💛</h2>
        <p class="subtitle">Take turns with a real person</p>
      </div>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
    </div>

    <div id="setup-view">
      <div class="card card-soft mb-16 text-center">
        <div style="font-size:3rem">👋</div>
        <p style="font-weight:800;margin-top:8px">Go and find someone!</p>
        <p style="font-size:0.88rem;margin-top:6px">
          Sit next to each other and take turns talking. I'll just count your turns —
          I'm not listening for anything clever.
        </p>
      </div>

      <div class="section-title">Who's talking with you?</div>
      <div class="breath-chips mb-16" id="partner-chips" role="radiogroup" aria-label="Who is with you">
        ${PARTNERS.map(p => `<button class="breath-chip" data-partner="${p}" role="radio"
          aria-checked="false" type="button">${p}</button>`).join('')}
      </div>
      <div class="challenge-input-row mb-16">
        <input id="partner-input" class="challenge-input" type="text" maxlength="20"
          placeholder="…or type a name" aria-label="Type who is with you" />
      </div>

      <div class="action-stack">
        <button class="btn btn-primary btn-lg" id="begin-btn">Let's talk! 💬</button>
      </div>
    </div>

    <div id="talk-view" style="display:none">
      <div class="card mb-16 text-center">
        <div class="turn-badge" id="turn-badge">Your turn</div>
        <div class="game-prompt" id="prompt" style="font-size:1.25rem;line-height:1.5;margin:10px 0"></div>
        <div id="mic-slot"></div>
        <p style="font-weight:700;min-height:22px" id="talk-msg"></p>
      </div>

      <div class="turn-track" id="turn-track" aria-label="Turns taken"></div>

      <div class="action-stack mt-16">
        <button class="btn btn-primary btn-lg" id="turn-btn">🎤 I'm talking</button>
        <div class="action-row">
          <button class="btn btn-ghost" id="skip-turn">Next prompt →</button>
          <button class="btn btn-ghost" id="finish-btn">Finish</button>
        </div>
      </div>
    </div>

    <div id="done-view" style="display:none">
      <div class="card card-mint text-center">
        <div style="font-size:4rem" class="float">🎉</div>
        <h3 style="margin-top:8px" id="done-title"></h3>
        <p style="font-size:0.9rem;margin-top:8px" id="done-note"></p>
        <div class="action-stack mt-16">
          <button class="btn btn-primary" id="again-btn">Talk again 💬</button>
          <div class="action-row">
            <button class="btn btn-ghost" id="home-btn">🏠 Home</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const setupView = page.querySelector('#setup-view');
  const talkView  = page.querySelector('#talk-view');
  const doneView  = page.querySelector('#done-view');
  const chipsEl   = page.querySelector('#partner-chips');
  const nameInput = page.querySelector('#partner-input');
  const badge     = page.querySelector('#turn-badge');
  const promptEl  = page.querySelector('#prompt');
  const msgEl     = page.querySelector('#talk-msg');
  const turnBtn   = page.querySelector('#turn-btn');
  const trackEl   = page.querySelector('#turn-track');

  const mic = createMicPanel({ status: 'Tap when you start talking 👂' });
  page.querySelector('#mic-slot').appendChild(mic.el);

  getSetting('talkPartner', null).then(saved => {
    if (!saved) return;
    nameInput.value = saved;
    const chip = chipsEl.querySelector(`[data-partner="${saved}"]`);
    if (chip) selectChip(chip);
  }).catch(() => {});

  function selectChip(btn) {
    chipsEl.querySelectorAll('.breath-chip').forEach(c => {
      const on = c === btn;
      c.classList.toggle('active', on);
      c.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    nameInput.value = btn.dataset.partner;
  }

  chipsEl.addEventListener('click', e => {
    const btn = e.target.closest('.breath-chip');
    if (!btn) return;
    playClick();
    selectChip(btn);
  });

  function paintTrack() {
    trackEl.innerHTML = Array.from({ length: ROUNDS * 2 }, (_, i) =>
      `<span class="turn-dot${i < turns ? ' on' : ''}${i % 2 ? ' theirs' : ''}"></span>`).join('');
  }

  function paintPrompt() {
    promptEl.textContent = prompts[round % prompts.length];
    badge.textContent = phase === 'theirs' ? `${partner}'s turn` : 'Your turn';
    badge.className = `turn-badge${phase === 'theirs' ? ' theirs' : ''}`;
    turnBtn.textContent = phase === 'theirs' ? `👂 ${partner} is talking` : "🎤 I'm talking";
  }

  async function ensureMic() {
    if (micReady) return true;
    if (!isMicSupported()) return false;
    try {
      await acquireMic();
      mic.setStatus('Listening to the room for a second…');
      await calibrateNoiseFloor(600);
      micReady = true;
      return true;
    } catch (e) { return false; }
  }

  function endTurn(heard) {
    listening = false;
    clearTimeout(turnTimer);
    mic.listening(false);
    tracker?.stop();
    turnBtn.disabled = false;

    if (!heard) {
      msgEl.textContent = 'I didn’t hear anyone — have another go 💙';
      mic.setStatus('Ready when you are');
      paintPrompt();
      return;
    }

    turns++;
    paintTrack();
    playTone(phase === 'mine' ? 523 : 392, 0.14, 'sine', 0.12);

    if (phase === 'mine') {
      phase = 'theirs';
      msgEl.textContent = `Nice one! Now it's ${partner}'s turn 👂`;
    } else {
      phase = 'mine';
      round++;
      msgEl.textContent = 'Your turn again!';
    }
    mic.setStatus('');
    paintPrompt();

    if (turns >= ROUNDS * 2) finish();
  }

  async function startTurn() {
    if (listening) return;
    // Claim the turn before awaiting the microphone: ensureMic() takes most of
    // a second, and an impatient double tap would otherwise start two.
    listening = true;
    turnBtn.disabled = true;
    playClick();

    const ok = await ensureMic();
    if (!ok) {
      listening = false;
      turnBtn.disabled = false;
      // Without a mic this still works perfectly well as a talking game.
      mic.setStatus('No microphone — just tap after each turn 💙');
      endTurn(true);
      return;
    }

    listening = true;
    mic.listening(true);
    turnBtn.disabled = true;
    msgEl.textContent = phase === 'theirs' ? `Listening to ${partner}…` : 'Off you go!';
    mic.setStatus('Talking… 💬', 'good');

    let heard = false;
    tracker = createVoiceTracker({
      silenceToEndMs: 2000,        // real speech has real gaps in it
      onFrame: ({ level, threshold, everVoiced }) => {
        mic.setLevel(level, threshold);
        if (everVoiced) heard = true;
      },
      onSettled: () => endTurn(heard),
    });
    tracker.reset();
    tracker.start();
    turnTimer = setTimeout(() => endTurn(heard), TURN_TIMEOUT_MS);
  }

  async function finish() {
    phase = 'done';
    listening = false;
    clearTimeout(turnTimer);
    tracker?.stop();
    mic.listening(false);
    talkView.style.display = 'none';
    doneView.style.display = '';

    page.querySelector('#done-title').textContent =
      `You took ${turns} turn${turns === 1 ? '' : 's'} with ${partner}!`;
    page.querySelector('#done-note').textContent = turns >= ROUNDS
      ? 'That was a real conversation — the hardest and most useful practice there is. 💛'
      : 'Every turn counts. Talking with someone is the bravest practice of all. 💛';

    playSuccess();
    await recordPractice('talk-together', { turns, partner });
    const coins = await awardRep('talk-together', 6);
    await saveState();
    if (coins) toast(`🪙 +${coins} coins!`, 'reward');
  }

  page.querySelector('#begin-btn').addEventListener('click', async () => {
    playClick();
    partner = (nameInput.value.trim() || 'them').slice(0, 20);
    await setSetting('talkPartner', partner);
    prompts = dailyTalkPrompts(ROUNDS);
    round = 0; turns = 0; phase = 'mine';
    setupView.style.display = 'none';
    talkView.style.display = '';
    doneView.style.display = 'none';
    paintTrack();
    paintPrompt();
    msgEl.textContent = '';
  });

  turnBtn.addEventListener('click', startTurn);

  page.querySelector('#skip-turn').addEventListener('click', () => {
    playClick();
    round++;
    paintPrompt();
  });
  page.querySelector('#finish-btn').addEventListener('click', () => { playClick(); finish(); });
  page.querySelector('#again-btn').addEventListener('click', () => {
    playClick();
    doneView.style.display = 'none';
    setupView.style.display = '';
  });
  page.querySelector('#home-btn').addEventListener('click', () => { playClick(); navigate('home'); });
  page.querySelector('#exit-btn').addEventListener('click', () => { playClick(); navigate('practice'); });

  page.__cleanup = () => {
    clearTimeout(turnTimer);
    tracker?.stop();
    if (micReady) releaseMic();
  };

  return page;
}
