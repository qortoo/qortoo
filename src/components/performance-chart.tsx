'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { init, use, type EChartsType, type EChartsCoreOption } from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { AriaComponent, DataZoomComponent, GridComponent, LegendComponent, MarkPointComponent, TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { compactRate, escapeHtml as h, formatDate, formatRate, shortDate } from '@/lib/benchmark-view.mjs';
import type { BenchmarkLine, BenchmarkPoint, BenchmarkRun } from '@/lib/benchmark-types';

use([LineChart, AriaComponent, DataZoomComponent, GridComponent, LegendComponent, MarkPointComponent, TooltipComponent, SVGRenderer]);

export default function PerformanceChart({ lines, runs, selected, onPoint, onVisibility }: {
  lines: BenchmarkLine[]; runs: BenchmarkRun[]; selected: Record<string, boolean>;
  onPoint: (point: BenchmarkPoint) => void; onVisibility: (selected: Record<string, boolean>) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<EChartsType>(undefined);
  const { resolvedTheme } = useTheme();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!container.current) return;
    const instance = init(container.current, undefined, { renderer: 'svg' });
    chart.current = instance;
    instance.on('click', (event: unknown) => {
      const point = (event as { data?: { point?: BenchmarkPoint } }).data?.point;
      if (point) onPoint(point);
    });
    instance.on('legendselectchanged', (event: unknown) => onVisibility((event as { selected: Record<string, boolean> }).selected));
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(container.current);
    return () => { observer.disconnect(); instance.dispose(); chart.current = undefined; };
  }, [onPoint, onVisibility]);

  useEffect(() => {
    if (!chart.current) return;
    const style = getComputedStyle(document.documentElement);
    const color = (name: string) => style.getPropertyValue(`--color-fd-${name}`).trim();
    const dark = resolvedTheme === 'dark';
    const palette = dark ? ['#83b5d2', '#d7a16c', '#b5a3d2', '#82bca5', '#d79d9d', '#c9b27a', '#9caed2', '#d3a0b9', '#c3c18f']
      : ['#517c94', '#b57845', '#9383a6', '#669c89', '#b97575', '#a68b54', '#7e93b9', '#b97c97', '#92934d'];
    const byRun = new Map(runs.map(run => [run.id, run]));
    const hasPayload = lines.some(line => line.payload);
    const option: EChartsCoreOption = {
      animation: false, backgroundColor: 'transparent',
      aria: { enabled: true, description: 'Operations per second by run. Higher is better. Dates are UTC labels; spacing follows run order. Equivalent values and keyboard controls follow this chart.' },
      legend: { type: 'scroll', top: 5, left: 0, right: 0, itemWidth: 16, itemHeight: 8, itemGap: 15, selected,
        textStyle: { color: color('muted-foreground'), fontSize: 10 }, data: lines.map(line => line.name) },
      grid: { left: 58, right: 16, top: 70, bottom: 112 },
      dataZoom: [{ id: 'runs', type: 'slider', xAxisIndex: 0, bottom: 8, height: 20, showDataShadow: false,
        labelFormatter: (_value: number, runId: string) => byRun.has(runId) ? shortDate(byRun.get(runId)!.time) : '',
        textStyle: { color: color('muted-foreground'), fontSize: 9 } }],
      tooltip: { trigger: 'item', confine: true, backgroundColor: color('card'), borderColor: color('border'), padding: [12, 16],
        formatter: (params: unknown) => {
          const p = (params as { data?: { point?: BenchmarkPoint } }).data?.point;
          if (!p) return '';
          return `<div class="performance-tooltip"><b>${h(p.name)}</b><strong>${formatRate(p.rate)} <small>op/sec</small></strong><div>${h(p.scenario.id)} · ${formatDate(p.run.time)}</div><div>Rust ${p.run.sources.rust.sha.slice(0, 7)} · Go ${p.run.sources.go.sha.slice(0, 7)}</div><div>Run ${h(p.run.id)} · ${p.latest ? 'Current eligible result' : 'Historical measurement'}</div><small>Click for full details and workload code.</small></div>`;
        } },
      xAxis: { type: 'category', data: runs.map(run => run.id), boundaryGap: true,
        axisLabel: { color: color('muted-foreground'), fontSize: 9, lineHeight: 14, hideOverlap: true,
          formatter: (value: string) => { const run = byRun.get(value)!; return `${shortDate(run.time)}\nR ${run.sources.rust.sha.slice(0, 7)}\nG ${run.sources.go.sha.slice(0, 7)}`; } },
        axisLine: { lineStyle: { color: color('border') } }, axisTick: { show: true }, splitLine: { show: false } },
      yAxis: { type: 'value', min: 0, name: 'op/sec ↑', nameTextStyle: { color: color('muted-foreground'), fontSize: 10, align: 'left' },
        axisLabel: { color: color('muted-foreground'), fontSize: 10, formatter: compactRate }, splitLine: { lineStyle: { color: color('border'), type: 'dashed' } } },
      series: lines.map(line => {
        const points = new Map(line.points.map(point => [point.run.id, point]));
        return { id: line.id, name: line.name, type: 'line',
          data: runs.map(run => { const point = points.get(run.id); return { value: [run.id, point?.rate ?? null], point }; }),
          connectNulls: true, showSymbol: true, showAllSymbol: true, symbol: line.sdk === 'rust' ? 'circle' : 'triangle', symbolSize: 7,
          lineStyle: { width: 2, type: line.sdk === 'rust' ? 'solid' : 'dashed' },
          itemStyle: { color: palette[(line.environmentIndex * (hasPayload ? 3 : 1) + line.payloadIndex) % palette.length] },
          emphasis: { focus: 'series', scale: 1.5 },
          markPoint: { symbol: 'diamond', symbolSize: 13, label: { show: false },
            data: line.points.filter(point => point.latest).map(point => ({ coord: [point.run.id, point.rate], point })) } };
      }),
    };
    try {
      chart.current.dispatchAction({ type: 'hideTip' });
      chart.current.setOption(option, { replaceMerge: ['series'] });
      setError(undefined);
    } catch (cause) { setError(String(cause)); }
  }, [lines, runs, selected, resolvedTheme]);

  return <>{error && <p role="alert">Chart unavailable: {error}. The result table and measurement controls remain available.</p>}
    <div className="performance-chart" ref={container} role="img" aria-label="Interactive benchmark chart. Use the following table and keyboard controls for equivalent information." /></>;
}
