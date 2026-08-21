// js/components/myWords.js – "My Words"
//
// He picks a word and records himself saying it well. From then on, every
// "🔊 Hear it" button in the app plays *his* voice instead of the synthesiser.
// He can also add words of his own, which join the practice pools.
//
// The recording is not a detour from practice. Saying "Apple" with a soft
// gentle start so the app can keep it *is* the exercise – so the take is
// analysed like any other attempt, counted toward his onset history, and told
// back to him. Authoring and practising are the same action here.
import { navigate } from '../modules/router.js';
import { state, addOnsetSample, awardRep, saveState, recordPractice } from '../modules/state.js';
import { startRecording, stopRecording, rmsFrom, playSuccess, playClick } from '../modules/audio.js';
import { classifyOnset, voiceThreshold, onsetTargetFrom, isMicSupported } from '../modules/voice.js';
import {
  listWords, addCustomWord, saveWordModel, removeWordModel, removeWord,
  playWordModel, stopModel, wordKey, isVowelInitial, plainWord,
} from '../modules/myWords.js';
import { dailyPowerWords, dailyGentleWords } from '../modules/content.js';
import { toast, praiseToast } from '../modules/toast.js';

const ONSET_WINDOW_MS = 450;
const MAX_TAKE_MS = 6000;
const SILENCE_END_MS = 900;
const MIN_TAKE_MS = 400;

