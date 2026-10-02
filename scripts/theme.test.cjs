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
  const summary = {
    label: '', focused: false,
    setAttribute: (_, value) => { summary.label = value; },
    focus: () => { summary.focused = true; },
  };
  const options = ['system', 'light', 'dark'].map(value => ({
    value, checked: false,
    addEventListener: (_, handler) => { events[value] = handler; },
  }));
  const picker = {
    hidden: true, open: false,
    querySelector: () => summary,
    querySelectorAll: () => options,
    contains: target => target === summary || options.includes(target),
  };
  const media = {
    matches: dark,
    addEventListener: (_, handler) => { events.system = handler; },
  };
  const storage = new Map(stored === null ? [] : [[key, stored]]);
  runInNewContext(source, {
    document: {
      documentElement: root,
      querySelectorAll: () => colors,
      querySelector: selector => withControl ? (selector === '#theme-choice' ? select : picker) : null,
      addEventListener: (name, handler) => { events[name] = handler; },
    },
    window: {
      matchMedia: query => query.includes('prefers-color-scheme') ? media : {
        addEventListener: (_, handler) => { events.breakpoint = handler; },
      },
      addEventListener: (name, handler) => { events[name] = handler; },
    },
    localStorage: {
      getItem: (name) => { if (blocked) throw Error('Storage blocked'); return storage.get(name); },
      setItem: (name, value) => { if (blocked) throw Error('Storage blocked'); storage.set(name, value); },
    },
  });
  return {
    root, select, control, colors, storage, picker, summary, options,
    ready: () => events.DOMContentLoaded(),
    choose: (value) => { select.value = value; events.change(); },
    chooseDesktop: value => {
      options.forEach(option => { option.checked = option.value === value; });
      events[value]();
    },
    leavePicker: (target, type = 'pointerdown') => events[type]({ target }),
    escape: () => events.keydown({ key: 'Escape', preventDefault() {} }),
    resize: () => events.breakpoint(),
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

test('desktop choices, mobile select and another tab keep one saved theme', () => {
  const page = visit({ stored: 'dark' });
  page.ready();
  assert.equal(page.picker.hidden, false);
  assert.equal(page.options.find(option => option.checked).value, 'dark');
  page.chooseDesktop('light');
  appearance(page, 'light', false);
  assert.equal(page.select.value, 'light');
  assert.equal(page.storage.get(key), 'light');
  assert.equal(page.summary.label, 'Тема сайта: Светлая');
  page.choose('system');
  assert.equal(page.options.find(option => option.checked).value, 'system');
  page.sync('dark');
  assert.equal(page.options.find(option => option.checked).value, 'dark');
  assert.equal(page.select.value, 'dark');
});

test('picker remains open while choosing, and closes on Escape, outside focus or layout change', () => {
  const page = visit();
  page.ready();
  page.picker.open = true;
  page.chooseDesktop('dark');
  page.leavePicker(page.options[2]);
  assert.equal(page.picker.open, true);
  page.escape();
  assert.equal(page.picker.open, false);
  assert.equal(page.summary.focused, true);
  for (const type of ['pointerdown', 'focusin']) {
    page.picker.open = true;
    page.leavePicker({}, type);
    assert.equal(page.picker.open, false);
  }
  page.picker.open = true;
  page.resize();
  assert.equal(page.picker.open, false);
});
