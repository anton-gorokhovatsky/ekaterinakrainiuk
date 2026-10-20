/* Moscow is the training city, not a claim about Katya's current location. */
(() => {
  'use strict';
  const HOUR = 60 * 60 * 1000;
  const MAX_AGE = 12 * HOUR; // The global forecast model is updated several times a day.
  const CACHE_KEY = 'katya-met-norway-v2';
  const clock = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' });
  const calendar = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' });
  const skyColours = { morning: '#ffc99b', day: '#a9dbe3', evening: '#ffb8d2', night: '#aaa5e8' };
  const paperColours = { morning: '#ffcfaa', day: '#cee4ec', evening: '#edb6d7', night: '#c2b6e8' };
  // Each chapter keeps its colour family throughout the same solar cycle.
  // The neutral cloud colour respects the role's lightness, especially cobalt.
  const paletteColours = {
    water: { morning: '#b9d7d4', day: '#a9dbe3', evening: '#b9cbdc', night: '#91bbc9', cloud: '#b9c3c8' },
    acid: { morning: '#eef29a', day: '#e9ff64', evening: '#f4dd88', night: '#d0dd85', cloud: '#c9ccae' },
    peach: { morning: '#ffc29b', day: '#ffb08b', evening: '#efa394', night: '#dfa592', cloud: '#c9b9b1' },
    lavender: { morning: '#d5c4ef', day: '#c4b9ff', evening: '#cbb0e6', night: '#b2a5d7', cloud: '#bdbacb' },
    rose: { morning: '#f5c1ce', day: '#ffb8d2', evening: '#efa8c2', night: '#dfa9c3', cloud: '#c9b8c0' },
    cobalt: { morning: '#364ccf', day: '#234ce8', evening: '#4543c4', night: '#293b88', cloud: '#425173' },
    paper: { morning: '#f6eee1', day: '#f4f3ee', evening: '#f4e7e8', night: '#e7e1ea', cloud: '#dde0e3' }
  };
  const coldColours = { water: '#b6e0e8', acid: '#dbe9a1', peach: '#e8bbb3', lavender: '#c5ccec', rose: '#e5c3d2', cobalt: '#344b80', paper: '#edf4f5' };
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
  function solarPosition(now, latitude = 55.7558, longitude = 37.6173) {
    // NOAA's approximate solar equations, in UTC: no visitor location or request.
    // https://gml.noaa.gov/grad/solcalc/solareqns.PDF
    const date = new Date(now);
    const year = date.getUTCFullYear();
    const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / (24 * HOUR);
    const day = Math.floor((now - Date.UTC(year, 0, 1)) / (24 * HOUR)) + 1;
    const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    const gamma = 2 * Math.PI / days * (day - 1 + (hour - 12) / 24);
    const equation = 229.18 * (.000075 + .001868 * Math.cos(gamma) - .032077 * Math.sin(gamma) - .014615 * Math.cos(2 * gamma) - .040849 * Math.sin(2 * gamma));
    const declination = .006918 - .399912 * Math.cos(gamma) + .070257 * Math.sin(gamma) - .006758 * Math.cos(2 * gamma) + .000907 * Math.sin(2 * gamma) - .002697 * Math.cos(3 * gamma) + .00148 * Math.sin(3 * gamma);
    const radians = Math.PI / 180;
    const lat = latitude * radians;
    const angle = ((hour * 60 + equation + 4 * longitude) / 4 - 180) * radians;
    const altitude = Math.asin(Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(angle));
    const azimuth = Math.atan2(Math.sin(angle), Math.cos(angle) * Math.sin(lat) - Math.tan(declination) * Math.cos(lat));
    return { altitude: altitude / radians, azimuth: (azimuth / radians + 540) % 360 };
  }
  function lightConditions(current) {
    const fog = Math.max(current.code === 45 ? 1 : 0, Number.isFinite(current.fogCover) ? current.fogCover / 100 : 0);
    const rain = current.wetPrecipitation && Number.isFinite(current.precipitation) ? smooth(current.precipitation / 2.4) : 0;
    // Forecast coverage is an artistic diffusion input, not optical transmission.
    const diffusion = 1 - (1 - .95 * current.cloudCover / 100) * (1 - fog) * (1 - .7 * rain);
    const cold = Math.max(current.code === 73 ? 1 : current.code === 68 ? .5 : 0, smooth(-current.temperature / 15));
    return { diffusion, cold };
  }
  function cardLighting(current) {
    if (!current) return null;
    const { diffusion } = lightConditions(current);
    const { altitude, azimuth } = current.sun;
    const direct = current.night ? 0 : smooth(altitude / 8) * (1 - diffusion);
    const angle = azimuth * Math.PI / 180;
    // A card only a few pixels above the surface, capped near the horizon.
    const reach = Math.min(22, 3 / Math.tan(Math.max(5, altitude) * Math.PI / 180));
    // Screen convention: morning light from the left, noon above, evening right.
    // The card keeps its authored tilt; only its shadow responds to the sun.
    return {
      x: direct ? reach * Math.sin(angle) * direct : 0,
      y: 2 + reach * (.45 + .55 * Math.max(0, -Math.cos(angle))) * direct,
      blur: 6 + 14 * diffusion + 4 * (1 - direct),
      opacity: .025 + .145 * direct
    };
  }
  function mixColour(from, to, blend) {
    return '#' + [1, 3, 5].map(offset => {
      const a = parseInt(from.slice(offset, offset + 2), 16);
      const b = parseInt(to.slice(offset, offset + 2), 16);
      return Math.round(a + (b - a) * blend).toString(16).padStart(2, '0');
    }).join('');
  }
  function skyColour(colours, sunrise, sunset, now) {
    const day = sunset - sunrise;
    // A stylised light cycle anchored to the actual Moscow sunrise and sunset.
    // Ease into each colour so neither dawn nor dusk introduces a palette jump.
    const stops = [
      [sunrise - HOUR, colours.night], [sunrise, colours.morning],
      [sunrise + day * .2, colours.day], [sunset - day * .2, colours.day],
      [sunset, colours.evening], [sunset + HOUR, colours.night]
    ];
    if (now <= stops[0][0]) return stops[0][1];
    for (let index = 1; index < stops.length; index++) {
      const [end, to] = stops[index];
      if (now > end) continue;
      const [start, from] = stops[index - 1];
      const progress = (now - start) / (end - start);
      const blend = progress * progress * (3 - 2 * progress);
      return mixColour(from, to, blend);
    }
    return colours.night;
  }
  function conditionCode(symbol) {
    if (typeof symbol !== 'string') return null;
    const name = symbol.replace(/_(day|night|polartwilight)$/, '');
    if (name.includes('thunder')) return 95;
    if (name.includes('sleet')) return 68;
    if (name.includes('snow')) return 73;
    if (name.includes('rain')) return 61;
    return { clearsky: 0, fair: 1, partlycloudy: 2, cloudy: 3, fog: 45 }[name] ?? null;
  }
  function readWeather(data, now = Date.now()) {
    const forecast = data?.forecast?.properties;
    const updated = Date.parse(forecast?.meta?.updated_at);
    if (!Number.isFinite(updated) || now - updated > MAX_AGE || updated - now > 5 * 60000) return null;
    const units = forecast.meta.units;
    if (units?.wind_speed !== 'm/s' || units?.air_temperature !== 'celsius' || units?.cloud_area_fraction !== '%') return null;
    if (!Array.isArray(forecast.timeseries) || !Array.isArray(data.sun)) return null;
    // Select the current forecast hour again on each render, including cached responses.
    const frame = forecast.timeseries.reduce((latest, item) => {
      const time = Date.parse(item?.time);
      return time <= now && (!latest || time > Date.parse(latest.time)) ? item : latest;
    }, null);
    const observed = Date.parse(frame?.time);
    if (!Number.isFinite(observed) || now - observed > HOUR + 5 * 60000) return null;
    const current = frame.data?.instant?.details;
    const nextHour = frame.data?.next_1_hours;
    const symbol = nextHour?.summary?.symbol_code;
    const code = conditionCode(symbol);
    if (!current || ![current.air_temperature, current.wind_speed, current.cloud_area_fraction, code].every(Number.isFinite)) return null;
    if (current.wind_speed < 0 || current.cloud_area_fraction < 0 || current.cloud_area_fraction > 100) return null;
    const days = data.sun.map(day => ({ sunrise: Date.parse(day?.properties?.sunrise?.time), sunset: Date.parse(day?.properties?.sunset?.time) }));
    const today = days.find(day => Number.isFinite(day.sunrise) && calendar.format(day.sunrise) === calendar.format(now));
    const sunrise = today?.sunrise;
    const sunset = today?.sunset;
    if (!Number.isFinite(sunrise) || !Number.isFinite(sunset) || sunset <= sunrise) return null;
    const progress = Math.max(0, Math.min(1, (now - sunrise) / (sunset - sunrise)));
    const night = now < sunrise || now >= sunset;
    const nextSunrise = days.map(day => day.sunrise).filter(time => Number.isFinite(time) && time > now).sort((a, b) => a - b)[0];
    const phase = night ? 'night' : progress < .12 ? 'morning' : progress > .85 ? 'evening' : 'day';
    // Optional material inputs must not make an otherwise useful forecast fail.
    // Keep absent values distinct from a genuine 0% humidity or 0 mm of rain.
    const humidity = units.relative_humidity === '%' && Number.isFinite(current.relative_humidity) && current.relative_humidity >= 0 && current.relative_humidity <= 100 ? current.relative_humidity : null;
    const apparentTemperature = units.apparent_air_temperature === 'celsius' && Number.isFinite(current.apparent_air_temperature) ? current.apparent_air_temperature : null;
    const fogCover = units.fog_area_fraction === '%' && Number.isFinite(current.fog_area_fraction) && current.fog_area_fraction >= 0 && current.fog_area_fraction <= 100 ? current.fog_area_fraction : null;
    const amount = nextHour?.details?.precipitation_amount;
    const precipitation = units.precipitation_amount === 'mm' && Number.isFinite(amount) && amount >= 0 ? amount : null;
    // Precipitation amount also includes snow. Only rain/sleet can strengthen
    // the wet-glass effect; snow retains the independent humidity response.
    const wetPrecipitation = /rain|sleet/.test(symbol);
    const light = lightConditions({ cloudCover: current.cloud_area_fraction, code, fogCover, precipitation, wetPrecipitation, temperature: current.air_temperature });
    const diffuseColour = colour => mixColour(colour, '#bdc9d4', light.diffusion * .28);
    return { temperature: Math.round(current.air_temperature), wind: current.wind_speed, cloudCover: current.cloud_area_fraction, code, observed, updated, sunrise, sunset, nextSunrise, progress, phase, night,
      humidity, apparentTemperature, fogCover, precipitation, wetPrecipitation, sun: solarPosition(now),
      skyTint: mixColour(diffuseColour(skyColour(skyColours, sunrise, sunset, now)), '#c5e4ed', light.cold * .18),
      skyPaper: mixColour(diffuseColour(skyColour(paperColours, sunrise, sunset, now)), '#edf4f5', light.cold * .18),
      palette: Object.fromEntries(Object.entries(paletteColours).map(([role, colours]) =>
        [role, mixColour(mixColour(skyColour(colours, sunrise, sunset, now), colours.cloud, light.diffusion * .32), coldColours[role], light.cold * .18)])) };
  }
  function coverAtmosphere(current) {
    if (!current) return null;
    // Sun and fog can coexist. Humidity/fog add a light veil without blurring
    // photographic detail; only liquid precipitation softens the image.
    const humid = Number.isFinite(current.humidity) ? smooth((current.humidity - 65) / 20) : 0;
    const fog = Math.max(current.code === 45 ? 1 : 0, Number.isFinite(current.fogCover) ? current.fogCover / 100 : 0);
    const veil = Math.max(humid, fog);
    const rain = current.wetPrecipitation && Number.isFinite(current.precipitation) ? smooth(current.precipitation / 2.4) : 0;
    return {
      blur: (2.4 + 1.6 * humid) * rain,
      saturation: 1 - .02 * veil - (.07 * humid + .11) * rain,
      haze: .06 * veil + .07 * rain,
      halo: 2 * veil + 2 * rain,
      haloOpacity: .3 * veil + .2 * rain
    };
  }
  function atmosphere(current) {
    if (!current) return null;
    const cloud = current.cloudCover / 100;
    const wind = Math.max(0, Math.min(1, current.wind / 8));
    return {
      tint: current.skyTint,
      tintShare: 16 - 7 * cloud,
      opacity: 84 + 4 * cloud,
      blur: 20 + 8 * cloud,
      saturation: 1 - .2 * cloud,
      sway: current.wind < .5 ? 0 : .25 + .85 * wind,
      duration: 4400 - 1000 * wind
    };
  }
  function daylightWindow(current, now = Date.now()) {
    if (!current) return { label: 'Световой день', value: 'Нет данных' };
    const target = current.night ? current.nextSunrise : current.sunset;
    const label = current.night ? 'До восхода' : 'До заката';
    return { label, value: Number.isFinite(target) && target > now ? durationText(target - now) : 'Нет данных о восходе' };
  }
  function conditions(code) {
    if (code === 0) return 'ясно';
    if (code <= 2) return 'переменная облачность';
    if (code === 3) return 'пасмурно';
    if (code <= 48) return 'туман';
    if (code <= 57) return 'морось';
    if (code <= 67) return 'дождь';
    if (code === 68) return 'дождь со снегом';
    if (code <= 77) return 'снег';
    if (code <= 82) return 'ливень';
    if (code <= 86) return 'снегопад';
    return 'гроза';
  }
  function weatherIcon(code, night = false) {
    const icons = { 'ясно': night ? 'moon' : 'sun', 'переменная облачность': night ? 'cloudy-night' : 'partly-cloudy', 'пасмурно': 'cloud', 'туман': 'fog', 'морось': 'rain', 'дождь': 'rain', 'дождь со снегом': 'snow', 'снег': 'snow', 'ливень': 'rain', 'снегопад': 'snow', 'гроза': 'storm' };
    return icons[conditions(code)] || 'cloud';
  }
  function solarCycle(days, now) {
    if (!Array.isArray(days) || !Number.isFinite(now)) return null;
    const events = days.map(day => ({
      rise: Date.parse(day?.properties?.sunrise?.time),
      set: Date.parse(day?.properties?.sunset?.time)
    })).filter(day => Number.isFinite(day.rise) && Number.isFinite(day.set) && day.set > day.rise)
      .sort((a, b) => a.rise - b.rise);
    const start = events.filter(day => day.rise <= now).at(-1);
    if (!start) return null;
    const next = events.find(day => day.rise > start.rise);
    if (!next || start.set >= next.rise || now >= next.rise || next.rise - start.rise > 26 * HOUR) return null;
    const length = next.rise - start.rise;
    const night = now >= start.set;
    const from = night ? start.set : start.rise;
    const to = night ? next.rise : start.set;
    return { start: start.rise, sunset: start.set, end: next.rise, night,
      dayShare: (start.set - start.rise) / length,
      progress: (now - start.rise) / length,
      phaseProgress: (now - from) / (to - from),
      dayDuration: start.set - start.rise, nightDuration: next.rise - start.set,
      remaining: to - now };
  }
  function cycleGeometry(cycle) {
    const start = 16, end = 624, horizon = 100;
    const split = start + (end - start) * cycle.dayShare;
    const day = `M${start} ${horizon} Q${(start + split) / 2} -60 ${split} ${horizon}`;
    const night = `M${split} ${horizon} Q${(split + end) / 2} 260 ${end} ${horizon}`;
    const p = cycle.phaseProgress;
    const from = cycle.night ? split : start;
    const to = cycle.night ? end : split;
    const direction = cycle.night ? 1 : -1;
    const x = start + (end - start) * cycle.progress;
    const y = horizon + direction * 320 * p * (1 - p);
    const part = `M${from} ${horizon} Q${from + (to - from) * p / 2} ${horizon + direction * 160 * p} ${x} ${y}`;
    return { day, night, split, x, y, trail: cycle.night ? day + ' ' + part : part };
  }
  function durationText(milliseconds) {
    const minutes = Math.max(0, Math.ceil(milliseconds / 60000));
    const hours = Math.floor(minutes / 60), rest = minutes % 60;
    return hours ? `${hours} ч${rest ? ` ${rest} мин` : ''}` : `${rest} мин`;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { readWeather, daylightWindow, conditions, weatherIcon, atmosphere, coverAtmosphere, conditionCode, solarPosition, cardLighting, solarCycle, cycleGeometry, durationText };
  if (typeof document === 'undefined') return;
  const root = document.querySelector('#daylight');
  if (!root) return;
  const get = name => root.querySelector(`[data-${name}]`);
  const environment = root;
  const material = document.documentElement.style;
  const glassProperties = ['--weather-tint', '--weather-tint-share', '--weather-opacity', '--weather-blur', '--weather-saturation'];
  const paletteProperties = Object.keys(paletteColours).map(role => `--${role}`);
  const coverProperties = ['--cover-photo-blur', '--cover-photo-saturation', '--cover-haze', '--cover-halo', '--cover-halo-opacity'];
  const shadowProperties = ['--card-shadow-x', '--card-shadow-y', '--card-shadow-blur', '--card-shadow-opacity'];
  const deck = document.querySelector('.tarot-spread');
  const cards = deck ? [...deck.querySelectorAll('.tarot-card')] : [];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let breeze = [];
  let deckVisible = false;
  let breezePlayed = false;
  let currentAtmosphere = null;
  function stopBreeze() {
    breeze.forEach(animation => animation.cancel());
    breeze = [];
  }
  function playBreeze() {
    if (!deckVisible || breezePlayed || document.hidden || reducedMotion.matches || !currentAtmosphere?.sway) return;
    if (deck.matches(':hover') || deck.contains(document.activeElement)) return;
    breezePlayed = true;
    stopBreeze();
    // A single passing gust, under five seconds including delays. Independent rotate
    // leaves the authored card angles, hover lift and inner flip untouched.
    cards.forEach((card, index) => {
      if (typeof card.animate !== 'function') return;
      const angle = currentAtmosphere.sway * (index === 1 ? -.8 : 1);
      breeze.push(card.animate([
        { rotate: '0deg', offset: 0 },
        { rotate: `${angle}deg`, offset: .25 },
        { rotate: `${-angle * .55}deg`, offset: .6 },
        { rotate: '0deg', offset: 1 }
      ], { duration: currentAtmosphere.duration, delay: index * 140, easing: 'cubic-bezier(.45,0,.55,1)' }));
    });
  }
  function updateAtmosphere(current) {
    currentAtmosphere = atmosphere(current);
    if (!currentAtmosphere) {
      [...glassProperties, ...paletteProperties, ...coverProperties, ...shadowProperties].forEach(property => material.removeProperty(property));
      stopBreeze();
      return;
    }
    const sky = currentAtmosphere;
    [sky.tint, `${sky.tintShare}%`, `${sky.opacity}%`, `${sky.blur}px`, sky.saturation].forEach((value, index) => material.setProperty(glassProperties[index], value));
    Object.entries(current.palette).forEach(([role, colour]) => material.setProperty(`--${role}`, colour));
    const cover = coverAtmosphere(current);
    [cover.blur, cover.saturation, cover.haze, cover.halo, cover.haloOpacity].forEach((value, index) => {
      material.setProperty(coverProperties[index], `${Number(value.toFixed(3))}${index === 0 || index === 3 ? 'px' : ''}`);
    });
    const shadow = cardLighting(current);
    [shadow.x, shadow.y, shadow.blur, shadow.opacity].forEach((value, index) => {
      material.setProperty(shadowProperties[index], `${Number(value.toFixed(3))}${index < 3 ? 'px' : ''}`);
    });
    playBreeze();
  }
  if (deck && typeof IntersectionObserver === 'function') {
    new IntersectionObserver(entries => {
      const visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .15;
      if (!visible) { stopBreeze(); breezePlayed = false; }
      deckVisible = visible;
      if (visible) playBreeze();
    }, { threshold: .15 }).observe(deck);
    deck.addEventListener('pointerenter', stopBreeze);
    deck.addEventListener('pointerdown', stopBreeze);
    deck.addEventListener('focusin', stopBreeze);
  }
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) stopBreeze();
  });
  const iconSymbols = { sun: 'sun', moon: 'moon', cloud: 'cloud', 'partly-cloudy': 'cloud', 'cloudy-night': 'cloud', fog: 'cloud-fog', rain: 'cloud-rain', snow: 'cloud-snow', storm: 'cloud-storm' };
  let weather = null;
  let cache = {};
  let unavailable = false;
  let pending = false;
  let lastAttempt = 0;
  function render() {
    const now = Date.now();
    const current = weather && readWeather(weather, now);
    updateAtmosphere(current);
    root.toggleAttribute('data-weather-ready', Boolean(current));
    root.toggleAttribute('data-night', Boolean(current?.night));
    get('weather-live').hidden = false;
    get('weather-detail').hidden = false;
    get('daylight-clock').textContent = clock.format(now);
    get('daylight-clock').setAttribute('datetime', new Date(now).toISOString());
    const cycle = current && solarCycle(weather.sun, now);
    get('cycle-drawing').hidden = !cycle;
    get('cycle-unavailable').hidden = !current || Boolean(cycle);
    if (!cycle) get('cycle-dates').textContent = '';
    if (!current) {
      get('weather-icon').setAttribute('href', 'assets/icons/tabler.svg?v=c08f6282ed7f#cloud');
      get('weather-summary').textContent = `${clock.format(now)} · московское время`;
      get('weather-temperature').textContent = '—';
      get('weather-condition').textContent = unavailable || weather ? 'Нет свежих данных о погоде' : 'Загружаем погоду';
      for (const hook of ['weather-feels', 'weather-wind', 'weather-humidity', 'weather-precip']) get(hook).textContent = '';
      get('weather-detail').textContent = unavailable || weather ? 'Не удалось обновить погоду. Часы показывают московское время.' : 'Погода появится, когда загрузятся данные.';
      environment.style.removeProperty('--daylight-paper');
      return;
    }
    const temp = `${current.temperature > 0 ? '+' : current.temperature < 0 ? '−' : ''}${Math.abs(current.temperature)}°`;
    get('weather-temperature').textContent = temp;
    get('weather-condition').textContent = conditions(current.code) + (current.fogCover > 0 && current.code !== 45 ? ' · туман' : '');
    get('weather-summary').textContent = `${clock.format(now)} · ${temp} · ${get('weather-condition').textContent}`;
    get('weather-icon').setAttribute('href', `assets/icons/tabler.svg?v=c08f6282ed7f#${iconSymbols[weatherIcon(current.code, current.night)]}`);
    environment.style.setProperty('--daylight-paper', `color-mix(in srgb, ${current.skyPaper} ${100 - .24 * current.cloudCover}%, #bcc7d5)`);
    get('weather-wind').textContent = `${current.wind.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} м/с`;
    get('weather-humidity').textContent = Number.isFinite(current.humidity) ? `${Math.round(current.humidity)}%` : '—';
    get('weather-precip').textContent = current.precipitation === null ? 'Нет данных об осадках в ближайший час' : current.precipitation === 0 ? 'Без осадков в ближайший час' : `${current.precipitation.toLocaleString('ru-RU')} мм осадков в ближайший час`;
    const rounded = Math.round(current.apparentTemperature);
    get('weather-feels').textContent = Number.isFinite(current.apparentTemperature) ? `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded)}°` : '—';
    const date = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long' });
    get('weather-detail').textContent = `Прогноз на ${clock.format(current.observed)} · ${date.format(current.observed)}`;
    const light = daylightWindow(current, now);
    get('cycle-target-label').textContent = light.label;
    get('cycle-remaining').textContent = light.value;
    if (!cycle) return;
    const geometry = cycleGeometry(cycle);
    const canvas = get('cycle-drawing');
    canvas.style.setProperty('--day-share', `${cycle.dayShare * 100}%`);
    canvas.style.setProperty('--event-share', `${cycle.dayShare * 100}%`);
    canvas.style.setProperty('--now-x', `${geometry.x / 640 * 100}%`);
    get('cycle-dates').textContent = date.formatRange(cycle.start, cycle.end);
    get('cycle-day-duration').textContent = durationText(cycle.dayDuration);
    get('cycle-night-duration').textContent = durationText(cycle.nightDuration);
    get('cycle-day-area').setAttribute('d', geometry.day + ' Z');
    get('cycle-night-area').setAttribute('d', geometry.night + ' Z');
    get('cycle-path').setAttribute('d', geometry.day + ' ' + geometry.night);
    get('cycle-trail').setAttribute('d', geometry.trail);
    get('cycle-guide').setAttribute('d', `M${geometry.x} ${geometry.y + 10} V202`);
    get('cycle-position').setAttribute('transform', `translate(${geometry.x} ${geometry.y})`);
    get('cycle-sunset-tick').setAttribute('d', `M${geometry.split} 94 V106`);
    for (const [hook, time] of [['cycle-start', cycle.start], ['cycle-sunset', cycle.sunset], ['cycle-end', cycle.end], ['cycle-now', now]]) {
      get(hook).textContent = clock.format(time);
      get(hook).setAttribute('datetime', new Date(time).toISOString());
    }
    get('cycle-description').textContent = `${date.formatRange(cycle.start, cycle.end)}. Восход ${clock.format(cycle.start)}, закат ${clock.format(cycle.sunset)}, следующий восход ${clock.format(cycle.end)}. Сейчас ${clock.format(now)}. День длится ${durationText(cycle.dayDuration)}, ночь ${durationText(cycle.nightDuration)}. Горизонтальная шкала равномерна по времени; дуги условно различают светлое и тёмное время, это не высота Солнца.`;
  }
  async function refresh() {
    if (pending || document.hidden || Date.now() - lastAttempt < 15 * 60 * 1000) return;
    pending = true;
    lastAttempt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const yesterday = calendar.format(Date.now() - 24 * HOUR);
      const today = calendar.format(Date.now());
      const tomorrow = calendar.format(Date.now() + 24 * HOUR);
      // Sunrise is immutable for a given date; only the forecast needs revalidation.
      for (const key of Object.keys(cache)) if (!['forecast', yesterday, today, tomorrow].includes(key)) delete cache[key];
      const request = async (key, url) => {
        const entry = cache[key];
        if (entry?.data && (key !== 'forecast' || entry.expires > Date.now())) return entry.data;
        // Simple CORS GET: the browser sends Origin for identification, and its HTTP
        // cache revalidates with Last-Modified. Custom headers would cause a preflight.
        const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
        if (!response.ok) {
          if ([403, 429].includes(response.status)) lastAttempt = Date.now() + HOUR;
          throw new Error('Weather response unavailable');
        }
        const data = await response.json();
        if (key !== 'forecast') {
          const rise = Date.parse(data?.properties?.sunrise?.time);
          const set = Date.parse(data?.properties?.sunset?.time);
          if (!Number.isFinite(rise) || !Number.isFinite(set) || set <= rise || calendar.format(rise) !== key) {
            throw new Error('Incomplete sunrise response');
          }
        }
        const expires = Date.parse(response.headers.get('Expires'));
        cache[key] = { data, expires: Math.max(Date.now() + 30 * 60000, Number.isFinite(expires) ? expires : 0) };
        return data;
      };
      const base = 'https://api.met.no/weatherapi/';
      const location = 'lat=55.7558&lon=37.6173';
      const [forecast, ...sun] = await Promise.all([
        request('forecast', `${base}locationforecast/2.0/complete?${location}`),
        ...[today, tomorrow].map(day => request(day, `${base}sunrise/3.0/sun?${location}&date=${day}&offset=%2B03:00`))
      ]);
      const data = { forecast, sun };
      const current = readWeather(data);
      if (!current) throw new Error('Weather is stale or incomplete');
      // Before sunrise the displayed cycle began yesterday. Missing history
      // hides only the graph; it must not discard an otherwise useful forecast.
      if (Date.now() < current.sunrise) {
        try {
          sun.unshift(await request(yesterday, `${base}sunrise/3.0/sun?${location}&date=${yesterday}&offset=%2B03:00`));
        } catch { /* Keep today's weather and countdown if history is unavailable. */ }
      }
      weather = data;
      unavailable = false;
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* Storage is optional. */ }
    } catch {
      unavailable = true;
      if (!weather || !readWeather(weather)) get('weather-detail').textContent = 'Не удалось обновить погоду. Часы показывают московское время.';
    } finally {
      clearTimeout(timeout);
      pending = false;
      render();
    }
  }
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY));
    if (cached && typeof cached === 'object' && !Array.isArray(cached)) cache = cached;
    const data = { forecast: cache.forecast?.data, sun: Object.entries(cache).filter(([key]) => key !== 'forecast').map(([, entry]) => entry.data) };
    if (readWeather(data)) weather = data;
  } catch { /* A fresh request also handles missing or unavailable storage. */ }
  render();
  refresh();
  setInterval(() => { if (!document.hidden) { render(); refresh(); } }, 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopBreeze();
    else { render(); refresh(); }
  });
})();
