// Tests for query-graph.mjs: a small fixture graph (exact expectations) + consistency checks against the real stored graph.
// Run: node --test .ua/tools/query-graph.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { run } from './query-graph.mjs';

const E = (source, target, type, tag = 'مؤكد-أداة') => ({ source, target, type, direction: 'forward', weight: 0.7, description: `[${tag}] x` });
const N = (id, type, extra = {}) => ({ id, type, name: id.split(/[:/]/).pop(), summary: 'ملخص ' + id, ...extra });
const FIX = {
  version: '1', project: {}, layers: [{ id: 'layer:a', name: 'طبقة أ', nodeIds: ['file:src/a.js', 'file:src/b.js'] }], tour: [],
  nodes: [
    N('file:src/a.js', 'file', { filePath: 'src/a.js' }), N('file:src/b.js', 'file', { filePath: 'src/b.js' }),
    N('file:src/c.js', 'file', { filePath: 'src/c.js' }), N('file:tests/a.test.mjs', 'file', { filePath: 'tests/a.test.mjs' }),
    N('function:src/a.js:doA', 'function', { filePath: 'src/a.js', lineRange: [3, 9] }),
    N('function:src/b.js:doB', 'function', { filePath: 'src/b.js', lineRange: [1, 4] }),
    N('function:src/c.js:doB', 'function', { filePath: 'src/c.js', lineRange: [1, 2] }),
    N('table:m/1.sql:students', 'table', { filePath: 'm/1.sql' }), N('endpoint:supabase-rpc:get_students', 'endpoint'),
    N('concept:page:students', 'concept'), N('concept:role:admin', 'concept'), N('concept:role:teacher', 'concept'),
  ],
  edges: [
    E('file:src/b.js', 'file:src/a.js', 'depends_on'), E('file:src/c.js', 'file:src/a.js', 'imports', 'مستنتج-تحليل'),
    E('function:src/b.js:doB', 'function:src/a.js:doA', 'calls'), E('function:src/a.js:doA', 'table:m/1.sql:students', 'reads_from'),
    E('file:src/a.js', 'endpoint:supabase-rpc:get_students', 'reads_from', 'مستنتج-أداة'),
    E('file:src/a.js', 'file:tests/a.test.mjs', 'tested_by'),
    E('concept:role:admin', 'concept:page:students', 'routes', 'مؤكد-تحليل'), E('concept:role:teacher', 'concept:page:students', 'routes', 'مؤكد-تحليل'),
  ],
};
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qg-'));
const GP = path.join(dir, 'graph.json');
fs.writeFileSync(GP, JSON.stringify(FIX));
const q = (...a) => run([...a, '--graph', GP, '--no-git']);

test('file: direct relations in both directions, labelled confirmed/inferred, with exact totals', () => {
  const r = q('file', 'src/a.js');
  assert.equal(r.node.id, 'file:src/a.js');
  assert.deepEqual(r.in.depends_on.items.map(i => i.from), ['src/b.js']);
  assert.equal(r.in.imports.items[0].conf, 'inferred');
  assert.equal(r.in.depends_on.items[0].conf, 'confirmed');
  assert.equal(r.out.tested_by.items[0].to, 'tests/a.test.mjs');
  assert.equal(r.out.reads_from.total, 1);
  assert.equal(r.functions.length, 1);
  assert.equal(r.functions[0].name, 'doA');
  assert.deepEqual(r.functions[0].lines, [3, 9]);
});

test('file: unique suffix match works, ambiguous/missing give candidates or a clear miss', () => {
  assert.equal(q('file', 'a.js').node.id, 'file:src/a.js');
  const none = q('file', 'zzz.js');
  assert.equal(none.found, false);
  const amb = q('file', '.js');
  assert.equal(amb.found, false);
  assert.ok(amb.candidates.length >= 2);
});

test('--limit caps every list but keeps the true total and flags truncation', () => {
  const r = run(['file', 'src/a.js', '--graph', GP, '--no-git', '--limit', '1']);
  assert.equal(r.in.depends_on.items.length, 1);
  const all = Object.values(r.in).concat(Object.values(r.out));
  assert.ok(all.every(g => g.items.length <= 1));
  const r2 = run(['search', 'src', '--graph', GP, '--no-git', '--limit', '2']);
  assert.equal(r2.items.length, 2);
  assert.ok(r2.total > 2 && r2.truncated === true);
});

test('function: name match across files, callers and callees', () => {
  const r = q('function', 'doB');
  assert.equal(r.matches.length, 2);
  const b = r.matches.find(m => m.file === 'src/b.js');
  assert.deepEqual(b.out.calls.items.map(i => i.to), ['src/a.js#doA']);
  const a = q('function', 'doA').matches[0];
  assert.deepEqual(a.in.calls.items.map(i => i.from), ['src/b.js#doB']);
  assert.equal(a.out.reads_from.items[0].to, 'students');
});

test('page: roles that route to it, not the whole graph', () => {
  const r = q('page', 'students');
  assert.deepEqual(r.roles.items.map(x => x.role).sort(), ['admin', 'teacher']);
  assert.equal(r.node.id, 'concept:page:students');
});

