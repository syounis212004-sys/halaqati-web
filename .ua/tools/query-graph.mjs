#!/usr/bin/env node
// Graph-first query tool: small answers from .ua/knowledge-graph.json without ever printing or reading the whole graph.
//   node .ua/tools/query-graph.mjs overview
//   node .ua/tools/query-graph.mjs file <path|suffix>        direct relations of a file (+ its functions)
//   node .ua/tools/query-graph.mjs function <name>           callers / callees / data touched
//   node .ua/tools/query-graph.mjs page <name>               roles routing to a page + files whose name matches (inferred)
//   node .ua/tools/query-graph.mjs table <name> | rpc <name> who reads / writes it
//   node .ua/tools/query-graph.mjs impact <file> [file...]   files, tests and data affected by changing those files
//   node .ua/tools/query-graph.mjs search <term>             node lookup by id / name / tag
// Options: --limit N (default 8, per list; totals stay exact)  --graph PATH  --root DIR  --verify  --no-git
// Output is ONE line of compact JSON. Every relation carries conf = confirmed | inferred | unlabeled (from the edge's provenance label).
// --verify greps the SOURCE for each inferred relation and adds evidence = found | not-found | source-missing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_GRAPH = path.join(HERE, '..', 'knowledge-graph.json');
const IGNORED = [/^\.ua\//, /^\.claude\//, /^\.codex\//, /^\.agents\/skills\//, /^AGENTS\.md$/, /^docs\/KNOWLEDGE_GRAPH_AR\.md$/];
const DEPENDENT_TYPES = new Set(['depends_on', 'imports', 'calls', 'exports']);
const cache = new Map();

function load(graphPath) {
  const st = fs.statSync(graphPath), key = graphPath + ':' + st.mtimeMs;
  if (cache.has(key)) return cache.get(key);
  const g = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  const byId = new Map(g.nodes.map(n => [n.id, n])), out = new Map(), inn = new Map();
  for (const e of g.edges) {
    (out.get(e.source) || out.set(e.source, []).get(e.source)).push(e);
    (inn.get(e.target) || inn.set(e.target, []).get(e.target)).push(e);
  }
  const idx = { g, byId, out, inn }; cache.set(key, idx); return idx;
}
const conf = e => { const m = /^\[([^\]]+)\]/.exec(e.description || ''); return !m ? 'unlabeled' : m[1].startsWith('مؤكد') ? 'confirmed' : m[1].startsWith('مستنتج') ? 'inferred' : 'unlabeled'; };
const rank = c => (c === 'confirmed' ? 0 : c === 'unlabeled' ? 1 : 2);
const label = n => !n ? '?' : n.type === 'file' || n.type === 'document' || n.type === 'config' || n.type === 'schema' || n.type === 'pipeline' ? (n.filePath || n.id)
  : n.type === 'function' || n.type === 'class' ? `${n.filePath}#${n.name}` : n.type === 'endpoint' ? n.name.replace(/^rpc:/, '')
  : n.type === 'table' ? n.name : n.id.replace(/^concept:/, '');
const fileOf = n => (n && n.filePath) || null;

function groups(idx, ids, dir, limit) {
  const res = {};
  for (const id of ids) for (const e of (dir === 'in' ? idx.inn : idx.out).get(id) || []) {
    const other = idx.byId.get(dir === 'in' ? e.source : e.target);
    const g = res[e.type] || (res[e.type] = { total: 0, items: [] });
    g.total++;
    g.items.push({ [dir === 'in' ? 'from' : 'to']: label(other), conf: conf(e) });
  }
  for (const [t, g] of Object.entries(res)) {
    g.items.sort((a, b) => rank(a.conf) - rank(b.conf) || String(a.from || a.to).localeCompare(String(b.from || b.to)));
    g.truncated = g.total > limit;
    g.items = t === 'contains' ? [] : g.items.slice(0, limit);
  }
  return res;
}
const cap = (arr, limit) => ({ total: arr.length, truncated: arr.length > limit, items: arr.slice(0, limit) });
const short = (n, withSummary) => ({ id: n.id, type: n.type, ...(n.lineRange ? { lines: n.lineRange } : {}), ...(withSummary && n.summary ? { sum: n.summary.slice(0, 140) } : {}) });

function staleness(o, wanted) {
  if (!o.git) return null;
  const graphPath = o.graph, root = o.root;
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(path.dirname(graphPath), 'meta.json'), 'utf8'));
    const hash = meta.gitCommitHash; if (!hash) return null;
    const changed = execFileSync('git', ['diff', '--name-only', hash], { cwd: root, encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').filter(Boolean).filter(f => !IGNORED.some(r => r.test(f)));
    const hit = (wanted || []).filter(f => changed.includes(f));
    return { commit: hash.slice(0, 7), changed_since: changed.length, ...(hit.length ? { warn: 'file(s) changed after the graph was built; re-read the source', changed_files: hit } : {}) };
  } catch { return null; }
}

