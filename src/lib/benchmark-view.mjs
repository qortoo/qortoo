/** @typedef {import('./benchmark-types').BenchmarkView} BenchmarkView */
/** @typedef {import('./benchmark-types').BenchmarkTopic} BenchmarkTopic */
/** @typedef {import('./benchmark-types').BenchmarkLine} BenchmarkLine */

export function toRate(ns) {
  const rate = 1e9 / ns;
  if (!Number.isFinite(ns) || ns <= 0 || !Number.isFinite(rate)) throw new Error('Benchmark presentation: expected positive finite ns/op');
  return rate;
}
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const formatRate = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
export const compactRate = value => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
export const formatDate = value => new Date(value).toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
export const shortDate = value => new Date(value).toISOString().slice(5, 16).replace('T', ' ').replace('-', '/');
export const payloadLabel = payload => ({ '64B': '64 B', '1024B': '1 KiB', '16384B': '16 KiB' })[payload] ?? payload;

/** @type {Record<string, string>} */
export const operationDescriptions = {
  IncreaseBy: 'One counter increment through the public SDK API.',
  GetValue: 'One counter read through the public SDK API.',
  BuildCounter: 'One counter construction and immediate release.',
  Set: 'One typed JSON write, including SDK serialization and previous-value handling.',
  Get: 'One typed JSON read, including SDK deserialization.',
  Transaction: 'One committed transaction containing ten writes. The whole transaction is one operation.',
  SyncLocal: 'One write followed by a synchronous local sync. The whole pair is one operation.',
};

export function codeLinks(repository, suiteId, harnessSha) {
  const base = `https://github.com/${repository}/blob/${harnessSha}`;
  return ['counter', 'variable'].includes(suiteId) ? {
    Rust: `${base}/harnesses/rust/src/bin/${suiteId}.rs`,
    Go: `${base}/harnesses/go/${suiteId}.go`,
    Contract: `${base}/contracts/${suiteId}.json`,
  } : { Harness: `https://github.com/${repository}/tree/${harnessSha}` };
}

/** @returns {BenchmarkView} */
export function buildBenchmarkView(data, docSources) {
  const topics = new Map();
  for (const series of data.latest) {
    const { suite, summary, entry } = series;
    if (suite.metric.unit !== 'ns/op' || suite.metric.direction !== 'smaller') throw new Error('Benchmark presentation: unsupported metric');
    const definition = suite.series_definition;
    // Different workload contracts or protocols must never share a chart axis.
    const key = JSON.stringify([suite.suite_id, definition.contract_sha256, definition.protocol]);
    if (!topics.has(key)) topics.set(key, { id: `${suite.suite_id}-${topics.size}`, suiteId: suite.suite_id, groups: [], operations: [] });
    const topic = topics.get(key);
    const runs = series.points.map(point => {
      const measured = point.summary.suites.find(s => s.series_id === series.seriesId);
      const time = Date.parse(point.summary.completed_at_utc);
      if (!Number.isFinite(time)) throw new Error('Benchmark presentation: invalid measurement time');
      const scenarios = measured.scenarios.map(s => {
        for (const sdk of ['rust', 'go']) toRate(s[sdk].median);
        return { id: s.scenario_id, operation: s.operation ?? s.scenario_id, ...(s.payload ? { payload: s.payload } : {}), budget: s.budget, rust: s.rust, go: s.go };
      });
      return { id: point.entry.run_id, url: point.summary.run_url, time, sources: point.summary.sources,
        harnessSha: point.summary.harness_sha, summaryPath: point.entry.summary.path, scenarios };
    });
    if (!runs.some(run => run.id === entry.run_id)) throw new Error('Benchmark presentation: current result missing');
    topic.groups.push({ id: series.seriesId, label: summary.environment.cpu.replace(/^AMD /, '').replace(/ \d+-Core Processor$/, ''),
      environment: summary.environment, currentRunId: entry.run_id, runs,
      revisionDifferences: Object.entries(summary.sources).filter(([id, source]) => docSources.find(d => d.id === id)?.sha !== source.sha).map(([id]) => id),
      conditions: { rustc: definition.rustc, go: definition.go, profile: definition.build_profile, features: definition.rust_features,
        contractId: suite.contract_id, contractSha: definition.contract_sha256, protocol: definition.protocol } });
    for (const scenario of suite.scenarios) {
      const operation = scenario.operation ?? scenario.scenario_id;
      if (!topic.operations.includes(operation)) topic.operations.push(operation);
    }
  }
  for (const topic of topics.values()) {
    topic.groups.sort((a, b) => new Set(b.runs.map(r => r.id)).size - new Set(a.runs.map(r => r.id)).size
      || b.runs.find(r => r.id === b.currentRunId).time - a.runs.find(r => r.id === a.currentRunId).time || a.id.localeCompare(b.id));
    for (const group of topic.groups) if (topic.groups.filter(g => g.label === group.label).length > 1) group.label += ` / ${group.id.split('/').at(-1).slice(0, 12)}`;
    for (const operation of topic.operations) runAxis(makeLines(topic, operation));
  }
  return { repository: data.repository, revision: data.revision, topics: [...topics.values()].sort((a, b) => a.suiteId.localeCompare(b.suiteId) || a.id.localeCompare(b.id)) };
}

/** @param {BenchmarkTopic} topic @returns {BenchmarkLine[]} */
export function makeLines(topic, operation) {
  return topic.groups.flatMap((group, environmentIndex) => {
    const current = group.runs.find(r => r.id === group.currentRunId);
    const scenarios = current.scenarios.filter(s => s.operation === operation);
    return scenarios.flatMap((scenario, payloadIndex) => ['rust', 'go'].map(sdk => {
      const name = `${group.label} · ${sdk === 'rust' ? 'Rust' : 'Go'}${scenario.payload ? ` · ${payloadLabel(scenario.payload)}` : ''}`;
      const points = group.runs.flatMap(run => {
        const measured = run.scenarios.find(s => s.id === scenario.id);
        return measured ? [{ name, sdk, rate: toRate(measured[sdk].median), stats: measured[sdk], scenario: measured, run, group, latest: run.id === group.currentRunId }] : [];
      });
      return { id: `${group.id}/${sdk}/${scenario.id}`, name, sdk, payload: scenario.payload, payloadIndex, environmentIndex,
        runCount: new Set(group.runs.map(r => r.id)).size, points };
    }));
  });
}

/** @param {BenchmarkLine[]} lines @returns {import('./benchmark-types').BenchmarkRun[]} */
export function runAxis(lines) {
  const runs = new Map();
  for (const point of lines.flatMap(l => l.points)) {
    const previous = runs.get(point.run.id);
    if (previous && ['rust', 'go'].some(sdk => previous.sources[sdk].sha !== point.run.sources[sdk].sha)) throw new Error('Benchmark presentation: conflicting revisions for one run');
    runs.set(point.run.id, point.run);
  }
  return [...runs.values()].sort((a, b) => {
    const [ai, aa] = a.id.split('-').map(BigInt), [bi, ba] = b.id.split('-').map(BigInt);
    return ai < bi ? -1 : ai > bi ? 1 : aa < ba ? -1 : aa > ba ? 1 : 0;
  });
}
