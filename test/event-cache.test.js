import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventCache, observeEvent } from '../src/event-cache.js';
import { deletionStatus } from '../src/deletion-status.js';

test('cached records are partitioned by identity and preserve deletion checks', () => {
  const cache = new EventCache(), records = cache.forIdentity('alice');
  const event = { id:'note', pubkey:'alice' };
  const record = observeEvent(records,event,'wss://one.example',1,100);
  record.deletion = { 'wss://one.example':{state:'removed',checkedAt:200} };
  assert.equal(cache.forIdentity('alice').get('note'),record);
  assert.equal(deletionStatus(record).state,'removed');
  assert.equal(cache.forIdentity('bob').size,0);
  // A cache hit alone cannot resurrect an event; only a live observation does.
  observeEvent(records,event,'wss://one.example',2,300);
  assert.equal(deletionStatus(record).state,'present');
  assert.equal(record.deletion['wss://one.example'].checkedAt,300);
  assert.equal(record.seenIn,2);
});

test('an event reappearing on a new relay makes previous deletion incomplete', () => {
  const records = new Map(), event={id:'note'};
  const record = observeEvent(records,event,'wss://one.example',1);
  record.deletion = { 'wss://one.example':{state:'removed'} };
  observeEvent(records,event,'wss://two.example',2);
  assert.equal(record.deletion['wss://one.example'].state,'removed');
  assert.equal(deletionStatus(record).state,'present');
});

test('tab cache evicts the least recently used identity', () => {
  const cache = new EventCache(2);
  const alice = cache.forIdentity('alice'); alice.set('note',{});
  cache.forIdentity('bob').set('note',{});
  cache.forIdentity('alice'); cache.forIdentity('carol');
  assert.equal(cache.forIdentity('alice'),alice);
  assert.equal(cache.forIdentity('bob').size,0);
});
