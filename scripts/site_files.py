"""Shared local-resource rules for the plain static site. No third-party parser."""
from dataclasses import dataclass
from html import unescape
import re
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET

VERSIONED = {'.css', '.js', '.svg', '.mp4', '.vtt', '.woff', '.woff2'}
HTML_URL = re.compile(r'''(?<![\w-])(?:href|src|poster)\s*=\s*(["'])(?P<url>.*?)\1''', re.I)
CSS_URL = re.compile(r'''url\(\s*(["']?)(?P<url>[^\s)"']+)\1\s*\)''', re.I)
CSS_IMPORT = re.compile(r'''@import\s+(["'])(?P<url>[^"']+)\1''', re.I)
# Keep template expressions in SVG fragments intact; version only the static URL.
JS_ASSET = re.compile(r'''(?P<url>assets/[\w./%+-]+\.[a-zA-Z0-9]+(?:\?[^\s"'`#<>]+)?(?:\#[\w-]+)?)''')


@dataclass(frozen=True)
class Reference:
    value: str
    start: int
    end: int


def references(path, text):
    patterns = {'.html': (HTML_URL,), '.css': (CSS_URL, CSS_IMPORT), '.js': (JS_ASSET,)}
    found = {}
    for pattern in patterns.get(path.suffix, ()):
        for match in pattern.finditer(text):
            start, end = match.span('url')
            found[(start, end)] = Reference(unescape(match['url']), start, end)
    return sorted(found.values(), key=lambda ref: ref.start)


def local_target(value, source, root):
    """Resolve relative and domain-root URLs without leaving the public site."""
    url = urlsplit(unescape(value))
    if url.scheme or url.netloc or not url.path:
        return None
    relative = unquote(url.path)
    if relative.startswith('/'):
        target = root / relative.lstrip('/')
    else:
        target = source.parent / relative
    target = target.resolve()
    if not target.is_relative_to(root.resolve()):
        raise ValueError(f'{source.name}: URL leaves the site: {value}')
    return target


def validate_reference(value, source, root):
    target = local_target(value, source, root)
    if target is None:
        return None
    if not target.exists():
        raise ValueError(f'{source.name}: missing local file {urlsplit(value).path}')
    fragment = unquote(urlsplit(value).fragment)
    if target.suffix == '.svg' and fragment:
        try:
            ids = {element.get('id') for element in ET.parse(target).iter()}
        except ET.ParseError as error:
            raise ValueError(f'{source.name}: invalid SVG {target.name}: {error}') from error
        if fragment not in ids:
            raise ValueError(f'{source.name}: missing SVG symbol {target.name}#{fragment}')
    return target


def public_text_files(root):
    return sorted(path for path in root.iterdir()
                  if path.suffix in {'.html', '.css', '.js'} and path.is_file())


def check_supporting_resources(root):
    """Check all site stylesheets, their imports, and literal JS asset references."""
    pending = [path for path in public_text_files(root) if path.suffix in {'.css', '.js'}]
    seen, errors = set(), []
    while pending:
        path = pending.pop()
        if path in seen:
            continue
        seen.add(path)
        for ref in references(path, path.read_text()):
            try:
                target = validate_reference(ref.value, path, root)
                if target and target.suffix == '.css':
                    pending.append(target)
            except (ValueError, OSError) as error:
                errors.append(str(error))
    return errors
