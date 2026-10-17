import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import config from '../docs-sources.json' with { type: 'json' };
import { loadSources } from './lib/sdk-sources.mjs';
import { dependencyLinks } from './lib/rustdoc-links.mjs';
import { inspectRustdoc, renderRustdoc } from './lib/rust-api.mjs';
import { withSnapshot } from './lib/api-sources.mjs';

const root = path.resolve(import.meta.dirname, '..');
const manifestFile = path.join(root, 'public/generated/sources.json');
const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
const rust = loadSources(root, config).find((source) => source.id === 'rust');
if (rust.sha !== manifest.sources.find((source) => source.id === 'rust').sha) throw new Error('Rust revision changed after guide collection; restart the build');
const target = path.join(root, '.cache/rust-api');
await mkdir(target, { recursive: true });
await rm(path.join(target, 'doc'), { recursive: true, force: true });
let links;
await withSnapshot(rust, async (directory) => {
  links = dependencyLinks(await readFile(path.join(directory, 'Cargo.lock'), 'utf8'));
  execFileSync('cargo', ['doc', '--locked', '--no-deps', '-p', 'qortoo', '--all-features', '--target-dir', target], {
    cwd: directory, stdio: 'inherit', env: { ...process.env, RUSTDOCFLAGS: '-D rustdoc::broken_intra_doc_links' },
  });
});
const documentation = path.join(target, 'doc');
const pages = new Map();
const routes = new Map();
const slugs = new Set();
for (const entry of await readdir(path.join(documentation, 'qortoo'), { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.html') || entry.name === 'all.html') continue;
  const file = path.relative(documentation, path.join(entry.parentPath, entry.name)).split(path.sep).join('/');
  const page = inspectRustdoc(await readFile(path.join(documentation, file), 'utf8'), file);
  pages.set(file, page);
  if (page.main && slugs.has(page.slug)) throw new Error(`Duplicate Rust API slug: ${page.slug}`);
  if (page.main) slugs.add(page.slug);
  if (page.main) routes.set(file, { url: page.slug === 'index' ? '/docs/rust-api/' : `/docs/rust-api/${page.slug}/`, title: page.title });
}
function resolve(file, seen = new Set()) {
  if (routes.has(file)) return routes.get(file);
  if (seen.has(file) || !pages.get(file)?.redirect) throw new Error(`Missing or circular rustdoc alias: ${file}`);
  seen.add(file);
  const route = resolve(pages.get(file).redirect, seen);
  routes.set(file, route);
  return route;
}
for (const file of pages.keys()) resolve(file);
const destination = path.join(root, 'content/docs/rust-api');
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
const exported = [];
for (const [file, page] of pages) {
  if (!page.main) continue;
  await writeFile(path.join(destination, page.slug + '.md'), renderRustdoc(page, { file, routes, source: rust, dependencyLinks: links }));
  exported.push({ url: routes.get(file).url, title: page.title, kind: page.kind });
}
if (!exported.length) throw new Error('No Rust API pages generated');
const order = ['index', 'mod', 'struct', 'enum', 'trait', 'fn', 'type', 'constant'];
const navigation = [...pages.values()].filter(page => page.main).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.title.localeCompare(b.title)).map(page => page.slug);
await writeFile(path.join(destination, 'meta.json'), JSON.stringify({ title: 'Rust API reference', root: true, pages: navigation }, null, 2) + '\n');
// Remove the previous standalone output so it cannot be published accidentally.
await rm(path.join(root, 'public/api/rust'), { recursive: true, force: true });
manifest.api.rust = { sha: rust.sha, url: '/docs/rust-api/', features: 'all', dependencies: false, pages: exported };
await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Rust API: ${rust.sha} → ${exported.length} Fumadocs pages`);
