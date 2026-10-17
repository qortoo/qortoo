import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import GithubSlugger from 'github-slugger';

const parser = unified().use(remarkParse).use(remarkGfm);
export const encodePath = (value) => value.split('/').map(encodeURIComponent).join('/');
export const documentUrl = (id, file) => `/docs/${id}/${encodePath(file.replace(/^docs\//, '').replace(/(?:README|index)\.md$/, '').replace(/\.md$/, ''))}`.replace(/\/?$/, '/');
export function walk(node, callback) { callback(node); for (const child of node.children ?? []) walk(child, callback); }
const textOf = (node) => node.value ?? (node.children ?? []).map(textOf).join('');

export function analyzeDocument(raw) {
  const tree = parser.parse(raw);
  const heading = tree.children.find((node) => node.type === 'heading' && node.depth === 1);
  if (!heading) throw new Error('Document must contain an H1 title');
  const counts = { mermaid: 0, tables: 0, images: 0 };
  const references = new Map();
  const headings = new Map();
  const slugger = new GithubSlugger();
  walk(tree, (node) => {
    if (node.type === 'heading') headings.set(node, slugger.slug(textOf(node)));
    if (node.type === 'code' && node.lang === 'mermaid') counts.mermaid++;
    if (node.type === 'table') counts.tables++;
    if (node.type === 'image') counts.images++;
    if (node.type === 'imageReference') { counts.images++; references.set(node.identifier, 'image'); }
  });
  return { tree, heading, title: textOf(heading), h1Anchor: headings.get(heading), headings, counts, references };
}

export function resolveTarget(source, file, url, sources) {
  if (!url || url.startsWith('#') || url.startsWith('//')) return null;
  let targetSource = source;
  let rawPath;
  let suffix;
  if (/^https:\/\/github\.com\//.test(url)) {
    const match = url.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/([^/]+)\/([^?#]+)(.*)$/);
    if (!match) return null;
    targetSource = sources.find((s) => s.repository === match[1] || s.upstreamRepository === match[1]);
    if (!targetSource || !['main', targetSource.ref, targetSource.sha].includes(match[2])) return null;
    rawPath = match[3]; suffix = match[4];
  } else if (/^[a-z][a-z\d+.-]*:/i.test(url)) {
    return null;
  } else {
    const match = url.match(/^([^?#]*)(.*)$/);
    rawPath = url.startsWith('/') ? match[1].slice(1) : path.posix.join(path.posix.dirname(file), match[1]);
    suffix = match[2];
  }
  const target = path.posix.normalize(decodeURIComponent(rawPath));
  if (target === '..' || target.startsWith('../') || path.posix.isAbsolute(target)) throw new Error(`Link escapes repository: ${url}`);
  if (!targetSource.files.has(target)) throw new Error(`Missing target: ${targetSource.repository}/${target} (from ${file})`);
  return { source: targetSource, file: target, suffix };
}

export function transformDocument(raw, analysis, source, file, sources) {
  const { tree, heading, references } = analysis;
  const edits = [{ start: heading.position.start.offset, end: heading.position.end.offset, value: '' }];
  const assets = new Map();
  let rewrittenLinks = 0;
  walk(tree, (node) => {
    if (node.type === 'heading' && node !== heading) {
      const offset = node.children.at(-1)?.position.end.offset;
      if (offset !== undefined) edits.push({ start: offset, end: offset, value: ` [#${analysis.headings.get(node)}]` });
    }
    if (!['link', 'image', 'definition'].includes(node.type)) return;
    // An H1 can contain a link; the entire original heading is replaced by the page title.
    if (node.position.start.offset >= heading.position.start.offset && node.position.end.offset <= heading.position.end.offset) return;
    const target = resolveTarget(source, file, node.url, sources);
    if (!target) return;
    const isImage = node.type === 'image' || (node.type === 'definition' && references.get(node.identifier) === 'image');
    let next;
    if (isImage || (target.file.startsWith('docs/') && !target.file.endsWith('.md'))) {
      const key = `${target.source.id}/${target.file}`;
      assets.set(key, target);
      const assetUrl = `/generated/assets/${encodePath(key)}`;
      // Image imports use public/ paths; the framework prefixes rendered links.
      next = assetUrl + target.suffix;
    } else if (target.file.startsWith('docs/') && target.file.endsWith('.md')) {
      next = documentUrl(target.source.id, target.file) + target.suffix;
    } else {
      next = `https://github.com/${target.source.repository}/blob/${target.source.sha}/${encodePath(target.file)}${target.suffix}`;
    }
    if (next === node.url) return;
    const original = raw.slice(node.position.start.offset, node.position.end.offset);
    const offset = original.lastIndexOf(node.url);
    if (offset < 0) throw new Error(`Cannot locate URL in Markdown: ${node.url}`);
    edits.push({ start: node.position.start.offset + offset, end: node.position.start.offset + offset + node.url.length, value: next });
    rewrittenLinks++;
  });
  let body = raw;
  for (const edit of edits.sort((a, b) => b.start - a.start)) body = body.slice(0, edit.start) + edit.value + body.slice(edit.end);
  return { body, assets, rewrittenLinks };
}
