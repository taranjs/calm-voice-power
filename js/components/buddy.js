// js/components/buddy.js – a friend who gets stuck too
//
// Everything else in this app is about speaking more smoothly. That is worth
// practising, but on its own it carries a quiet message: smooth is good, stuck
// is bad. A child who absorbs only that learns to hide, avoid, and dread the
// moments he gets stuck — and avoidance does far more damage over a childhood
// than the stammer itself.
//
// So: a friend who stammers, is completely fine about it, and needs *him*. He
// is the one who knows what to do. Getting stuck is shown as ordinary, survivable
// and not an emergency, and one of the offered strategies is bouncing on a word
// on purpose — voluntary stuttering, the classic desensitisation move, framed
// as a game rather than an exercise.
//
// Nothing here is scored. There is no wrong way to help a friend.
import { navigate } from '../modules/router.js';
import { awardRep, saveState, recordPractice } from '../modules/state.js';
import { playSuccess, playClick, playTone, playGentleRamp } from '../modules/audio.js';
import { getSetting, setSetting } from '../modules/db.js';
import { toast } from '../modules/toast.js';

const CREATURES = ['🦕', '🐙', '🦊', '🐢', '🦉', '🐧', '🐝', '🦋'];

// The situations children who stammer most often name as hard. The buddy walks
// into them and comes out fine.
const SCENARIOS = [
  { where: 'at the ice cream shop', icon: '🍦',
    line: 'I would like a chocolate one please', stuck: 'ch', stuckWord: 'chocolate' },
  { where: 'meeting someone new', icon: '👋',
    line: 'My name is {name}', stuck: 'm', stuckWord: 'My' },
  { where: 'in class', icon: '🏫',
    line: 'I know the answer!', stuck: 'I', stuckWord: 'I' },
  { where: 'on the phone', icon: '📞',
    line: 'Hello, is Sam there please?', stuck: 'h', stuckWord: 'Hello' },
  { where: 'at the park', icon: '🌳',
    line: 'Can I play with you?', stuck: 'c', stuckWord: 'Can' },
  { where: 'ordering at a cafe', icon: '🥤',
    line: 'Could I have a juice please?', stuck: 'c', stuckWord: 'Could' },
  { where: 'at a friend\'s house', icon: '🏠',
    line: 'Please can I have a turn?', stuck: 'p', stuckWord: 'Please' },
];

// Every option is a real thing a person can do, so none of them is wrong.
const STRATEGIES = [
  { id: 'breath', icon: '🌬️', label: 'Take a breath first',
    reply: 'I breathed out first… and it came out! Thank you.' },
  { id: 'slow', icon: '🐢', label: 'Say it slow and stretchy',
    reply: 'Sloooowly. That felt much easier. Good idea!' },
  { id: 'keep', icon: '💙', label: "It's okay — just keep going",
    reply: 'I got a bit stuck… and I said it anyway! Getting stuck did not stop me.' },
  { id: 'bounce', icon: '🏀', label: 'Bounce on it, like b-b-bouncing',
    reply: 'B-b-bouncing on purpose is actually kind of fun! It stopped feeling scary.' },
];

const REFLECTIONS = [
  'Everybody gets stuck on words sometimes. It is not a bad thing that happened to you.',
  'People who wait while you talk are the best kind of people. You can ask someone to wait.',
  'Getting stuck and saying it anyway is braver than never getting stuck at all.',
  'You do not have to hide it. Your friend did not, and everyone was fine.',
  'Your voice is worth waiting for — including when it takes a moment.',
];

