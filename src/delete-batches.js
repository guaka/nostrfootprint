import { deletionTemplate, assertSigned, publish, query } from './core.js';

export const DELETION_BATCH_SIZE = 100;

export async function deleteInBatches({
  records, pubkey, signer, relays, reason = '', shouldStop = () => false,
  onProgress = () => {}, onReceipt = () => {}, publishEvent = publish, queryEvents = query,
}) {
  if (!records.length) throw new Error('Select at least one event.');
  if (!relays.length) throw new Error('Choose at least one relay.');
  const batches = [];
  for (let offset = 0; offset < records.length; offset += DELETION_BATCH_SIZE) {
    const batch = records.slice(offset, offset + DELETION_BATCH_SIZE);
    // Validate the entire selection before signing or publishing any batch.
    batches.push({ records: batch, template: deletionTemplate(batch.map(r => r.event), pubkey, reason) });
  }
  const completed = [];
  for (let index = 0; index < batches.length; index++) {
    if (shouldStop()) return { completed, remaining: records.slice(completed.length), stopped: true };
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
      return { completed, remaining: records.slice(completed.length), error: error.message || 'Signature was not approved.' };
    }
    onReceipt(signed);
    for (const record of batch.records) {
      record.deletion = { ...record.deletion, ...Object.fromEntries(relays.map(url => [url, { state:'pending' }])) };
    }
    report('sending');
    await Promise.all(relays.map(async url => {
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
