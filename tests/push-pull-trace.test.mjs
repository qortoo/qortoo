import test from 'node:test';
import assert from 'node:assert/strict';
import { initialTrace, send, respond, finish } from '../src/lib/push-pull-trace.ts';

test('two subscriptions track applied, accepted and page checkpoints independently across retries', () => {
  const exchange = (s, peer) => respond(send(s, peer));
  let s = exchange(initialTrace(), 'B');
  assert.equal(s.push.more, true);
  assert.deepEqual(s.records.B, { sseq: 10, cseq: 1 });
  assert.deepEqual(s.pull.point, { sseq: 11, cseq: 1 });
  s = finish(exchange(finish(s, false), 'B'), false);
  assert.deepEqual(s.clients.B.applied, { sseq: 12, cseq: 2 });
  s = exchange(s, 'A');
  assert.deepEqual(s.push.point, { sseq: 10, cseq: 5 });
  assert.deepEqual(s.records.A, { sseq: 10, cseq: 5 });
  assert.deepEqual(s.pull.point, { sseq: 11, cseq: 3 });
  assert.equal(s.pull.more, true);
  const lost = finish(s, true);
  const retry = exchange(lost, 'A');
  assert.deepEqual(retry.history, s.history);
  assert.deepEqual(retry.pull, s.pull);
  s = finish(exchange(finish(retry, false), 'A'), false);
  assert.deepEqual(s.clients.A.applied, { sseq: 14, cseq: 5 });
  assert.deepEqual(s.records.A, { sseq: 11, cseq: 5 });
  s = exchange(s, 'B');
  assert.deepEqual(s.push.writes, []);
  assert.deepEqual(s.pull.writes.map(tx => tx.peer + tx.cseq), ['A4', 'A5']);
  assert.deepEqual(finish(s, false).clients.B.applied, { sseq: 14, cseq: 2 });
});
