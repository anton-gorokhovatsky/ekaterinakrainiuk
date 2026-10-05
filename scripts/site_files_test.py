import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from site_files import check_supporting_resources, local_target, validate_reference
from stage_pages import stage
from version_assets import versioned_sources


class SiteFilesTest(unittest.TestCase):
    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()

    def write(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        return path

    def apply_versions(self):
        changes = versioned_sources(self.root)
        for path, content in changes.items():
            path.write_bytes(content)
        return changes

    def test_nested_dependency_change_reaches_html_and_404(self):
        font = self.write('assets/font.woff2', 'font-v1')
        self.write('assets/nested.css', '@font-face {src: url(font.woff2)}')
        self.write('styles.css', '@import "assets/nested.css";')
        index = self.write('index.html', '<link href="styles.css?v=old">')
        error_page = self.write('404.html', '<link href="/ekaterinakrainiuk/styles.css?v=old">')
        self.apply_versions()
        before = index.read_text()
        self.assertEqual(versioned_sources(self.root), {})
        font.write_text('font-v2')
        changes = self.apply_versions()
        self.assertEqual({path.name for path in changes}, {'nested.css', 'styles.css', 'index.html', '404.html'})
        self.assertNotEqual(index.read_text(), before)
        digest = hashlib.sha256((self.root / 'styles.css').read_bytes()).hexdigest()[:12]
        self.assertIn(f'?v={digest}', error_page.read_text())
        self.assertEqual(versioned_sources(self.root), {})

    def test_svg_query_fragment_and_dynamic_javascript_are_preserved(self):
        sprite = self.write('assets/icons.svg', '<svg><symbol id="play"/></svg>')
        page = self.write('index.html', '<use href="assets/icons.svg?size=2&amp;v=old#play"/>')
        script = self.write('app.js', 'const icon = `assets/icons.svg#${name}`;')
        self.apply_versions()
        digest = hashlib.sha256(sprite.read_bytes()).hexdigest()[:12]
        self.assertIn(f'?size=2&amp;v={digest}#play', page.read_text())
        self.assertIn(f'?v={digest}#${{name}}', script.read_text())
        self.assertEqual(versioned_sources(self.root), {})

    def test_missing_files_and_svg_ids_are_reported_in_every_stylesheet(self):
        self.write('styles.css', 'body {}')
        self.write('tarot.css', 'a {background: url(assets/missing.svg)}')
        self.write('themes.css', '@import "assets/theme-extra.css";')
        self.write('assets/theme-extra.css', 'a {mask: url(icons.svg#missing)}')
        self.write('assets/icons.svg', '<svg><symbol id="present"/></svg>')
        errors = check_supporting_resources(self.root)
        self.assertEqual(len(errors), 2)
        self.assertTrue(any('tarot.css: missing local file' in error for error in errors))
        self.assertTrue(any('missing SVG symbol icons.svg#missing' in error for error in errors))

    def test_missing_html_symbol_and_javascript_asset_fail(self):
        self.write('assets/icons.svg', '<svg><symbol id="present"/></svg>')
        page = self.write('index.html', '<use href="assets/icons.svg#missing"/>')
        with self.assertRaisesRegex(ValueError, 'missing SVG symbol'):
            validate_reference('assets/icons.svg?v=1#missing', page, self.root)
        self.write('app.js', 'const icon = "assets/no-file.svg";')
        self.assertIn('missing local file', check_supporting_resources(self.root)[0])

    def test_external_data_and_page_fragments_are_not_local_paths(self):
        page = self.write('index.html', '<a href="#contact">Contact</a>')
        for url in ('https://example.com/a.css', '//example.com/a.css', 'data:image/svg+xml,svg', '#contact'):
            self.assertIsNone(local_target(url, page, self.root))
        self.assertEqual(versioned_sources(self.root), {})

    def test_urls_cannot_escape_the_pages_directory(self):
        page = self.write('index.html', '')
        for url in ('../secret.css', '/wrong-prefix/file.css', '%2e%2e/secret.css'):
            with self.assertRaises(ValueError):
                local_target(url, page, self.root)

    def test_cyclic_imports_fail_with_a_useful_message(self):
        self.write('styles.css', '@import "second.css";')
        self.write('second.css', '@import "styles.css";')
        with self.assertRaisesRegex(ValueError, 'Cyclic asset dependency'):
            versioned_sources(self.root)

    def test_artifact_contains_only_public_files_and_verifiable_hashes(self):
        self.write('index.html', 'site')
        self.write('assets/font.woff2', 'font')
        self.write('docs/ux-rules.md', 'rules')
        self.write('.nojekyll', '')
        self.write('package.json', '{}')
        self.write('node_modules/private.js', 'dev dependency')
        self.write('scripts/test.py', 'development only')
        destination = self.root / '_site' / 'ekaterinakrainiuk'
        files = stage(self.root, destination, 'abc123')
        manifest = json.loads((destination / 'release.json').read_text())
        self.assertEqual(manifest['commit'], 'abc123')
        self.assertEqual(set(files), {'index.html', '.nojekyll', 'assets/font.woff2', 'docs/ux-rules.md'})
        for name, digest in manifest['files'].items():
            self.assertEqual(digest, hashlib.sha256((destination / name).read_bytes()).hexdigest())
        self.write('_site/ekaterinakrainiuk/stale.html', 'old')
        stage(self.root, destination, 'next')
        self.assertFalse((destination / 'stale.html').exists())
        with self.assertRaises(ValueError):
            stage(self.root, self.root / 'assets', 'unsafe')


if __name__ == '__main__':
    unittest.main()
