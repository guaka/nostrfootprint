import { readableBase64 } from './readable-base64.js';
// Classification only: never decrypt payloads.
const encryptedKinds = new Set([4, 13, 1059, 21059, 24133]);
const classifications = new WeakMap();
export function encryptionState(event) {
  if (encryptedKinds.has(event.kind)) return 'encrypted';
  if (classifications.has(event)) return classifications.get(event);
  const value = (event.content || '').trim();
  let state = 'unrecognized';
  // Require a substantial, complete, canonical payload; plain text and
  // readable Base64 keep their previews. Binary is evidence, not proof.
  if (value.length >= 64 && value.length <= 100000 &&
      /^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) {
    try {
      const standard = value.replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(standard);
      if (btoa(binary).replace(/=+$/, '') === standard.replace(/=+$/, '') &&
          readableBase64(value) === null) state = 'likely';
    } catch { /* Not Base64. */ }
  }
  classifications.set(event, state);
  return state;
}
export function matchesEncryption(event, mode) {
  return mode === 'all' || (mode === 'encrypted') === (encryptionState(event) !== 'unrecognized');
}
