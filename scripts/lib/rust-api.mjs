import path from 'node:path';
import { fromHtml } from 'hast-util-from-html';
import { defaultHandlers, toMdast } from 'hast-util-to-mdast';
import { toMarkdown } from 'mdast-util-to-markdown';
import { gfmToMarkdown } from 'mdast-util-gfm';

const textContent = (node) => {
  if (node.type === 'text') return node.value;
  const content = (node.children ?? []).map(textContent).join('');
  return node.tagName === 'div' || node.tagName === 'br' ? '\n' + content + '\n' : content;
};
const classes = (node) => node.properties?.className ?? [];
function find(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.children ?? []) { const found = find(child, predicate); if (found) return found; }
}
export function inspectRustdoc(html, file) {
  const tree = fromHtml(html);
  const main = find(tree, (node) => node.properties?.id === 'main-content');
  if (!main) {
    const redirect = find(tree, (node) => node.tagName === 'meta' && String(node.properties?.httpEquiv).toLowerCase() === 'refresh');
    const target = redirect?.properties.content?.match(/url=(.*)/i)?.[1];
    if (!target) throw new Error(`Unsupported rustdoc page: ${file}`);
    return { redirect: path.posix.normalize(path.posix.join(path.posix.dirname(file), target)) };
  }
  const stem = path.posix.basename(file, '.html');
  const root = file === 'qortoo/index.html';
  const title = root ? 'Rust API reference' : stem === 'index' ? path.posix.dirname(file).slice('qortoo/'.length) : stem.slice(stem.indexOf('.') + 1);
  const slug = file.slice('qortoo/'.length, -'.html'.length).toLowerCase().replace(/[/.]/g, '-');
  return { main, title, slug, kind: root ? 'index' : stem === 'index' ? 'mod' : stem.split('.')[0] };
}

export function renderRustdoc(page, { file, routes, source, dependencyLinks = new Map() }) {
  const main = structuredClone(page.main);
  const anchors = [];
  const headingIds = new Set();
  const related = new Map();
  const sourceBase = `https://github.com/${source.repository}/blob/${source.sha}/`;
  const rewrite = (href) => {
    if (dependencyLinks.has(href)) return dependencyLinks.get(href);
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) {
      if (!/^https?:|^mailto:/i.test(href)) throw new Error(`Unresolved rustdoc link in ${file}: ${href}`);
      return href;
    }
    const url = new URL(href, `https://rustdoc.invalid/${file}`);
    const target = decodeURIComponent(url.pathname.slice(1));
    if (target.startsWith('src/qortoo/')) {
      const lines = url.hash.slice(1).split('-');
      return sourceBase + 'src/' + target.slice('src/qortoo/'.length).replace(/\.html$/, '') + (lines[0] ? `#L${lines[0]}${lines[1] ? `-L${lines[1]}` : ''}` : '');
    }
    const route = routes.get(target);
    if (!route) throw new Error(`Missing rustdoc route in ${file}: ${href}`);
    const fragment = url.hash ? '#' + decodeURIComponent(url.hash.slice(1)) : '';
    if (target !== file && !related.has(route.url)) related.set(route.url, route.title);
    return (target === file ? '' : route.url) + fragment;
  };
  // Keep rustdoc's member IDs, but present signatures as code blocks beneath concise headings.
  function clean(node, parentId) {
    if (node.type !== 'element') return node;
    if (['script', 'style', 'button', 'rustdoc-toolbar'].includes(node.tagName) || classes(node).includes('main-heading') || classes(node).includes('anchor') || classes(node).includes('out-of-band') || classes(node).includes('hideme')) return null;
    if (node.tagName === 'a' && textContent(node).trim() === '§') return null;
    if (node.tagName === 'details' || node.tagName === 'summary') node.tagName = 'div';
    const id = node.properties.id ?? parentId;
    if (/^h[1-6]$/.test(node.tagName)) {
      const ownId = node.properties.id ?? parentId;
      if (ownId && ownId !== 'main-content') { node.properties.id = ownId; headingIds.add(ownId); }
      if (classes(node).includes('code-header')) {
        const signature = textContent(node).trim();
        function collectLinks(child) {
          if (child.tagName === 'a' && child.properties?.href) rewrite(child.properties.href);
          for (const nested of child.children ?? []) collectLinks(nested);
        }
        collectLinks(node);
        const name = ownId?.match(/^(?:method|tymethod|associatedconstant|associatedtype|structfield|variant)\.(.*)$/)?.[1] ?? signature.split('\n')[0];
        node.children = [{ type: 'text', value: name }];
        node.tagName = ownId?.startsWith('impl-') ? 'h3' : 'h4';
        return { type: 'element', tagName: 'div', properties: {}, children: [node, { type: 'element', tagName: 'pre', properties: {}, children: [{ type: 'element', tagName: 'code', properties: { className: ['language-rust'] }, children: [{ type: 'text', value: signature }] }] }] };
      }
    }
    if (node.tagName === 'a' && node.properties.href) node.properties.href = rewrite(node.properties.href);
    if (node.tagName === 'pre') {
      const code = find(node, (child) => child.tagName === 'code');
      if (code) code.properties.className = ['language-rust'];
    }
    node.children = (node.children ?? []).map((child) => clean(child, id)).filter(Boolean);
    return node;
  }
  const sourceLink = find(main, node => node.tagName === 'a' && node.properties?.href?.includes('src/'))?.properties.href;
  const originalSource = sourceLink ? rewrite(sourceLink) : null;
  const cleaned = clean(main);
  const handlers = {};
  function configure(node) {
    if (node.type !== 'element') return;
    const tag = node.tagName;
    if (!handlers[tag]) handlers[tag] = (state, element, parent) => {
      const result = defaultHandlers[tag] ? defaultHandlers[tag](state, element, parent) : state.all(element);
      const id = element.properties?.id;
      if (!id || id === 'main-content') return result;
      if (/^h[1-6]$/.test(tag)) {
        result.children.push({ type: 'text', value: ` QORTOOANCHOR${anchors.length}TOKEN` });
        anchors.push(id);
        return result;
      }
      if (headingIds.has(id)) return result;
      const anchor = { type: 'html', value: `<a id="${String(id).replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"></a>` };
      return [anchor, ...(Array.isArray(result) ? result : result ? [result] : [])];
    };
    for (const child of node.children ?? []) configure(child);
  }
  configure(cleaned);
  const markdown = toMarkdown(toMdast(cleaned, { handlers }), { extensions: [gfmToMarkdown()], fences: true });
  const body = markdown.replace(/QORTOOANCHOR(\d+)TOKEN/g, (_, index) => `[#${anchors[index]}]`);
  const revision = `[SDK revision ${source.sha.slice(0, 12)}](https://github.com/${source.repository}/commit/${source.sha}) · All features · [Rust guides](/docs/rust/)`;
  const links = [...related].filter(([url]) => url !== '/docs/rust-api/').map(([url, title]) => `- [${title}](${url})`).join('\n');
  return `---\ntitle: ${JSON.stringify(page.title)}\ndescription: ${JSON.stringify(page.kind === 'index' ? 'Public Rust API generated from the SDK.' : `${page.kind} ${page.title} in qortoo`)}\n---\n\n${revision}${originalSource ? ` · [View source](${originalSource})` : ''}\n\n${body}${links ? `\n## Related API\n\n${links}\n` : ''}`;
}
