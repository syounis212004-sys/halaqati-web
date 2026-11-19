import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const verifier = path.join(repo, '.ua/tools/verify-graph.mjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'halaqati-v15-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  const write = (name, text) => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  git('init', '-q');
  const commit = (...names) => {
    git('add', '-A', '--', ...names);
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture');
  };
  write('web-src/src/example.js', 'export const before = true;\n');
  commit('web-src/src/example.js');
  const graph = JSON.parse(fs.readFileSync(path.join(repo, '.ua/knowledge-graph.json')));
  graph.project.gitCommitHash = git('rev-parse', 'HEAD');
  write('.ua/knowledge-graph.json', JSON.stringify(graph));
  write('.ua/intermediate/scan-result.json', '{"files":[]}');
  for (const node of graph.nodes.filter(n => n.filePath)) {
    if (fs.existsSync(path.join(root, node.filePath))) continue;
    const source = path.join(repo, node.filePath);
    write(node.filePath, fs.existsSync(source) ? fs.readFileSync(source) : '');
  }
  return { root, git, write, commit };
}

function verify(root, status, count) {
  const result = spawnSync(process.execPath, [verifier, root], { encoding: 'utf8' });
  assert.equal(result.status, status === 'PASS' ? 0 : 1, result.stderr + result.stdout);
  assert.match(result.stdout, new RegExp('^' + status + ' V15 .+source files changed since: ' + count + '\\)$', 'm'));
  assert.equal(result.stdout.match(/^FAIL /gm)?.length ?? 0, status === 'PASS' ? 0 : 1, result.stdout);
}

test('V15 ignores committed project instructions, skill links and Codex hooks', t => {
  const f = fixture(t);
  f.write('AGENTS.md', '# Project instructions\n');
  f.write('.agents/skills/example/SKILL.md', '# Skill\n');
  fs.symlinkSync('example', path.join(f.root, '.agents/skills/linked'));
  f.write('.codex/hooks.json', '{"hooks":{}}');
  f.commit('AGENTS.md', '.agents/skills', '.codex');
  verify(f.root, 'PASS', 0);
});

test('V15 detects a source edit alongside agent configuration', t => {
  const f = fixture(t);
  f.write('AGENTS.md', '# Project instructions\n');
  f.write('web-src/src/example.js', 'export const after = true;\n');
  f.commit('AGENTS.md', 'web-src/src/example.js');
  verify(f.root, 'FAIL', 1);
});

test('V15 detects a source file moved into an excluded directory', t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.root, '.codex'));
  f.git('mv', 'web-src/src/example.js', '.codex/example.js');
  f.commit('.codex');
  verify(f.root, 'FAIL', 1);
});
