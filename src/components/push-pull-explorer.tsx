'use client';

import { useState } from 'react';
import { baseline, finish, initialTrace, respond, send, target, type Peer, type Point, type Trace, type Write } from '../lib/push-pull-trace';
import { PushPullSequence } from './push-pull-sequence';
import './push-pull-explorer.css';

const peers: Peer[] = ['A', 'B'];
const id = (tx: Write) => tx.peer + tx.cseq;
const pair = (point: Point) => '(' + point.sseq + ', ' + point.cseq + ')';

export function PushPullExplorer() {
  const [timeline, setTimeline] = useState<Trace[]>(() => [initialTrace()]);
  const [selection, setSelection] = useState('');
  const state = timeline[timeline.length - 1];
  const { actor, clients, records, phase, push, pull, history } = state;
  const previous = timeline.at(-2);
  const head = history.at(-1)?.sseq ?? baseline;
  const continuation = phase === 'applied' && (push?.more || pull?.more);
  const ready = phase === 'ready' || (phase === 'applied' && !continuation) || phase === 'lost';
  const titles = { ready: 'Both clients have buffered writes', sent: 'Push in flight', reply: 'Server prepared the Pull',
    lost: 'Pull lost before delivery', applied: 'Client applied the Pull' };
  function advance(next: Trace) {
    setTimeline([...timeline, next]);
    setSelection('');
  }
  function select(key: string) { setSelection(selection === key ? '' : key); }
  function coordinates(label: string, point: Point, owner: Peer, old?: Point) {
    return <div className="pp-pair" aria-label={label}>{(['sseq', 'cseq'] as const).map(axis => {
      const key = axis === 'sseq' ? 's:' + point.sseq : owner + ':' + point.cseq;
      return <button key={axis} aria-label={label + ' ' + axis + ' ' + point[axis]}
        aria-pressed={selection === key} onClick={() => select(key)}>
        {axis} <b>{old && old[axis] !== point[axis] && <del>{old[axis]} </del>}{point[axis]}</b>
      </button>;
    })}</div>;
  }
  function writes(items: Write[], server = false) {
    if (!items.length) return <span className="pp-empty">Empty</span>;
    return <div className="pp-items">{items.map(tx => {
      const pos = server ? history.find(item => id(item) === id(tx))?.sseq : undefined;
      const [axis, value] = selection.split(':');
      const covered = (axis === 's' && pos !== undefined && pos <= Number(value))
        || (axis === tx.peer && tx.cseq <= Number(value));
      return <button key={id(tx)} data-covered={covered} aria-pressed={selection === id(tx)}
        onClick={() => select(id(tx))}>{id(tx)} <small>{pos !== undefined ? '#' + pos + ' · ' : ''}{tx.bytes} B</small></button>;
    })}</div>;
  }
  return <section className="pp-explorer not-prose" aria-label="Two-client PushPull explorer">
    <div className="pp-controls">
      <span>Step {timeline.length} · {phase === 'ready' ? 'Two subscriptions' : 'Client ' + actor}</span>
      <div><button disabled={!previous} onClick={() => { setTimeline(timeline.slice(0, -1)); setSelection(''); }}>← Back</button>
      <button disabled={!previous} onClick={() => { setTimeline([initialTrace()]); setSelection(''); }}>Restart</button></div>
    </div>
    <h3 aria-live="polite">{titles[phase]}</h3>
    <div className="pp-actions">
      {ready && peers.map(peer => <button key={peer} onClick={() => advance(send(state, peer))}>Send {peer} → Server</button>)}
      {continuation && <button onClick={() => advance(send(state, actor))}>Continue {actor} → Server</button>}
      {phase === 'sent' && <button onClick={() => advance(respond(state))}>Process Push and build Pull</button>}
      {phase === 'reply' && <><button onClick={() => advance(finish(state, false))}>Deliver to {actor}</button>
        <button onClick={() => advance(finish(state, true))}>Lose response</button></>}
    </div>
    <PushPullSequence timeline={timeline} />
    <div className="pp-network">
      {peers.map(peer => <div key={peer} className={'pp-node pp-client-' + peer} data-active={phase !== 'ready' && peer === actor}>
        <h4>Client {peer}</h4><p>Applied CheckPoint</p>
        {coordinates('Client ' + peer, clients[peer].applied, peer, previous?.clients[peer].applied)}
        <p>Push buffer</p>{writes(clients[peer].pending)}
      </div>)}
      <div className="pp-node pp-server"><h4>Server <small>head #{head}</small></h4>
        {peers.map(peer => <div key={peer}><p>Record for {peer}</p>
          {coordinates('Server record for ' + peer, records[peer], peer, previous?.records[peer])}</div>)}
      </div>
    </div>
    <div className="pp-history"><strong>Server history after #{baseline}</strong>{writes(history, true)}</div>
    <p className="pp-hint">Select sseq to highlight a history prefix. Select cseq to highlight that client’s writes, or a write to trace its copies.</p>
    <div className="pp-wire">
      <div><h4>{push ? actor + ' → Server' : 'Client → Server'} · Push</h4>
        {push ? <>{coordinates('Push request', push.point, actor)}
          {writes(push.writes)}<p>Applied sseq {push.point.sseq} and {push.writes.length ? 'last outgoing' : 'applied'} cseq {push.point.cseq}.</p>
          <small>has_more = {String(push.more)}</small></> : <p>Choose a client to form its request.</p>}
      </div>
      <div><h4>{pull ? 'Server → ' + actor : 'Server → Client'} · Pull</h4>
        {pull && push ? <>{coordinates('Pull response', pull.point, actor)}
          {writes(pull.writes)}<p>Scan after #{push.point.sseq} through #{pull.point.sseq}. Own writes covered through {actor}{pull.point.cseq}.</p>
          <small>{pull.writes.reduce((n, tx) => n + tx.bytes, 0)} / {target.toLocaleString('en-US')} B · has_more = {String(pull.more)}</small>
          <details><summary>How the server chose this pair</summary>
            <p>Start after request sseq {push.point.sseq} with prior cseq {push.writes.length ? push.writes[0].cseq - 1 : push.point.cseq}. Count only transactions included in the Pull body toward {target.toLocaleString('en-US')} bytes. Scan the requesting client’s writes in order, acknowledging at most the sent cseq {push.point.cseq}.</p>
            {pull.more && <p>The next remote write at #{pull.point.sseq + 1} exceeds the remaining space.</p>}
          </details></> : <p>Server processing determines the page boundary.</p>}
      </div>
    </div>
    <p className="pp-note" aria-live="polite">{phase === 'ready' ? 'Try B first. Its two writes exceed one Push batch. Then send A to see a Pull split across the same history.'
      : phase === 'sent' ? 'Only the request has been formed. Both client and server checkpoints retain their previous values.'
      : phase === 'reply' ? 'The server records the applied sseq reported by the request and the highest accepted cseq for this sender. The sender still holds its previous checkpoint.'
      : phase === 'lost' ? 'The server keeps accepted writes. Send from the same client to retry from its last applied checkpoint, or let the other client sync first.'
      : 'Only client ' + actor + ' adopts ' + pair(clients[actor].applied) + '. The server learns this applied sseq on a later request from ' + actor + '.'}</p>
  </section>;
}
