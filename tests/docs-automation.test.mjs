import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveInputs, validateCandidate, verifyBuild } from '../scripts/lib/docs-automation.mjs';

const a = 'a'.repeat(40), b = 'b'.repeat(40), c = 'c'.repeat(40), d = 'd'.repeat(40);
const definitions = [
  { id: 'rust', repository: 'qortoo/qortoo-rs', ref: 'main' },
  { id: 'go', repository: 'qortoo/qortoo-go', ref: 'main' },
];
const candidate = { sdk: 'rust', repository: 'contributor/qortoo-rs', sha: c };
const context = { repository: 'qortoo/qortoo-rs', eventName: 'pull_request', headRepository: candidate.repository, headSha: c };

test('fork PR input is accepted only for the calling SDK and exact event head', () => {
  assert.deepEqual(validateCandidate(candidate, definitions, context), candidate);
  for (const input of [{ ...candidate, sha: 'main' }, { ...candidate, repository: 'bad/repo/extra' }, { sdk: 'rust' }, { ...candidate, sdk: 'unknown' }]) {
    assert.throws(() => validateCandidate(input, definitions, context), /candidate requires/);
  }
  for (const changed of [{ repository: 'qortoo/qortoo-go' }, { eventName: 'pull_request_target' }, { headSha: d }, { headRepository: 'someone/else' }]) {
    assert.throws(() => validateCandidate(candidate, definitions, { ...context, ...changed }), /own pull request head/);
  }
  assert.equal(validateCandidate({}, definitions), null);
});

test('one candidate replaces its SDK; both default refs resolve once to immutable commits', async () => {
  const calls = [];
  const inputs = await resolveInputs(definitions, candidate, a, async (repository, ref) => {
    calls.push([repository, ref]);
    return repository === candidate.repository ? c : b;
  });
  assert.deepEqual(calls, [[candidate.repository, c], ['qortoo/qortoo-go', 'main']]);
  assert.equal(inputs.sources.rust.sha, c);
  assert.equal(inputs.sources.go.sha, b);
  assert.equal(inputs.siteSha, a);
  await assert.rejects(resolveInputs(definitions, candidate, a, async () => d), /requested revision/);
});

function fixture() {
  const inputs = { version: 1, siteSha: a, candidate: null, sources: {
    rust: { repository: definitions[0].repository, sha: b },
    go: { repository: definitions[1].repository, sha: c },
  } };
  const manifest = { site: { sha: a, dirty: false }, mode: 'committed',
    sources: Object.entries(inputs.sources).map(([id, source]) => ({ id, ...source })), api: { rust: { sha: b }, go: { sha: c } } };
  return { inputs, manifest };
}

test('guide, API, site and clean committed inputs must all agree before a CI build succeeds', () => {
  const { inputs, manifest } = fixture();
  verifyBuild(inputs, manifest, { requireClean: true });
  for (const mutate of [m => { m.site.sha = d; }, m => { m.site.dirty = true; }, m => { m.mode = 'worktree'; },
    m => { m.api.rust.sha = d; }, m => { m.sources[1].sha = d; }, m => { m.sources[0].repository = 'other/repo'; }]) {
    const changed = structuredClone(manifest); mutate(changed);
    assert.throws(() => verifyBuild(inputs, changed, { requireClean: true }), /does not match/);
  }
});
