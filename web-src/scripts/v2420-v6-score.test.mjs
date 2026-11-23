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
const c=ctx.computeRecitationV7;
const ev=(pages,m,p)=>c(pages,m,p).evaluation;
test('the circle rule: at most one mistake (a phrase) and two prompts per page, scored 100 - (20*mistakes + 5*prompts) per page', () => {
  assert.equal(c(1,0,0).safety_percentage,100); assert.equal(ev(1,0,0),'excellent');
  assert.equal(c(1,0,1).safety_percentage,95); assert.equal(ev(1,0,1),'excellent');
  assert.equal(c(1,0,2).safety_percentage,90); assert.equal(ev(1,0,2),'excellent');
  assert.equal(c(1,1,0).safety_percentage,80); assert.equal(ev(1,1,0),'very_good');
  assert.equal(c(1,1,1).safety_percentage,75); assert.equal(ev(1,1,1),'good');
  assert.equal(c(1,1,2).safety_percentage,70); assert.equal(ev(1,1,2),'good', 'the highest allowed amount per page still passes');
  assert.equal(ev(1,1,3),'repeat'); assert.ok(c(1,1,3).safety_percentage<70);
  assert.equal(ev(1,2,0),'repeat', 'a second mistake on one page is over the limit');
  assert.equal(ev(1,0,3),'repeat', 'a third prompt on one page is over the limit even though the formula alone gives 85');
  assert.ok(c(1,0,3).safety_percentage<70, 'the shown percentage never contradicts the grade');
});
test('the limit is per page: more pages allow proportionally more', () => {
  assert.equal(c(2,1,2).safety_percentage,85); assert.equal(ev(2,1,2),'very_good');
  assert.equal(ev(2,2,4),'good'); assert.equal(c(2,2,4).safety_percentage,70);
  assert.equal(ev(2,3,0),'repeat'); assert.equal(ev(2,0,5),'repeat');
});
test('short segments normalize by actual line count and a started page has a full allowance', () => {
  const lines=n=>({pages_count:n/15,mistakes:0,prompts:1,selection_data:{qcf_line_keys:Array.from({length:n},(_,i)=>`1:${i+1}`)}});
  const seven=c(lines(7)), eight=c(lines(8));
  assert.ok(Math.abs(seven.safety_percentage-89.3)<0.11); assert.equal(seven.evaluation,'very_good');
  assert.ok(Math.abs(eight.safety_percentage-90.6)<0.11); assert.equal(eight.evaluation,'excellent');
  assert.equal(c(0,0,0).evaluation,'not_rated');
});
test('points keep the old shape: pages minus a quarter per penalty unit (unit = mistake + a quarter prompt)', () => {
  assert.equal(c(1,0,2).points,0.88);
  assert.equal(c(1,1,0).points,0.75);
  assert.equal(c(1,1,2).points,0.63);
  assert.equal(c(1,1,2).scoring_version,'V7');
});
