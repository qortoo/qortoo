'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';

let renderQueue: Promise<unknown> = Promise.resolve();
let diagramId = 0;
function draw(chart: string, dark: boolean) {
  // Mermaid has global configuration; serialize configuration and rendering together.
  const task = renderQueue.then(async () => {
    const { default: mermaid } = await import('mermaid');
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: dark ? 'dark' : 'default',
      // SVG labels avoid HTML reflow after Mermaid measures its temporary diagram.
      htmlLabels: false,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      flowchart: { wrappingWidth: 480 },
    });
    return mermaid.render(`qortoo-diagram-${diagramId++}`, chart);
  });
  renderQueue = task.catch(() => undefined);
  return task;
}

export function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [error, setError] = useState<string>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    setError(undefined);
    setReady(false);
    void draw(chart, resolvedTheme === 'dark').then(({ svg }) => {
      if (cancelled || !ref.current) return;
      ref.current.innerHTML = svg;
      const element = ref.current.querySelector('svg');
      const intrinsicWidth = element?.viewBox.baseVal.width;
      if (element && intrinsicWidth) {
        const fit = (availableWidth: number) => {
          const scale = availableWidth / intrinsicWidth;
          // Shrink only when this removes scrolling without reducing text by over 15%.
          const width = scale >= 0.85 && scale < 1 ? Math.floor(availableWidth) : intrinsicWidth;
          element.style.width = `${width}px`;
        };
        fit(ref.current.clientWidth);
        observer = new ResizeObserver(([entry]) => fit(entry.contentRect.width));
        observer.observe(ref.current);
      }
      setReady(true);
    }).catch((cause) => { if (!cancelled) setError(String(cause)); });
    return () => { cancelled = true; observer?.disconnect(); };
  }, [chart, resolvedTheme]);

  return <figure className="diagram-frame" aria-label="Diagram" aria-busy={!ready && !error}>
    {!ready && !error && <p className="px-5 pt-4 text-xs text-fd-muted-foreground" role="status">Rendering diagram…</p>}
    <div className="diagram-scroll" tabIndex={0} role="region" aria-label="Scrollable diagram"><div ref={ref} data-mermaid="true" /></div>
    {error && <p className="diagram-error" role="alert">Diagram rendering failed: {error}</p>}
    <details><summary>Diagram source</summary><pre>{chart}</pre></details>
  </figure>;
}
