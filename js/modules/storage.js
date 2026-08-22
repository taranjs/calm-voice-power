// js/modules/storage.js – keeping his data from quietly disappearing
//
// Everything the app knows about him — coins, streak, voice profile, the
// recordings behind Then vs Now — lives in IndexedDB on this one device. That
// storage is evictable by default: iOS Safari clears it after 7 days without a
// visit, and every browser will drop it under storage pressure. For a child
// whose interest already dipped once, opening the app to find his streak gone
// is about the worst thing it could do.
//
// The StorageManager API lets us ask for the data to be exempt. Chrome and
// Android grant it silently for an installed PWA; iOS treats an installed PWA
// as exempt anyway; Firefox asks the user once and remembers the answer.

/** True once we've asked this origin, so a declined prompt isn't re-shown. */
let _asked = false;

/**
 * Ask the browser to stop treating our data as disposable.
 * Safe to call on every boot: it short-circuits if already granted, and every
 * failure path is non-fatal — persistence is insurance, not a dependency.
 *
 * @returns {Promise<boolean|null>} granted, denied, or null if unsupported.
 */
export async function requestPersistence() {
  if (!navigator.storage?.persist) return null;
  try {
    if (await navigator.storage.persisted()) return true;
    if (_asked) return false;
    _asked = true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

/**
 * What the browser will tell us about our own data. Used by the parent
 * dashboard, because a parent is the only person here who can act on
 * "his recordings are not protected on this device".
 *
 * @returns {Promise<{persisted: boolean|null, usedMB: number|null, quotaMB: number|null}>}
 */
export async function storageReport() {
  const out = { persisted: null, usedMB: null, quotaMB: null };
  if (!navigator.storage) return out;
  try {
    if (navigator.storage.persisted) out.persisted = await navigator.storage.persisted();
    if (navigator.storage.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      if (usage != null)  out.usedMB  = usage / 1048576;
      if (quota != null)  out.quotaMB = quota / 1048576;
    }
  } catch {
    // An origin can refuse to answer; the caller renders the unknown case.
  }
  return out;
}

/** Is this running as an installed PWA rather than a browser tab? */
export function isInstalled() {
  return window.matchMedia?.('(display-mode: standalone)').matches
      || navigator.standalone === true;
}
