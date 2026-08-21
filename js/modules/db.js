// js/modules/db.js – IndexedDB wrapper
const DB_NAME = 'CalmVoiceDB';
const DB_VER  = 2;   // v2 adds `words`: the child's own words and voice models

let _db = null;

const STORES = {
  sessions:   { keyPath: 'id', autoIncrement: true },
  challenges: { keyPath: 'id' },
  rewards:    { keyPath: 'id' },
  settings:   { keyPath: 'key' },
  recordings: { keyPath: 'id', autoIncrement: true },
  // Keyed by the normalised word, so a word can only ever have one model and
  // looking one up during a game is a single get().
  words:      { keyPath: 'id' },
};

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      Object.entries(STORES).forEach(([name, opts]) => {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, opts);
        }
      });
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = () => reject(req.error);
  });
}

function tx(store, mode = 'readonly') {
  return _db.transaction(store, mode).objectStore(store);
}

export async function dbGet(store, key) {
  await openDB();
  return new Promise((res, rej) => {
    const r = tx(store).get(key);
    r.onsuccess = () => res(r.result ?? null);
    r.onerror   = () => rej(r.error);
  });
}

export async function dbPut(store, value) {
  await openDB();
  return new Promise((res, rej) => {
    const r = tx(store, 'readwrite').put(value);
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
}

export async function dbGetAll(store) {
  await openDB();
  return new Promise((res, rej) => {
    const r = tx(store).getAll();
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
}

export async function dbDelete(store, key) {
  await openDB();
  return new Promise((res, rej) => {
    const r = tx(store, 'readwrite').delete(key);
    r.onsuccess = () => res();
    r.onerror   = () => rej(r.error);
  });
}

// Settings helpers
export async function getSetting(key, fallback = null) {
  const row = await dbGet('settings', key);
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  return dbPut('settings', { key, value });
}
