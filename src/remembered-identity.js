import { nip19 } from 'nostr-tools';

const storageKey = 'nostr-footprint:public-npub';

export function rememberIdentity(npub, signerType) {
  if (!['NIP-07', 'Remote signer'].includes(signerType)) return;
  try {
    if (nip19.decode(npub).type === 'npub') localStorage.setItem(storageKey, npub);
  } catch { /* Storage may be disabled; connecting still works. */ }
}

export function restoreIdentity() {
  try {
    const value = localStorage.getItem(storageKey);
    const decoded = nip19.decode(value || '');
    return decoded.type === 'npub' ? nip19.npubEncode(decoded.data) : '';
  } catch { return ''; }
}
