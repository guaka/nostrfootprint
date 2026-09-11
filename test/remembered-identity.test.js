import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nip19} from 'nostr-tools';
import {rememberIdentity,restoreIdentity} from '../src/remembered-identity.js';
test('only public identities from NIP-07 and NIP-46 are remembered',()=>{
  let stored=null;
  globalThis.localStorage={getItem:()=>stored,setItem:(_,value)=>{stored=value;}};
  const npub=nip19.npubEncode('a'.repeat(64));
  rememberIdentity(npub,'Session key');assert.equal(stored,null);
  for(const type of ['NIP-07','Remote signer']){stored=null;rememberIdentity(npub,type);assert.equal(restoreIdentity(),npub);}
  stored=nip19.nsecEncode(new Uint8Array(32).fill(1));assert.equal(restoreIdentity(),'');
  stored='invalid';assert.equal(restoreIdentity(),'');
  globalThis.localStorage={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
  assert.doesNotThrow(()=>rememberIdentity(npub,'NIP-07'));assert.equal(restoreIdentity(),'');
});