test('table / rpc: who reads or writes it', () => {
  assert.deepEqual(q('table', 'students').in.reads_from.items.map(i => i.from), ['src/a.js#doA']);
  assert.deepEqual(q('rpc', 'get_students').in.reads_from.items.map(i => i.from), ['src/a.js']);
});

test('impact: dependents, callers, tests and data touched by a changed file', () => {
  const r = q('impact', 'src/a.js');
  assert.deepEqual(r.affected_files.items.map(i => i.file).sort(), ['src/b.js', 'src/c.js']);
  assert.deepEqual(r.tests.items.map(i => i.file), ['tests/a.test.mjs']);
  assert.deepEqual(r.data.items.map(i => i.name).sort(), ['get_students', 'students']);
  assert.equal(r.affected_files.items.find(i => i.file === 'src/c.js').conf, 'inferred');
});

test('overview is small and lists layers', () => {
  const r = q('overview');
  assert.equal(r.nodes, FIX.nodes.length);
  assert.equal(r.edges, FIX.edges.length);
  assert.equal(r.layers[0].id, 'layer:a');
});

test('--verify checks an inferred relation against the source text instead of trusting it', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsrc-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src/c.js'), "import { x } from './a.js';\n");
  const r = run(['impact', 'src/a.js', '--graph', GP, '--no-git', '--verify', '--root', root]);
  assert.equal(r.affected_files.items.find(i => i.file === 'src/c.js').evidence, 'found');
  fs.writeFileSync(path.join(root, 'src/c.js'), 'nothing here\n');
  const r2 = run(['impact', 'src/a.js', '--graph', GP, '--no-git', '--verify', '--root', root]);
  assert.equal(r2.affected_files.items.find(i => i.file === 'src/c.js').evidence, 'not-found');
});

test('bad input: missing arguments and unknown commands report an error, never throw a stack', () => {
  assert.ok(run(['file', '--graph', GP, '--no-git']).error);
  assert.ok(run(['nope', '--graph', GP, '--no-git']).error);
  assert.ok(run(['file', 'a', '--graph', path.join(dir, 'missing.json')]).error);
});

test('CLI prints compact single-line JSON to stdout', () => {
  const out = execFileSync('node', [path.join(import.meta.dirname, 'query-graph.mjs'), 'file', 'src/a.js', '--graph', GP, '--no-git'], { encoding: 'utf8' });
  assert.ok(out.trim().split('\n').length === 1);
  assert.equal(JSON.parse(out).node.id, 'file:src/a.js');
});

// ---- consistency with the real stored graph (skipped when it is absent) ----
const REAL = path.join(import.meta.dirname, '..', 'knowledge-graph.json');
test('real graph: query output equals a raw scan of the same edges', { skip: !fs.existsSync(REAL) }, () => {
  const g = JSON.parse(fs.readFileSync(REAL, 'utf8'));
  const id = 'file:web-src/src/core/script-loader.js';
  const r = run(['file', 'web-src/src/core/script-loader.js', '--limit', '3', '--no-git']);
  assert.equal(r.node.id, id);
  const rawIn = {}; const rawOut = {};
  for (const e of g.edges) { if (e.target === id) rawIn[e.type] = (rawIn[e.type] || 0) + 1; if (e.source === id) rawOut[e.type] = (rawOut[e.type] || 0) + 1; }
  for (const [t, n] of Object.entries(rawIn)) assert.equal(r.in[t].total, n, 'in ' + t);
  for (const [t, n] of Object.entries(rawOut)) assert.equal(r.out[t].total, n, 'out ' + t);
  const sources = new Set(g.edges.filter(e => e.target === id && e.type === 'depends_on').map(e => e.source.replace(/^file:/, '')));
  for (const it of r.in.depends_on?.items || []) assert.ok(sources.has(it.from));
});

test('real graph: impact lists only valid confidence labels and finds the known dependents', { skip: !fs.existsSync(REAL) }, () => {
  const r = run(['impact', 'web-src/src/core/script-loader.js', '--limit', '50', '--no-git']);
  assert.deepEqual(r.affected_files.items.map(i => i.file).sort(), ['web-src/src/core/lazy-libs.js', 'web-src/src/main.js']);
  assert.equal(r.stale, null);
  assert.ok(r.affected_files.items.every(i => ['confirmed', 'inferred', 'unlabeled'].includes(i.conf)));
});

test('real graph: output for typical questions stays small (bytes budget)', { skip: !fs.existsSync(REAL) }, () => {
  const budget = (args, max) => { const s = JSON.stringify(run([...args, '--no-git'])); assert.ok(s.length <= max, `${args.join(' ')} -> ${s.length} > ${max}`); };
  budget(['overview'], 3500);
  budget(['file', 'web-src/src/core/script-loader.js'], 6000);
  budget(['impact', 'web-src/src/core/script-loader.js'], 6000);
  budget(['page', 'students'], 6000);
  budget(['function', 'ensureLib'], 4000);
});
