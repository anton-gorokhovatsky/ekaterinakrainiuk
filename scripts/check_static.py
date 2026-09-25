#!/usr/bin/env python3
"""Small, dependency-free release check for the actual static files."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import re
import struct
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
        self.meta = {}
        self.canonical = None

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
        if tag == 'meta':
            self.meta[attrs.get('property') or attrs.get('name')] = attrs.get('content', '')
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonical = attrs.get('href')
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
    if path.name == 'index.html':
        for key in ('description', 'og:title', 'og:description', 'og:site_name', 'og:locale',
                    'og:image:alt', 'twitter:title', 'twitter:description', 'twitter:image:alt'):
            if not page.meta.get(key):
                errors.append(f'index.html: missing {key}')
        base = 'https://anton-gorokhovatsky.github.io/ekaterinakrainiuk/'
        if page.canonical != base or page.meta.get('og:url') != base:
            errors.append('index.html: canonical and og:url must match the public site')
        if page.meta.get('og:type') != 'website' or page.meta.get('twitter:card') != 'summary_large_image':
            errors.append('index.html: check Open Graph and Twitter card types')
        image_url = page.meta.get('og:image', '')
        if not image_url.startswith(base) or page.meta.get('twitter:image') != image_url:
            errors.append('index.html: share images must use the same absolute public URL')
        else:
            image = ROOT / image_url.removeprefix(base)
            if not image.is_file():
                errors.append('index.html: share image is missing')
            else:
                data = image.read_bytes()
                if data[:8] != b'\x89PNG\r\n\x1a\n' or page.meta.get('og:image:type') != 'image/png':
                    errors.append('index.html: share image must be a PNG with matching MIME type')
                else:
                    dimensions = tuple(map(str, struct.unpack('>II', data[16:24])))
                    if dimensions != (page.meta.get('og:image:width'), page.meta.get('og:image:height')):
                        errors.append('index.html: declared share image dimensions do not match the file')

for value in re.findall(r'url\(["\']?([^"\')]+)', (ROOT / 'styles.css').read_text()):
    if not (ROOT / value).is_file():
        errors.append(f'styles.css: missing {value}')

ET.parse(ROOT / 'sitemap.xml')
if not (ROOT / '.nojekyll').exists():
    errors.append('Missing .nojekyll')
if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)
print('Static checks passed: HTML, anchors, local assets, share metadata and image, sitemap, Pages marker.')
