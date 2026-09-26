const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readWeather, conditions, weatherIcon } = require('../daylight.js');
const noon = Date.parse('2026-09-26T09:00:00Z');
const sample = (now = noon) => ({
  current: { time: now / 1000, temperature_2m: 14.6, wind_speed_10m: 1.8, weather_code: 3 },
  current_units: { temperature_2m: '°C', wind_speed_10m: 'm/s' },
  daily: { time: [Date.parse('2026-09-25T21:00:00Z') / 1000], sunrise: [Date.parse('2026-09-26T03:00:00Z') / 1000], sunset: [Date.parse('2026-09-26T15:00:00Z') / 1000] }
});
test('daylight uses Moscow dates and Unix seconds, regardless of visitor timezone', () => {
  const current = readWeather(sample(), noon);
  assert.equal(current.phase, 'day');
  assert.equal(current.progress, 0.5);
  assert.equal(current.temperature, 15);
  assert.equal(current.wind, 1.8);
});
test('rejects missing, null, stale, or wrongly labelled weather instead of presenting zero', () => {
  assert.equal(readWeather({}, noon), null);
  const broken = sample(); broken.current.temperature_2m = null;
  assert.equal(readWeather(broken, noon), null);
  assert.equal(readWeather(sample(), noon + 4 * 60 * 60 * 1000), null);
  const wrongUnits = sample(); wrongUnits.current_units.wind_speed_10m = 'km/h';
  assert.equal(readWeather(wrongUnits, noon), null);
  const missingSun = sample(); missingSun.daily.sunset = [];
  assert.equal(readWeather(missingSun, noon), null);
});
test('sun arc is bounded and night has its own state', () => {
  const early = Date.parse('2026-09-26T01:00:00Z');
  const late = Date.parse('2026-09-26T18:00:00Z');
  assert.equal(readWeather(sample(early), early).progress, 0);
  assert.equal(readWeather(sample(early), early).night, true);
  assert.equal(readWeather(sample(late), late).progress, 1);
  assert.equal(readWeather(sample(late), late).phase, 'night');
});
test('weather words distinguish sun, rain, snow and storms', () => {
  assert.equal(conditions(0), 'ясно');
  assert.equal(conditions(61), 'дождь');
  assert.equal(conditions(73), 'снег');
  assert.equal(conditions(95), 'гроза');
});
test('weather symbols follow the reported condition and clear nights never show a sun', () => {
  assert.equal(weatherIcon(0), 'sun');
  assert.equal(weatherIcon(0, true), 'moon');
  assert.equal(weatherIcon(2), 'partly-cloudy');
  assert.equal(weatherIcon(2, true), 'cloudy-night');
  assert.equal(weatherIcon(3), 'cloud');
  assert.equal(weatherIcon(45), 'fog');
  for (const code of [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]) assert.equal(weatherIcon(code), 'rain');
  for (const code of [71, 73, 75, 77, 85, 86]) assert.equal(weatherIcon(code), 'snow');
  for (const code of [95, 96, 99]) assert.equal(weatherIcon(code), 'storm');
});