export function renderMyWords() {
  const page = document.createElement('div');
  page.className = 'page';

  let entries = [];          // everything in the words store
  let recording = false;
  let activeWord = null;
  let analyser = null, raf = null, stopTimer = null;
  // Component-scoped so the manual Done button judges the same take the
  // auto-stop would have, rather than a fresh empty one.
  let envelope = [];

  page.innerHTML = `
    <div class="page-header flex-between">
      <div>
        <h2>My Words 🎤</h2>
        <p class="subtitle">Teach the app to say words in your voice</p>
      </div>
      <button class="btn btn-ghost" id="exit-btn" style="padding:10px 16px;font-size:0.85rem">✕</button>
    </div>

    <div class="card card-soft mb-16">
      <p style="font-size:0.9rem;font-weight:700">How this works 🌟</p>
      <p style="font-size:0.85rem;margin-top:6px">
        Say a word really well and I'll keep it. Then whenever you tap
        <strong>🔊 Hear it</strong> in a game, you'll hear <strong>you</strong> — not a robot.
      </p>
    </div>

    <div class="card mb-16">
      <div style="font-weight:800">Add your own word ✍️</div>
      <p style="font-size:0.85rem;margin-top:4px">Any word you want to practise.</p>
      <div class="challenge-input-row mt-16">
        <input id="word-input" class="challenge-input" type="text" maxlength="24"
          placeholder="Example: Dinosaur" aria-label="Add a word" />
        <button class="btn btn-primary" id="add-word-btn"
          style="min-height:44px;padding:10px 16px;font-size:0.9rem">Add</button>
      </div>
    </div>

    <div id="rec-panel" class="card card-lavender mb-16" style="display:none">
      <div class="text-center">
        <div style="font-size:0.8rem;font-weight:800;color:var(--lavender)">RECORDING</div>
        <div class="game-prompt" id="rec-word" style="margin:6px 0"></div>
        <div class="mic-meter" id="rec-meter" aria-hidden="true">
          ${Array.from({ length: 14 }, () => '<span class="mic-seg"></span>').join('')}
        </div>
        <p style="font-weight:700;min-height:22px" id="rec-status">Say it gently and clearly…</p>
        <div class="action-row mt-12">
          <button class="btn btn-ghost" id="rec-cancel">Cancel</button>
          <button class="btn btn-primary" id="rec-stop">Done</button>
        </div>
      </div>
    </div>

    <div id="word-groups"></div>
  `;

  const groupsEl  = page.querySelector('#word-groups');
  const recPanel  = page.querySelector('#rec-panel');
  const recWordEl = page.querySelector('#rec-word');
  const recStatus = page.querySelector('#rec-status');
  const recSegs   = [...page.querySelectorAll('#rec-meter .mic-seg')];
  const input     = page.querySelector('#word-input');

  function entryFor(word) {
    return entries.find(e => e.id === wordKey(plainWord(word)));
  }

  function setMeter(level) {
    const scaled = Math.min(level / (voiceThreshold() * 6), 1);
    const lit = Math.round(scaled * recSegs.length);
    recSegs.forEach((s, i) => {
      s.classList.toggle('lit', i < lit);
      s.classList.toggle('over', i < lit && i >= 2);
    });
  }

  // ── Recording a model ──────────────────────────
  async function startModelTake(word) {
    if (recording) return;
    if (!isMicSupported()) { toast('No microphone on this device'); return; }
    playClick();
    stopModel();

    try {
      analyser = await startRecording();
    } catch (e) {
      toast('Could not access microphone. Please allow permission.');
      return;
    }

    recording = true;
    activeWord = word;
    recWordEl.textContent = plainWord(word);
    recStatus.textContent = isVowelInitial(word)
      ? 'Breathe out, then let it float in… 🪶'
      : 'Say it slowly and smoothly… 🌈';
    recPanel.style.display = '';
    recPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Build the onset envelope from the recording's own analyser, so we can
    // judge the take without opening a second microphone stream.
    envelope = [];
    let onsetAt = null, lastVoiceAt = null;
    const startedAt = performance.now();

    (function sample(ts = performance.now()) {
      if (!recording) return;
      const level = rmsFrom(analyser);
      setMeter(level);
      const th = voiceThreshold();

      if (level >= th) {
        if (onsetAt === null) onsetAt = ts;
        lastVoiceAt = ts;
      }
      if (onsetAt !== null && ts - onsetAt <= ONSET_WINDOW_MS) {
        envelope.push({ t: ts - onsetAt, level });
      }
      // Stop by itself once he has spoken and gone quiet.
      if (lastVoiceAt && ts - lastVoiceAt >= SILENCE_END_MS && ts - startedAt >= MIN_TAKE_MS) {
        finishModelTake();
        return;
      }
      raf = requestAnimationFrame(sample);
    })();

    stopTimer = setTimeout(() => finishModelTake(), MAX_TAKE_MS);
  }

  async function finishModelTake({ cancelled = false } = {}) {
    if (!recording) return;
    recording = false;
    if (raf) cancelAnimationFrame(raf);
    clearTimeout(stopTimer);
    recSegs.forEach(s => s.classList.remove('lit', 'over'));

    const blob = await stopRecording();
    const word = activeWord;
    activeWord = null;
    recPanel.style.display = 'none';

    if (cancelled || !blob) return;

    if (!envelope.length) {
      toast('I couldn’t hear that one – try a bit closer 🎤');
      return;
    }

    const goalMs = onsetTargetFrom(state.voiceProfile.onsetSamples);
    const onset = classifyOnset(envelope, { gentleMs: goalMs });

    await saveWordModel(word, {
      blob,
      durationMs: Math.round(envelope[envelope.length - 1]?.t || 0),
      riseMs: onset?.riseMs ?? null,
    });

    // Recording a model *is* a gentle-onset rep, so it counts like one.
    if (onset && isVowelInitial(word)) await addOnsetSample(onset.riseMs);

    playSuccess();
    praiseToast();
    await recordPractice('my-words', { word: plainWord(word) });
    const coins = await awardRep('my-words', 4);
    await saveState();

    const how = onset?.quality === 'gentle'
      ? '🪶 lovely soft start too!'
      : onset?.quality === 'hard'
        ? 'Next time try letting it float in a bit softer 💙'
        : '';
    toast(`🎤 Saved in your voice! ${coins ? `+${coins} coins` : ''}`.trim(), 'reward');
    if (how) setTimeout(() => toast(how, 'success'), 900);

    await refresh();
  }

  function cancelTake() {
    if (!recording) return;
    playClick();
    finishModelTake({ cancelled: true });
  }

  // ── Rendering ──────────────────────────────────
  function wordRow(word) {
    const entry = entryFor(word);
    const mine = !!entry?.blob;
    const row = document.createElement('div');
    row.className = `word-row${mine ? ' has-model' : ''}`;
    row.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="word-row-name"></div>
        <div class="word-row-note">${mine
          ? `🎤 Your voice${entry.riseMs ? ` · ${entry.riseMs}ms start` : ''}`
          : 'No recording yet'}</div>
      </div>
      <div class="word-row-actions"></div>
    `;
    row.querySelector('.word-row-name').textContent = plainWord(word);

    const actions = row.querySelector('.word-row-actions');

    if (mine) {
      const play = document.createElement('button');
      play.className = 'btn btn-ghost';
      play.textContent = '▶';
      play.setAttribute('aria-label', `Play my recording of ${plainWord(word)}`);
      play.addEventListener('click', async () => {
        playClick();
        play.textContent = '⏸';
        await playWordModel(word);
        play.textContent = '▶';
      });
      actions.appendChild(play);
    }

    const rec = document.createElement('button');
    rec.className = `btn ${mine ? 'btn-ghost' : 'btn-primary'}`;
    rec.textContent = mine ? '🔁' : '🎤';
    rec.setAttribute('aria-label', `${mine ? 'Re-record' : 'Record'} ${plainWord(word)}`);
    rec.addEventListener('click', () => startModelTake(word));
    actions.appendChild(rec);

    if (mine || entry?.custom) {
      const del = document.createElement('button');
      del.className = 'challenge-delete';
      del.type = 'button';
      del.textContent = '🗑️';
      del.setAttribute('aria-label', `Remove ${plainWord(word)}`);
      del.addEventListener('click', async () => {
        playClick();
        if (mine) await removeWordModel(word);
        else await removeWord(word);
        toast(mine ? 'Recording removed' : 'Word removed');
        await refresh();
      });
      actions.appendChild(del);
    }

    return row;
  }

  function group(title, subtitle, words) {
    if (!words.length) return null;
    const wrap = document.createElement('div');
    wrap.className = 'mb-16';
    wrap.innerHTML = `
      <div class="section-title" style="margin-bottom:4px">${title}</div>
      <p style="font-size:0.8rem;color:var(--ink-faint);margin-bottom:10px">${subtitle}</p>
    `;
    const list = document.createElement('div');
    list.className = 'word-list';
    words.forEach(w => list.appendChild(wordRow(w)));
    wrap.appendChild(list);
    return wrap;
  }

  async function refresh() {
    entries = await listWords();
    const custom = entries.filter(e => e.custom).map(e => e.word);
    const recorded = entries.filter(e => e.blob).length;

    groupsEl.innerHTML = '';

    const mine = group(
      `My own words ✍️ (${custom.length})`,
      custom.length ? 'These show up in Word Stretch too.' : '',
      custom
    );
    if (mine) groupsEl.appendChild(mine);
    else {
      const empty = document.createElement('div');
      empty.className = 'card card-soft mb-16 text-center';
      empty.innerHTML = `<p style="font-size:0.88rem">No words of your own yet — add one above ✍️</p>`;
      groupsEl.appendChild(empty);
    }

    groupsEl.appendChild(group('Today\'s gentle start words 🌱', 'Words that begin on a vowel sound.', dailyGentleWords()));
    groupsEl.appendChild(group('Today\'s power words ✨', 'The stretchy words from Word Stretch.', dailyPowerWords()));

    const tally = document.createElement('div');
    tally.className = 'card card-mint text-center';
    tally.innerHTML = `<p style="font-weight:800">${recorded} word${recorded === 1 ? '' : 's'} in your own voice 🎤</p>`;
    groupsEl.appendChild(tally);
  }

  async function addWord() {
    const value = input.value.trim();
    if (!value) { toast('Type a word first ✍️'); input.focus(); return; }
    playClick();
    await addCustomWord(value);
    input.value = '';
    toast(`Added “${value}” — now record it! 🎤`, 'success');
    await refresh();
  }

  page.querySelector('#add-word-btn').addEventListener('click', addWord);
  input.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    addWord();
  });
  page.querySelector('#rec-stop').addEventListener('click', () => {
    playClick();
    if (recording) { clearTimeout(stopTimer); finishModelTake(); }
  });
  page.querySelector('#rec-cancel').addEventListener('click', cancelTake);
  page.querySelector('#exit-btn').addEventListener('click', () => { playClick(); navigate('practice'); });

  refresh();

  page.__cleanup = () => {
    if (raf) cancelAnimationFrame(raf);
    clearTimeout(stopTimer);
    stopModel();
    if (recording) { recording = false; stopRecording(); }
  };

  return page;
}
