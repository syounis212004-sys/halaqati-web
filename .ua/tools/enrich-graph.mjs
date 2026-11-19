#!/usr/bin/env node
/* Deterministic enrichment of the halaqati-web knowledge graph (no LLM, no network).
 * Reads the assembled graph + the real source and adds relations the file analyzers could not see
 * (classic scripts share globals, most code is IIFE-wrapped one-liners):
 *   Supabase tables/RPCs, pages/roles/permissions, shared state keys, motion CSS, tests -> sources.
 * Every added edge carries a provenance prefix in `description`:
 *   "[مؤكد]"  = read directly from a literal in the source (regex over the file text)
 *   "[مستنتج]" = a reasonable link derived from confirmed facts, NOT proven by a call/import
 * Added nodes are tagged "static-analysis" and removed/re-added on every run (idempotent).
 * Usage: node .ua/tools/enrich-graph.mjs <repo-root> <graph.json in> <graph.json out> */
import fs from 'node:fs';
import path from 'node:path';
import { safeLiteral } from './safe-literal.mjs';

const [root = process.cwd(), inP, outP] = process.argv.slice(2);
if (!inP || !outP) { console.error('usage: node enrich-graph.mjs <repo-root> <graph-in.json> <graph-out.json>'); process.exit(2); }
const g = JSON.parse(fs.readFileSync(inP, 'utf8'));
const TAG = 'static-analysis';
g.nodes = g.nodes.filter(n => !(n.tags || []).includes(TAG));
g.edges = g.edges.filter(e => !String(e.description || '').startsWith('[مؤكد-تحليل]') && !String(e.description || '').startsWith('[مستنتج-تحليل]'));
const byId = new Map(g.nodes.map(n => [n.id, n]));
const edgeKeys = new Set(g.edges.map(e => `${e.source}|${e.target}|${e.type}`));
const WEIGHT = { reads_from: .5, writes_to: .6, calls: .8, depends_on: .6, tested_by: .5, routes: .6, documents: .5, serves: .5 };
const addNode = n => { if (!byId.has(n.id)) { const full = { complexity: 'simple', tags: [], ...n, tags: [...new Set([...(n.tags || []), TAG])] }; g.nodes.push(full); byId.set(n.id, full); } return byId.get(n.id); };
const addEdge = (source, target, type, confirmed, note) => {
  if (!byId.has(source) || !byId.has(target) || source === target) return false;
  const k = `${source}|${target}|${type}`; if (edgeKeys.has(k)) return false; edgeKeys.add(k);
  g.edges.push({ source, target, type, direction: 'forward', weight: WEIGHT[type] ?? .5, description: `${confirmed ? '[مؤكد-تحليل]' : '[مستنتج-تحليل]'} ${note}` });
  return true;
};
const stats = {};
const bump = k => { stats[k] = (stats[k] || 0) + 1; };

/* ---------- source files ---------- */
const fileNodes = g.nodes.filter(n => n.filePath && ['file', 'config'].includes(n.type));
const jsFiles = fileNodes.filter(n => /^web-src\/src\/.*\.js$/.test(n.filePath));
const text = new Map(), lineStarts = new Map();
for (const n of g.nodes.filter(n => /\.(js|mjs|ts|css|html)$/.test(n.filePath || '') && n.type === 'file')) {
  try { const t = fs.readFileSync(path.join(root, n.filePath), 'utf8'); text.set(n.filePath, t); const ls = [0]; for (let i = 0; i < t.length; i++) if (t[i] === '\n') ls.push(i + 1); lineStarts.set(n.filePath, ls); } catch { /* file missing: skipped, reported by validation */ }
}
const lineOf = (fp, idx) => { const ls = lineStarts.get(fp); let lo = 0, hi = ls.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ls[m] <= idx) lo = m; else hi = m - 1; } return lo + 1; };
const funcsByFile = new Map();
for (const n of g.nodes) if (n.type === 'function' && n.lineRange) { if (!funcsByFile.has(n.filePath)) funcsByFile.set(n.filePath, []); funcsByFile.get(n.filePath).push(n); }
const owner = (fp, line) => { let best = null; for (const f of funcsByFile.get(fp) || []) if (f.lineRange[0] <= line && line <= f.lineRange[1] && (!best || f.lineRange[1] - f.lineRange[0] < best.lineRange[1] - best.lineRange[0])) best = f; return best ? best.id : `file:${fp}`; };

/* ---------- 0. Label the analyzer's own (unlabeled) edges ----------
 * [مؤكد-أداة]  = extracted structurally, or the target is named in the source file's own text
 * [مستنتج-أداة] = LLM judgment not backed by the text; speculative types (related/similar_to/configures) are dropped then */
