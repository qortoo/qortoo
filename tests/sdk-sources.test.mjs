import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadSources, readSource } from '../scripts/lib/sdk-sources.mjs';

test('a full candidate SHA and fork repository override main without reading worktree changes', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'qortoo-source-candidate-'));
  const git = (...args) => execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trim();
  const commit = () => { git('add', '.'); git('-c', 'user.name=Docs fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture'); };
  try {
    git('init', '--initial-branch=main');
    await mkdir(path.join(directory, 'docs'));
    await writeFile(path.join(directory, 'docs/start.md'), '# Main');
    commit();
    git('checkout', '-b', 'candidate');
    await writeFile(path.join(directory, 'docs/start.md'), '# Candidate');
    commit();
    const sha = git('rev-parse', 'HEAD');
    await writeFile(path.join(directory, 'docs/start.md'), '# Uncommitted');
    await writeFile(path.join(directory, 'docs/untracked.md'), '# Untracked');
    const config = { sources: [{ id: 'rust', directory, directoryEnv: 'SDK_DIR', repository: 'qortoo/qortoo-rs', repositoryEnv: 'SDK_REPOSITORY', ref: 'main', refEnv: 'SDK_REF' }] };
    const [source] = loadSources(directory, config, { SDK_REPOSITORY: 'contributor/qortoo-rs', SDK_REF: sha });
    assert.equal(source.sha, sha);
    assert.equal(source.repository, 'contributor/qortoo-rs');
    assert.equal(source.upstreamRepository, 'qortoo/qortoo-rs');
    assert.equal(source.editRef, sha);
    const [upstream] = loadSources(directory, config, { SDK_REF: sha });
    assert.equal(upstream.editRef, 'main');
    assert.equal((await readSource(source, 'docs/start.md', false)).toString(), '# Candidate');
    assert.equal(source.files.has('docs/untracked.md'), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
