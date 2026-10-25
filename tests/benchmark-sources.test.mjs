import test from 'node:test';
import assert from 'node:assert/strict';
import { collectBenchmarks, digest, benchmarkProvenance } from '../scripts/lib/benchmark-sources.mjs';
import { renderBenchmarkPage } from '../scripts/lib/benchmark-page.mjs';
import { buildBenchmarkView, codeLinks, escapeHtml, makeLines, runAxis, shortDate, toRate } from '../src/lib/benchmark-view.mjs';
import { verifyBuild } from '../scripts/lib/docs-automation.mjs';
import { gitSnapshot } from '../scripts/lib/benchmark-sources.mjs';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const revision = 'a'.repeat(40), checksum = 'b'.repeat(64);
const seriesId = `official/counter/${checksum}`;
const json = value => Buffer.from(JSON.stringify(value));
function fixture({ empty = false, amend = () => {} } = {}) {
  const sources = { rust: { repository: 'https://github.com/qortoo/qortoo-rs.git', sha: 'c'.repeat(40) }, go: { repository: 'https://github.com/qortoo/qortoo-go.git', sha: 'd'.repeat(40) } };
  const environment = { cpu: 'test CPU', os: 'test OS', arch: 'x86_64', runner: 'fixture', id: 'test' };
  const metric = { id: 'latency', unit: 'ns/op', direction: 'smaller' };
  const suite = { suite_id: 'counter', series_id: seriesId, contract_id: 'counter/v1', metric,
    series_definition: { profile: 'full', build_profile: 'release', contract_sha256: checksum, environment, rustc: 'rustc fixture', go: 'go fixture', rust_features: [], protocol: 'round-mean/v1', suite: { id: 'counter', metric } },
    scenarios: [{ scenario_id: 'IncreaseBy', budget: 100, ...Object.fromEntries(['rust', 'go'].map(id => [id, { count: 10, median: 100, mean: 100, min: 90, max: 110, stddev: 5, p95: 110 }])) }] };
  const records = new Map();
  const entries = [1, 2].map(n => {
    const run_id = `${n}-1`, run_url = `https://github.com/qortoo/qortoo-bench/actions/runs/${n}/attempts/1`;
    const common = { schema_version: 1, channel: 'official', run_id, run_url, sources, harness_sha: revision, performance_baseline: true, measurement_baseline: true, harness_dirty: false, environment_provenance: 'measurement-host', environment, completed_at_utc: `2026-01-0${n}T00:00:00Z` };
    const summary = { ...common, suites: [structuredClone(suite)] };
    amend(summary, n);
    const bytes = json(summary);
    const manifest = { ...common, files_sha256: { 'summary.json': digest(bytes) } };
    records.set(`runs/${run_id}/summary.json`, bytes);
    records.set(`runs/${run_id}/manifest.json`, json(manifest));
    return { schema_version: 1, run_id, run_url, sources, channel: 'official', eligible_for_latest: true, series_ids: [seriesId], summary: { path: `runs/${run_id}/summary.json`, sha256: digest(bytes) }, manifest: { path: `runs/${run_id}/manifest.json`, sha256: digest(json(manifest)) } };
  });
  // A later-completed request need not own latest: selection is the publisher's job.
  const shard = json({ schema_version: 1, runs: empty ? {} : Object.fromEntries(entries.map(e => [e.run_id, e])) });
  records.set('index/2026-01.json', shard);
  records.set('index.json', json({ schema_version: 1, shards: { '2026-01': digest(shard) }, latest: empty ? {} : { [seriesId]: entries[0] } }));
  records.set(`requests/go-${sources.go.sha}.json`, json({ schema_version: 1, event: { kind: 'sdk-main', component: 'go', sha: sources.go.sha }, active_attempt: '3-1', status: 'failed' }));
  const snapshot = { revision, files: [...records.keys()], read: file => { assert.ok(records.has(file), file); return records.get(file); } };
  return { snapshot, records, sources };
}

