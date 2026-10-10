const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSpread, disciplines, omens, formats, art, sportArt, formatArt, reading, storyName, type } = require('../tarot.js');
const { readFileSync } = require('node:fs');
const path = require('node:path');

test('every format belongs to the drawn discipline, including random boundaries', () => {
  for (const randomValue of [0, 0.01, 0.15, 0.3, 0.5, 0.75, 0.999999]) {
    const spread = createSpread(() => randomValue);
    assert.ok(disciplines.includes(spread.sport));
    assert.ok(spread.sport.formats.includes(spread.format));
    assert.ok(omens.includes(spread.omen));
  }
});
test('a new deal changes both the discipline and the omen even with the same random number', () => {
  let previous = createSpread(() => 0);
  for (let i = 0; i < 100; i++) {
    const next = createSpread(() => 0, previous);
    assert.notEqual(next.sport.id, previous.sport.id);
    assert.notEqual(next.omen.id, previous.omen.id);
    assert.ok(next.sport.formats.includes(next.format));
    previous = next;
  }
});
test('all disciplines and omens can be drawn', () => {
  const sports = new Set();
  const signs = new Set();
  for (let i = 0; i < 1000; i++) {
    const spread = createSpread(() => i / 1000);
    sports.add(spread.sport.id);
    signs.add(spread.omen.id);
  }
  assert.equal(sports.size, disciplines.length);
  assert.equal(signs.size, omens.length);
});
test('short prepositions stay with the next word without changing words', () => {
  assert.equal(type('На финише вы снова в игре.'), 'На\u00a0финише вы снова в\u00a0игре.');
  const text = 'Кроссовки, номер — и на старт!';
  const typeset = 'Кроссовки, номер\u00a0— и\u00a0на\u00a0старт!';
  assert.equal(type(text), typeset);
  assert.equal(type(typeset), typeset);
});

test('all 224 compatible readings have specific copy and distinct export names', () => {
  const names = new Set();
  const descriptions = new Set();
  for (const sport of disciplines) {
    for (const format of sport.formats) {
      assert.equal(formats[format].length, 2);
      descriptions.add(formats[format][0]);
      for (const omen of omens) {
        const spread = { sport, format, omen };
        assert.ok(reading(spread).length > 80);
        assert.ok(!reading(spread).includes('undefined'));
        names.add(storyName(spread));
      }
    }
  }
  assert.equal(descriptions.size, 28);
  assert.equal(names.size, 224);
});

test('every drawn face uses a local SVG with the same coordinate system', () => {
  for (const source of [...Object.values(art), ...Object.values(sportArt), formatArt]) {
    const text = readFileSync(path.join(__dirname, '..', source.split('?')[0]), 'utf8');
    assert.match(text, /viewBox="0 0 256 256"/);
    assert.ok(!/<script|<foreignObject|href="https?:/i.test(text));
  }
  assert.notEqual(sportArt.swimrun, sportArt.duathlon);
});
