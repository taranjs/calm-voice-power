// js/modules/myWords.js – the child's own words, in the child's own voice
//
// Two things live here, and the second is the point.
//
// 1. Words he adds himself, which then appear in the practice activities.
// 2. Recordings of *him* saying a word well, which the app plays as the model
//    instead of the synthesiser.
//
// Recording a model is not a detour from practice – saying "Apple" with a soft
// gentle start, so the app can keep it, *is* the exercise. So a model take is
// analysed like any other attempt and counted toward his onset history.
//
// Co-authorship is the most durable motivation available here: a child who
// built the word list is practising with his own thing rather than consuming
// someone else's.
import { dbGet, dbPut, dbGetAll, dbDelete } from './db.js';
import { speakModel } from './speech.js';

/** Words are keyed by a normalised form so "Apple" and "apple" are one entry. */
export function wordKey(word) {
  return String(word || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** A word is useful for gentle-onset work when it starts on a vowel sound. */
export function isVowelInitial(word) {
  return /^[aeiou]/i.test(String(word || '').trim());
}

/** Strip the syllable hyphens some word lists carry, for display and speech. */
export function plainWord(word) {
  return String(word || '').replace(/-/g, '');
}

export async function getWordEntry(word) {
  if (!word) return null;
  return dbGet('words', wordKey(plainWord(word)));
}

export async function listWords() {
  const all = await dbGetAll('words');
  return all.sort((a, b) => (a.word || '').localeCompare(b.word || ''));
}

/** Words he typed in himself, for mixing into the activity pools. */
export async function customWords({ vowelInitial = false } = {}) {
  const all = await listWords();
  return all
    .filter(w => w.custom)
    .filter(w => !vowelInitial || isVowelInitial(w.word))
    .map(w => w.word);
}

export async function addCustomWord(word) {
  const clean = plainWord(word).trim().replace(/\s+/g, ' ');
  if (!clean) return null;
  const id = wordKey(clean);
  const existing = await dbGet('words', id);
  const entry = { ...(existing || {}), id, word: clean, custom: true };
  await dbPut('words', entry);
  return entry;
}

/** Attach his recording of this word. Keeps whatever else the entry holds. */
export async function saveWordModel(word, { blob, durationMs, riseMs }) {
  const clean = plainWord(word).trim();
  const id = wordKey(clean);
  const existing = await dbGet('words', id);
  const entry = {
    ...(existing || { custom: false }),
    id,
    word: clean,
    blob,
    durationMs,
    riseMs: riseMs ?? null,
    recordedAt: new Date().toISOString(),
  };
  await dbPut('words', entry);
  return entry;
}

export async function removeWordModel(word) {
  const entry = await getWordEntry(word);
  if (!entry) return;
  if (entry.custom) {
    // Keep his word, just drop the recording.
    const { blob, durationMs, riseMs, recordedAt, ...rest } = entry;
    await dbPut('words', rest);
  } else {
    await dbDelete('words', entry.id);
  }
}

export async function removeWord(word) {
  const entry = await getWordEntry(word);
  if (entry) await dbDelete('words', entry.id);
}

let _playing = null;

export function stopModel() {
  if (!_playing) return;
  try { _playing.audio.pause(); } catch (e) { /* already stopped */ }
  URL.revokeObjectURL(_playing.url);
  _playing = null;
}

/**
 * Play the model for a word: his own recording when he has made one, the
 * synthesiser otherwise. Returns 'own' or 'tts' so the UI can say which it was –
 * hearing "that's your voice!" is most of the reward for having recorded it.
 */
export async function playWordModel(word, { rate = 0.5 } = {}) {
  stopModel();
  let entry = null;
  try { entry = await getWordEntry(word); } catch (e) { /* fall through to tts */ }

  if (entry?.blob) {
    const url = URL.createObjectURL(entry.blob);
    const audio = new Audio(url);
    _playing = { audio, url };
    await new Promise(resolve => {
      audio.addEventListener('ended', () => { stopModel(); resolve(); });
      audio.addEventListener('error', () => { stopModel(); resolve(); });
      audio.play().catch(() => { stopModel(); resolve(); });
    });
    return 'own';
  }

  await speakModel(plainWord(word), { rate });
  return 'tts';
}
