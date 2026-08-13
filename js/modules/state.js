// js/modules/state.js – Reactive app state
import { getSetting, setSetting, dbPut, dbGetAll } from './db.js';

const _listeners = new Map();

// Bumped when the shape of stored data changes, so a future sync layer can tell
// old devices from new ones instead of guessing.
export const SCHEMA_VERSION = 2;

// A rest day bridges a gap without breaking the streak. Earned by practising,
// capped low enough to still feel like a streak, generous enough that a normal
// childhood weekend never destroys anything.
const REST_EARNED_EVERY = 5;
const REST_MAX = 2;

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
};

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
  }

  state.streak = computeStreak();
  state.bestStreak = Math.max(state.bestStreak || 0, state.streak);
  await setSetting('bestStreak', state.bestStreak);

  // Gives the parent dashboard something real to chart.
  await logSession({ activity, ...meta });

  emit('practiceLogged', { activity, isNewDay, streak: state.streak });
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
  const pool = [
    { id: 1, text: 'Say good morning to someone', icon: '☀️', done: false },
    { id: 2, text: 'Ask for something you want', icon: '🙋', done: false },
    { id: 3, text: 'Tell someone one fun fact', icon: '🌟', done: false },
    { id: 4, text: 'Read one sentence out loud', icon: '📖', done: false },
    { id: 5, text: 'Say your name nice and slow', icon: '🐢', done: false },
    { id: 6, text: 'Use a stretchy word today', icon: '🌈', done: false },
    { id: 7, text: 'Take a deep breath before talking', icon: '💨', done: false },
  ];
  // Pick 3 random
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}
