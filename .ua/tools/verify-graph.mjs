#!/usr/bin/env node
/* Graph integrity checks for the halaqati-web knowledge graph. Usage: node .ua/tools/verify-graph.mjs <repo-root> [graph.json]
 * Exits 1 on any FAIL. Checks: schema, coverage of source files, stale files, layers/tour refs, call-chain
 * tracing page -> file -> data operation, impact analysis of shared components, motion coverage, commit freshness. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.argv[2] || process.cwd();
const gp = process.argv[3] || path.join(root, '.ua/knowledge-graph.json');
const g = JSON.parse(fs.readFileSync(gp, 'utf8'));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const ids = new Map(g.nodes.map(n => [n.id, n]));

ok(g.nodes.length === ids.size, `V1 node ids unique (${g.nodes.length})`);
ok(g.edges.every(e => ids.has(e.source) && ids.has(e.target)), `V2 no dangling edges (${g.edges.length})`);

/* V3: every file in the analyzer's inventory (.ua/intermediate/scan-result.json, built with .understandignore) has a node */
const inventory = JSON.parse(fs.readFileSync(path.join(root, '.ua/intermediate/scan-result.json'), 'utf8')).files.map(f => f.path).filter(f => !f.startsWith('.ua/'));
const nodePaths = new Set(g.nodes.map(n => n.filePath).filter(Boolean));
const missing = inventory.filter(f => !nodePaths.has(f));
ok(missing.length === 0, `V3 every inventory file (${inventory.length}) has a node (missing ${missing.length}${missing.length ? ': ' + missing.slice(0, 8).join(', ') : ''})`);
const stale = [...nodePaths].filter(p => !fs.existsSync(path.join(root, p)));
ok(stale.length === 0, `V4 no node points at a file that no longer exists (${stale.length})`);

/* V5: layers + tour */
const inLayer = new Map(); let multi = 0;
for (const l of g.layers) for (const id of l.nodeIds) { if (inLayer.has(id)) multi++; inLayer.set(id, l.id); }
const fileLevel = g.nodes.filter(n => ['file', 'config', 'document', 'pipeline', 'schema', 'table', 'endpoint'].includes(n.type));
ok(multi === 0 && fileLevel.every(n => inLayer.has(n.id)), `V5 every file-level node is in exactly one layer (${g.layers.length} layers)`);
ok(g.layers.every(l => l.nodeIds.every(i => ids.has(i))), 'V5b every layer member exists as a node (no stale ids after enrichment)');
ok(g.tour.every(s => s.nodeIds.every(i => ids.has(i))), `V6 tour references resolve (${g.tour.length} steps)`);

/* helpers */
const out = new Map(), inn = new Map();
for (const e of g.edges) { (out.get(e.source) || out.set(e.source, []).get(e.source)).push(e); (inn.get(e.target) || inn.set(e.target, []).get(e.target)).push(e); }
const bfs = (start, adj, types, maxDepth = 6) => { const seen = new Map([[start, [start]]]); let q = [start]; for (let d = 0; d < maxDepth; d++) { const nq = []; for (const id of q) for (const e of (adj.get(id) || [])) { if (!types.includes(e.type)) continue; const nxt = adj === out ? e.target : e.source; if (!seen.has(nxt)) { seen.set(nxt, [...seen.get(id), nxt]); nq.push(nxt); } } q = nq; } return seen; };

/* V7: a full trace  role -> page -> implementing file -> (function) -> Supabase operation */
let traced = null;
for (const p of g.nodes.filter(n => n.id.startsWith('concept:page:'))) {
  const impl = (out.get(p.id) || []).find(e => e.type === 'depends_on' && ids.get(e.target)?.type === 'file'); if (!impl) continue;
  const reach = bfs(impl.target, out, ['contains', 'calls', 'reads_from', 'writes_to'], 3);
  const data = [...reach.keys()].find(k => /^(table|endpoint):/.test(k)); const implRoles = ((impl.description || '').split('للأدوار:')[1] || '').split('،').map(x => x.trim()).filter(Boolean); // roles the R.page registration itself lists
  const role = (inn.get(p.id) || []).find(e => e.type === 'routes' && implRoles.includes(e.source.split(':')[2]));
  if (data && role) { traced = [role.source, p.id, impl.target, ...reach.get(data).slice(1)]; break; }
}
ok(!!traced, `V7 full trace role -> page -> file -> data operation: ${traced ? traced.join(' -> ') : 'none'}`);

