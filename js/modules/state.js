// js/modules/state.js – Reactive app state
import { getSetting, setSetting, dbPut, dbGetAll } from './db.js';

const _listeners = new Map();

export const state = {
  page: 'home',
  coins: 0,
  streak: 0,
  streakDays: [],
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

export async function loadState() {
  state.coins         = await getSetting('coins', 0);
  state.streak        = await getSetting('streak', 0);
  state.streakDays    = await getSetting('streakDays', []);
  state.avatar        = await getSetting('avatar', { body: '🐱', name: 'Brave Voice' });
  state.unlockedAvatars = await getSetting('unlockedAvatars', ['🐱']);
  state.totalMinutes  = await getSetting('totalMinutes', 0);
  state.sessions      = await dbGetAll('sessions');
  state.todayChallenges = await getSetting('todayChallenges', defaultChallenges());
  state.customRewards = await getSetting('customRewards', []);
  // Reset challenges daily
  const lastDay = await getSetting('lastDay', '');
  const today   = new Date().toDateString();
  if (lastDay !== today) {
    state.todayChallenges = defaultChallenges();
    await setSetting('lastDay', today);
    await setSetting('todayChallenges', state.todayChallenges);
    // Update streak
    await checkStreak(lastDay, today);
  }
}

export async function saveState() {
  await setSetting('coins', state.coins);
  await setSetting('streak', state.streak);
  await setSetting('streakDays', state.streakDays);
  await setSetting('avatar', state.avatar);
  await setSetting('unlockedAvatars', state.unlockedAvatars);
  await setSetting('totalMinutes', state.totalMinutes);
  await setSetting('todayChallenges', state.todayChallenges);
  await setSetting('customRewards', state.customRewards);
}

async function checkStreak(lastDay, today) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (lastDay === yesterday.toDateString()) {
    state.streak++;
  } else if (lastDay !== today) {
    state.streak = 0;
  }
  if (!state.streakDays.includes(today)) state.streakDays.push(today);
  await setSetting('streak', state.streak);
  await setSetting('streakDays', state.streakDays);
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
