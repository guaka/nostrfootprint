import {test} from 'node:test';
import assert from 'node:assert/strict';
import {observeCoverage,updateDeletionCoverage} from '../src/relay-counts.js';

test('coverage separates and deduplicates kind 5 from other events',()=>{
  const coverage={};
  for(const event of [{id:'a',kind:1},{id:'b',kind:5},{id:'b',kind:5}]) observeCoverage(coverage,event);
  assert.deepEqual([...coverage.eventIds],['a']);
  assert.deepEqual([...coverage.deletionIds],['b']);
});

test('deletion updates remove only verified absent copies and count accepted requests once',()=>{
  const coverage={};
  const current=['removed','present','unknown'].map((state,i)=>({
    event:{id:String(i),kind:1},deletion:{relay:{state}}
  }));
  current.forEach(r=>observeCoverage(coverage,r.event));
  const progress={relay:'relay',current,ack:'Request accepted',receipt:{id:'receipt',kind:5}};
  updateDeletionCoverage(coverage,progress);
  updateDeletionCoverage(coverage,progress);
  assert.deepEqual([...coverage.eventIds],['1','2']);
  assert.deepEqual([...coverage.deletionIds],['receipt']);
  updateDeletionCoverage(coverage,{...progress,ack:'Rejected',receipt:{id:'rejected',kind:5}});
  assert.equal(coverage.deletionIds.size,1);
});
