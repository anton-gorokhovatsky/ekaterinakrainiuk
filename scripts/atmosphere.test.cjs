const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');

const source = readFileSync(resolve(__dirname, '../daylight.js'), 'utf8');
function visit({ reduced = false } = {}) {
  let now = Date.parse('2026-09-26T09:00:00Z');
  const events = {}, material = new Map(), nodes = new Map(), animations = [];
  const node = () => ({ textContent: '', style: { setProperty() {}, removeProperty() {} }, setAttribute() {} });
  const root = { ...node(), toggleAttribute() {}, removeAttribute() {}, querySelector: selector => {
    if (!nodes.has(selector)) nodes.set(selector, node());
    return nodes.get(selector);
  } };
  const media = { matches: reduced, addEventListener: (_, fn) => { events.motion = fn; } };
  const cards = Array.from({ length: 3 }, () => ({ animate: (frames, timing) => {
    const animation = { frames, timing, cancelled: false, cancel() { this.cancelled = true; } };
    animations.push(animation);
    return animation;
  } }));
  const deck = { hovered: false, focused: false, querySelectorAll: () => cards,
    matches() { return this.hovered; }, contains() { return this.focused; },
    addEventListener: (name, fn) => { events[name] = fn; } };
  const document = { hidden: false, activeElement: null,
    documentElement: { dataset: { theme: 'dark' }, style: {
      setProperty: (name, value) => material.set(name, value), removeProperty: name => material.delete(name)
    } },
    querySelector: selector => selector === '#daylight' ? root : deck,
    addEventListener: (name, fn) => { events[name] = fn; }
  };
  const data = {
    current: { time: now / 1000, temperature_2m: 15, wind_speed_10m: 4, weather_code: 2, cloud_cover: 65 },
    current_units: { temperature_2m: '°C', wind_speed_10m: 'm/s', cloud_cover: '%' },
    daily: { time: [(now - 12 * 60 * 60 * 1000) / 1000], sunrise: [(now - 6 * 60 * 60 * 1000) / 1000], sunset: [(now + 6 * 60 * 60 * 1000) / 1000] }
  };
  runInNewContext(source, { document, window: { matchMedia: () => media }, Intl, Number, Math,
    Date: class extends Date { static now() { return now; } },
    sessionStorage: { getItem: () => JSON.stringify({ saved: now, data }) },
    IntersectionObserver: class { constructor(callback) { events.intersection = callback; } observe() {} },
    setInterval: callback => { events.tick = callback; }, setTimeout, clearTimeout, AbortController,
    fetch: async () => ({ ok: false })
  });
  return { document, deck, material, animations,
    enter: () => events.intersection([{ isIntersecting: true, intersectionRatio: .5 }]),
    leave: () => events.intersection([{ isIntersecting: false, intersectionRatio: 0 }]),
    reduce: () => { media.matches = true; events.motion(); },
    hide: () => { document.hidden = true; events.visibilitychange(); },
    interact: name => events[name](),
    expire: () => { now += 4 * 60 * 60 * 1000; events.visibilitychange(); },
    tick: () => events.tick()
  };
}
test('shared weather material preserves the explicit theme and clears stale values', () => {
  const page = visit();
  assert.equal(page.material.size, 5);
  assert.equal(page.document.documentElement.dataset.theme, 'dark');
  page.enter();
  page.expire();
  assert.equal(page.material.size, 0);
  assert.ok(page.animations.every(animation => animation.cancelled));
});
test('the deck gets one bounded gust per entrance, never a recurring idle animation', () => {
  const page = visit();
  assert.equal(page.animations.length, 0);
  page.enter();
  assert.equal(page.animations.length, 3);
  for (const { frames, timing } of page.animations) {
    assert.equal(frames[0].rotate, '0deg');
    assert.equal(frames.at(-1).rotate, '0deg');
    assert.ok(timing.duration + timing.delay < 5000);
  }
  page.tick(); page.enter();
  assert.equal(page.animations.length, 3);
  page.leave();
  assert.ok(page.animations.every(animation => animation.cancelled));
  page.enter();
  assert.equal(page.animations.length, 6);
});
test('reduced motion, interaction and hidden tabs stop decorative wind immediately', () => {
  const reduced = visit({ reduced: true }); reduced.enter();
  assert.equal(reduced.animations.length, 0);
  const hovered = visit(); hovered.deck.hovered = true; hovered.enter();
  assert.equal(hovered.animations.length, 0);
  const focused = visit(); focused.deck.focused = true; focused.enter();
  assert.equal(focused.animations.length, 0);
  for (const stop of [page => page.reduce(), page => page.hide(), ...['pointerenter', 'pointerdown', 'focusin'].map(name => page => page.interact(name))]) {
    const page = visit(); page.enter(); stop(page);
    assert.ok(page.animations.every(animation => animation.cancelled));
  }
});
