#!/usr/bin/env python3
"""Small, dependency-free release check for the actual static files."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
errors = []


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.ids = set()
        self.fragments = []
        self.headings = 0
        self.lang = None
        self.title = False
        self.viewport = False

    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        if tag == 'html':
            self.lang = attrs.get('lang')
        if tag == 'h1':
            self.headings += 1
        if tag == 'title':
            self.title = True
        if tag == 'meta' and attrs.get('name') == 'viewport':
            self.viewport = True
        if attrs.get('id'):
            if attrs['id'] in self.ids:
                errors.append(f'{self.path.name}: duplicate id {attrs["id"]}')
            self.ids.add(attrs['id'])
        if tag == 'img':
            for key in ('alt', 'width', 'height'):
                if key not in attrs:
                    errors.append(f'{self.path.name}: image missing {key}')
        for key in ('href', 'src'):
            value = attrs.get(key)
            if value is not None:
                self.check_reference(value)
        for candidate in attrs.get('srcset', '').split(','):
            if candidate.strip():
                self.check_reference(candidate.strip().split()[0])

    def check_reference(self, value):
        if not value or value == '#':
            errors.append(f'{self.path.name}: empty destination')
            return
        url = urlsplit(value)
        if url.scheme or url.netloc:
            if url.scheme == 'http':
                errors.append(f'{self.path.name}: insecure external reference {value}')
            return
        if not url.path and url.fragment:
            self.fragments.append(unquote(url.fragment))
            return
        if url.path.startswith('/ekaterinakrainiuk/'):
            target = ROOT / unquote(url.path.removeprefix('/ekaterinakrainiuk/'))
        else:
            target = self.path.parent / unquote(url.path)
        if not target.exists():
            errors.append(f'{self.path.name}: missing local file {url.path}')


for path in ROOT.glob('*.html'):
    page = Page(path)
    page.feed(path.read_text())
    if page.lang != 'ru' or page.headings != 1 or not page.title or not page.viewport:
        errors.append(f'{path.name}: check language, title, viewport and single h1')
    for fragment in page.fragments:
        if fragment not in page.ids:
            errors.append(f'{path.name}: broken fragment #{fragment}')

for value in re.findall(r'url\(["\']?([^"\')]+)', (ROOT / 'styles.css').read_text()):
    if not (ROOT / value).is_file():
        errors.append(f'styles.css: missing {value}')

ET.parse(ROOT / 'sitemap.xml')
if not (ROOT / '.nojekyll').exists():
    errors.append('Missing .nojekyll')
if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)
print('Static checks passed: HTML, anchors, local assets, image dimensions, sitemap, Pages marker.')
