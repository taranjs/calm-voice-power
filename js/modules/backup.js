// js/modules/backup.js – taking his progress with him.
//
// Everything the app knows lives in IndexedDB, which is scoped to one origin on
// one device. Persistence (storage.js) stops a browser *evicting* it; it does
// nothing about a lost phone, a factory reset, or — the reason this exists —
// moving the app to a different web address, where the browser hands you a
// completely empty database and a child finds his streak and every recording
// apparently gone.
//
// So: one file out, one file in.
//
// Import MERGES rather than replaces. The data model was already shaped for a
// future sync layer (practiceDays is a set, streak is always derived), and merge
// is the operation that cannot lose anything. Restoring an old backup onto a
// device that has since been used should not cost him this week's practice.
import { dbGetAll, dbPut, openDB } from './db.js';

export const BACKUP_FORMAT = 1;
const STORES = ['settings', 'sessions', 'recordings', 'words', 'challenges', 'rewards'];

// ── Blobs ────────────────────────────────────────
// His recordings are the part of this worth protecting, and JSON has no opinion
// about Blobs, so they travel as base64 with their MIME type alongside.

function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload  = () => res(String(fr.result).split(',')[1] || '');
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
}

function base64ToBlob(data, type) {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: type || 'application/octet-stream' });
}

async function packValue(v) {
  if (v instanceof Blob) {
    return { __blob: true, type: v.type, size: v.size, data: await blobToBase64(v) };
  }
  if (Array.isArray(v)) return Promise.all(v.map(packValue));
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = await packValue(val);
    return out;
  }
  return v;
}

function unpackValue(v) {
  if (v && typeof v === 'object' && v.__blob) return base64ToBlob(v.data, v.type);
  if (Array.isArray(v)) return v.map(unpackValue);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = unpackValue(val);
    return out;
  }
  return v;
}

// ── Export ───────────────────────────────────────

/** The whole database as one plain object, ready to be stringified. */
export async function exportAll() {
  await openDB();
  const stores = {};
  for (const name of STORES) {
    stores[name] = await packValue(await dbGetAll(name));
  }
  return {
    app: 'calm-voice-power',
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    stores,
  };
}

/** A filename that sorts and reads sensibly in a downloads folder. */
export function backupFilename(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `calm-voice-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

// ── Merge ────────────────────────────────────────
// Pure, and deliberately so: this is the logic worth testing, and it is the same
// logic a sync layer would need later.

const uniq  = arr => [...new Set(arr)];
const num   = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
/** Rows keyed by id, incoming filling gaps but never overwriting what is here. */
function unionById(current = [], incoming = [], prefer = null) {
  const out = new Map();
  for (const row of current)  if (row && row.id != null) out.set(row.id, row);
  for (const row of incoming) {
    if (!row || row.id == null) continue;
    const have = out.get(row.id);
    if (!have) out.set(row.id, row);
    else if (prefer && prefer(row, have)) out.set(row.id, row);
  }
  return [...out.values()];
}

/** Rows with no id of their own, deduped on the fields that identify them. */
function unionByStamp(current = [], incoming = [], keyOf) {
  const seen = new Set(current.map(keyOf));
  const out  = [...current];
  for (const row of incoming) {
    const k = keyOf(row);
    if (seen.has(k)) continue;
    seen.add(k);
    // Drop any autoIncrement id, or it collides with a row already stored here.
    const { id, ...rest } = row;
    out.push(rest);
  }
  return out;
}

const settingsToMap = rows => Object.fromEntries((rows || []).map(r => [r.key, r.value]));

/**
 * Merge one exported database into another. Nothing is ever removed.
 * Returns { settings, sessions, recordings, words, challenges, rewards, added }.
 */
export function mergeStores(current = {}, incoming = {}) {
  const a = settingsToMap(current.settings);
  const b = settingsToMap(incoming.settings);
  const merged = { ...b, ...a };   // start from ours; fill gaps from theirs

  // Practice days are a set by design, so a union is exactly right and two
  // devices can never disagree about whether a day happened.
  merged.practiceDays = uniq([...(a.practiceDays || []), ...(b.practiceDays || [])]).sort();

  // Things earned. Taking the larger can over-credit slightly if both devices
  // were used; a child losing coins he already spent is the worse error.
  for (const k of ['coins', 'totalMinutes', 'bestStreak']) merged[k] = Math.max(num(a[k]), num(b[k]));
  merged.bests = {
    holdMs:     Math.max(num(a.bests?.holdMs),     num(b.bests?.holdMs)),
    pauseMs:    Math.max(num(a.bests?.pauseMs),    num(b.bests?.pauseMs)),
    pacedWords: Math.max(num(a.bests?.pacedWords), num(b.bests?.pacedWords)),
  };
  merged.unlockedAvatars = uniq([...(a.unlockedAvatars || []), ...(b.unlockedAvatars || [])]);

  // The voice profile is a measurement of one child at one time, so it is not
  // averaged — the more recent calibration simply wins.
  const pa = a.voiceProfile, pb = b.voiceProfile;
  if (pa?.quiet && pb?.quiet) merged.voiceProfile = (num(pb.updatedAt) > num(pa.updatedAt)) ? pb : pa;
  else merged.voiceProfile = pa?.quiet ? pa : (pb || pa);

  // Whatever he is wearing on this device stays, unless he never chose.
  if (!a.avatar || a.avatar.body === '🐱') merged.avatar = b.avatar || a.avatar;

  merged.customRewards = unionById(a.customRewards || [], b.customRewards || []);

  const stamp = r => `${r?.date || ''}|${r?.type || ''}|${r?.promptId || ''}`;
  return {
    settings:   Object.entries(merged).map(([key, value]) => ({ key, value })),
    sessions:   unionByStamp(current.sessions   || [], incoming.sessions   || [], stamp),
    // A recording without audio is worth nothing, so a take with a blob wins.
    recordings: unionByStamp(current.recordings || [], incoming.recordings || [], stamp),
    words:      unionById(current.words || [], incoming.words || [], (inc, have) => !!inc.blob && !have.blob),
    challenges: unionById(current.challenges || [], incoming.challenges || []),
    rewards:    unionById(current.rewards || [], incoming.rewards || []),
    added: {
      days:       uniq(b.practiceDays || []).filter(d => !(a.practiceDays || []).includes(d)).length,
      sessions:   (incoming.sessions   || []).length,
      recordings: (incoming.recordings || []).length,
      words:      (incoming.words      || []).length,
    },
  };
}

// ── Import ───────────────────────────────────────

export class BackupError extends Error {}

/** Throws BackupError with something a parent can act on, never a stack trace. */
export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); }
  catch { throw new BackupError('That file is not a Calm Voice backup.'); }
  if (!data || typeof data !== 'object' || data.app !== 'calm-voice-power') {
    throw new BackupError('That file is not a Calm Voice backup.');
  }
  if (num(data.format) > BACKUP_FORMAT) {
    throw new BackupError('That backup was made by a newer version of the app.');
  }
  if (!data.stores || typeof data.stores !== 'object') {
    throw new BackupError('That backup looks empty or damaged.');
  }
  return data;
}

/** Merge a parsed backup into this device. Returns what arrived. */
export async function importAll(data) {
  await openDB();

  const current = {};
  for (const name of STORES) current[name] = await dbGetAll(name);

  const incoming = {};
  for (const name of STORES) incoming[name] = unpackValue(data.stores[name] || []);

  const merged = mergeStores(current, incoming);

  for (const name of STORES) {
    for (const row of merged[name]) await dbPut(name, row);
  }
  return merged.added;
}
