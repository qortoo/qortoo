// A bounded teaching example for two established subscriptions on one datatype.
export type Peer = 'A' | 'B';
export type Point = { sseq: number; cseq: number };
export type Write = { peer: Peer; cseq: number; bytes: number };
type Packet = { point: Point; writes: Write[]; more: boolean };
type Client = { applied: Point; pending: Write[] };
export type Trace = {
  clients: Record<Peer, Client>;
  records: Record<Peer, Point>;
  history: (Write & { sseq: number })[];
  phase: 'ready' | 'sent' | 'reply' | 'lost' | 'applied';
  actor: Peer;
  push?: Packet;
  pull?: Packet;
};

export const target = 1000;
export const baseline = 10;

export function initialTrace(): Trace {
  const a = { sseq: baseline, cseq: 3 };
  const b = { sseq: baseline, cseq: 0 };
  return {
    phase: 'ready', actor: 'B', history: [], records: { A: a, B: b },
    clients: {
      A: { applied: a, pending: [{ peer: 'A', cseq: 4, bytes: 200 }, { peer: 'A', cseq: 5, bytes: 200 }] },
      B: { applied: b, pending: [{ peer: 'B', cseq: 1, bytes: 700 }, { peer: 'B', cseq: 2, bytes: 600 }] },
    },
  };
}

export function send(state: Trace, actor: Peer): Trace {
  const { applied, pending } = state.clients[actor];
  const writes: Write[] = [];
  let bytes = 0;
  for (const tx of pending) {
    if (writes.length && bytes + tx.bytes > target) break;
    writes.push(tx);
    bytes += tx.bytes;
  }
  const point = { sseq: applied.sseq, cseq: writes.at(-1)?.cseq ?? applied.cseq };
  return { ...state, actor, phase: 'sent', push: { point, writes, more: writes.length < pending.length }, pull: undefined };
}

export function respond(state: Trace): Trace {
  const { push, actor } = state;
  if (!push || state.phase !== 'sent') throw Error('Expected a pending Push');
  const previous = state.records[actor];
  const history = [...state.history];
  let accepted = previous.cseq;
  for (const tx of push.writes) {
    if (tx.cseq <= accepted) continue;
    history.push({ ...tx, sseq: baseline + history.length + 1 });
    accepted = tx.cseq;
  }
  const record = { sseq: Math.max(previous.sseq, push.point.sseq), cseq: accepted };
  const prior = push.writes.length ? push.writes[0].cseq - 1 : push.point.cseq;
  const point = { sseq: push.point.sseq, cseq: Math.min(prior, accepted) };
  const writes: Write[] = [];
  let bytes = 0;
  let more = false;
  for (const tx of history) {
    if (tx.sseq <= push.point.sseq) continue;
    if (tx.peer === actor) {
      point.cseq = Math.min(tx.cseq, push.point.cseq);
    } else {
      if (writes.length && bytes + tx.bytes > target) {
        more = true;
        break;
      }
      bytes += tx.bytes;
      writes.push(tx);
    }
    point.sseq = tx.sseq;
  }
  return { ...state, phase: 'reply', history, records: { ...state.records, [actor]: record }, pull: { point, writes, more } };
}

export function finish(state: Trace, lost: boolean): Trace {
  const { actor, pull } = state;
  if (!pull || state.phase !== 'reply') throw Error('Expected a Pull response');
  if (lost) return { ...state, phase: 'lost' };
  const pending = state.clients[actor].pending.filter(tx => tx.cseq > pull.point.cseq);
  return { ...state, phase: 'applied', clients: { ...state.clients, [actor]: { applied: pull.point, pending } } };
}
