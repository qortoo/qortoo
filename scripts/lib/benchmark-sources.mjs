import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';

export const benchmarkRepository = 'qortoo/qortoo-bench';
export const digest = data => createHash('sha256').update(data).digest('hex');
const sha = /^[0-9a-f]{40}$/;
const hash = /^[0-9a-f]{64}$/;
const seriesPattern = /^official\/[a-z][a-z0-9-]*\/[0-9a-f]{64}$/;
const require = (condition, message) => { if (!condition) throw new Error(`Benchmark data: ${message}`); };
const equal = isDeepStrictEqual;
export function gitSnapshot(directory, ref) {
  const git = (...args) => execFileSync('git', ['-C', directory, ...args], { maxBuffer: 32 * 1024 * 1024 });
  const revision = git('rev-parse', '--verify', `${ref}^{commit}`).toString().trim();
  require(sha.test(revision), 'invalid data revision');
  return { revision, files: git('ls-tree', '-r', '--name-only', revision).toString().trim().split('\n'),
    read: file => git('show', `${revision}:${file}`) };
}

/** Read JSON only from a fixed Git snapshot. Action JavaScript is never evaluated. */
export function collectBenchmarks(snapshot) {
  require(sha.test(snapshot.revision), 'invalid snapshot');
  const read = (file, expected) => {
    require(/^(index(?:\/\d{4}-\d{2})?\.json|runs\/[0-9]+-[0-9]+\/(?:manifest|summary)\.json|requests\/[a-z0-9-]+\.json)$/.test(file), 'invalid data path');
    const bytes = snapshot.read(file);
    require(bytes.length <= 25 * 1024 * 1024, 'JSON exceeds size limit');
    if (expected !== undefined) require(hash.test(expected) && digest(bytes) === expected, `hash mismatch: ${file}`);
    const value = JSON.parse(bytes);
    require(value.schema_version === 1, `unsupported schema: ${file}`);
    return { value, sha256: digest(bytes) };
  };
  const { value: index, sha256: indexSha256 } = read('index.json');
  require(index.latest && index.shards && !Array.isArray(index.latest), 'invalid index');
  const entries = new Map();
  for (const [month, checksum] of Object.entries(index.shards)) {
    require(/^\d{4}-\d{2}$/.test(month), 'invalid shard');
    const shard = read(`index/${month}.json`, checksum).value;
    require(shard.runs && typeof shard.runs === 'object' && !Array.isArray(shard.runs), 'invalid shard entries');
    for (const entry of Object.values(shard.runs)) {
      require(!entries.has(entry.run_id), 'duplicate run');
      entries.set(entry.run_id, entry);
    }
  }
  const runs = new Map();
  function load(entry) {
    require(entry.schema_version === 1 && /^[0-9]+-[0-9]+$/.test(entry.run_id), 'invalid run');
    require(entry.channel === 'official' && entry.eligible_for_latest === true, 'ineligible result');
    require(entry.manifest.path === `runs/${entry.run_id}/manifest.json` && entry.summary.path === `runs/${entry.run_id}/summary.json`, 'invalid bundle paths');
    const manifest = read(entry.manifest.path, entry.manifest.sha256).value;
    const summary = read(entry.summary.path, entry.summary.sha256).value;
    require(manifest.files_sha256?.['summary.json'] === entry.summary.sha256, 'manifest/summary mismatch');
    require(summary.run_id === entry.run_id && manifest.run_id === entry.run_id && summary.run_url === entry.run_url, 'run identity mismatch');
    require(/^https:\/\/github\.com\/qortoo\/qortoo-bench\/actions\/runs\/[0-9]+(?:\/attempts\/[0-9]+)?$/.test(summary.run_url), 'invalid run URL');
    for (const record of [summary, manifest]) require(record.channel === 'official' && record.performance_baseline === true && record.measurement_baseline === true && record.harness_dirty === false && record.environment_provenance === 'measurement-host', 'unofficial measurement');
    require(sha.test(summary.harness_sha) && Number.isFinite(Date.parse(summary.completed_at_utc)), 'invalid provenance');
    require(equal(summary.sources, entry.sources) && equal(manifest.sources, summary.sources), 'source mismatch');
    for (const field of ['harness_sha', 'completed_at_utc', 'environment', 'run_url']) require(equal(manifest[field], summary[field]), `provenance mismatch: ${field}`);
    require(equal(Object.keys(summary.sources).sort(), ['go', 'rust']), 'unsupported SDK sources');
    for (const id of ['rust', 'go']) require(summary.sources[id]?.repository === `https://github.com/qortoo/qortoo-${id === 'rust' ? 'rs' : 'go'}.git` && sha.test(summary.sources[id].sha), 'invalid SDK source');
    require(Array.isArray(summary.suites) && summary.suites.length > 0, 'missing suites');
    for (const suite of summary.suites) {
      require(seriesPattern.test(suite.series_id) && suite.series_id.split('/')[1] === suite.suite_id && entry.series_ids.includes(suite.series_id), 'invalid series');
      require(suite.series_definition?.profile === 'full' && hash.test(suite.series_definition.contract_sha256), 'invalid contract/profile');
      require(equal(suite.series_definition.environment, summary.environment) && equal(suite.series_definition.suite?.metric, suite.metric) && suite.series_definition.suite.id === suite.suite_id, 'series definition mismatch');
      // Series digests use Python canonical JSON; do not reserialize them with JS number formatting.
      require(['smaller', 'bigger'].includes(suite.metric?.direction) && typeof suite.metric.unit === 'string', 'invalid metric');
      require(Array.isArray(suite.scenarios) && suite.scenarios.length > 0, 'missing scenarios');
      for (const scenario of suite.scenarios) for (const id of ['rust', 'go']) {
        const stats = scenario[id];
        require(typeof scenario.scenario_id === 'string' && stats?.count === 10 && ['median', 'mean', 'min', 'max', 'stddev', 'p95'].every(k => Number.isFinite(stats[k]) && stats[k] >= 0), 'invalid full measurement');
      }
    }
    return { entry, summary };
  }
  for (const entry of entries.values()) if (entry.channel === 'official' && entry.eligible_for_latest === true) runs.set(entry.run_id, load(entry));
  const latest = Object.entries(index.latest).map(([seriesId, entry]) => {
    require(seriesPattern.test(seriesId) && equal(entries.get(entry.run_id), entry), 'latest is not indexed');
    const run = runs.get(entry.run_id);
    const suite = run?.summary.suites.find(s => s.series_id === seriesId);
    require(suite, 'latest series missing from summary');
    const points = [...runs.values()].filter(r => r.summary.suites.some(s => s.series_id === seriesId))
      .sort((a, b) => Number(a.entry.run_id.split('-')[0]) - Number(b.entry.run_id.split('-')[0]) || Number(a.entry.run_id.split('-')[1]) - Number(b.entry.run_id.split('-')[1]));
    require(points.every(p => equal(p.summary.suites.find(s => s.series_id === seriesId).series_definition, suite.series_definition)), 'series conditions changed within one trend');
    return { seriesId, suite, ...run, points };
  });
  const requests = snapshot.files.filter(f => /^requests\/[a-z0-9-]+\.json$/.test(f)).map(file => read(file).value)
    .filter(r => r.event?.kind === 'sdk-main').map(r => {
      require(['rust', 'go'].includes(r.event.component) && sha.test(r.event.sha) && /^[0-9]+-[0-9]+$/.test(r.active_attempt), 'invalid request');
      require(['received', 'running', 'published', 'failed', 'incompatible', 'cancelled'].includes(r.status), 'invalid request status');
      return { component: r.event.component, sha: r.event.sha, status: r.status, attempt: r.active_attempt,
        runUrl: `https://github.com/${benchmarkRepository}/actions/runs/${r.active_attempt.replace('-', '/attempts/')}` };
    });
  return { repository: benchmarkRepository, revision: snapshot.revision, indexSha256, latest, requests };
}

export function benchmarkProvenance(data) {
  return { repository: data.repository, revision: data.revision, indexSha256: data.indexSha256,
    latest: data.latest.map(({ seriesId, suite, entry, summary }) => ({ seriesId, runId: entry.run_id,
      summarySha256: entry.summary.sha256, manifestSha256: entry.manifest.sha256,
      contractSha256: suite.series_definition.contract_sha256, sources: summary.sources })) };
}
