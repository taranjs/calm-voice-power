// js/modules/state.js – Reactive app state
import { getSetting, setSetting, dbPut, dbGetAll } from './db.js';
import { dailyChallenges } from './content.js';

const _listeners = new Map();

// Bumped when the shape of stored data changes, so a future sync layer can tell
// old devices from new ones instead of guessing.
export const SCHEMA_VERSION = 2;

// A rest day bridges a gap without breaking the streak. Earned by practising,
// capped low enough to still feel like a streak, generous enough that a normal
// childhood weekend never destroys anything.
const REST_EARNED_EVERY = 5;
const REST_MAX = 2;

// How many recent onsets we keep. Enough to have a stable median, short enough
// that it tracks him as he improves rather than averaging in last month's habit.
const ONSET_HISTORY = 20;

// Coins taper within a session. Heavy per-rep rewards for something a child was
// already intrinsically excited about crowd the excitement out – and once the
// coins saturate, motivation lands *below* where it started. Effort still pays;
// grinding the same activity twenty times does not.
const REP_FULL_PRICE = 3;   // first few reps of an activity each day pay in full
const DAILY_BONUS = 15;     // showing up at all is the behaviour worth paying for

// Measured loudness of this particular child on this particular device, so the
// detection threshold stops being a guess about a generic six-year-old. Only
// numbers – no audio is stored, which also makes it trivial to sync later.
export const EMPTY_VOICE_PROFILE = {
  quiet: null,          // rms of his whisper
  normal: null,         // rms of his ordinary talking voice
  loud: null,           // rms of his roar
  onsetSamples: [],     // recent 10%→90% rise times, ms
  updatedAt: null,
};

export const state = {
  page: 'home',
  coins: 0,
  streak: 0,          // derived from practiceDays – never stored as truth
  bestStreak: 0,
  practiceDays: [],   // ['2026-08-13', …] unique + sorted; the actual record
  avatar: { body: '🐱', name: 'Brave Voice' },
  emotionBefore: null,
  emotionAfter: null,
  sessions: [],
  todayChallenges: [],
  customRewards: [],
  unlockedAvatars: ['🐱'],
  totalMinutes: 0,
  voiceProfile: { ...EMPTY_VOICE_PROFILE },
  bests: { holdMs: 0, pauseMs: 0, pacedWords: 0 },
  repsToday: { date: null, counts: {} },
};

// ── Sessions ─────────────────────────────────────
// A "session" is check-in → a few activities → check-out. Until now the
// check-in button navigated straight back to the home screen, the "after"
// check-in was unreachable from any route, and so logSession() never ran with
// an emotion attached: the Parent Dashboard's emotion trend has always been
// dead code reading an empty table.
const SESSION_TARGET = 3;

export const session = {
  active: false,
  emotionBefore: null,
  done: [],
  startedAt: null,
};

export function startSession(emotionBefore = null) {
  session.active = true;
  session.emotionBefore = emotionBefore;
  session.done = [];
  session.startedAt = Date.now();
  emit('sessionChanged', session);
  return session;
}

export function sessionTarget() { return SESSION_TARGET; }

/** Returns true once he has done enough for a check-out to make sense. */
export function noteSessionActivity(activity) {
  if (!session.active) return false;
  if (!session.done.includes(activity)) session.done.push(activity);
  emit('sessionChanged', session);
  return session.done.length >= SESSION_TARGET;
}

export async function endSession(emotionAfter = null) {
  const payload = {
    type: 'session',
    emotionBefore: session.emotionBefore,
    emotionAfter,
    activities: [...session.done],
    durationMs: session.startedAt ? Date.now() - session.startedAt : 0,
  };
  await logSession(payload);
  session.active = false;
  session.done = [];
  session.emotionBefore = null;
  session.startedAt = null;
  emit('sessionChanged', session);
  return payload;
}

// ── Rewards ──────────────────────────────────────
/**
 * Pay for one completed repetition, tapering after the first few today.
 * Returns the coins awarded so the caller can show the right number.
 */
