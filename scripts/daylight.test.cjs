const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readWeather, daylightWindow, conditions, weatherIcon, atmosphere, conditionCode } = require('../daylight.js');
const noon = Date.parse('2026-09-26T09:00:00Z');
const { sample, sunDay } = require('./weather-fixture.cjs');
test('daylight uses Moscow dates and ISO timestamps, regardless of visitor timezone', () => {
  const current = readWeather(sample(), noon);
  assert.equal(current.phase, 'day');
  assert.equal(current.progress, 0.5);
  assert.equal(current.temperature, 15);
  assert.equal(current.wind, 1.8);
});
test('rejects missing, null, stale, or wrongly labelled weather instead of presenting zero', () => {
  assert.equal(readWeather({}, noon), null);
  const broken = sample(); broken.forecast.properties.timeseries[0].data.instant.details.air_temperature = null;
  assert.equal(readWeather(broken, noon), null);
  assert.equal(readWeather(sample(), noon + 4 * 60 * 60 * 1000), null);
  const wrongUnits = sample(); wrongUnits.forecast.properties.meta.units.wind_speed = 'km/h';
  assert.equal(readWeather(wrongUnits, noon), null);
  const missingSun = sample(); missingSun.sun[0].properties.sunset.time = null;
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
  twoDays.sun.push(sunDay('2026-09-27'));
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

test('cloud percentage controls the shared material and malformed values are rejected', () => {
  const clear = sample(); clear.forecast.properties.timeseries[0].data.instant.details.cloud_area_fraction = 0;
  const overcast = sample(); overcast.forecast.properties.timeseries[0].data.instant.details.cloud_area_fraction = 100;
  const sun = atmosphere(readWeather(clear, noon));
  const cloud = atmosphere(readWeather(overcast, noon));
  assert.ok(cloud.opacity > sun.opacity);
  assert.ok(cloud.blur > sun.blur);
  assert.ok(cloud.tintShare < sun.tintShare);
  assert.ok(cloud.saturation < sun.saturation);
  assert.equal(readWeather(sample(), noon).cloudCover, 100);
  clear.forecast.properties.timeseries[0].data.instant.details.cloud_area_fraction = 200;
  assert.equal(readWeather(clear, noon), null);
  clear.forecast.properties.timeseries[0].data.instant.details.cloud_area_fraction = null;
  assert.equal(readWeather(clear, noon), null);
});
test('light follows the Moscow sun while stale weather has no material or wind effect', () => {
  const morning = Date.parse('2026-09-26T03:30:00Z');
  const evening = Date.parse('2026-09-26T14:30:00Z');
  const night = Date.parse('2026-09-26T18:00:00Z');
  const colours = [morning, noon, evening, night].map(now => atmosphere(readWeather(sample(now), now)).tint);
  assert.equal(new Set(colours).size, 4);
  assert.equal(atmosphere(readWeather(sample(), noon + 4 * 60 * 60 * 1000)), null);
});
test('light changes continuously through dawn, sunset and the former phase boundaries', () => {
  const sunrise = Date.parse('2026-09-26T03:00:00Z');
  const sunset = Date.parse('2026-09-26T15:00:00Z');
  const channels = colour => [1, 3, 5].map(offset => parseInt(colour.slice(offset, offset + 2), 16));
  const light = now => readWeather(sample(now), now);
  const boundaries = [sunrise - 3600000, sunrise, sunrise + .12 * (sunset - sunrise),
    sunrise + .2 * (sunset - sunrise), sunrise + .8 * (sunset - sunrise),
    sunrise + .85 * (sunset - sunrise), sunset, sunset + 3600000];
  for (const boundary of boundaries) {
    for (const property of ['skyTint', 'skyPaper']) {
      const before = channels(light(boundary - 1000)[property]);
      const after = channels(light(boundary + 1000)[property]);
      assert.ok(before.every((value, i) => Math.abs(value - after[i]) <= 1), `${property} jumps at ${new Date(boundary).toISOString()}`);
    }
  }
  assert.equal(light(sunrise - 3600000).skyTint, '#aaa5e8');
  assert.equal(light(sunrise).skyTint, '#ffc99b');
  assert.equal(light(noon).skyTint, '#a9dbe3');
  assert.equal(light(sunset).skyTint, '#ffb8d2');
  assert.equal(light(sunset + 3600000).skyTint, '#aaa5e8');
  assert.notEqual(light(sunrise - 1800000).skyTint, light(sunrise).skyTint);
  assert.notEqual(light(sunset + 1800000).skyTint, light(sunset).skyTint);
});
test('a changed sunrise shifts the light while midnight keeps the same night colour', () => {
  const morning = Date.parse('2026-09-26T04:00:00Z');
  const laterSunrise = sample(morning);
  laterSunrise.sun[0].properties.sunrise.time = '2026-09-26T07:00:00+03:00';
  assert.notEqual(readWeather(sample(morning), morning).skyTint, readWeather(laterSunrise, morning).skyTint);
  const beforeMidnight = Date.parse('2026-09-26T20:59:59Z');
  const afterMidnight = beforeMidnight + 2000;
  const next = sample(afterMidnight);
  next.sun.push(sunDay('2026-09-27'));
  assert.equal(readWeather(sample(beforeMidnight), beforeMidnight).skyTint, readWeather(next, afterMidnight).skyTint);
});
test('every chapter and accent follows the sun and clouds without a boundary jump', () => {
  const start = Date.parse('2026-09-26T00:00:00+03:00');
  const palette = (hour, cloud = 0) => {
    const now = start + hour * 3600000;
    const data = sample(now);
    data.forecast.properties.timeseries[0].data.instant.details.cloud_area_fraction = cloud;
    return readWeather(data, now).palette;
  };
  const phases = [6, 12, 18, 22].map(hour => palette(hour));
  const roles = ['water', 'acid', 'peach', 'lavender', 'rose', 'cobalt', 'paper'];
  assert.deepEqual(Object.keys(phases[0]), roles);
  for (const role of roles) {
    assert.equal(new Set(phases.map(colours => colours[role])).size, 4, role);
    assert.notEqual(palette(12)[role], palette(12, 100)[role], `${role} ignores clouds`);
    for (const hour of [5, 6, 8.4, 15.6, 18, 19]) {
      const before = palette(hour - 1 / 3600)[role];
      const after = palette(hour + 1 / 3600)[role];
      for (const offset of [1, 3, 5]) {
        assert.ok(Math.abs(parseInt(before.slice(offset, offset + 2), 16) - parseInt(after.slice(offset, offset + 2), 16)) <= 1, `${role} jumps at ${hour}`);
      }
    }
  }
});
test('editorial colour pairs keep readable contrast across the full day and cloud range', () => {
  const luminance = hex => [1, 3, 5].map(offset => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  }).reduce((sum, channel, i) => sum + channel * [.2126, .7152, .0722][i], 0);
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
  const start = Date.parse('2026-09-26T00:00:00+03:00');
  for (let minutes = 0; minutes < 1440; minutes += 15) {
    for (const cloud of [0, 25, 50, 75, 100]) {
      const now = start + minutes * 60000;
      const data = sample(now);
      data.forecast.properties.timeseries[0].data.instant.details.cloud_area_fraction = cloud;
      const colours = readWeather(data, now).palette;
      const pairs = [
        ...['water', 'acid', 'peach', 'lavender', 'rose', 'paper'].map(role => [role, '#101216', colours[role]]),
        ['coach body', '#ffffff', colours.cobalt], ['coach accent', colours.acid, colours.cobalt],
        ['tarot secondary', '#51424b', colours.rose]
      ];
      for (const [role, ink, background] of pairs) {
        assert.ok(contrast(ink, background) >= 4.5, `${role}: ${contrast(ink, background).toFixed(2)} at minute ${minutes}, cloud ${cloud}`);
      }
    }
  }
});
test('calm air stays still and extreme wind cannot create a large or long animation', () => {
  const data = sample();
  data.forecast.properties.timeseries[0].data.instant.details.wind_speed = 0;
  assert.equal(atmosphere(readWeather(data, noon)).sway, 0);
  data.forecast.properties.timeseries[0].data.instant.details.wind_speed = 2;
  const mild = atmosphere(readWeather(data, noon));
  data.forecast.properties.timeseries[0].data.instant.details.wind_speed = 80;
  const strong = atmosphere(readWeather(data, noon));
  assert.ok(strong.sway > mild.sway);
  assert.ok(strong.sway <= 1.1);
  assert.ok(strong.duration < mild.duration);
  assert.ok(mild.duration + 280 < 5000);
  data.forecast.properties.timeseries[0].data.instant.details.wind_speed = -1;
  assert.equal(readWeather(data, noon), null);
});

test('MET Norway symbols distinguish sleet and thunderstorms, including night variants', () => {
  assert.equal(conditionCode('clearsky_night'), 0);
  assert.equal(conditionCode('fair_day'), 1);
  assert.equal(conditionCode('partlycloudy_polartwilight'), 2);
  assert.equal(conditions(conditionCode('lightsleetshowers_day')), 'дождь со снегом');
  assert.equal(weatherIcon(conditionCode('heavysnowandthunder')), 'storm');
  assert.equal(conditionCode('unknown_condition'), null);
});
test('cached forecasts advance to the current hour but old models and unknown symbols are rejected', () => {
  const data = sample();
  const next = structuredClone(data.forecast.properties.timeseries[0]);
  next.time = new Date(noon + 3600000).toISOString();
  next.data.instant.details.air_temperature = 20;
  data.forecast.properties.timeseries.push(next);
  assert.equal(readWeather(data, noon + 3600000).temperature, 20);
  data.forecast.properties.meta.updated_at = new Date(noon - 13 * 3600000).toISOString();
  assert.equal(readWeather(data, noon), null);
  const unknown = sample();
  unknown.forecast.properties.timeseries[0].data.next_1_hours.summary.symbol_code = 'unknown';
  assert.equal(readWeather(unknown, noon), null);
});
test('the Moscow calendar rolls over before UTC and selects the correct sunrise', () => {
  const midnight = Date.parse('2026-09-26T21:05:00Z');
  const data = sample(midnight);
  data.sun.push(sunDay('2026-09-27'));
  const weather = readWeather(data, midnight);
  assert.equal(weather.sunrise, Date.parse('2026-09-27T03:00:00Z'));
  assert.equal(weather.phase, 'night');
});
