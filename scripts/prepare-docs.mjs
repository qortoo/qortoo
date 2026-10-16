import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

const root = path.resolve(import.meta.dirname, '..');
const content = path.join(root, 'content/docs');
const generated = path.join(root, 'public/generated');
const parser = unified().use(remarkParse).use(remarkGfm);
const worktree = process.argv.includes('--worktree') || process.env.QORTOO_DOCS_WORKTREE === '1';
const definitions = [
  { id: 'rust', repo: 'qortoo-rs', env: 'QORTOO_RS_DIR' },
  { id: 'go', repo: 'qortoo-go', env: 'QORTOO_GO_DIR' },
];
const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trimEnd();
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const route = (id, file) => `/docs/${id}/${file.replace(/^docs\//, '').replace(/README\.md$/, '').replace(/\.md$/, '')}`.replace(/\/?$/, '/');
function walk(node, callback) { callback(node); for (const child of node.children ?? []) walk(child, callback); }
function textOf(node) { return node.value ?? (node.children ?? []).map(textOf).join(''); }

const sources = definitions.map((def) => {
  const dir = path.resolve(process.env[def.env] ?? path.join(root, '..', def.repo));
  const sha = git(dir, 'rev-parse', 'HEAD');
  const files = git(dir, 'ls-tree', '-r', '--name-only', sha, 'docs').split('\n').filter((f) => f.endsWith('.md'));
  return { ...def, dir, sha, files, dirty: git(dir, 'status', '--porcelain', '--', 'docs') !== '' };
});
const pages = new Map(sources.flatMap((s) => s.files.map((f) => [`${s.repo}/${f}`, route(s.id, f)])));

function resolveLink(source, file, url) {
  if (!url || url.startsWith('#')) return url;
  let targetSource = source;
  let target;
  let suffix = '';
  if (/^https:\/\/github\.com\/qortoo\//.test(url)) {
    const match = url.match(/^https:\/\/github\.com\/qortoo\/([^/]+)\/blob\/main\/([^?#]+)(.*)$/);
    if (!match) return url;
    targetSource = sources.find((s) => s.repo === match[1]);
    if (!targetSource) return url;
    target = decodeURI(match[2]); suffix = match[3];
  } else if (/^[a-z][a-z\d+.-]*:|^\//i.test(url)) {
    return url;
  } else {
    const match = url.match(/^([^?#]*)(.*)$/);
    target = path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURI(match[1])));
    suffix = match[2];
  }
  const page = pages.get(`${targetSource.repo}/${target}`);
  if (page) return page + suffix;
  if (target.startsWith('../')) throw new Error(`Link escapes repository: ${file}: ${url}`);
  return `https://github.com/qortoo/${targetSource.repo}/blob/${targetSource.sha}/${target}${suffix}`;
}

await rm(content, { recursive: true, force: true });
await mkdir(content, { recursive: true });
await mkdir(generated, { recursive: true });
const manifest = { site: { sha: git(root, 'rev-parse', 'HEAD'), dirty: git(root, 'status', '--porcelain') !== '' }, mode: worktree ? 'worktree' : 'committed', sources: [], pages: [] };
for (const source of sources) {
  const inventory = { id: source.id, repo: source.repo, sha: source.sha, dirtyDocs: source.dirty, files: [], mermaid: 0, tables: 0, images: 0, rewrittenLinks: 0 };
  for (const file of source.files) {
    const raw = worktree ? await readFile(path.join(source.dir, file), 'utf8') : execFileSync('git', ['-C', source.dir, 'show', `${source.sha}:${file}`], { encoding: 'utf8' });
    const tree = parser.parse(raw);
    const heading = tree.children.find((n) => n.type === 'heading' && n.depth === 1);
    if (!heading) throw new Error(`Missing title: ${source.repo}/${file}`);
    const title = textOf(heading);
    const edits = [{ start: heading.position.start.offset, end: heading.position.end.offset, value: '' }];
    let mermaid = 0;
    walk(tree, (node) => {
      if (node.type === 'code' && node.lang === 'mermaid') { inventory.mermaid++; mermaid++; }
      if (node.type === 'table') inventory.tables++;
      if (node.type === 'image') inventory.images++;
      if (node.type === 'link' || node.type === 'definition') {
        const next = resolveLink(source, file, node.url);
        if (next !== node.url) {
          const original = raw.slice(node.position.start.offset, node.position.end.offset);
          const offset = original.lastIndexOf(node.url);
          if (offset < 0) throw new Error(`Cannot locate link: ${node.url}`);
          edits.push({ start: node.position.start.offset + offset, end: node.position.start.offset + offset + node.url.length, value: next });
          inventory.rewrittenLinks++;
        }
      }
    });
    let body = raw;
    for (const edit of edits.sort((a, b) => b.start - a.start)) body = body.slice(0, edit.start) + edit.value + body.slice(edit.end);
    const relative = file.replace(/^docs\//, '').replace(/README\.md$/, 'index.md');
    const output = path.join(content, source.id, relative);
    await mkdir(path.dirname(output), { recursive: true });
    const sourceUrl = `https://github.com/qortoo/${source.repo}/blob/${source.sha}/${file}`;
    await writeFile(output, `---\ntitle: ${JSON.stringify(title)}\n---\n\n[View SDK source](${sourceUrl})\n${body}`);
    inventory.files.push({ path: file, sha256: sha256(raw) });
    manifest.pages.push({ url: route(source.id, file), title, sourceUrl, mermaid });
  }
  manifest.sources.push(inventory);
  await writeFile(path.join(content, source.id, 'meta.json'), JSON.stringify({ title: source.id === 'rust' ? 'Rust SDK' : 'Go SDK', root: true }));
}
await writeFile(path.join(content, 'index.md'), '---\ntitle: Documentation\n---\n\nChoose the [Rust SDK](./rust/) or [Go SDK](./go/).\n');
// A site-owned fixture exercises image and literal Markdown handling absent from the SDK docs.
await writeFile(path.join(content, 'compatibility.md'), '---\ntitle: Rendering compatibility\n---\n\n## Image and anchor\n\n![Qortoo rendering probe](/generated/probe.svg)\n\n[Local anchor](#image-and-anchor)\n\nPlain Markdown literals: {value} and `Type<T>`.\n');
await writeFile(path.join(generated, 'probe.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="80" viewBox="0 0 320 80"><rect width="320" height="80" rx="12" fill="#e2e8f0"/><text x="24" y="48" font-family="sans-serif" font-size="22" fill="#0f172a">Qortoo rendering probe</text></svg>');
await writeFile(path.join(generated, 'sources.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ mode: manifest.mode, sources: manifest.sources.map(({ files, ...s }) => ({ ...s, documents: files.length })) }, null, 2));