test('fixed snapshot verifies bundles, retains publisher latest and separates failure status', () => {
  const { snapshot } = fixture();
  const data = collectBenchmarks(snapshot);
  assert.equal(data.latest[0].entry.run_id, '1-1');
  assert.deepEqual(data.latest[0].points.map(p => p.entry.run_id), ['1-1', '2-1']);
  assert.equal(data.requests[0].status, 'failed');
  const page = renderBenchmarkPage(data, []);
  assert.match(page.markdown, /Revision difference/);
  assert.match(page.markdown, /previous successful results/);
  assert.match(page.markdown, /failed/);
  assert.equal(page.assets.length, 1);
  const provenance = benchmarkProvenance(data);
  assert.equal(provenance.latest[0].runId, '1-1');
  assert.equal(provenance.latest[0].sources.go.sha, 'd'.repeat(40));
});

test('tampering in index shard, manifest or summary fails closed', () => {
  for (const file of ['index/2026-01.json', 'runs/1-1/manifest.json', 'runs/1-1/summary.json']) {
    const { snapshot, records } = fixture();
    records.set(file, Buffer.concat([records.get(file), Buffer.from(' ')]));
    assert.throws(() => collectBenchmarks(snapshot), /hash mismatch/);
  }
});

test('ineligible or malformed official summaries are rejected even with matching hashes', () => {
  for (const amend of [s => { s.channel = 'candidate'; }, s => { s.harness_dirty = true; },
    s => { s.suites[0].series_definition.profile = 'smoke'; }, s => { s.suites[0].scenarios[0].rust.count = 1; },
    s => { s.sources.go.sha = 'main'; }, s => { s.suites[0].scenarios[0].go.median = -1; }, s => { s.environment_provenance = 'operator-supplied'; }]) {
    const { snapshot } = fixture({ amend });
    assert.throws(() => collectBenchmarks(snapshot), /Benchmark data/);
  }
});

test('empty index renders explicit no-measurement state; data cannot inject MDX or chart markup', () => {
  const empty = collectBenchmarks(fixture({ empty: true }).snapshot);
  assert.match(renderBenchmarkPage(empty, []).markdown, /No official measurements/);
  const { snapshot } = fixture({ amend: s => { s.suites[0].scenarios[0].scenario_id = '<script>{x}</script>|'; } });
  const page = renderBenchmarkPage(collectBenchmarks(snapshot), []);
  assert.doesNotMatch(page.markdown, /<script>/);
  assert.doesNotMatch(page.assets[0].content, /<script>/);
  assert.equal(JSON.parse(page.assets[0].content).topics[0].operations[0], '<script>{x}</script>|');
});