export function renderBuddy() {
  const page = document.createElement('div');
  page.className = 'page';

  let buddy = { emoji: '🦕', name: '' };
  let scenarioIdx = 0, helped = 0;
  let phase = 'naming';    // naming | scene | stuck | choose | resolved

  page.innerHTML = `
    <div class="page-header flex-between">
      <div>
        <h2>My Buddy 🦕</h2>
        <p class="subtitle">A friend who gets stuck too</p>
      </div>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
    </div>

    <div id="naming-view">
      <div class="card card-soft text-center mb-16">
        <p style="font-weight:800">Meet your buddy!</p>
        <p style="font-size:0.88rem;margin-top:6px">
          Your buddy gets stuck on words, just like lots of people do.
          You're going to help them out.
        </p>
      </div>
      <div class="section-title">Pick your buddy</div>
      <div class="avatar-customize-row mb-16" id="creature-row"></div>
      <div class="section-title">Give them a name</div>
      <input class="avatar-name-input mb-16" id="buddy-name" maxlength="16" placeholder="Their name…" />
      <div class="action-stack">
        <button class="btn btn-primary btn-lg" id="meet-btn">Let's go! 💛</button>
      </div>
    </div>

    <div id="scene-view" style="display:none">
      <div class="card text-center mb-16">
        <div style="font-size:0.8rem;font-weight:800;color:var(--ink-faint)" id="where"></div>
        <div class="buddy-face" id="buddy-face">🦕</div>
        <div class="speech-bubble" id="bubble"></div>
        <p style="font-weight:700;min-height:24px;margin-top:10px" id="scene-msg"></p>
      </div>

      <div id="choose-box" style="display:none">
        <div class="section-title text-center">What could help?</div>
        <div id="strategy-list"></div>
        <p class="text-center" style="font-size:0.8rem;color:var(--ink-faint);margin-top:8px">
          There's no wrong answer — these all work.
        </p>
      </div>

      <div class="action-stack mt-16" id="scene-actions">
        <button class="btn btn-primary btn-lg" id="next-btn">Next →</button>
      </div>
    </div>

    <div id="reflect-view" style="display:none">
      <div class="card card-lavender text-center">
        <div style="font-size:3rem">💛</div>
        <h3 style="margin-top:8px" id="reflect-title"></h3>
        <p style="font-size:0.9rem;margin-top:10px" id="reflect-note"></p>
      </div>
      <div class="action-stack mt-16">
        <button class="btn btn-primary" id="more-btn">Help again 🦕</button>
        <div class="action-row">
          <button class="btn btn-ghost" id="home2-btn">🏠 Home</button>
        </div>
      </div>
    </div>
  `;

  const namingView = page.querySelector('#naming-view');
  const sceneView  = page.querySelector('#scene-view');
  const reflectView= page.querySelector('#reflect-view');
  const faceEl     = page.querySelector('#buddy-face');
  const bubbleEl   = page.querySelector('#bubble');
  const whereEl    = page.querySelector('#where');
  const msgEl      = page.querySelector('#scene-msg');
  const chooseBox  = page.querySelector('#choose-box');
  const stratList  = page.querySelector('#strategy-list');
  const nextBtn    = page.querySelector('#next-btn');
  const nameInput  = page.querySelector('#buddy-name');

  // ── Setup ──────────────────────────────────────
  const creatureRow = page.querySelector('#creature-row');
  CREATURES.forEach(c => {
    const btn = document.createElement('button');
    btn.className = `avatar-part-btn${c === buddy.emoji ? ' selected' : ''}`;
    btn.textContent = c;
    btn.setAttribute('aria-label', `Choose ${c}`);
    btn.addEventListener('click', () => {
      playClick();
      buddy.emoji = c;
      creatureRow.querySelectorAll('.avatar-part-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    creatureRow.appendChild(btn);
  });

  getSetting('buddy', null).then(saved => {
    if (!saved?.name) return;
    buddy = saved;
    nameInput.value = saved.name;
    const btn = [...creatureRow.children].find(b => b.textContent === saved.emoji);
    if (btn) { creatureRow.querySelectorAll('.avatar-part-btn').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); }
    startScene();
  }).catch(() => {});

  function scenario() { return SCENARIOS[scenarioIdx % SCENARIOS.length]; }
  function lineFor(s) { return s.line.replace('{name}', buddy.name || 'Pip'); }

  // ── The buddy gets stuck ───────────────────────
  function showStuck() {
    phase = 'stuck';
    const s = scenario();
    faceEl.textContent = buddy.emoji;
    faceEl.className = 'buddy-face stuck';
    const rest = lineFor(s).replace(s.stuckWord, '').trim();

    // A repetition, drawn plainly and without alarm. No red, no buzzer.
    let reps = 0;
    bubbleEl.innerHTML = `<span class="stuck-part"></span>`;
    const part = bubbleEl.querySelector('.stuck-part');
    const tick = setInterval(() => {
      reps++;
      part.textContent = Array(reps).fill(s.stuck).join('-') + '…';
      playTone(220, 0.08, 'sine', 0.06);
      if (reps >= 3) {
        clearInterval(tick);
        msgEl.textContent = `${buddy.name} is stuck on a word.`;
        chooseBox.style.display = '';
        nextBtn.style.display = 'none';
        paintStrategies();
      }
    }, 420);
  }

  function paintStrategies() {
    phase = 'choose';
    stratList.innerHTML = '';
    STRATEGIES.forEach(st => {
      const btn = document.createElement('button');
      btn.className = 'strategy-btn';
      btn.innerHTML = `<span class="strategy-icon">${st.icon}</span><span>${st.label}</span>`;
      btn.addEventListener('click', () => resolve(st));
      stratList.appendChild(btn);
    });
  }

  async function resolve(strategy) {
    if (phase !== 'choose') return;
    playClick();
    phase = 'resolved';
    chooseBox.style.display = 'none';
    faceEl.className = 'buddy-face';
    if (strategy.id === 'breath') playGentleRamp(330, 0.5, 0.3, 0.14);

    const s = scenario();
    bubbleEl.textContent = lineFor(s);
    msgEl.textContent = strategy.reply;
    playSuccess();

    helped++;
    setTimeout(() => {
      msgEl.textContent = `“Thanks for waiting for me. People who wait are the best.” — ${buddy.name}`;
    }, 2600);

    nextBtn.style.display = '';
    nextBtn.textContent = helped >= 3 ? 'Finish 💛' : 'Next →';

    if (helped === 1) {
      await recordPractice('buddy', { helped });
      const coins = await awardRep('buddy', 5);
      await saveState();
      if (coins) toast(`🪙 +${coins} coins for helping!`, 'reward');
    }
  }

  function startScene() {
    namingView.style.display = 'none';
    reflectView.style.display = 'none';
    sceneView.style.display = '';
    phase = 'scene';
    const s = scenario();
    whereEl.textContent = s.where.toUpperCase();
    faceEl.textContent = buddy.emoji;
    faceEl.className = 'buddy-face';
    bubbleEl.textContent = '…';
    msgEl.textContent = `${buddy.name} wants to say something ${s.where}.`;
    chooseBox.style.display = 'none';
    nextBtn.style.display = '';
    nextBtn.textContent = 'They start talking →';
    nextBtn.onclick = () => { playClick(); showStuck(); };
  }

  function finish() {
    sceneView.style.display = 'none';
    reflectView.style.display = '';
    page.querySelector('#reflect-title').textContent =
      `You helped ${buddy.name} ${helped} time${helped === 1 ? '' : 's'}!`;
    page.querySelector('#reflect-note').textContent =
      REFLECTIONS[Math.floor(Math.random() * REFLECTIONS.length)];
    playSuccess();
  }

  nextBtn.addEventListener('click', () => {
    if (phase !== 'resolved') return;
    playClick();
    if (helped >= 3) return finish();
    scenarioIdx++;
    startScene();
  });

  page.querySelector('#meet-btn').addEventListener('click', async () => {
    playClick();
    buddy.name = (nameInput.value.trim() || 'Pip').slice(0, 16);
    await setSetting('buddy', buddy);
    scenarioIdx = Math.floor(Math.random() * SCENARIOS.length);
    helped = 0;
    startScene();
  });

  page.querySelector('#more-btn').addEventListener('click', () => {
    playClick();
    helped = 0;
    scenarioIdx++;
    startScene();
  });
  page.querySelector('#home2-btn').addEventListener('click', () => { playClick(); navigate('home'); });
  page.querySelector('#exit-btn').addEventListener('click', () => { playClick(); navigate('practice'); });

  return page;
}