/* V8: function-level call chain exists (not only imports) */
const calls = g.edges.filter(e => e.type === 'calls' && ids.get(e.source)?.type === 'function' && ids.get(e.target)?.type === 'function');
ok(calls.length >= 20, `V8 function->function calls present (${calls.length})`);
const chain = (() => { for (const e of calls) { const nx = (out.get(e.target) || []).find(x => x.type === 'calls' && ids.get(x.target)?.type === 'function'); if (nx) return [e.source, e.target, nx.target]; } })();
ok(!!chain, `V9 two-hop function call chain: ${chain ? chain.map(c => c.split(':').pop()).join(' -> ') : 'none'}`);

/* V10: impact of a shared component (roleCanManage permission helper) */
const perm = 'function:web-src/src/core/navigation.js:roleCanManage';
const users = (inn.get(perm) || []).filter(e => e.type === 'calls').map(e => e.source);
ok(users.length >= 5, `V10 impact of changing roleCanManage(): ${users.length} dependent files`);
const motion = 'file:web-src/src/styles/motion.css';
ok((inn.get(motion) || []).some(e => e.type === 'depends_on') && (inn.get(motion) || []).some(e => e.type === 'documents'), `V11 motion.css is linked from code (${(inn.get(motion) || []).filter(e => e.type === 'depends_on').length}) and docs (${(inn.get(motion) || []).filter(e => e.type === 'documents').length})`);
ok(['file:web-src/src/core/motion-system.js', 'file:web-src/src/features/rc27/motion.js', 'file:web-src/scripts/motion-check.mjs'].every(i => ids.has(i)), 'V12 motion system files are nodes (motion-system.js, rc27/motion.js, motion-check.mjs)');

/* V13: Supabase coverage */
const tables = g.nodes.filter(n => n.type === 'table').length, rpcs = g.nodes.filter(n => n.id.startsWith('endpoint:supabase-rpc:')).length;
ok(tables >= 20 && rpcs >= 40 && g.edges.some(e => e.type === 'reads_from') && g.edges.some(e => e.type === 'writes_to'), `V13 Supabase operations present (${tables} tables, ${rpcs} RPCs)`);

/* V14: provenance labels on enrichment edges */
const enr = g.edges.filter(e => /^\[(مؤكد|مستنتج)-تحليل\]/.test(e.description || ''));
ok(enr.length > 500, `V14 enrichment edges carry a confirmed/inferred label (${enr.length})`);

/* V16-V18: provenance and evidence */
const unlabeled = g.edges.filter(e => !/^\[(مؤكد|مستنتج)-(تحليل|أداة)\]/.test(e.description || ''));
ok(unlabeled.length === 0, `V16 every edge is labeled confirmed/inferred (${unlabeled.length} unlabeled)`);
const srcText = f => { try { return fs.readFileSync(path.join(root, f), 'utf8'); } catch { return ''; } };
const unbacked = g.edges.filter(e => e.type === 'calls' && ids.get(e.source)?.type === 'function' && ids.get(e.target)?.type === 'function' && !new RegExp('(^|[^\\w$])' + ids.get(e.target).name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\(').test(srcText(ids.get(e.source).filePath)));
ok(unbacked.length === 0, `V17 every function->function call calls its target by name( in the caller's file (${unbacked.length} without evidence)`);
const speculative = g.edges.filter(e => ['related', 'similar_to'].includes(e.type) && !/^\[مؤكد/.test(e.description || ''));
ok(speculative.length === 0, `V18 no speculative related/similar_to edges (${speculative.length})`);

/* V15: freshness */
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const head = git('rev-parse', 'HEAD').trim();
const graphCommit = g.project.gitCommitHash;
if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(graphCommit)) throw new Error('Invalid graph commit hash');
// Treat renames as a deletion and an addition so moving source into an excluded folder is still detected.
const excluded = /^(?:\.ua\/|\.claude\/|\.codex\/|\.agents\/skills\/|AGENTS\.md$|docs\/KNOWLEDGE_GRAPH_AR\.md$)/;
const changed = graphCommit === head ? [] : git('diff', '--no-renames', '--name-only', '-z', graphCommit, head, '--')
  .split('\0').filter(file => file && !excluded.test(file));
ok(changed.length === 0, `V15 graph matches HEAD ${head.slice(0, 7)} (graph commit ${g.project.gitCommitHash.slice(0, 7)}; source files changed since: ${changed.length})`);

console.log(fails ? `\n${fails} check(s) FAILED` : '\nGraph checks: all passed');
process.exit(fails ? 1 : 0);
