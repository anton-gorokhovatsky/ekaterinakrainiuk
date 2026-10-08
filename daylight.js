/* Moscow is the training city, not a claim about Katya's current location. */
(() => {
  'use strict';
  const HOUR = 60 * 60 * 1000;
  const MAX_AGE = 12 * HOUR; // The global forecast model is updated several times a day.
  const CACHE_KEY = 'katya-met-norway-v1';
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
    const code = conditionCode(frame.data?.next_1_hours?.summary?.symbol_code);
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
    return { temperature: Math.round(current.air_temperature), wind: current.wind_speed, cloudCover: current.cloud_area_fraction, code, observed, updated, sunrise, sunset, nextSunrise, progress, phase, night,
      skyTint: skyColour(skyColours, sunrise, sunset, now), skyPaper: skyColour(paperColours, sunrise, sunset, now),
      palette: Object.fromEntries(Object.entries(paletteColours).map(([role, colours]) =>
        [role, mixColour(skyColour(colours, sunrise, sunset, now), colours.cloud, current.cloud_area_fraction * .0018)])) };
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
    if (!Number.isFinite(target) || target <= now) return { label: 'Световой день', value: 'Завершён' };
    const minutes = Math.ceil((target - now) / 60000);
    const hours = Math.floor(minutes / 60);
    const value = hours ? `${hours} ч ${String(minutes % 60).padStart(2, '0')} мин` : `${minutes} мин`;
    return { label: current.night ? 'До рассвета' : 'До заката', value };
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
  if (typeof module !== 'undefined' && module.exports) module.exports = { readWeather, daylightWindow, conditions, weatherIcon, atmosphere, conditionCode };
  if (typeof document === 'undefined') return;
  const root = document.querySelector('#daylight');
  if (!root) return;
  const get = name => root.querySelector(`[data-${name}]`);
  const environment = root;
  const material = document.documentElement.style;
  const glassProperties = ['--weather-tint', '--weather-tint-share', '--weather-opacity', '--weather-blur', '--weather-saturation'];
  const paletteProperties = Object.keys(paletteColours).map(role => `--${role}`);
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
      [...glassProperties, ...paletteProperties].forEach(property => material.removeProperty(property));
      stopBreeze();
      return;
    }
    const sky = currentAtmosphere;
    [sky.tint, `${sky.tintShare}%`, `${sky.opacity}%`, `${sky.blur}px`, sky.saturation].forEach((value, index) => material.setProperty(glassProperties[index], value));
    Object.entries(current.palette).forEach(([role, colour]) => material.setProperty(`--${role}`, colour));
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
    get('daylight-clock').textContent = clock.format(now);
    const light = daylightWindow(current, now);
    get('daylight-label').textContent = light.label;
    get('daylight-remaining').textContent = light.value;
    get('next-sunrise').textContent = current?.night && Number.isFinite(current.nextSunrise) ? `Солнце взойдёт в ${clock.format(current.nextSunrise)}.` : '';
    if (!current) {
      get('weather-icon').setAttribute('href', 'assets/icons/tabler.svg?v=c08f6282ed7f#cloud');
      get('weather-summary').textContent = `${clock.format(now)} · московское время`;
      get('sun-position').style.visibility = 'hidden';
      get('sunrise').textContent = '—';
      get('sunset').textContent = '—';
      get('weather-temperature').textContent = '—';
      get('weather-condition').textContent = unavailable || weather ? 'Нет свежих данных' : 'Загружаем погоду';
      get('weather-wind').textContent = '';
      root.removeAttribute('data-night');
      if (weather) get('weather-detail').textContent = 'Не удалось обновить погоду. Часы показывают московское время.';
      environment.style.removeProperty('--daylight-paper');
      return;
    }
    get('sun-position').style.visibility = '';
    get('sun-position').setAttribute('transform', `translate(${16 + 368 * current.progress} ${70 - 184 * current.progress * (1 - current.progress)})`);
    // Exact sub-curve of the day arc, ending at the current sun marker.
    const p = current.progress;
    get('sun-trail').setAttribute('d', `M16 70 Q${16 + 184 * p} ${70 - 92 * p} ${16 + 368 * p} ${70 - 184 * p * (1 - p)}`);
    root.toggleAttribute('data-night', current.night);
    get('weather-icon').setAttribute('href', `assets/icons/tabler.svg?v=c08f6282ed7f#${iconSymbols[weatherIcon(current.code, current.night)]}`);
    environment.style.setProperty('--daylight-paper', `color-mix(in srgb, ${current.skyPaper} ${100 - .24 * current.cloudCover}%, #bcc7d5)`);
    get('sunrise').textContent = clock.format(current.sunrise);
    get('sunset').textContent = clock.format(current.sunset);
    const temp = `${current.temperature > 0 ? '+' : current.temperature < 0 ? '−' : ''}${Math.abs(current.temperature)}°`;
    get('weather-temperature').textContent = temp;
    get('weather-condition').textContent = conditions(current.code);
    get('weather-summary').textContent = `${clock.format(now)} · ${temp} · ${conditions(current.code)}`;
    get('weather-wind').textContent = `Ветер ${current.wind.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} м/с`;
    get('weather-detail').textContent = `Прогноз на ${clock.format(current.observed)}`;
  }
  async function refresh() {
    if (pending || document.hidden || Date.now() - lastAttempt < 15 * 60 * 1000) return;
    pending = true;
    lastAttempt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const today = calendar.format(Date.now());
      const tomorrow = calendar.format(Date.now() + 24 * HOUR);
      // Sunrise is immutable for a given date; only the forecast needs revalidation.
      for (const key of Object.keys(cache)) if (!['forecast', today, tomorrow].includes(key)) delete cache[key];
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
        request('forecast', `${base}locationforecast/2.0/compact?${location}`),
        ...[today, tomorrow].map(day => request(day, `${base}sunrise/3.0/sun?${location}&date=${day}&offset=%2B03:00`))
      ]);
      const data = { forecast, sun };
      if (!readWeather(data)) throw new Error('Weather is stale or incomplete');
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
