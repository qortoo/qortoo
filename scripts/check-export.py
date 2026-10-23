"""Validate the exported documentation and its local links without a web server."""
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

root = Path(__file__).resolve().parent.parent / 'out'
manifest = json.loads((root / 'generated/sources.json').read_text())
prefix = manifest['basePath']
base = 'http://localhost' + prefix + '/'


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids = set()
        self.links = []
        self.tables = 0
        self.diagrams = 0
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.add(attrs['id'])
        if tag in ('a', 'link') and attrs.get('href'):
            self.links.append(attrs['href'])
        if tag in ('img', 'script') and attrs.get('src'):
            self.links.append(attrs['src'])
        self.tables += tag == 'table'
        self.diagrams += attrs.get('data-mermaid') == 'true'


pages = {p: Page(p.read_text()) for p in root.rglob('*.html')}
errors = []
checked = 0
for file, page in pages.items():
    relative = file.relative_to(root).as_posix()
    current = base + relative.removesuffix('index.html')
    for link in page.links:
        url = urlsplit(urljoin(current, link))
        if url.netloc != 'localhost' or url.scheme not in ('http', 'https'):
            continue
        if not url.path.startswith(prefix + '/'):
            errors.append(f'{relative}: link escapes base path: {link}')
            continue
        target = root / unquote(url.path.removeprefix(prefix + '/'))
        if target.is_dir():
            target /= 'index.html'
        if not target.is_file():
            errors.append(f'{relative}: missing target: {link}')
        elif url.fragment and target in pages:
            # Generated API member IDs can contain literal percent escapes.
            ids = pages[target].ids
            fragment = unquote(url.fragment)
            valid = url.fragment in ids or fragment in ids
            if not valid:
                errors.append(f'{relative}: missing anchor: {link}')
        checked += 1

for page in manifest['pages']:
    target = root / page['url'].strip('/') / 'index.html'
    if target not in pages:
        errors.append(f'Missing SDK page: {page["url"]}')
    elif page['h1Anchor'] not in pages[target].ids:
        errors.append(f'Missing original H1 anchor: {page["url"]}')
    elif pages[target].diagrams != page['mermaid']:
        errors.append(f'Mermaid block count differs: {page["url"]}')
expected_tables = sum(s['tables'] for s in manifest['sources'])
actual_tables = sum(pages[root / p['url'].strip('/') / 'index.html'].tables for p in manifest['pages'] if root / p['url'].strip('/') / 'index.html' in pages)
if actual_tables != expected_tables:
    errors.append(f'Table count differs: {actual_tables} != {expected_tables}')
for language, api in manifest.get('api', {}).items():
    source = next(s for s in manifest['sources'] if s['id'] == language)
    if api['sha'] != source['sha']:
        errors.append(f'API revision differs from guides: {language}')
    target = root / api['url'].lstrip('/')
    if target.is_dir():
        target /= 'index.html'
    if not target.is_file():
        errors.append(f'Missing API reference: {language}')
    for page in api.get('pages', []):
        target = root / page['url'].strip('/') / 'index.html'
        if target not in pages:
            errors.append(f'Missing API page: {page["url"]}')
if 'rust' not in manifest.get('api', {}):
    errors.append('Rust API has not been built; run npm run build')
benchmark_manifest = root / 'generated/benchmarks.json'
performance = root / 'docs/performance/index.html'
if not benchmark_manifest.is_file() or not performance.is_file():
    errors.append('Missing Performance page or benchmark provenance')
else:
    benchmarks = json.loads(benchmark_manifest.read_text())
    if benchmarks != manifest.get('benchmarks'):
        errors.append('Benchmark provenance differs from the source manifest')
    html = performance.read_text()
    if benchmarks['revision'] not in html:
        errors.append('Performance page does not identify its data revision')
    for entry in benchmarks['latest']:
        if entry['runId'] not in html or entry['seriesId'] not in html:
            errors.append('Performance page is missing a selected result')
for asset in manifest['assets']:
    if not (root / asset['path']).is_file():
        errors.append(f'Missing SDK asset: {asset["path"]}')
if (root / 'docs/compatibility').exists():
    errors.append('Compatibility fixture leaked into public documentation')
search = json.loads((root / 'api/search').read_text())
if not search:
    errors.append('Empty static search index')
if not any(s['id'] == 'fixture' for s in manifest['sources']):
    if (root / 'docs/fixture').exists() or 'Fixture Start' in json.dumps(search):
        errors.append('SDK fixture leaked into public documentation or search')
print(json.dumps({'sdk_pages': len(manifest['pages']), 'api_pages': sum(len(api.get('pages', [api])) for api in manifest.get('api', {}).values()), 'tables': actual_tables,
                  'mermaid_blocks': sum(p.diagrams for p in pages.values()),
                  'local_links_and_assets': checked, 'errors': errors}, indent=2))
raise SystemExit(bool(errors))