const rdCache = new Map();
const rd = fp => { if (!rdCache.has(fp)) { try { rdCache.set(fp, fs.readFileSync(path.join(root, fp), 'utf8')); } catch { rdCache.set(fp, ''); } } return rdCache.get(fp); };
const named = (fp, name) => new RegExp('\\b' + String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(rd(fp));
const called = (fp, name) => new RegExp('(^|[^\\w$])' + String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\(').test(rd(fp));
const STRUCTURAL = new Set(['contains', 'exports', 'imports', 'migrates']), SPECULATIVE = new Set(['related', 'similar_to', 'configures']);
const labeled = e => /^\[(مؤكد|مستنتج)-(تحليل|أداة)\]/.test(e.description || '');
g.edges = g.edges.filter(e => {
  if (labeled(e)) return true;
  const s = byId.get(e.source), t = byId.get(e.target); if (!s || !t) return false;
  let sure = STRUCTURAL.has(e.type);
  if (!sure && s.filePath) sure = e.type === 'tested_by' ? false : (t.type === 'function' ? called(s.filePath, t.name) : t.filePath ? named(s.filePath, t.filePath.split('/').pop()) || (['reads_from', 'writes_to'].includes(e.type) && named(s.filePath, t.name)) : ['reads_from', 'writes_to'].includes(e.type) && named(s.filePath, t.name));
  if (!sure && (SPECULATIVE.has(e.type) || (e.type === 'calls' && t.type === 'function'))) { bump('dropped_unbacked_' + e.type); return false; }
  e.description = sure ? '[مؤكد-أداة] ' + (STRUCTURAL.has(e.type) ? 'استخراج هيكلي' : 'الهدف مذكور في نص ملف المصدر') : '[مستنتج-أداة] حكم المحلل دون دليل نصي مباشر';
  bump(sure ? 'tool_confirmed' : 'tool_inferred'); return true;
});
edgeKeys.clear(); for (const e of g.edges) edgeKeys.add(`${e.source}|${e.target}|${e.type}`);

/* ---------- 1. Supabase tables and RPCs ---------- */
const tableByName = new Map(g.nodes.filter(n => n.type === 'table').map(n => [n.name, n.id]));
const sqlFnByName = new Map(g.nodes.filter(n => n.type === 'function' && /supabase\/migrations/.test(n.filePath || '')).map(n => [n.name, n.id]));
const WRITE = /^\.(insert|update|upsert|delete)\(/, READ = /^\.select\(/;
const fromRe = /(?<!storage)\.from\(\s*['"`]([a-zA-Z_0-9]+)['"`]\s*\)/g, rpcRe = /\.rpc\(\s*['"`]([a-zA-Z_0-9]+)['"`]/g;
const seenTables = new Set(), seenRpc = new Set();
for (const n of jsFiles.concat(g.nodes.filter(n => /supabase\/functions\//.test(n.filePath || '') && n.type === 'file'))) {
  const t = text.get(n.filePath); if (!t) continue;
  for (const m of t.matchAll(fromRe)) {
    const name = m[1], line = lineOf(n.filePath, m.index);
    const tid = tableByName.get(name) || `table:supabase:${name}`;
    if (!byId.has(tid)) addNode({ id: tid, type: 'table', name, summary: `جدول ${name} في Supabase، مستخرج من استدعاءات db.from('${name}') في الشيفرة (تعريفه قد لا يكون ضمن مجلد الترحيلات).`, tags: ['supabase', 'table'] });
    const tail = t.slice(m.index + m[0].length, m.index + m[0].length + 400);
    const next = tail.search(/\.from\(/); const win = (next === -1 ? tail : tail.slice(0, next));
    const verb = (win.match(/\.(select|insert|update|upsert|delete)\(/) || [])[1];
    const src = owner(n.filePath, line);
    const note = `${n.filePath}:${line} db.from('${name}')${verb ? '.' + verb + '()' : ''}`;
    if (verb === 'select' || !verb) addEdge(src, tid, 'reads_from', !!verb, verb ? note : note + ' (نوع العملية غير ظاهر في النافذة)') && bump('reads_from');
    if (verb && verb !== 'select') addEdge(src, tid, 'writes_to', true, note) && bump('writes_to');
    seenTables.add(name);
  }
  for (const m of t.matchAll(rpcRe)) {
    const name = m[1], line = lineOf(n.filePath, m.index), eid = `endpoint:supabase-rpc:${name}`;
    if (!byId.has(eid)) addNode({ id: eid, type: 'endpoint', name: `rpc:${name}`, summary: `دالة قاعدة البيانات ${name} المستدعاة عبر db.rpc('${name}') في Supabase.`, tags: ['supabase', 'rpc'] });
    addEdge(owner(n.filePath, line), eid, 'calls', true, `${n.filePath}:${line} db.rpc('${name}')`) && bump('rpc_calls');
    if (sqlFnByName.has(name)) addEdge(eid, sqlFnByName.get(name), 'depends_on', false, `الاسم مطابق لدالة SQL معرّفة في الترحيلات`) && bump('rpc_to_sql');
    seenRpc.add(name);
  }
}
stats.tables = seenTables.size; stats.rpcs = seenRpc.size;

/* ---------- 2. Roles, pages (routes), permissions ---------- */
const ROLES = { admin: 'مسؤول النظام', supervisor: 'مشرف الحلقات', teacher: 'محفّظ', guardian: 'ولي أمر', observer: 'مانح', student: 'طالب' };
for (const [r, ar] of Object.entries(ROLES)) addNode({ id: `concept:role:${r}`, type: 'concept', name: `دور ${r}`, summary: `دور المستخدم «${ar}» (${r}) كما يظهر في صلاحيات الواجهة.`, tags: ['role'] });
const pageNode = id => addNode({ id: `concept:page:${id}`, type: 'concept', name: `صفحة ${id}`, summary: `صفحة «${id}» في تطبيق الويب (state.page = '${id}').`, tags: ['page', 'route'] });
const roleConst = new Map();
for (const f of jsFiles) for (const m of (text.get(f.filePath) || '').matchAll(/(?:const|let|var)\s+([A-Z][A-Za-z_]*)\s*=\s*(\[(?:\s*'[a-z]+'\s*,?)+\s*\])/g)) if (!roleConst.has(m[1])) roleConst.set(m[1], [...m[2].matchAll(/'([a-z]+)'/g)].map(x => x[1]));
const parity = text.get('web-src/src/features/rc86/parity.js') || '';
const dm = parity.match(/const DRAWER=(\{[\s\S]*?\n  \});/);
if (dm) {
  let DR = {}; try { DR = safeLiteral(dm[1]); } catch (err) { console.error('DRAWER literal not parseable, role->page edges skipped:', err.message); }
  for (const [role, items] of Object.entries(DR)) for (const [pid, label] of items) { pageNode(pid).summary = `صفحة «${label}» (${pid}).`; addEdge(`concept:role:${role}`, `concept:page:${pid}`, 'routes', true, `القائمة الجانبية للدور ${role} (DRAWER في rc86/parity.js): «${label}»`) && bump('role_page_drawer'); }
}
for (const n of jsFiles) {
  const t = text.get(n.filePath) || '';
  for (const m of t.matchAll(/R\.page\(\s*'([a-z_0-9]+)'\s*,\s*\{\s*title:'([^']*)'\s*,\s*roles:(\[[^\]]*\]|[A-Za-z_]+)/g)) {
    const pid = m[1], p = pageNode(pid); p.summary = `صفحة «${m[2]}» (${pid}) مسجّلة عبر R.page في ${n.filePath}.`;
    let roles = []; if (m[3].startsWith('[')) roles = [...m[3].matchAll(/'([a-z]+)'/g)].map(x => x[1]); else roles = roleConst.get(m[3]) || [];
    addEdge(`concept:page:${pid}`, n.id, 'depends_on', true, `${n.filePath}:${lineOf(n.filePath, m.index)} R.page('${pid}') للأدوار: ${roles.join('،') || 'غير محلولة'}`) && bump('page_impl');
    for (const r of roles) addEdge(`concept:role:${r}`, `concept:page:${pid}`, 'routes', true, `R.page('${pid}') roles في ${n.filePath}`) && bump('role_page_rpage');
  }
}
const nav = text.get('web-src/src/core/navigation.js') || '';
for (const m of nav.matchAll(/function (roleCan\w+|canManage\w+|isOwner|isSupervisor)\(\)\{return ([^}]*)\}/g)) {
  const name = m[1], line = lineOf('web-src/src/core/navigation.js', m.index);
  const fid = `function:web-src/src/core/navigation.js:${name}`;
  if (!byId.has(fid)) addNode({ id: fid, type: 'function', name, filePath: 'web-src/src/core/navigation.js', lineRange: [line, line], summary: `دالة صلاحية: ${name}.`, tags: ['permission'] });
  const pid = `concept:permission:${name}`; addNode({ id: pid, type: 'concept', name: `صلاحية ${name}`, summary: `صلاحية يحسمها ${name}() اعتماداً على state.profile.role.`, tags: ['permission'] });
  addEdge(pid, fid, 'depends_on', true, `تعريف ${name} في navigation.js:${line}`) && bump('perm_fn');
  const rs = /\.includes\(/.test(m[2]) ? [...m[2].matchAll(/'([a-z]+)'/g)].map(x => x[1]) : (name === 'isOwner' || name === 'canManageUsers' ? ['admin'] : name === 'isSupervisor' ? ['supervisor'] : []);
  for (const r of rs) addEdge(`concept:role:${r}`, pid, 'serves', true, `${name}() يسمح للدور ${r}`) && bump('role_perm');
  const re = new RegExp('\\b' + name + '\\s*\\(', 'g');
  for (const f of jsFiles) { const t = text.get(f.filePath) || ''; if (f.filePath !== 'web-src/src/core/navigation.js' && re.test(t)) addEdge(f.id, fid, 'calls', true, `${f.filePath} يستدعي ${name}()`) && bump('perm_use'); re.lastIndex = 0; }
}

/* ---------- 3. Shared state keys (state.<key>) ---------- */
const keyFiles = new Map();
for (const f of jsFiles) { const t = text.get(f.filePath) || ''; for (const m of t.matchAll(/\bstate\.([a-zA-Z_]\w*)\s*(=(?!=)|\+=|\|\|=|\?\?=)?/g)) { const k = m[1]; if (!keyFiles.has(k)) keyFiles.set(k, new Map()); const e = keyFiles.get(k); const cur = e.get(f.id) || { w: false, r: false }; if (m[2]) cur.w = true; else cur.r = true; e.set(f.id, cur); } }
for (const [k, files] of keyFiles) {
  if (files.size < 3) continue; // keys shared by at least 3 files = real cross-module state
  const sid = `concept:state:${k}`; addNode({ id: sid, type: 'concept', name: `state.${k}`, summary: `مفتاح الحالة العامة state.${k} المشترك بين ${files.size} ملفات.`, tags: ['state'] });
  for (const [fid, rw] of files) { if (rw.w) addEdge(fid, sid, 'writes_to', true, `إسناد state.${k}=… في الملف`) && bump('state_w'); if (rw.r) addEdge(fid, sid, 'reads_from', true, `قراءة state.${k} في الملف`) && bump('state_r'); }
}

/* ---------- 4. Motion: files that use the shared motion tokens/classes ---------- */
const motionCss = 'file:web-src/src/styles/motion.css';
if (byId.has(motionCss)) for (const f of jsFiles) { const t = text.get(f.filePath) || ''; const hits = new Set([...t.matchAll(/--hm-[a-z-]+|\bhm-[a-z-]+/g)].map(x => x[0])); if (hits.size) addEdge(f.id, motionCss, 'depends_on', true, `يستخدم رموز/أصناف الحركة المشتركة: ${[...hits].slice(0, 4).join('، ')}`) && bump('motion_js_css'); }
for (const d of g.nodes.filter(n => n.type === 'document' && /MOTION_SYSTEM/.test(n.filePath || ''))) for (const target of ['file:web-src/src/core/motion-system.js', motionCss, 'file:web-src/src/features/rc27/motion.js']) addEdge(d.id, target, 'documents', true, 'التوثيق يصف نظام الحركة المشترك') && bump('motion_doc');

/* ---------- 5. Tests -> sources they read ---------- */
const testFiles = g.nodes.filter(n => n.type === 'file' && /^web-src\/scripts\/.*\.(mjs|html)$/.test(n.filePath || ''));
const srcByPath = new Map(g.nodes.filter(n => n.type === 'file' || n.type === 'config').map(n => [n.filePath, n.id]));
for (const tst of testFiles) {
  const t = text.get(tst.filePath) || '';
  for (const m of t.matchAll(/(?:\.\.\/)?(?:web-src\/)?(src\/[A-Za-z0-9_\-./]+\.(?:js|css))/g)) { const p = 'web-src/' + m[1], id = srcByPath.get(p); if (id) addEdge(id, tst.id, 'tested_by', false, `الاختبار ${path.basename(tst.filePath)} يذكر المسار ${m[1]} (قراءة/تحميل، وليس تغطية مثبتة)`) && bump('tested_by'); }
}

/* new enrichment nodes must belong to a layer (layers are not regenerated on incremental updates) */
const layerOf = id => (g.layers || []).find(l => l.id === id);
const assign = (n, lid) => { const l = layerOf(lid); if (l && !(g.layers || []).some(x => x.nodeIds.includes(n.id))) l.nodeIds.push(n.id); };
for (const n of g.nodes.filter(n => (n.tags || []).includes(TAG))) assign(n, n.type === 'concept' ? 'layer:access-state' : 'layer:backend-data');
const alive = new Set(g.nodes.map(n => n.id)); for (const l of g.layers || []) l.nodeIds = l.nodeIds.filter(i => alive.has(i));
g.project = g.project || {}; g.project.enrichment = { tool: '.ua/tools/enrich-graph.mjs', stats };
fs.writeFileSync(outP, JSON.stringify(g, null, 2));
console.log(JSON.stringify(stats, null, 1)); console.log('nodes', g.nodes.length, 'edges', g.edges.length);
