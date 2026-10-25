import { execFileSync } from 'node:child_process';
import { withSnapshot } from './lib/api-sources.mjs';
import { createHash } from 'node:crypto';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sourceConfig from '../docs-sources.json' with { type: 'json' };
import siteConfig from '../site.config.json' with { type: 'json' };
import { analyzeDocument, documentUrl, transformDocument, walk } from './lib/documents.mjs';
import { git, loadSources, loadDeveloperSource, readSource } from './lib/sdk-sources.mjs';
import { benchmarkProvenance, collectBenchmarks, gitSnapshot } from './lib/benchmark-sources.mjs';
import { renderBenchmarkPage } from './lib/benchmark-page.mjs';

const root = path.resolve(import.meta.dirname, '..');
const content = path.join(root, 'content/docs');
const generated = path.join(root, 'public/generated');
const worktree = process.argv.includes('--worktree') || process.env.QORTOO_DOCS_WORKTREE === '1';
const config = structuredClone(sourceConfig);
if (process.env.QORTOO_DOCS_FIXTURE_DIR) config.sources.push({ id: 'fixture', title: 'Rendering fixture', repository: 'qortoo/fixture', directory: process.env.QORTOO_DOCS_FIXTURE_DIR, directoryEnv: 'QORTOO_DOCS_FIXTURE_DIR', ref: 'main', refEnv: 'QORTOO_DOCS_FIXTURE_REF', navigation: ['index', '...'] });
const sources = loadSources(root, config);
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const json = (data) => JSON.stringify(data, null, 2) + '\n';
const manifest = {
  site: { sha: git(root, 'rev-parse', 'HEAD'), dirty: git(root, 'status', '--porcelain') !== '' },
  builtAt: new Date().toISOString(), basePath: siteConfig.basePath,
  mode: worktree ? 'worktree' : 'committed', sources: [], pages: [], assets: [], examples: {}, api: {},
};
if (process.env.DOCS_INPUTS) manifest.automation = {
  inputs: JSON.parse(process.env.DOCS_INPUTS),
  runUrl: process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT,
};
sources.push(loadDeveloperSource(root, manifest.site.sha));
const assets = new Map();
const urls = new Set();
await rm(content, { recursive: true, force: true });
await rm(generated, { recursive: true, force: true });
await mkdir(content, { recursive: true });
await mkdir(generated, { recursive: true });
await cp(path.join(root, 'site-content/docs'), content, { recursive: true });
for (const source of sources) {
  const files = [...source.files].filter((file) => file.startsWith('docs/') && file.endsWith('.md')).sort();
  const inventory = { id: source.id, title: source.title, repository: source.repository, ref: source.ref, sha: source.sha, dirtyDocs: source.dirtyDocs, files: [], mermaid: 0, tables: 0, images: 0, rewrittenLinks: 0 };
  for (const file of files) {
    const raw = (await readSource(source, file, worktree)).toString('utf8');
    const analysis = analyzeDocument(raw);
    if (file === 'docs/getting-started.md') {
      walk(analysis.tree, (node) => {
        if (node.type === 'code' && node.lang === source.id && !manifest.examples[source.id]) manifest.examples[source.id] = node.value;
      });
    }
    const result = transformDocument(raw, analysis, source, file, sources);
    const url = documentUrl(source.id, file);
    if (urls.has(url)) throw new Error(`Duplicate page URL: ${url}`);
    urls.add(url);
    for (const [key, asset] of result.assets) assets.set(key, asset);
    const relative = file.replace(/^docs\//, '').replace(/README\.md$/, 'index.md');
    const output = path.join(content, source.id, relative);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, `---\ntitle: ${JSON.stringify(analysis.title)}\n---\n${result.body}`);
    const sourceUrl = `https://github.com/${source.repository}/blob/${source.sha}/${file}`;
    manifest.pages.push({ url, title: analysis.title, sdk: source.id, file, h1Anchor: analysis.h1Anchor, sourceUrl, editUrl: `https://github.com/${source.repository}/edit/${encodeURIComponent(source.editRef)}/${file}`, ...analysis.counts });
    inventory.files.push({ path: file, sha256: sha256(raw) });
    for (const count of ['mermaid', 'tables', 'images']) inventory[count] += analysis.counts[count];
    inventory.rewrittenLinks += result.rewrittenLinks;
  }
  if (!files.length) throw new Error(`No documents found: ${source.repository}`);
  manifest.sources.push(inventory);
  await writeFile(path.join(content, source.id, 'meta.json'), json({ title: source.title, description: source.description ?? (source.id === 'rust' ? 'Core implementation and Rust API' : 'Go bindings for the Rust core'), root: true, pages: source.navigation }));
}
for (const [key, asset] of assets) {
  const data = await readSource(asset.source, asset.file, worktree);
  const destination = path.join(generated, 'assets', key);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, data);
  manifest.assets.push({ path: `generated/assets/${key}`, sha256: sha256(data) });
}
const go = sources.find((source) => source.id === 'go');
await withSnapshot(go, async (directory) => {
  const markdown = execFileSync('go', ['run', path.join(root, 'scripts/go-api/main.go'), directory, `https://github.com/${go.repository}/blob/${go.sha}`], { encoding: 'utf8', cwd: root, maxBuffer: 16 * 1024 * 1024 });
  await writeFile(path.join(content, 'go-api.md'), markdown);
});
manifest.api.go = { sha: go.sha, url: '/docs/go-api/', platform: 'linux/amd64', cgo: true };
const benchmarkDirectory = path.resolve(root, process.env.QORTOO_BENCH_DIR ?? '../qortoo-bench');
const benchmarkRef = process.env.QORTOO_BENCH_REF ?? 'origin/bench-data';
const benchmarkData = collectBenchmarks(gitSnapshot(benchmarkDirectory, benchmarkRef));
manifest.benchmarks = benchmarkProvenance(benchmarkData);
const expectedBenchmarks = manifest.automation?.inputs.benchmarks;
if (expectedBenchmarks && (expectedBenchmarks.revision !== manifest.benchmarks.revision || expectedBenchmarks.indexSha256 !== manifest.benchmarks.indexSha256)) throw new Error('Benchmark snapshot differs from resolved inputs');
const performance = renderBenchmarkPage(benchmarkData, manifest.sources);
await writeFile(path.join(content, 'performance.mdx'), performance.markdown);
await mkdir(path.join(generated, 'benchmarks'), { recursive: true });
for (const asset of performance.assets) await writeFile(path.join(generated, asset.file), asset.content);
await writeFile(path.join(generated, 'benchmarks.json'), json(manifest.benchmarks));
await writeFile(path.join(generated, 'sources.json'), json(manifest));
console.log(json({ mode: manifest.mode, sources: manifest.sources.map(({ files, ...s }) => ({ ...s, documents: files.length })), assets: manifest.assets.length }));
