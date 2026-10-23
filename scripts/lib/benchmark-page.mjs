// Escape data before embedding it in Markdown/MDX or SVG.
const text = value => String(value).replace(/[&<>"'{}|`\[\]\\*_]/g, c => `&#${c.charCodeAt(0)};`).replace(/[\r\n]/g, ' ');
const number = value => value.toLocaleString('en-US', { maximumFractionDigits: 2 });
const sourceLink = (id, source) => `[${id} ${source.sha.slice(0, 7)}](${source.repository.replace(/\.git$/, '')}/commit/${source.sha})`;
const rawUrl = (data, file) => `https://github.com/${data.repository}/raw/${data.revision}/${file}`;

export function trendSvg(points, seriesId, scenarioId) {
  const rows = points.map(point => ({ point, scenario: point.summary.suites.find(s => s.series_id === seriesId)?.scenarios.find(s => s.scenario_id === scenarioId) })).filter(r => r.scenario);
  const ceiling = Math.max(1, ...rows.flatMap(r => [r.scenario.rust.median, r.scenario.go.median]));
  const x = i => 60 + i * 640 / Math.max(1, rows.length - 1);
  const y = v => 160 - v * 120 / ceiling;
  const lines = ['rust', 'go'].map((id, j) => {
    const color = j ? '#c2410c' : '#2563eb';
    return `<polyline fill="none" stroke="${color}" stroke-width="2" points="${rows.map((r, i) => `${x(i)},${y(r.scenario[id].median)}`).join(' ')}"/>` + rows.map((r, i) => `<circle cx="${x(i)}" cy="${y(r.scenario[id].median)}" r="4" fill="${color}"><title>${id}: ${number(r.scenario[id].median)}; run ${r.point.entry.run_id}; Rust ${r.point.summary.sources.rust.sha}; Go ${r.point.summary.sources.go.sha}</title></circle>`).join('');
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 220" role="img" aria-label="${text(scenarioId)}: round mean medians by run"><rect width="760" height="220" fill="white"/><g font-family="sans-serif" font-size="12" fill="#334155"><text x="60" y="20">${text(scenarioId)} · Rust (blue) / Go (orange)</text><text x="4" y="44">${number(ceiling)}</text><text x="34" y="164">0</text><path d="M60 35V160H710" fill="none" stroke="#94a3b8"/>${lines}<text x="60" y="190">${text(rows[0]?.point.entry.run_id ?? '')}</text><text x="710" y="190" text-anchor="end">${text(rows.at(-1)?.point.entry.run_id ?? '')}</text><text x="60" y="210">Run order; each point retains its SDK revisions in the history table.</text></g></svg>`;
}

export function renderBenchmarkPage(data, docSources) {
  const assets = [];
  const lines = ['---', 'title: Performance', 'description: Official SDK benchmark results, measurement conditions, and revision history.', '---',
    'These development benchmarks measure the public Rust and Go SDK paths, including serialization, FFI, and runtime work where applicable. They do not isolate binding overhead or measure server/network performance.', '',
    'Values are medians of ten round means. Standard deviation describes variation between those round means; it is not per-request latency. Warmup is excluded. Lower latency is better. GitHub hosted runners can vary between runs; small changes alone do not establish a regression.', '',
    `Data snapshot: [${data.revision.slice(0, 7)}](https://github.com/${data.repository}/tree/${data.revision}). Each environment, toolchain, and measurement contract has its own series.`, '', '## SDK main request status', '',
    'These are the latest registered main requests by attempt order, not a claim that every newer SDK commit has already been measured. Failed, incompatible, or cancelled requests retain previous successful results below.', '', '| SDK | Requested revision | Status | Execution |', '| --- | --- | --- | --- |'];
  for (const id of ['rust', 'go']) {
    const request = data.requests.filter(r => r.component === id).sort((a, b) => Number(b.attempt.split('-')[0]) - Number(a.attempt.split('-')[0]) || Number(b.attempt.split('-')[1]) - Number(a.attempt.split('-')[1]))[0];
    lines.push(request ? `| ${id} | ${text(request.sha.slice(0, 7))} | ${text(request.status)} | [Run](${request.runUrl}) |` : `| ${id} | — | No registered measurement | — |`);
  }
  if (!data.latest.length) lines.push('', '## Results', '', 'No official measurements are available. PR candidates, smoke runs, and dirty local runs are excluded.');
  for (const [position, series] of [...data.latest].sort((a, b) => a.suite.suite_id.localeCompare(b.suite.suite_id) || Number(b.entry.run_id.split('-')[0]) - Number(a.entry.run_id.split('-')[0]) || a.seriesId.localeCompare(b.seriesId)).entries()) {
    const { suite, summary, entry, points } = series;
    const definition = suite.series_definition;
    lines.push('', `## ${text(suite.suite_id)} · series ${series.seriesId.split('/')[2].slice(0, 8)}`, '',
      `Latest eligible result: **${text(summary.completed_at_utc)}** · [Execution](${summary.run_url}) · [Raw samples and logs](${rawUrl(data, `runs/${entry.run_id}/raw.tar.gz`)}) · [Summary](${rawUrl(data, entry.summary.path)})`, '',
      Object.entries(summary.sources).map(([id, source]) => sourceLink(id, source)).join(' · '), '');
    const differences = Object.entries(summary.sources).filter(([id, s]) => docSources.find(d => d.id === id)?.sha !== s.sha);
    if (differences.length) lines.push(`**Revision difference:** ${differences.map(([id]) => text(id)).join(', ')} benchmark revisions differ from the SDK documentation in this build. These values describe the linked measured commits.`, '');
    lines.push('<details>', `<summary>Measurement conditions · ${text(summary.environment.cpu)}</summary>`, '', '| Condition | Value |', '| --- | --- |', ...Object.entries(summary.environment).map(([key, value]) => `| ${text(key)} | ${text(value)} |`),
      `| Rust compiler | ${text(definition.rustc)} |`, `| Go compiler | ${text(definition.go)} |`, `| Build | ${text(definition.build_profile)}; features: ${text(definition.rust_features.join(', '))} |`,
      `| Contract | ${text(suite.contract_id)}; ${text(definition.contract_sha256)} |`, `| Protocol | ${text(definition.protocol)} |`,
      `| Harness | [${summary.harness_sha.slice(0, 7)}](https://github.com/${data.repository}/commit/${summary.harness_sha}) |`,
      `| Series | ${text(series.seriesId)} |`, '', '</details>', '', `### Latest ${text(suite.metric.unit)} · ${text(suite.metric.direction)} is better`, '',
      '| Scenario | Operations per round | Rust median ± stddev | Go median ± stddev |', '| --- | ---: | ---: | ---: |',
      ...suite.scenarios.map(s => `| ${text(s.scenario_id)} | ${number(s.budget)} | ${number(s.rust.median)} ± ${number(s.rust.stddev)} | ${number(s.go.median)} ± ${number(s.go.stddev)} |`), '', '<details>', '<summary>History and trend charts</summary>', '',
      'Points are ordered by request/run identity. The latest eligible result above follows SDK ancestry and can differ from the last point. All rows and charts in this section belong to this single series.', '',
      '| Run | Measured at | Rust | Go |', '| --- | --- | --- | --- |',
      ...points.map(p => `| [${p.entry.run_id}](${p.summary.run_url}) | ${text(p.summary.completed_at_utc)} | ${sourceLink('rust', p.summary.sources.rust)} | ${sourceLink('go', p.summary.sources.go)} |`), '');
    for (const [index, scenario] of suite.scenarios.entries()) {
      const file = `benchmarks/trend-${position}-${index}.svg`;
      assets.push({ file, content: trendSvg(points, series.seriesId, scenario.scenario_id) });
      lines.push(`![${text(scenario.scenario_id)} trend in ${text(suite.metric.unit)}](/generated/${file})`, '');
    }
    lines.push('</details>', '');
  }
  return { markdown: lines.join('\n') + '\n', assets };
}
