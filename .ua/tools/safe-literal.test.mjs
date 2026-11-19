import assert from 'node:assert/strict';
import fs from 'node:fs';
import { safeLiteral } from './safe-literal.mjs';

// 1. the real DRAWER literal parses to the same roles/pages the old vm-based code produced
const src = fs.readFileSync(new URL('../../web-src/src/features/rc86/parity.js', import.meta.url), 'utf8');
const lit = src.match(/const DRAWER=(\{[\s\S]*?\n  \});/)[1];
const d = safeLiteral(lit);
assert.deepEqual(Object.keys(d), ['admin', 'supervisor', 'teacher', 'guardian', 'observer']);
assert.equal(d.admin[0][0], 'home');
assert.ok(Object.values(d).every(items => items.every(([id, label]) => id && label)));

// 2. code inside the literal is rejected, never run
globalThis.__pwned = false;
for (const evil of ["({a:(globalThis.__pwned=true)})", "({a:[1].map(x=>x)})", "({a:this.constructor.constructor('return 1')()})"])
  assert.throws(() => safeLiteral(evil), /unsupported token/);
assert.equal(globalThis.__pwned, false);

// 3. trailing commas and nesting are fine
assert.deepEqual(safeLiteral("{x:[['a','b'],],}"), { x: [['a', 'b']] });
console.log('safe-literal: all passed');
