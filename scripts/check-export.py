"""Validate the exported documentation and its local links without a web server."""
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

root = Path(__file__).resolve().parent.parent / 'out'
base = 'http://localhost/qortoo/'


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
        if not url.path.startswith('/qortoo/'):
            errors.append(f'{relative}: link escapes base path: {link}')
            continue
        target = root / unquote(url.path.removeprefix('/qortoo/'))
        if target.is_dir():
            target /= 'index.html'
        if not target.is_file():
            errors.append(f'{relative}: missing target: {link}')
        elif url.fragment and target in pages and unquote(url.fragment) not in pages[target].ids:
            errors.append(f'{relative}: missing anchor: {link}')
        checked += 1

manifest = json.loads((root / 'generated/sources.json').read_text())
for page in manifest['pages']:
    target = root / page['url'].strip('/') / 'index.html'
    if target not in pages:
        errors.append(f'Missing SDK page: {page["url"]}')
    elif pages[target].diagrams != page['mermaid']:
        errors.append(f'Mermaid block count differs: {page["url"]}')
expected_tables = sum(s['tables'] for s in manifest['sources'])
actual_tables = sum(p.tables for f, p in pages.items() if '/docs/rust/' in str(f) or '/docs/go/' in str(f))
if actual_tables != expected_tables:
    errors.append(f'Table count differs: {actual_tables} != {expected_tables}')
search = json.loads((root / 'api/search').read_text())
if not search:
    errors.append('Empty static search index')
print(json.dumps({'sdk_pages': len(manifest['pages']), 'tables': actual_tables,
                  'mermaid_blocks': sum(p.diagrams for p in pages.values()),
                  'local_links_and_assets': checked, 'errors': errors}, indent=2))
raise SystemExit(bool(errors))
