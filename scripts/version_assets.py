#!/usr/bin/env python3
"""Version local assets by their bytes, updating dependencies before consumers."""
import argparse
import hashlib
from html import escape
from pathlib import Path
import sys
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from site_files import VERSIONED, public_text_files, references, validate_reference


def versioned_sources(root):
    rendered, visiting = {}, set()

    def render(path):
        if path in rendered:
            return rendered[path]
        if path in visiting:
            raise ValueError(f'Cyclic asset dependency: {path.relative_to(root)}')
        visiting.add(path)
        data = path.read_bytes()
        if path.suffix in {'.html', '.css', '.js'}:
            text = data.decode('utf-8')
            for ref in reversed(references(path, text)):
                target = validate_reference(ref.value, path, root)
                if target is None or target.suffix not in VERSIONED:
                    continue
                digest = hashlib.sha256(render(target)).hexdigest()[:12]
                url = urlsplit(ref.value)
                query = [(key, value) for key, value in parse_qsl(url.query, keep_blank_values=True)
                         if key != 'v']
                query.append(('v', digest))
                value = urlunsplit(url._replace(query=urlencode(query)))
                if path.suffix == '.html':
                    value = escape(value, quote=False)
                text = text[:ref.start] + value + text[ref.end:]
            data = text.encode('utf-8')
        visiting.remove(path)
        rendered[path] = data
        return data

    for path in public_text_files(root):
        render(path)
    return {path: data for path, data in rendered.items() if path.read_bytes() != data}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--write', action='store_true')
    mode.add_argument('--check', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    try:
        changes = versioned_sources(root)
    except (ValueError, OSError) as error:
        sys.exit(str(error))
    if args.write:
        for path, data in changes.items():
            path.write_bytes(data)
        print(f'Asset versions updated in {len(changes)} files.')
    elif changes:
        print('Stale asset versions: ' + ', '.join(str(path.relative_to(root)) for path in sorted(changes)),
              file=sys.stderr)
        sys.exit('Run npm run assets, then commit the updated references.')
    else:
        print('Asset content hashes are current.')


if __name__ == '__main__':
    main()
