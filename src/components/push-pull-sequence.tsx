import { useEffect, useRef } from 'react';
import type { Trace } from '../lib/push-pull-trace';

export function PushPullSequence({ timeline }: { timeline: Trace[] }) {
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [timeline]);

  return <figure className="pp-sequence">
    <figcaption><strong>Exchange sequence</strong><small>CheckPoint (sseq, cseq)</small></figcaption>
    <div className="pp-participants" aria-hidden="true"><b>Client A</b><b>Server</b><b>Client B</b></div>
    <div className="pp-sequence-scroll" ref={viewport} role="region" aria-label="Packet history, oldest first" tabIndex={0}>
      {timeline.length === 1 && <p className="pp-sequence-empty">Waiting for the first Push</p>}
      {timeline.map((step, i) => {
        const isPush = step.phase === 'sent';
        if (!isPush && step.phase !== 'reply') return null;
        const packet = isPush ? step.push : step.pull;
        if (!packet) return null;
        const next = timeline[i + 1]?.phase;
        const status = isPush ? (next === 'reply' ? 'Received' : 'In flight')
          : next === 'applied' ? 'Applied' : next === 'lost' ? 'Lost' : 'Prepared';
        const right = (step.actor === 'A') === isPush;
        const current = i === timeline.length - 1 || (!isPush && i === timeline.length - 2);
        const kind = isPush ? 'Push' : 'Pull';
        const client = 'Client ' + step.actor;
        const route = isPush ? client + ' to server' : 'Server to ' + client;
        return <div key={i} className="pp-message" data-peer={step.actor} data-status={status}
          data-right={right} aria-current={current ? 'step' : undefined}>
          <div className="pp-message-leg">
            <span className="sr-only">{route}. </span>
            <strong>{kind} ({packet.point.sseq}, {packet.point.cseq})</strong>
            <span className="pp-arrow" aria-hidden="true"><i /></span>
            <small>{status}</small>
          </div>
        </div>;
      })}
    </div>
  </figure>;
}
