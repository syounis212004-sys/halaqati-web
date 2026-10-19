import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const core=fs.readFileSync(new URL('../src/core/runtime.js',import.meta.url),'utf8');
const start=core.indexOf('function recitationLineCountV6');
const end=core.indexOf('function decorateRecForOffline',start);
assert.ok(start>=0&&end>start,'V6 functions missing');
const ctx={Math,Number,Set,Array,String,console,window:{}};
vm.runInNewContext(core.slice(start,end),ctx);
const c=ctx.computeRecitationV6;
const ev=(pages,m,p)=>c(pages,m,p).evaluation;
test('15 lines rating boundaries match approved rules',()=>{
  assert.equal(c(1,0,0).safety_percentage,100); assert.equal(ev(1,0,0),'excellent');
  assert.equal(c(1,0,1).safety_percentage,90); assert.equal(ev(1,0,1),'excellent');
  assert.equal(c(1,0,2).safety_percentage,80); assert.equal(ev(1,0,2),'very_good');
  assert.equal(c(1,1,0).safety_percentage,80); assert.equal(ev(1,1,0),'very_good');
  assert.equal(c(1,1,1).safety_percentage,70); assert.equal(ev(1,1,1),'good');
  assert.equal(c(1,0,3).safety_percentage,70); assert.equal(ev(1,0,3),'good');
  assert.equal(ev(1,2,0),'repeat');
});
test('short segments normalize by actual line count',()=>{
  const seven=c({pages_count:7/15,mistakes:0,prompts:1,selection_data:{qcf_line_keys:Array.from({length:7},(_,i)=>`1:${i+1}`)}});
  const eight=c({pages_count:8/15,mistakes:0,prompts:1,selection_data:{qcf_line_keys:Array.from({length:8},(_,i)=>`1:${i+1}`)}});
  assert.equal(seven.evaluation,'good');
  assert.equal(eight.evaluation,'very_good');
  assert.ok(Math.abs(seven.safety_percentage-78.6)<0.11);
  assert.ok(Math.abs(eight.safety_percentage-81.3)<0.11);
});
test('points remain points-first compatible',()=>{
  assert.equal(c(1,0,2).points,0.75);
  assert.equal(c(1,1,0).points,0.75);
  assert.equal(c(1,1,1).points,0.63);
});
