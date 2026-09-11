import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAddress, verifyAddress } from '../src/nip05.js';
test('address parsing rejects URL injection and supports root identifiers', () => {
  assert.equal(parseAddress('_@example.com').name, '_');
  for (const invalid of ['a@host/path', 'a@host:443', 'a@localhost', 'a@host?name=b', null]) assert.equal(parseAddress(invalid), null);
});
test('verification checks exact key and disallows redirects and credentials', async () => {
  const claim = parseAddress('alice@example.com'), pk = 'a'.repeat(64);
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://example.com/.well-known/nostr.json?name=alice');
    assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit');
    return { ok: true, json: async () => ({ names: { alice: pk } }) };
  };
  assert.equal(await verifyAddress(claim, pk, undefined, fetcher), 'Verified for this public key');
  assert.equal(await verifyAddress(claim, 'b'.repeat(64), undefined, fetcher), 'Maps to a different public key');
  assert.match(await verifyAddress(claim, pk, undefined, async () => { throw new Error('CORS'); }), /Could not check/);
});
