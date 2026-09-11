import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deletionStatus} from '../src/deletion-status.js';
const record=(...states)=>({deletion:Object.fromEntries(states.map((state,i)=>[String(i),{state}]))});
test('only complete absent results show the removed state',()=>{
  assert.equal(deletionStatus(record('removed','removed')).state,'removed');
  assert.equal(deletionStatus(record('removed','unknown')).state,'unknown');
  assert.equal(deletionStatus(record('removed','present')).state,'present');
  assert.equal(deletionStatus(record('removed','pending')).state,'pending');
  assert.equal(deletionStatus(record()).state,'unknown');
  assert.equal(deletionStatus({}),null);
});
