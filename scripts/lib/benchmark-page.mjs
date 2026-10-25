import { buildBenchmarkView, codeLinks } from '../../src/lib/benchmark-view.mjs';

const text = value => String(value).replace(/[&<>"'{}|`\[\]\\*_]/g, c => `&#${c.charCodeAt(0)};`).replace(/[\r\n]/g, ' ');

export function renderBenchmarkPage(data, docSources) {
  const view = buildBenchmarkView(data, docSources);
  const lines = ['---', 'title: Performance', 'description: Explore Rust and Go SDK performance across operations, revisions, and environments.', '---',
    'These benchmarks measure public SDK calls, including serialization, FFI, and runtime work. Server and network performance are excluded.', '',
    '**Higher op/sec is better.** Rates are converted from measured latency medians. The most measured environment is enabled by default; use the legend to compare reference environments.', '',
    `Data snapshot: [${data.revision.slice(0, 7)}](https://github.com/${data.repository}/tree/${data.revision}).`, '', '<PerformanceOverview />', '', '## SDK main request status', '',
    'Latest registered main requests are separate from measured results. Failed, incompatible, or cancelled requests retain previous successful results and their measurement dates.', '',
    '| SDK | Requested revision | Status | Execution |', '| --- | --- | --- | --- |'];
  for (const id of ['rust', 'go']) {
    const request = data.requests.filter(r => r.component === id).sort((a, b) => Number(b.attempt.split('-')[0]) - Number(a.attempt.split('-')[0]) || Number(b.attempt.split('-')[1]) - Number(a.attempt.split('-')[1]))[0];
    lines.push(request ? `| ${id} | ${text(request.sha.slice(0, 7))} | ${text(request.status)} | [Run](${request.runUrl}) |` : `| ${id} | — | No registered measurement | — |`);
  }
  if (!view.topics.length) lines.push('', '## Results', '', 'No official measurements are available. PR candidates, smoke runs, and dirty local runs are excluded.');
  for (const suiteId of [...new Set(view.topics.map(t => t.suiteId))]) {
    const topics = view.topics.filter(t => t.suiteId === suiteId);
    const title = suiteId.charAt(0).toUpperCase() + suiteId.slice(1);
    lines.push('', `## ${text(title)}`, '', suiteId === 'counter' ? 'Core counter operations, from reads to local synchronization.' : 'Typed JSON operations. Compare all payload sizes in the same graph.', '');
    for (const topic of topics) {
      const group = topic.groups[0];
      const current = group.runs.find(r => r.id === group.currentRunId);
      if (topics.length > 1) lines.push(`### Contract ${text(group.conditions.contractId)} · ${group.conditions.contractSha.slice(0, 8)}`, '');
      const links = Object.entries(codeLinks(data.repository, suiteId, current.harnessSha)).map(([label, url]) => `[${label === 'Contract' ? 'Measurement contract' : label + ' workload'}](${url})`).join(' · ');
      lines.push(`Benchmark code for the default environment's current result (harness [${current.harnessSha.slice(0, 7)}](https://github.com/${data.repository}/commit/${current.harnessSha})): ${links}. Each measurement's details link to its own measured code.`, '');
      const differences = topic.groups.filter(g => g.revisionDifferences.length);
      if (differences.length) lines.push(`**Revision difference:** Some measured SDK revisions differ from the documentation in this build. Each result identifies its measured Rust and Go commits.`, '');
      lines.push(`<PerformanceTopic topicId="${topic.id}" />`, '');
    }
  }
  lines.push('## How to read these results', '',
    '- **Rates:** op/sec = 1,000,000,000 / latency median in ns/op, computed before rounding. This is not a concurrent-load capacity test or a median of per-round throughput values.',
    '- **One operation:** Transaction includes ten writes and a commit. SyncLocal includes one write and one synchronous local sync. BuildCounter includes construction and release. Variable payload sizes are serialized JSON bytes.',
    '- **Variation:** Original statistics describe ten measured round means; warmup is excluded. Standard deviation stays in ns/op in the details. It is not a confidence interval or per-request tail latency.',
    '- **History:** Labels show short UTC measurement dates and measured Rust/Go revisions. Equal spacing follows run identity, not elapsed time. Expand the range slider to inspect dense labels. Exact run IDs remain in hover and details.',
    '- **Comparison:** Every environment, compiler, build, and SDK path retains a separate line. Only matching workload contracts share a chart. Small changes or differences between environments alone do not establish a regression.',
    '- **Current values:** Diamonds mark publisher-selected eligible results. SDK ancestry determines current values; the last completed run does not necessarily replace them.', '',
    '## Provenance', '', `[Snapshot and immutable bundles](https://github.com/${data.repository}/tree/${data.revision}) · [Published data manifest](/generated/benchmarks.json). Raw samples, execution logs, measurement conditions, and pinned workload sources remain available in measurement details.`, '');
  return { markdown: lines.join('\n') + '\n', assets: [{ file: 'benchmarks/view.json', content: JSON.stringify(view).replaceAll('<', '\\u003c') + '\n' }] };
}
