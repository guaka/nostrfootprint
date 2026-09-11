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
  const input=records();input.push({event:finalizeEvent({kind:1,created_at:1,tags:[],content:'other'},generateSecretKey()),relays:new Set(defaults.relays)});
  let signed=false;
  await assert.rejects(deleteInBatches({...defaults,records:input,signer:{signEvent:async()=>{signed=true;}}}));
  assert.equal(signed,false);
});
test('stopping after one batch leaves the remaining events untouched',async()=>{
  let stop=false;
  const result=await deleteInBatches({...defaults,records:records(),shouldStop:()=>stop,onProgress:p=>{if(p.stage==='completed')stop=true;}});
  assert.equal(result.completed.length,100);assert.equal(result.remaining.length,105);assert.equal(result.stopped,true);
});

test('requests and checks include only IDs observed on each destination',async()=>{
  const [a,b,c,unused]=['wss://a','wss://b','wss://c','wss://unused'];
  const input=records().slice(0,4);
  [ [a], [b], [b,a], [a] ].forEach((urls,i)=>input[i].relays=new Set(urls));
  input[0].deletion={[unused]:{state:'unknown'}};
  const sent=[],checks=[];
  await deleteInBatches({...defaults,records:input,relays:[a,b,c,unused],
    publishEvent:async(url,event)=>{sent.push([url,event.tags.filter(t=>t[0]==='e').map(t=>t[1])]);return 'Request accepted';},
    queryEvents:async(url,filter)=>{checks.push([url,filter.ids]);return {events:[],status:'Query complete'};}
  });
  assert.deepEqual(checks,sent);
  assert.equal(sent.length,4);
  for(const [url,ids] of sent) for(const id of ids)
    assert.ok(input.find(r=>r.event.id===id).relays.has(url));
  assert.deepEqual(sent.filter(([url])=>url===a).flatMap(([,ids])=>ids).sort(),
    [input[0],input[2],input[3]].map(r=>r.event.id).sort());
  assert.equal(input[0].deletion[unused].state,'unknown');
  assert.equal(input[1].deletion[a],undefined);
});

test('resuming regrouped events does not skip or resend interleaved selections',async()=>{
  const input=records().slice(0,4),relays=['wss://a','wss://b'];
  input.forEach((r,i)=>r.relays=new Set([relays[i%2]]));
  let stop=false;
  const first=await deleteInBatches({...defaults,relays,records:input,shouldStop:()=>stop,
    onProgress:p=>{if(p.stage==='completed')stop=true;}});
  assert.deepEqual(first.completed,[input[0],input[2]]);
  assert.deepEqual(first.remaining,[input[1],input[3]]);
  const second=await deleteInBatches({...defaults,relays,records:first.remaining});
  assert.deepEqual(second.completed,[input[1],input[3]]);
});

test('missing eligible source aborts the entire selection before signing',async()=>{
  const input=records().slice(0,2);input[1].relays=new Set(['wss://not-selected']);
  let calls=0;
  await assert.rejects(deleteInBatches({...defaults,records:input,
    signer:{signEvent:async()=>{calls++;}}}),/no observed source relay/);
  assert.equal(calls,0);
});
