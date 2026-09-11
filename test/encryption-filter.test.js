import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesEncryption,encryptionState} from '../src/encryption-filter.js';
test('encryption filter recognizes known envelopes without guessing from content',()=>{
  for(const kind of [4,13,1059,21059,24133]) {
    assert.equal(matchesEncryption({kind},'encrypted'),true);
    assert.equal(matchesEncryption({kind},'unencrypted'),false);
  }
  for(const kind of [0,1,5,99999]) {
    assert.equal(matchesEncryption({kind},'all'),true);
    assert.equal(matchesEncryption({kind},'unencrypted'),true);
    assert.equal(matchesEncryption({kind},'encrypted'),false);
  }
});
test('binary Base64 in custom or list kinds is likely encrypted, not proven encrypted',()=>{
  const content=Buffer.from(Array.from({length:96},(_,i)=>(i*71)%256)).toString('base64');
  const event={kind:30003,content};
  assert.equal(encryptionState(event),'likely');
  assert.equal(matchesEncryption(event,'encrypted'),true);
  assert.equal(matchesEncryption(event,'unencrypted'),false);
  for(const content of ['Plain text',Buffer.from('Readable text '.repeat(12)).toString('base64'),'a'.repeat(65)]) {
    assert.equal(encryptionState({kind:30003,content}),'unrecognized');
  }
});
