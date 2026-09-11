// Tab-local snapshots only: no note contents or deletion history on disk.
export class EventCache {
  constructor(limit = 3) { this.limit = limit; this.identities = new Map(); }
  forIdentity(pubkey) {
    const records = this.identities.get(pubkey) || new Map();
    this.identities.delete(pubkey);
    this.identities.set(pubkey, records);
    while (this.identities.size > this.limit) this.identities.delete(this.identities.keys().next().value);
    return records;
  }
}

// Call only for a verified event actually returned by a live relay query.
export function observeEvent(records, event, relay, scanId, now = Date.now()) {
  let record = records.get(event.id);
  if (!record) {
    record = { event, relays: new Set() };
    records.set(event.id, record);
  }
  record.relays.add(relay);
  record.seenIn = scanId;
  if (record.deletion) {
    record.deletion[relay] = { ...record.deletion[relay], state: 'present', checkedAt: now };
  }
  return record;
}
