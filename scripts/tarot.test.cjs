const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSpread, disciplines, omens, type } = require('../tarot.js');

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
});
