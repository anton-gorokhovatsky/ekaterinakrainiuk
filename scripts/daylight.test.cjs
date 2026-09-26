const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readWeather, daylightWindow, conditions, weatherIcon, atmosphere } = require('../daylight.js');
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
test('daylight countdown switches to the next sunrise at sunset', () => {
  const early = Date.parse('2026-09-26T02:00:00Z');
  assert.deepEqual(daylightWindow(readWeather(sample(early), early), early), { label: 'До рассвета', value: '1 ч 00 мин' });
  assert.deepEqual(daylightWindow(readWeather(sample(), noon), noon), { label: 'До заката', value: '6 ч 00 мин' });
  const lastMinute = Date.parse('2026-09-26T14:59:30Z');
  assert.equal(daylightWindow(readWeather(sample(lastMinute), lastMinute), lastMinute).value, '1 мин');
  const sunset = Date.parse('2026-09-26T15:00:00Z');
  const twoDays = sample(sunset);
  twoDays.daily.sunrise.push(Date.parse('2026-09-27T03:00:00Z') / 1000);
  assert.deepEqual(daylightWindow(readWeather(twoDays, sunset), sunset), { label: 'До рассвета', value: '12 ч 00 мин' });
  assert.deepEqual(daylightWindow(readWeather(sample(sunset), sunset), sunset), { label: 'Световой день', value: 'Завершён' });
  assert.deepEqual(daylightWindow(null), { label: 'Световой день', value: 'Нет данных' });
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

test('cloud percentage controls the shared material, with safe older-cache fallback', () => {
  const clear = sample(); clear.current.cloud_cover = 0; clear.current_units.cloud_cover = '%';
  const overcast = sample(); overcast.current.cloud_cover = 100; overcast.current_units.cloud_cover = '%';
  const sun = atmosphere(readWeather(clear, noon));
  const cloud = atmosphere(readWeather(overcast, noon));
  assert.ok(cloud.opacity > sun.opacity);
  assert.ok(cloud.blur > sun.blur);
  assert.ok(cloud.tintShare < sun.tintShare);
  assert.ok(cloud.saturation < sun.saturation);
  assert.equal(readWeather(sample(), noon).cloudCover, 100);
  clear.current.cloud_cover = 200;
  assert.equal(readWeather(clear, noon).cloudCover, 100);
  clear.current.cloud_cover = null;
  assert.equal(readWeather(clear, noon).cloudCover, 100);
});
test('light follows the Moscow sun while stale weather has no material or wind effect', () => {
  const morning = Date.parse('2026-09-26T03:30:00Z');
  const evening = Date.parse('2026-09-26T14:30:00Z');
  const night = Date.parse('2026-09-26T18:00:00Z');
  const colours = [morning, noon, evening, night].map(now => atmosphere(readWeather(sample(now), now)).tint);
  assert.equal(new Set(colours).size, 4);
  assert.equal(atmosphere(readWeather(sample(), noon + 4 * 60 * 60 * 1000)), null);
});
test('calm air stays still and extreme wind cannot create a large or long animation', () => {
  const data = sample();
  data.current.wind_speed_10m = 0;
  assert.equal(atmosphere(readWeather(data, noon)).sway, 0);
  data.current.wind_speed_10m = 2;
  const mild = atmosphere(readWeather(data, noon));
  data.current.wind_speed_10m = 80;
  const strong = atmosphere(readWeather(data, noon));
  assert.ok(strong.sway > mild.sway);
  assert.ok(strong.sway <= 1.1);
  assert.ok(strong.duration < mild.duration);
  assert.ok(mild.duration + 280 < 5000);
  data.current.wind_speed_10m = -1;
  assert.equal(readWeather(data, noon), null);
});