function findFile(idx, arg) {
  const files = idx.g.nodes.filter(n => n.type === 'file' || n.type === 'document' || n.type === 'config' || n.type === 'schema');
  const exact = files.filter(n => n.filePath === arg); if (exact.length === 1) return { node: exact[0] };
  const suf = files.filter(n => n.filePath && (n.filePath === arg || n.filePath.endsWith('/' + arg))); if (suf.length === 1) return { node: suf[0] };
  const sub = files.filter(n => n.filePath && n.filePath.includes(arg)); if (sub.length === 1) return { node: sub[0] };
  return { candidates: (suf.length ? suf : sub).map(n => n.filePath) };
}
const functionsOf = (idx, filePath) => idx.g.nodes.filter(n => n.type === 'function' && n.filePath === filePath);
const evidenceFor = (root, srcFile, needles) => {
  try { const t = fs.readFileSync(path.join(root, srcFile), 'utf8'); return needles.some(s => t.includes(s)) ? 'found' : 'not-found'; } catch { return 'source-missing'; }
};

function cmdFile(idx, o, arg) {
  const f = findFile(idx, arg);
  if (!f.node) return { q: 'file', found: false, arg, candidates: f.candidates.slice(0, o.limit), total: f.candidates.length };
  const fns = functionsOf(idx, f.node.filePath);
  return { q: 'file', node: short(f.node, true), in: groups(idx, [f.node.id], 'in', o.limit), out: groups(idx, [f.node.id], 'out', o.limit),
    functions_total: fns.length, functions: fns.slice(0, o.limit).map(n => ({ name: n.name, lines: n.lineRange })), stale: staleness(o, [f.node.filePath]) };
}
function cmdFunction(idx, o, name) {
  let ms = idx.g.nodes.filter(n => (n.type === 'function' || n.type === 'class') && n.name === name);
  if (!ms.length) ms = idx.g.nodes.filter(n => n.type === 'function' && n.name.toLowerCase().includes(name.toLowerCase()));
  if (!ms.length) return { q: 'function', found: false, arg: name };
  return { q: 'function', total: ms.length, matches: ms.slice(0, Math.min(3, o.limit)).map(n => ({ file: n.filePath, lines: n.lineRange, sum: (n.summary || '').slice(0, 120), in: groups(idx, [n.id], 'in', o.limit), out: groups(idx, [n.id], 'out', o.limit) })),
    ...(ms.length > 3 ? { more: ms.slice(3, 3 + o.limit).map(label) } : {}) };
}
function cmdPage(idx, o, name) {
  const node = idx.byId.get('concept:page:' + name);
  if (!node) return { q: 'page', found: false, arg: name, candidates: idx.g.nodes.filter(n => n.id.startsWith('concept:page:') && n.id.includes(name)).map(n => n.id.slice(13)).slice(0, o.limit) };
  const roles = (idx.inn.get(node.id) || []).filter(e => e.type === 'routes' && e.source.startsWith('concept:role:')).map(e => ({ role: e.source.slice(13), conf: conf(e), via: (e.description || '').replace(/^\[[^\]]+\]\s*/, '').slice(0, 90) }));
  const word = name.toLowerCase();
  const related = idx.g.nodes.filter(n => n.type === 'file' && n.filePath && (n.filePath.toLowerCase().split('/').some(seg => seg.replace(/\.[a-z]+$/, '') === word) || (n.tags || []).includes(word))).map(n => n.filePath);
  return { q: 'page', node: short(node, true), roles: cap(roles, o.limit), related_files: { basis: 'name/tag match (inferred, verify in source)', ...cap(related, o.limit) } };
}
function cmdData(idx, o, kind, name) {
  const ids = idx.g.nodes.filter(n => kind === 'table' ? n.type === 'table' && n.name === name : n.type === 'endpoint' && (n.name === 'rpc:' + name || n.name === name)).map(n => n.id);
  if (!ids.length) return { q: kind, found: false, arg: name };
  return { q: kind, nodes: ids.length, in: groups(idx, ids, 'in', o.limit), out: groups(idx, ids, 'out', o.limit) };
}
function cmdImpact(idx, o, args) {
  if (!args.length) return { error: 'impact needs at least one file' };
  const missing = [], files = [], affected = new Map(), tests = new Map(), data = new Map();
  const isTest = p => /\.test\.|-check\.|smoke|\.spec\./.test(p);
  for (const a of args) {
    const f = findFile(idx, a); if (!f.node) { missing.push(a); continue; }
    const fp = f.node.filePath; files.push(fp);
    const ids = [f.node.id, ...functionsOf(idx, fp).map(n => n.id)], own = new Set(ids);
    for (const id of ids) {
      for (const e of idx.inn.get(id) || []) {
        if (!DEPENDENT_TYPES.has(e.type) || own.has(e.source)) continue;
        const sp = fileOf(idx.byId.get(e.source)); if (!sp || sp === fp) continue;
        const a2 = affected.get(sp) || { file: sp, via: new Set(), conf: 'confirmed', by: fp, rankv: 0 };
        a2.via.add(e.type); const c = conf(e); if (rank(c) > a2.rankv) { a2.rankv = rank(c); a2.conf = c; } affected.set(sp, a2);
      }
      for (const e of idx.out.get(id) || []) {
        if (e.type === 'tested_by') { const t = fileOf(idx.byId.get(e.target)); if (t) tests.set(t, { file: t, for: fp, conf: conf(e) }); }
        if (e.type === 'reads_from' || e.type === 'writes_to') {
          const t = idx.byId.get(e.target); if (!t || (t.type !== 'table' && t.type !== 'endpoint')) continue;
          const nm = label(t), key = nm + e.type; if (!data.has(key)) data.set(key, { name: nm, kind: t.type === 'table' ? 'table' : 'rpc', op: e.type === 'reads_from' ? 'reads' : 'writes', conf: conf(e) });
        }
      }
    }
  }
  for (const [p, a] of affected) {
    if (isTest(p)) tests.set(p, tests.get(p) || { file: p, for: a.by, conf: a.conf });
    for (const e of idx.out.get('file:' + p) || []) if (e.type === 'tested_by') { const t = fileOf(idx.byId.get(e.target)); if (t && !tests.has(t)) tests.set(t, { file: t, for: p, conf: conf(e), via: 'dependent' }); }
  }
  const items = [...affected.values()].sort((x, y) => x.rankv - y.rankv || x.file.localeCompare(y.file)).map(a => {
    const row = { file: a.file, via: [...a.via].sort(), conf: a.conf };
    if (o.verify && a.conf === 'inferred') row.evidence = evidenceFor(o.root, a.file, files.flatMap(f => { const b = path.basename(f), n = b.replace(/\.[a-z]+$/, ''); return n.length >= 4 ? [b, n] : [b]; }));
    return row;
  });
  const sort = arr => arr.sort((x, y) => rank(x.conf) - rank(y.conf) || String(x.file || x.name).localeCompare(String(y.file || y.name)));
  return { q: 'impact', files, ...(missing.length ? { not_in_graph: missing } : {}), affected_files: cap(items, o.limit), tests: cap(sort([...tests.values()]), o.limit),
    data: cap(sort([...data.values()]), o.limit), stale: staleness(o, files),
    note: 'direct relations only (1 hop, plus tests of dependents); relations tagged inferred must be verified in source (--verify)' };
}
function cmdSearch(idx, o, term) {
  const t = term.toLowerCase();
  const hits = idx.g.nodes.filter(n => n.id.toLowerCase().includes(t) || (n.name || '').toLowerCase().includes(t) || (n.tags || []).some(x => x.toLowerCase() === t));
  return { q: 'search', arg: term, ...cap(hits.map(n => ({ t: n.type, id: label(n) })), o.limit) };
}
function cmdOverview(idx, o) {
  const count = arr => arr.reduce((a, x) => (a[x] = (a[x] || 0) + 1, a), {});
  return { q: 'overview', nodes: idx.g.nodes.length, edges: idx.g.edges.length, node_types: count(idx.g.nodes.map(n => n.type)), edge_types: count(idx.g.edges.map(e => e.type)),
    layers: (idx.g.layers || []).map(l => ({ id: l.id, name: l.name, nodes: (l.nodeIds || []).length })), stale: staleness(o, []) };
}

