#!/usr/bin/env python3
"""Copy public files into a testable Pages artifact, without a bundler."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parent.parent


def stage(root, destination, commit):
    if not destination.resolve().is_relative_to(root.resolve() / '_site'):
        raise ValueError('The Pages artifact must stay inside _site.')
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True)
    for path in root.iterdir():
        if path.is_file() and (path.suffix in {'.html', '.css', '.js', '.xml'} or
                              path.name in {'robots.txt', '.nojekyll', 'README.md', 'AGENTS.md'}):
            shutil.copy2(path, destination / path.name)
    for name in ('assets', 'docs'):
        shutil.copytree(root / name, destination / name)
    files = {str(path.relative_to(destination)): hashlib.sha256(path.read_bytes()).hexdigest()
             for path in sorted(destination.rglob('*')) if path.is_file()}
    (destination / 'release.json').write_text(json.dumps({
        'schema': 1, 'commit': commit, 'files': files,
    }, indent=2) + '\n')
    return files


if __name__ == '__main__':
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    destination = ROOT / '_site' / 'ekaterinakrainiuk'
    files = stage(ROOT, destination, commit)
    print(f'Staged {len(files)} public files for {commit} in {destination.relative_to(ROOT)}.')
