import { deletionTemplate, assertSigned, publish, query } from './core.js';

export const DELETION_BATCH_SIZE = 100;

// Every event in a request must have been observed on every destination.
export function deletionBatches(records, relays) {
  const allowed = new Set(relays), groups = new Map();
  for (const record of records) {
    const targets = [...(record.relays || [])].filter(url => allowed.has(url)).sort();
    if (!targets.length) throw new Error('A selected event has no observed source relay among the current relays. Search its source relay or deselect it.');
    const key = JSON.stringify(targets);
    if (!groups.has(key)) groups.set(key, { relays: targets, records: [] });
    groups.get(key).records.push(record);
  }
  return [...groups.values()].flatMap(group => {
    const batches = [];
    for (let offset = 0; offset < group.records.length; offset += DELETION_BATCH_SIZE) {
      batches.push({ relays: group.relays, records: group.records.slice(offset, offset + DELETION_BATCH_SIZE) });
    }
    return batches;
  });
}

export async function deleteInBatches({
  records, pubkey, signer, relays, reason = '', shouldStop = () => false,
  onProgress = () => {}, onReceipt = () => {}, publishEvent = publish, queryEvents = query,
}) {
  if (!records.length) throw new Error('Select at least one event.');
  if (!relays.length) throw new Error('Choose at least one relay.');
  // Validate the entire selection before signing or publishing any batch.
  const batches = deletionBatches(records, relays).map(batch => ({
    ...batch, template: deletionTemplate(batch.records.map(r => r.event), pubkey, reason),
  }));
  const completed = [];
  const remaining = () => {
    const ids = new Set(completed.map(record => record.event.id));
    return records.filter(record => !ids.has(record.event.id));
  };
  for (let index = 0; index < batches.length; index++) {
    if (shouldStop()) return { completed, remaining: remaining(), stopped: true };
    const batch = batches[index];
    const report = (stage, extra = {}) => onProgress({
      stage, index, batches: batches.length, completed: completed.length,
      total: records.length, current: batch.records, ...extra,
    });
    report('signing');
    let signed;
    try {
      signed = await signer.signEvent(batch.template);
      assertSigned(signed, batch.template, pubkey);
    } catch (error) {
      return { completed, remaining: remaining(), error: error.message || 'Signature was not approved.' };
    }
    onReceipt(signed);
    for (const record of batch.records) {
      record.deletion = { ...record.deletion, ...Object.fromEntries(batch.relays.map(url => [url, { state:'pending' }])) };
    }
    report('sending');
    await Promise.all(batch.relays.map(async url => {
      let ack, check;
      try { ack = await publishEvent(url, signed); } catch { ack = 'Could not send request'; }
      try { check = await queryEvents(url, { ids:batch.records.map(r => r.event.id) }); }
      catch { check = { events:[], status:'Could not check' }; }
      const returned = new Set(check.events.map(e => e.id));
      for (const record of batch.records) {
        record.deletion[url] = {
          state: returned.has(record.event.id) ? 'present' : check.status === 'Query complete' ? 'removed' : 'unknown',
          ack, checkedAt:Date.now(),
        };
      }
      report('checking', { relay:url, ack, returned:returned.size, checkStatus:check.status });
    }));
    completed.push(...batch.records);
    report('completed');
  }
  return { completed, remaining:[] };
}
