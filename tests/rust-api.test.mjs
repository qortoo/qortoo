import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectRustdoc, renderRustdoc } from '../scripts/lib/rust-api.mjs';
import { analyzeDocument } from '../scripts/lib/documents.mjs';

const source = { repository: 'qortoo/qortoo-rs', sha: 'a'.repeat(40) };
const file = 'qortoo/struct.Client.html';
const html = `<main><section id="main-content"><div class="main-heading"><h1>Struct Client</h1><a href="../src/qortoo/clients/client.rs.html#92-95">Source</a><rustdoc-toolbar>Search Settings</rustdoc-toolbar></div>
<pre><code>pub struct Client { /* private fields */ }</code></pre>
<div class="docblock"><p>Creates a <a href="datatypes/counter/struct.Counter.html">Counter</a>.</p></div>
<h2 id="implementations">Implementations</h2><details><summary><section id="method.create_datatype"><a href="../src/qortoo/clients/client.rs.html#182-184">Source</a><h4 class="code-header">pub fn create_datatype(&amp;self) -&gt; <a href="struct.Counter.html">Counter</a></h4></section></summary><div class="docblock"><p>Creates a datatype. See <a href="#method.create_datatype">this method</a>.</p><pre><code>let value = "{unchanged}";</code></pre></div></details></section></main>`;
const routes = new Map([
  [file, { url: '/docs/rust-api/struct-client/', title: 'Client' }],
  ['qortoo/struct.Counter.html', { url: '/docs/rust-api/struct-counter/', title: 'Counter' }],
  ['qortoo/datatypes/counter/struct.Counter.html', { url: '/docs/rust-api/struct-counter/', title: 'Counter' }],
]);

test('Rust API conversion preserves method boundaries, signatures, examples and links', () => {
  const page = inspectRustdoc(html, file);
  const result = renderRustdoc(page, { file, source, routes });
  assert.match(result, /title: "Client"/);
  assert.match(result, /#### create_datatype \[#method.create_datatype\]\n\n```rust\npub fn create_datatype\(&self\) -> Counter\n```/);
  assert.match(result, /\[Counter\]\(\/docs\/rust-api\/struct-counter\/\)/);
  assert.match(result, /\[this method\]\(#method.create_datatype\)/);
  assert.match(result, /let value = "\{unchanged\}";/);
  assert.ok(result.includes(`https://github.com/${source.repository}/blob/${source.sha}/src/clients/client.rs#L92-L95`));
  assert.doesNotMatch(result, /rustdoc-toolbar|Search Settings|QORTOOANCHOR/);
  const headings = analyzeDocument('# Test\n' + result).tree.children.filter(node => node.type === 'heading');
  assert.ok(headings.some(node => node.depth === 4), 'method heading must be a Markdown block, not inline prose');
});

test('Rust aliases resolve relative to the originating page and public modules have distinct slugs', () => {
  assert.deepEqual(inspectRustdoc('<meta http-equiv="refresh" content="0;URL=../../struct.Client.html">', 'qortoo/clients/client/struct.Client.html'), { redirect: 'qortoo/struct.Client.html' });
  assert.equal(inspectRustdoc(html, 'qortoo/example/struct.Client.html').slug, 'example-struct-client');
  assert.equal(inspectRustdoc(html, 'qortoo/example/index.html').title, 'example');
  assert.throws(() => inspectRustdoc('<html>changed layout</html>', file), /Unsupported rustdoc page/);
});

test('Rust conversion fails on unresolved local and dependency links', () => {
  const page = inspectRustdoc(html.replace('datatypes/counter/struct.Counter.html', 'missing.html'), file);
  assert.throws(() => renderRustdoc(page, { file, source, routes }), /Missing rustdoc route/);
  const unresolved = inspectRustdoc(html.replace('datatypes/counter/struct.Counter.html', 'crate::Unknown'), file);
  assert.throws(() => renderRustdoc(unresolved, { file, source, routes }), /Unresolved rustdoc link/);
});

test('Rust where clauses retain a separator when rustdoc uses block layout in signatures', () => {
  const page = inspectRustdoc('<section id="main-content"><section id="impl-Example"><h3 class="code-header">impl&lt;T&gt; Example for T<div class="where">where T: Send,</div></h3></section></section>', file);
  const result = renderRustdoc(page, { file, source, routes });
  assert.match(result, /```rust\nimpl<T> Example for T\nwhere T: Send,\n```/);
  assert.doesNotMatch(result, /Twhere/);
});
