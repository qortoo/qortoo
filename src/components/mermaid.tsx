'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';

let renderQueue: Promise<unknown> = Promise.resolve();
let diagramId = 0;
function draw(chart: string, dark: boolean) {
  // Mermaid has global configuration; serialize configuration and rendering together.
  const task = renderQueue.then(async () => {
    const { default: mermaid } = await import('mermaid');
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default', fontFamily: 'inherit' });
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
    setError(undefined);
    setReady(false);
    void draw(chart, resolvedTheme === 'dark').then(({ svg }) => {
      if (cancelled || !ref.current) return;
      ref.current.innerHTML = svg;
      const element = ref.current.querySelector('svg');
      if (element?.viewBox.baseVal.width) element.style.width = `${element.viewBox.baseVal.width}px`;
      setReady(true);
    }).catch((cause) => { if (!cancelled) setError(String(cause)); });
    return () => { cancelled = true; };
  }, [chart, resolvedTheme]);

  return <figure className="diagram-frame" aria-label="Diagram" aria-busy={!ready && !error}>
    {!ready && !error && <p className="px-5 pt-4 text-xs text-fd-muted-foreground" role="status">Rendering diagram…</p>}
    <div className="diagram-scroll" tabIndex={0} role="region" aria-label="Scrollable diagram"><div ref={ref} data-mermaid="true" /></div>
    {error && <p className="diagram-error" role="alert">Diagram rendering failed: {error}</p>}
    <details><summary>Diagram source</summary><pre>{chart}</pre></details>
  </figure>;
}