export async function awardRep(activity, base = 5) {
  const today = dayKey();
  if (state.repsToday.date !== today) state.repsToday = { date: today, counts: {} };

  const n = (state.repsToday.counts[activity] || 0) + 1;
  state.repsToday.counts[activity] = n;
  await setSetting('repsToday', state.repsToday);

  const amount = n <= REP_FULL_PRICE ? base : Math.max(1, base - (n - REP_FULL_PRICE));
  await addCoins(amount);
  return amount;
}

/**
 * Record a personal best. Returns true when it actually is one, so activities
 * can celebrate it – beating your own record is the competence signal that
 * generic praise isn't.
 */
export async function noteBest(key, value) {
  if (!Number.isFinite(value) || value <= 0) return false;
  if (value <= (state.bests?.[key] || 0)) return false;
  state.bests = { ...state.bests, [key]: Math.round(value) };
  await setSetting('bests', state.bests);
  emit('newBest', { key, value: state.bests[key] });
  return true;
}

// ── Voice profile ────────────────────────────────
export function hasVoiceProfile(p = state.voiceProfile) {
  return !!(p && p.quiet > 0 && p.normal > 0);
}

export async function saveVoiceProfile(patch) {
  state.voiceProfile = {
    ...state.voiceProfile,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await setSetting('voiceProfile', state.voiceProfile);
  emit('voiceProfileChanged', state.voiceProfile);
  return state.voiceProfile;
}

/**
 * Feed one measured onset back in. The shaping target is derived from the
 * median of these, so as he gets gentler the goal moves with him – he competes
 * against his own recent self rather than a number I picked by ear.
 */
export async function addOnsetSample(riseMs) {
  if (!Number.isFinite(riseMs) || riseMs < 0) return state.voiceProfile;
  const samples = [...(state.voiceProfile.onsetSamples || []), Math.round(riseMs)]
    .slice(-ONSET_HISTORY);
  return saveVoiceProfile({ onsetSamples: samples });
}

export async function clearVoiceProfile() {
  state.voiceProfile = { ...EMPTY_VOICE_PROFILE };
  await setSetting('voiceProfile', state.voiceProfile);
  emit('voiceProfileChanged', state.voiceProfile);
}

export function on(event, cb) {
  if (!_listeners.has(event)) _listeners.set(event, []);
  _listeners.get(event).push(cb);
}

export function emit(event, data) {
  (_listeners.get(event) || []).forEach(cb => cb(data));
}

export function setState(patch) {
  Object.assign(state, patch);
  emit('stateChange', state);
}

// ── Dates ────────────────────────────────────────
// Local-date keys, not ISO timestamps: "did he practise on Tuesday" is a
// calendar question, and a UTC timestamp gets it wrong every evening.
export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Streak ───────────────────────────────────────
// practiceDays is a *set of dates*, which is the one shape that merges cleanly
// when this eventually syncs across devices: two devices union their days and
// the answer is right. A stored counter could never be merged.

export function restAllowance(days = state.practiceDays) {
  return Math.min(REST_MAX, Math.floor(days.length / REST_EARNED_EVERY));
}

export function computeStreak(days = state.practiceDays) {
  const set = new Set(days);
  let credits = restAllowance(days);
  let streak = 0;
  const cursor = new Date();

  // Today isn't over yet. Not having practised *so far today* must not cost him
  // anything – otherwise the streak looks broken every morning.
  if (!set.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  for (;;) {
    if (set.has(dayKey(cursor))) streak++;
    else if (credits > 0) credits--;      // a rest day bridges the gap
    else break;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Call when the child actually completes something. Not on app open – the old
 * version counted launches, which rewarded opening the app and punished a day
 * off with a full reset to zero.
 */
export async function recordPractice(activity = 'practice', meta = {}) {
  const key = dayKey();
  const isNewDay = !state.practiceDays.includes(key);

  if (isNewDay) {
    state.practiceDays = [...state.practiceDays, key].sort();
    await setSetting('practiceDays', state.practiceDays);
    // The one thing worth paying well for is coming back at all.
    await addCoins(DAILY_BONUS);
    emit('dailyBonus', DAILY_BONUS);
  }

  state.streak = computeStreak();
  state.bestStreak = Math.max(state.bestStreak || 0, state.streak);
  await setSetting('bestStreak', state.bestStreak);

  // Gives the parent dashboard something real to chart.
  await logSession({ type: 'activity', activity, ...meta });

  const sessionComplete = noteSessionActivity(activity);
  emit('practiceLogged', { activity, isNewDay, streak: state.streak, sessionComplete });
  return { isNewDay, streak: state.streak, totalDays: state.practiceDays.length };
}

export async function loadState() {
  state.coins           = await getSetting('coins', 0);
  state.avatar          = await getSetting('avatar', { body: '🐱', name: 'Brave Voice' });
  state.unlockedAvatars = await getSetting('unlockedAvatars', ['🐱']);
  state.totalMinutes    = await getSetting('totalMinutes', 0);
  state.sessions        = await dbGetAll('sessions');
  state.todayChallenges = await getSetting('todayChallenges', defaultChallenges());
  state.customRewards   = await getSetting('customRewards', []);
  state.voiceProfile    = {
    ...EMPTY_VOICE_PROFILE,
    ...(await getSetting('voiceProfile', null) || {}),
  };
  state.bests     = { holdMs: 0, pauseMs: 0, pacedWords: 0, ...(await getSetting('bests', null) || {}) };
  state.repsToday = await getSetting('repsToday', { date: null, counts: {} });

  state.practiceDays = await migratePracticeDays();
  state.bestStreak   = await getSetting('bestStreak', 0);
  state.streak       = computeStreak();
  if (state.streak > state.bestStreak) {
    state.bestStreak = state.streak;
    await setSetting('bestStreak', state.bestStreak);
  }

  await setSetting('schemaVersion', SCHEMA_VERSION);

  // Reset challenges daily. Note this no longer touches the streak.
  const lastDay = await getSetting('lastDay', '');
  const today   = dayKey();
  if (lastDay !== today) {
    state.todayChallenges = defaultChallenges();
    await setSetting('lastDay', today);
    await setSetting('todayChallenges', state.todayChallenges);
  }
}

/** One-time move from the v1 shape, without losing anyone's progress. */
async function migratePracticeDays() {
  const existing = await getSetting('practiceDays', null);
  if (Array.isArray(existing)) return existing;

  const legacyDays   = await getSetting('streakDays', []) || [];
  const legacyStreak = await getSetting('streak', 0) || 0;
  const set = new Set();

  // v1 stored `new Date().toDateString()` strings.
  legacyDays.forEach(s => {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) set.add(dayKey(d));
  });

  // The old counter held days it never wrote down. Credit them back rather than
  // letting an upgrade quietly cost him his run.
  for (let i = 0; i < legacyStreak; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    set.add(dayKey(d));
  }

  const days = [...set].sort();
  await setSetting('practiceDays', days);
  return days;
}

export async function saveState() {
  await setSetting('coins', state.coins);
  await setSetting('practiceDays', state.practiceDays);
  await setSetting('bestStreak', state.bestStreak);
  await setSetting('avatar', state.avatar);
  await setSetting('unlockedAvatars', state.unlockedAvatars);
  await setSetting('totalMinutes', state.totalMinutes);
  await setSetting('todayChallenges', state.todayChallenges);
  await setSetting('customRewards', state.customRewards);
}

export async function addCoins(amount) {
  state.coins += amount;
  await setSetting('coins', state.coins);
  emit('coinsChanged', state.coins);
}

export async function addMinutes(mins) {
  state.totalMinutes += mins;
  await setSetting('totalMinutes', state.totalMinutes);
}

export async function logSession(data) {
  const session = { date: new Date().toISOString(), ...data };
  await dbPut('sessions', session);
  state.sessions.push(session);
}

function defaultChallenges() {
  // Generated from templates and slot banks, seeded by the date: the same three
  // all day, a different three tomorrow. Was a fixed pool of seven.
  return dailyChallenges(3);
}
