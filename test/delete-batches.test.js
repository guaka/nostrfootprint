import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateSecretKey,getPublicKey,finalizeEvent} from 'nostr-tools';
import {deleteInBatches} from '../src/delete-batches.js';
const sk=generateSecretKey(),pubkey=getPublicKey(sk);
const events=Array.from({length:205},(_,i)=>finalizeEvent({kind:1,created_at:100+i,tags:[],content:`note ${i}`},sk));
const records=()=>events.map(event=>({event,relays:new Set(['wss://example.com'])}));
const defaults={pubkey,relays:['wss://example.com'],signer:{signEvent:async t=>finalizeEvent(t,sk)},publishEvent:async()=> 'Request accepted',queryEvents:async()=>({events:[],status:'Query complete'})};
test('205 selected events become three exact, bounded deletion requests',async()=>{
  const signed=[];
  const result=await deleteInBatches({...defaults,records:records(),onReceipt:e=>signed.push(e)});
  assert.deepEqual(signed.map(e=>e.tags.filter(t=>t[0]==='e').length),[100,100,5]);
  assert.deepEqual(signed.flatMap(e=>e.tags.filter(t=>t[0]==='e').map(t=>t[1])),events.map(e=>e.id));
  assert.equal(result.completed.length,205);assert.equal(result.remaining.length,0);
});
test('declining a later signature preserves processed results and allows resuming only unsent events',async()=>{
  let calls=0;
  const result=await deleteInBatches({...defaults,records:records(),signer:{signEvent:async t=>{if(++calls===2)throw new Error('Declined');return finalizeEvent(t,sk);}}});
  assert.equal(result.completed.length,100);assert.equal(result.remaining.length,105);assert.equal(result.error,'Declined');
  assert.equal(result.remaining[0].deletion,undefined);
  const sent=[];await deleteInBatches({...defaults,records:result.remaining,onReceipt:e=>sent.push(e)});
  assert.equal(sent.flatMap(e=>e.tags.filter(t=>t[0]==='e')).length,105);
  assert.equal(result.completed[0].deletion['wss://example.com'].state,'removed');
});
test('invalid ownership in the last batch prevents any signing or publication',async()=>{
  const input=records();input.push({event:finalizeEvent({kind:1,created_at:1,tags:[],content:'other'},generateSecretKey())});
  let signed=false;
  await assert.rejects(deleteInBatches({...defaults,records:input,signer:{signEvent:async()=>{signed=true;}}}));
  assert.equal(signed,false);
});
test('stopping after one batch leaves the remaining events untouched',async()=>{
  let stop=false;
  const result=await deleteInBatches({...defaults,records:records(),shouldStop:()=>stop,onProgress:p=>{if(p.stage==='completed')stop=true;}});
  assert.equal(result.completed.length,100);assert.equal(result.remaining.length,105);assert.equal(result.stopped,true);
});