export function run(argv) {
  const o = { limit: 8, graph: DEFAULT_GRAPH, root: path.join(HERE, '..', '..'), verify: false, git: true }, pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--limit') o.limit = Math.max(1, parseInt(argv[++i], 10) || 8);
    else if (a === '--graph') o.graph = argv[++i];
    else if (a === '--root') o.root = argv[++i];
    else if (a === '--verify') o.verify = true;
    else if (a === '--no-git') o.git = false;
    else pos.push(a);
  }
  try {
    const [cmd, ...args] = pos;
    if (!cmd) return { error: 'usage: query-graph.mjs overview | file <path> | function <name> | page <name> | table <name> | rpc <name> | impact <file...> | search <term>' };
    if (!fs.existsSync(o.graph)) return { error: `graph not found: ${o.graph}` };
    const idx = load(o.graph);
    const need = () => (args[0] ? null : { error: `${cmd} needs an argument` });
    const res = cmd === 'overview' ? cmdOverview(idx, o) : need() || (cmd === 'file' ? cmdFile(idx, o, args[0]) : cmd === 'function' ? cmdFunction(idx, o, args[0])
      : cmd === 'page' ? cmdPage(idx, o, args[0]) : cmd === 'table' ? cmdData(idx, o, 'table', args[0]) : cmd === 'rpc' ? cmdData(idx, o, 'rpc', args[0])
      : cmd === 'impact' ? cmdImpact(idx, o, args) : cmd === 'search' ? cmdSearch(idx, o, args[0]) : { error: `unknown command: ${cmd}` });
    return res;
  } catch (e) { return { error: String(e && e.message || e) }; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = run(process.argv.slice(2));
  console.log(JSON.stringify(r));
  process.exit(r.error ? 1 : 0);
}