test('rate conversion and UTC labels preserve precision and reject invalid data', () => {
  assert.equal(toRate(1000), 1_000_000);
  assert.equal(toRate(3), 1e9 / 3);
  for (const value of [0, -1, NaN, Infinity, Number.MIN_VALUE, '1000']) assert.throws(() => toRate(value), /finite ns\/op/);
  assert.equal(shortDate('2027-01-01T00:30:00+09:00'), '12/31 15:30');
  assert.equal(escapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
  const data = collectBenchmarks(fixture().snapshot);
  data.latest[0].points[0].summary.suites[0].scenarios[0].rust.median = 0;
  assert.throws(() => buildBenchmarkView(data, []), /finite ns\/op/);
});

test('most measured environment precedes newer reference environments and retains publisher latest', () => {
  const data = collectBenchmarks(fixture().snapshot);
  const reference = structuredClone(data.latest[0]);
  reference.seriesId = `official/counter/${'e'.repeat(64)}`;
  reference.suite.series_id = reference.seriesId;
  reference.summary.environment.cpu = 'Reference CPU';
  reference.points = reference.points.slice(0, 1);
  reference.points[0].summary.suites[0].series_id = reference.seriesId;
  reference.points[0].summary.completed_at_utc = '2026-03-01T00:00:00Z';
  data.latest.unshift(reference);
  const topic = buildBenchmarkView(data, []).topics[0];
  assert.equal(topic.groups[0].runs.length, 2);
  assert.equal(topic.groups[1].runs.length, 1);
  const lines = makeLines(topic, 'IncreaseBy');
  assert.equal(lines.filter(line => line.environmentIndex === 0).length, 2);
  assert.ok(lines.every(line => line.points.find(p => p.latest).run.id === '1-1'));
  assert.deepEqual(runAxis(lines).map(run => run.id), ['1-1', '2-1']);
  assert.equal(lines[0].points[0].stats.stddev, 5);
});

test('Variable retains all payloads as separate SDK lines on a shared run and revision axis', () => {
  const data = collectBenchmarks(fixture().snapshot);
  const group = data.latest[0];
  group.seriesId = `official/variable/${checksum}`;
  for (const point of group.points) {
    const suite = point.summary.suites[0];
    suite.series_id = group.seriesId;
    suite.suite_id = 'variable';
    suite.scenarios = ['64B', '1024B', '16384B'].map(payload => ({ ...structuredClone(suite.scenarios[0]), scenario_id: `Set-${payload}`, operation: 'Set', payload }));
  }
  group.suite = group.points[0].summary.suites[0];
  const topic = buildBenchmarkView(data, []).topics[0];
  const lines = makeLines(topic, 'Set');
  assert.equal(lines.length, 6);
  assert.equal(new Set(lines.map(line => line.id)).size, 6);
  assert.equal(new Set(lines.map(line => line.name)).size, 6);
  assert.deepEqual([...new Set(lines.map(line => line.payload))], ['64B', '1024B', '16384B']);
  const axis = runAxis(lines);
  assert.equal(axis.length, 2);
  assert.equal(axis[0].sources.rust.sha, 'c'.repeat(40));
  const conflicting = structuredClone(lines[0]);
  conflicting.points[0].run.sources.go.sha = 'f'.repeat(40);
  assert.throws(() => runAxis([...lines, conflicting]), /conflicting revisions/);
});

test('incompatible contracts render separate topics and workload links pin the measured harness', () => {
  const data = collectBenchmarks(fixture().snapshot);
  const different = structuredClone(data.latest[0]);
  different.suite.series_definition.contract_sha256 = 'e'.repeat(64);
  data.latest.push(different);
  const page = renderBenchmarkPage(data, []);
  assert.equal(JSON.parse(page.assets[0].content).topics.length, 2);
  assert.match(page.markdown, /### Contract/);
  assert.ok(page.markdown.includes(`/blob/${revision}/harnesses/rust/src/bin/counter.rs`));
  assert.ok(page.markdown.includes(`/blob/${revision}/harnesses/go/counter.go`));
  assert.ok(page.markdown.includes(`/blob/${revision}/contracts/counter.json`));
  assert.ok(codeLinks(data.repository, 'variable', 'e'.repeat(40)).Rust.endsWith(`/blob/${'e'.repeat(40)}/harnesses/rust/src/bin/variable.rs`));
});

test('different toolchain conditions cannot be combined in one series', () => {
  const { snapshot } = fixture({ amend: (s, n) => { if (n === 2) s.suites[0].series_definition.go = 'other compiler'; } });
  assert.throws(() => collectBenchmarks(snapshot), /series conditions changed/);
});

test('build manifest must match benchmark revision and index hash', () => {
  const benchmarks = { repository: 'qortoo/qortoo-bench', revision, indexSha256: checksum };
  const inputs = { version: 1, siteSha: revision, sources: {}, benchmarks };
  const manifest = { site: { sha: revision }, mode: 'committed', benchmarks };
  verifyBuild(inputs, manifest);
  for (const change of [{ revision: 'e'.repeat(40) }, { indexSha256: 'f'.repeat(64) }]) assert.throws(() => verifyBuild(inputs, { ...manifest, benchmarks: { ...benchmarks, ...change } }), /Benchmark build/);
});

test('fixed Git snapshot and refresh retry stay stable despite branch and worktree changes', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'qortoo-benchmark-snapshot-'));
  const git = (...args) => execFileSync('git', ['-C', directory, ...args], { stdio: 'pipe' });
  try {
    const { records } = fixture();
    for (const [file, bytes] of records) {
      await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
      await writeFile(path.join(directory, file), bytes);
    }
    git('init', '--initial-branch=bench-data');
    const commit = () => { git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture'); };
    commit();
    const snapshot = gitSnapshot(directory, 'bench-data');
    const initial = collectBenchmarks(snapshot);
    await writeFile(path.join(directory, 'index.json'), '{}');
    commit();
    await writeFile(path.join(directory, 'index.json'), 'dirty');
    const retried = collectBenchmarks(gitSnapshot(directory, snapshot.revision));
    assert.deepEqual(benchmarkProvenance(retried), benchmarkProvenance(initial));
    assert.deepEqual(renderBenchmarkPage(retried, []), renderBenchmarkPage(initial, []));
    assert.deepEqual(collectBenchmarks(snapshot), initial);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
