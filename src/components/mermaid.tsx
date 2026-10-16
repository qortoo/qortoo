'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from 'next-themes';

export function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId().replaceAll(':', '');
  const { resolvedTheme } = useTheme();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setError(undefined);
    async function render() {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: resolvedTheme === 'dark' ? 'dark' : 'default' });
        const { svg } = await mermaid.render(`diagram-${id}`, chart);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (cause) {
        if (!cancelled) setError(String(cause));
      }
    }
    void render();
    return () => { cancelled = true; };
  }, [chart, id, resolvedTheme]);

  return <figure className="my-6 overflow-x-auto rounded-lg border p-4" aria-label="Diagram">
    <div ref={ref} data-mermaid="true" />
    {error && <p role="alert">Diagram rendering failed: {error}</p>}
    <details><summary>Diagram source</summary><pre>{chart}</pre></details>
  </figure>;
}
