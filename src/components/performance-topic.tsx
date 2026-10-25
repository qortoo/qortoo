'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { codeLinks, formatDate, formatRate, makeLines, operationDescriptions, payloadLabel, runAxis } from '@/lib/benchmark-view.mjs';
import type { BenchmarkPoint, BenchmarkTopic } from '@/lib/benchmark-types';

const PerformanceChart = dynamic(() => import('./performance-chart'), { ssr: false, loading: () => <p role="status">Loading interactive chart…</p> });
const number = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });

export function PerformanceTopicClient({ topic, repository, revision }: { topic: BenchmarkTopic; repository: string; revision: string }) {
  const [operation, setOperation] = useState(topic.operations[0]);
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [point, setPoint] = useState<BenchmarkPoint>();
  const [inspectLineId, setInspectLineId] = useState('');
  const [inspectRunId, setInspectRunId] = useState('');
  const lines = useMemo(() => makeLines(topic, operation), [topic, operation]);
  const runs = useMemo(() => runAxis(lines), [lines]);
  const selected = useMemo(() => Object.fromEntries(lines.map(line => [line.name, visibility[line.name] ?? line.environmentIndex === 0])), [lines, visibility]);
  const inspectLine = lines.find(line => line.id === inspectLineId) ?? lines[0];
  const inspection = inspectLine.points.find(p => p.run.id === inspectRunId) ?? inspectLine.points.find(p => p.latest)!;
  const primary = topic.groups[0];
  const panelId = `${topic.id}-panel`;

  function activate(value: string) {
    setOperation(value);
    setPoint(undefined);
    setInspectLineId('');
    setInspectRunId('');
  }
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % topic.operations.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + topic.operations.length) % topic.operations.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = topic.operations.length - 1;
    else return;
    event.preventDefault();
    event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role=tab]')[next].focus();
    activate(topic.operations[next]);
  }

  return <div className="performance">
    <div className="performance-tabs" role="tablist" aria-label={`${topic.suiteId} operations`}>
      {topic.operations.map((value, index) => <button key={value} type="button" role="tab" id={`${topic.id}-tab-${index}`}
        aria-controls={panelId} aria-selected={value === operation} tabIndex={value === operation ? 0 : -1}
        onClick={() => activate(value)} onKeyDown={event => tabKey(event, index)}>{value}</button>)}
    </div>
    <div id={panelId} role="tabpanel" aria-labelledby={`${topic.id}-tab-${topic.operations.indexOf(operation)}`} tabIndex={0}>
      <div className="performance-chart-card">
        <div className="performance-chart-top"><strong>{operationDescriptions[operation] ?? operation}{lines.some(line => line.payload) && ' Compare all JSON payload sizes.'}</strong><span>op/sec · higher is better<br />Run order · UTC labels</span></div>
        <p className="performance-note">Default: {primary.label} ({lines[0].runCount} retained runs, the most measured environment). Enable reference lines in the legend. Use the range slider to read dense date and revision labels.</p>
        <PerformanceChart lines={lines} runs={runs} selected={selected} onPoint={setPoint} onVisibility={setVisibility} />
        <div className="performance-chart-hint"><span>Hover for a preview; click for details. R = Rust SHA · G = Go SHA.</span><span>◆ Current eligible result · solid Rust / dashed Go</span></div>
      </div>
      <div className="performance-results-title"><strong>Current eligible results</strong><span>Per environment · measured revisions may differ</span></div>
      <div className="performance-table-scroll" role="region" aria-label={`${topic.suiteId} current results`} tabIndex={0}>
        <table><caption>{operation}{lines.some(line => line.payload) ? ' · All JSON payloads' : ''} · Converted from latency median</caption>
          <thead><tr><th>Environment / CPU</th>{lines.some(line => line.payload) && <th>Payload</th>}<th className="number">Rust · op/sec ↑</th><th className="number">Go · op/sec ↑</th><th>Measured at · UTC</th><th>Inspect</th></tr></thead>
          <tbody>{lines.filter(line => line.sdk === 'rust').map(rust => {
            const r = rust.points.find(p => p.latest)!;
            const go = lines.find(line => line.sdk === 'go' && line.points[0].group.id === r.group.id && line.payload === rust.payload)!;
            const g = go.points.find(p => p.latest)!;
            return <tr key={rust.id} data-series-id={r.group.id} data-run-id={r.run.id}>
              <td>{r.group.label}<span className="performance-tag">{rust.environmentIndex === 0 ? 'Most runs' : 'Reference'}</span><small>{r.group.environment.id} · {rust.runCount} retained {rust.runCount === 1 ? 'run' : 'runs'}</small></td>
              {lines.some(line => line.payload) && <td>{payloadLabel(rust.payload)}</td>}
              <td className="number">{formatRate(r.rate)}<small>{r.run.sources.rust.sha.slice(0, 7)}</small></td>
              <td className="number">{formatRate(g.rate)}<small>{g.run.sources.go.sha.slice(0, 7)}</small></td>
              <td>{formatDate(r.run.time).replace(' UTC', '')}</td>
              <td><button type="button" onClick={() => setPoint(r)} aria-label={`Inspect ${rust.name}`}>Rust</button> <button type="button" onClick={() => setPoint(g)} aria-label={`Inspect ${go.name}`}>Go</button></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <details className="performance-history"><summary>Keyboard controls & measurement history</summary>
        <p>Toggle individual lines, or select any retained measurement to inspect its statistics and sources.</p>
        <div className="performance-visibility">{lines.map(line => <label key={line.id}><input type="checkbox" checked={selected[line.name]} onChange={event => setVisibility(previous => ({ ...previous, [line.name]: event.target.checked }))} />{line.name}</label>)}</div>
        <div className="performance-inspection">
          <label>Environment / SDK / payload<select aria-label={`${topic.id} measurement line`} value={inspectLine.id} onChange={event => {
            const line = lines.find(line => line.id === event.target.value)!;
            setInspectLineId(line.id); setInspectRunId(''); setPoint(line.points.find(p => p.latest));
          }}>{lines.map(line => <option key={line.id} value={line.id}>{line.name}</option>)}</select></label>
          <label>Measurement<select aria-label={`${topic.id} measurement run`} value={inspection.run.id} onChange={event => {
            setInspectRunId(event.target.value); setPoint(inspectLine.points.find(p => p.run.id === event.target.value));
          }}>{inspectLine.points.map(p => <option key={p.run.id} value={p.run.id}>{formatDate(p.run.time)} · {p.run.id}{p.latest ? ' · current' : ''}</option>)}</select></label>
        </div>
        <p>Spacing follows run identity, not elapsed time. Current values follow SDK ancestry and can differ from the last completed run.</p>
      </details>
      {point && <section className="performance-detail" aria-label="Selected measurement" aria-live="polite">
        <div className="performance-detail-title"><strong>{point.name} · {formatRate(point.rate)} op/sec</strong><button type="button" onClick={() => setPoint(undefined)}>Close details</button></div>
        <p>{point.scenario.id} · {formatDate(point.run.time)} · {point.latest ? 'Current eligible result' : 'Historical measurement'}</p>
        <dl>
          <dt>Original latency</dt><dd>{number(point.stats.median)} ns/op median · {number(point.stats.stddev)} ns/op stddev</dd>
          <dt>Sampling</dt><dd>{point.stats.count} measured round means; warmup excluded · {number(point.scenario.budget)} operations per round</dd>
          {Object.entries(point.group.environment).map(([key, value]) => <div className="performance-condition" key={key}><dt>{key}</dt><dd>{value}</dd></div>)}
          <dt>Toolchain</dt><dd>{point.group.conditions.rustc} · {point.group.conditions.go}</dd>
          <dt>Build</dt><dd>{point.group.conditions.profile} · features: {point.group.conditions.features.join(', ') || 'none'}</dd>
          <dt>Contract</dt><dd>{point.group.conditions.contractId} · <code>{point.group.conditions.contractSha}</code></dd>
          <dt>Protocol</dt><dd>{point.group.conditions.protocol}</dd>
          <dt>Series</dt><dd><code>{point.group.id}</code></dd>
          <dt>Run</dt><dd><a href={point.run.url}>{point.run.id}</a></dd>
          <dt>Harness</dt><dd><a href={`https://github.com/${repository}/commit/${point.run.harnessSha}`}>{point.run.harnessSha}</a></dd>
        </dl>
        <div className="performance-links">{(['rust', 'go'] as const).map(sdk => <a key={sdk} href={`${point.run.sources[sdk].repository.replace(/\.git$/, '')}/commit/${point.run.sources[sdk].sha}`}>{sdk === 'rust' ? 'Rust' : 'Go'} {point.run.sources[sdk].sha.slice(0, 7)}</a>)}
          <a href={point.run.url}>Execution</a><a href={`https://github.com/${repository}/raw/${revision}/${point.run.summaryPath}`}>Summary</a><a href={`https://github.com/${repository}/raw/${revision}/runs/${point.run.id}/raw.tar.gz`}>Raw samples</a>
        </div>
        <p className="performance-code-links">Measured benchmark code: {Object.entries(codeLinks(repository, topic.suiteId, point.run.harnessSha)).map(([label, url]) => <a key={label} href={url}>{label === 'Contract' ? 'Measurement contract' : `${label} workload`}</a>)}</p>
      </section>}
    </div>
  </div>;
}
