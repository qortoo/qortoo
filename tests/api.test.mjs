import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { withSnapshot } from '../scripts/lib/api-sources.mjs';
import { dependencyLinks } from '../scripts/lib/rustdoc-links.mjs';

const generator = path.resolve(import.meta.dirname, '../scripts/go-api/main.go');

test('API snapshots use the selected commit despite tracked and untracked local edits', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'qortoo-api-snapshot-test-'));
  try {
    const git = (...args) => execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trim();
    git('init', '--initial-branch=main');
    await writeFile(path.join(directory, 'api.go'), 'committed');
    git('add', '.');
    git('-c', 'user.name=API fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture');
    const sha = git('rev-parse', 'HEAD');
    await writeFile(path.join(directory, 'api.go'), 'uncommitted');
    await writeFile(path.join(directory, 'untracked.go'), 'untracked');
    let snapshot;
    await withSnapshot({ id: 'fixture', directory, sha }, async (input) => {
      snapshot = input;
      assert.equal(await readFile(path.join(input, 'api.go'), 'utf8'), 'committed');
      await assert.rejects(readFile(path.join(input, 'untracked.go')), { code: 'ENOENT' });
    });
    await assert.rejects(readFile(path.join(snapshot, 'api.go')), { code: 'ENOENT' });
    assert.equal(await readFile(path.join(directory, 'api.go'), 'utf8'), 'uncommitted');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('Go API extraction includes cgo declarations, comments and methods without native dependencies', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'qortoo-go-api-test-'));
  try {
    await writeFile(path.join(directory, 'api.go'), `// Package qortoo exposes [Client.Close].
package qortoo
// #include <missing-native-header.h>
import "C"
// Client owns a handle.
type Client struct { Exported string; private int }
// Close releases the handle.
func (c *Client) Close() { panic("must not execute") }
// NewClient creates a [Client].
func NewClient() *Client { return nil }
func privateFunction() {}
`);
    await writeFile(path.join(directory, 'platform_windows.go'), 'package qortoo; type WindowsOnly struct{}');
    await writeFile(path.join(directory, 'excluded.go'), '//go:build excluded\n\npackage qortoo; type Excluded struct{}');
    await writeFile(path.join(directory, 'api_test.go'), 'package qortoo; type TestOnly struct{}');
    const sourceURL = 'https://github.com/qortoo/qortoo-go/blob/' + 'a'.repeat(40);
    const output = execFileSync('go', ['run', generator, directory, sourceURL], { encoding: 'utf8' });
    assert.match(output, /type Client \[#Client\]/);
    assert.match(output, /Client.Close \[#Client.Close\]/);
    assert.match(output, /Close releases the handle/);
    assert.match(output, /\[Client.Close\]\(#Client.Close\)/);
    assert.ok(output.includes(sourceURL + '/api.go#L'));
    assert.doesNotMatch(output, /privateFunction|private int|WindowsOnly|Excluded|TestOnly|must not execute/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('rustdoc dependency link repairs are explicit and pinned to Cargo.lock versions', () => {
  const lock = ['tracing', 'tracing-core', 'tracing-subscriber', 'opentelemetry'].map(name => `[[package]]\nname = "${name}"\nversion = "1.2.3"\n`).join('\n');
  const links = dependencyLinks(lock);
  assert.equal(links.get('Context'), 'https://docs.rs/opentelemetry/1.2.3/opentelemetry/context/struct.Context.html');
  assert.equal(links.get('super::Subscriber'), 'https://docs.rs/tracing/1.2.3/tracing/trait.Subscriber.html');
  assert.equal(links.has('unknown.html'), false);
  assert.throws(() => dependencyLinks(''), /Missing dependency/);
});
