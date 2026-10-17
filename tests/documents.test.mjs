import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeDocument, documentUrl, transformDocument } from '../scripts/lib/documents.mjs';

const rust = { id: 'rust', repository: 'qortoo/qortoo-rs', ref: 'main', sha: 'a'.repeat(40), files: new Set(['docs/README.md', 'docs/start.md', 'docs/other page.md', 'docs/images/chart.svg', 'docs/data.json', 'src/lib.rs']) };
const go = { id: 'go', repository: 'qortoo/qortoo-go', ref: 'main', sha: 'b'.repeat(40), files: new Set(['docs/README.md']) };
function transform(raw) { const analysis = analyzeDocument(raw); return { analysis, ...transformDocument(raw, analysis, rust, 'docs/start.md', [rust, go]) }; }

test('document links stay internal while code links identify an exact SDK revision', () => {
  const result = transform('# Start\n\n[Root](README.md) [Other](other%20page.md#part) [Code](../src/lib.rs) [Go](https://github.com/qortoo/qortoo-go/blob/main/docs/README.md)');
  assert.match(result.body, /\[Root\]\(\/docs\/rust\/\)/);
  assert.match(result.body, /\/docs\/rust\/other%20page\/#part/);
  assert.ok(result.body.includes(`/blob/${rust.sha}/src/lib.rs`));
  assert.match(result.body, /\[Go\]\(\/docs\/go\/\)/);
});

test('pinned historical links and external URLs retain their original meaning', () => {
  const raw = '# Start\n\n[Old](https://github.com/qortoo/qortoo-rs/blob/v0.1/docs/start.md) [External](https://example.com/docs/start.md)';
  const { body } = transform(raw);
  assert.match(body, /blob\/v0.1\/docs\/start.md/);
  assert.match(body, /https:\/\/example.com\/docs\/start.md/);
});

test('asset URLs preserve references shared by images and downloads', () => {
  const { body, assets } = transform('# Start\n\n![A](images/chart.svg) [Data](data.json) ![B][chart] [Download][chart]\n\n[chart]: images/chart.svg');
  assert.equal(assets.size, 2);
  assert.match(body, /!\[A\]\(\/generated\/assets\/rust\/docs\/images\/chart.svg\)/);
  assert.match(body, /\[chart\]: \/generated\/assets\/rust\/docs\/images\/chart.svg/);
  assert.match(body, /\[Data\]\(\/generated\/assets\/rust\/docs\/data.json\)/);
});

test('missing Markdown and image targets fail instead of turning into broken GitHub links', () => {
  for (const target of ['missing.md', 'images/missing.svg']) assert.throws(() => transform(`# Start\n\n[Missing](${target})`), /Missing target/);
  for (const target of ['../../private.md', '..%2F..%2Fprivate.md']) assert.throws(() => transform(`# Start\n\n[Escape](${target})`), /escapes repository/);
});

test('H1 and duplicate heading anchors keep GitHub slug order without rewriting code', () => {
  const raw = '# Start\n\n## Start\n\n## Start\n\n```rust\n// [Link](missing.md)\nlet value = "## Start";\n```';
  const { body, analysis } = transform(raw);
  assert.equal(analysis.h1Anchor, 'start');
  assert.match(body, /## Start \[#start-1\]/);
  assert.match(body, /## Start \[#start-2\]/);
  assert.ok(body.includes('```rust\n// [Link](missing.md)\nlet value = "## Start";\n```'));
  assert.equal(documentUrl('rust', 'docs/README.md'), '/docs/rust/');
});
