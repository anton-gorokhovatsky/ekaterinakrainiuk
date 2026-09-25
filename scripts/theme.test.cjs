const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');

const source = readFileSync(resolve(__dirname, '../theme.js'), 'utf8');
const key = 'ekaterinakrainiuk-theme';

function visit({ stored = null, dark = false, blocked = false, withControl = true } = {}) {
  const events = {};
  const control = { hidden: true };
  const select = {
    value: '',
    closest: () => control,
    addEventListener: (name, handler) => { events[name] = handler; },
  };
  const colors = [{ content: '' }, { content: '' }];
  const root = { dataset: {} };
  const media = {
    matches: dark,
    addEventListener: (_, handler) => { events.system = handler; },
  };
  const storage = new Map(stored === null ? [] : [[key, stored]]);
  runInNewContext(source, {
    document: {
      documentElement: root,
      querySelectorAll: () => colors,
      querySelector: () => withControl ? select : null,
      addEventListener: (name, handler) => { events[name] = handler; },
    },
    window: {
      matchMedia: () => media,
      addEventListener: (name, handler) => { events[name] = handler; },
    },
    localStorage: {
      getItem: (name) => { if (blocked) throw Error('Storage blocked'); return storage.get(name); },
      setItem: (name, value) => { if (blocked) throw Error('Storage blocked'); storage.set(name, value); },
    },
  });
  return {
    root, select, control, colors, storage,
    ready: () => events.DOMContentLoaded(),
    choose: (value) => { select.value = value; events.change(); },
    system: (value) => { media.matches = value; events.system(); },
    sync: (value, name = key) => events.storage({ key: name, newValue: value }),
  };
}

function appearance(page, choice, dark) {
  assert.equal(page.root.dataset.theme, choice);
  for (const meta of page.colors) assert.equal(meta.content, dark ? '#101216' : '#f4f3ee');
}

test('saved choice applies before controls exist, with a system fallback for missing or invalid values', () => {
  for (const stored of [null, 'system', 'light', 'dark', 'invalid']) {
    for (const dark of [false, true]) {
      const page = visit({ stored, dark });
      const choice = ['light', 'dark'].includes(stored) ? stored : 'system';
      appearance(page, choice, choice === 'dark' || (choice === 'system' && dark));
      assert.equal(page.control.hidden, true);
      page.ready();
      assert.equal(page.control.hidden, false);
      assert.equal(page.select.value, choice);
    }
  }
});

test('manual choice survives a new visit and overrides system changes until system mode is restored', () => {
  const page = visit();
  page.ready();
  page.choose('dark');
  page.system(false);
  appearance(page, 'dark', true);
  appearance(visit({ stored: page.storage.get(key) }), 'dark', true);
  page.choose('light');
  page.system(true);
  appearance(page, 'light', false);
  appearance(visit({ stored: page.storage.get(key), dark: true }), 'light', false);
  page.choose('system');
  appearance(page, 'system', true);
  page.system(false);
  appearance(page, 'system', false);
  assert.equal(page.storage.get(key), 'system');
});

test('a choice in another tab updates the control, and clearing storage restores system mode', () => {
  const page = visit({ dark: true });
  page.ready();
  page.sync('light');
  appearance(page, 'light', false);
  assert.equal(page.select.value, 'light');
  page.sync('dark', 'unrelated-key');
  appearance(page, 'light', false);
  page.sync(null, null);
  appearance(page, 'system', true);
});

test('blocked storage does not disable manual or system switching', () => {
  const page = visit({ blocked: true });
  page.ready();
  page.choose('dark');
  appearance(page, 'dark', true);
  page.choose('system');
  page.system(true);
  appearance(page, 'system', true);
});

test('pages without a switch still apply the preference and follow system changes', () => {
  const page = visit({ withControl: false });
  page.ready();
  page.system(true);
  appearance(page, 'system', true);
});
