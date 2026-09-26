/* Moscow is the training city, not a claim about Katya's current location. */
(() => {
  'use strict';
  const MAX_AGE = 3 * 60 * 60 * 1000;
  const clock = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' });
  const calendar = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' });
  const skyColours = { morning: '#ffc99b', day: '#a9dbe3', evening: '#ffb8d2', night: '#aaa5e8' };
  function readWeather(data, now = Date.now()) {
    const current = data?.current;
    if (!current || ![current.time, current.temperature_2m, current.wind_speed_10m, current.weather_code].every(Number.isFinite)) return null;
    if (Math.abs(now - current.time * 1000) > MAX_AGE) return null;
    if (data.current_units?.wind_speed_10m !== 'm/s' || data.current_units?.temperature_2m !== '°C') return null;
    if (current.wind_speed_10m < 0) return null;
    const index = data.daily?.time?.findIndex(time => Number.isFinite(time) && calendar.format(time * 1000) === calendar.format(now));
    if (!Number.isInteger(index) || index < 0) return null;
    const sunrise = data.daily.sunrise?.[index] * 1000;
    const sunset = data.daily.sunset?.[index] * 1000;
    if (!Number.isFinite(sunrise) || !Number.isFinite(sunset) || sunset <= sunrise) return null;
    const progress = Math.max(0, Math.min(1, (now - sunrise) / (sunset - sunrise)));
    const night = now < sunrise || now >= sunset;
    const nextSunrise = data.daily.sunrise.map(time => time * 1000).find(time => Number.isFinite(time) && time > now);
    const phase = night ? 'night' : progress < .12 ? 'morning' : progress > .85 ? 'evening' : 'day';
    // Older cached responses have no percentage: retain a coarse condition-based fallback.
    const cloudCover = Number.isFinite(current.cloud_cover) && data.current_units?.cloud_cover === '%'
      ? Math.max(0, Math.min(100, current.cloud_cover))
      : ({ 0: 0, 1: 30, 2: 70 }[current.weather_code] ?? 100);
    return { temperature: Math.round(current.temperature_2m), wind: current.wind_speed_10m, cloudCover, code: current.weather_code, observed: current.time * 1000, sunrise, sunset, nextSunrise, progress, phase, night };
  }
  function atmosphere(current) {
    if (!current) return null;
    const cloud = current.cloudCover / 100;
    const wind = Math.max(0, Math.min(1, current.wind / 8));
    return {
      tint: skyColours[current.phase],
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
    if (code <= 77) return 'снег';
    if (code <= 82) return 'ливень';
    if (code <= 86) return 'снегопад';
    return 'гроза';
  }
  function weatherIcon(code, night = false) {
    const icons = { 'ясно': night ? 'moon' : 'sun', 'переменная облачность': night ? 'cloudy-night' : 'partly-cloudy', 'пасмурно': 'cloud', 'туман': 'fog', 'морось': 'rain', 'дождь': 'rain', 'снег': 'snow', 'ливень': 'rain', 'снегопад': 'snow', 'гроза': 'storm' };
    return icons[conditions(code)] || 'cloud';
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { readWeather, daylightWindow, conditions, weatherIcon, atmosphere };
  if (typeof document === 'undefined') return;
  const root = document.querySelector('#daylight');
  if (!root) return;
  const get = name => root.querySelector(`[data-${name}]`);
  const environment = root;
  const material = document.documentElement.style;
  const glassProperties = ['--weather-tint', '--weather-tint-share', '--weather-opacity', '--weather-blur', '--weather-saturation'];
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
      glassProperties.forEach(property => material.removeProperty(property));
      stopBreeze();
      return;
    }
    const sky = currentAtmosphere;
    [sky.tint, `${sky.tintShare}%`, `${sky.opacity}%`, `${sky.blur}px`, sky.saturation].forEach((value, index) => material.setProperty(glassProperties[index], value));
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
  const palette = { morning: '#ffcfaa', day: '#cee4ec', evening: '#edb6d7', night: '#c2b6e8' };
  let weather = null;
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
      get('weather-icon').setAttribute('href', 'assets/icons/tabler.svg#cloud');
      get('weather-summary').textContent = `${clock.format(now)} · московское время`;
      get('sun-position').style.visibility = 'hidden';
      get('sunrise').textContent = '—';
      get('sunset').textContent = '—';
      get('weather-temperature').textContent = '—';
      get('weather-condition').textContent = unavailable || weather ? 'Нет свежих данных' : 'Загружаем погоду';
      root.removeAttribute('data-night');
      if (weather) get('weather-detail').textContent = 'Не удалось обновить погоду. Часы показывают московское время.';
      environment.style.removeProperty('--daylight-paper');
      return;
    }
    get('sun-position').style.visibility = '';
    get('sun-position').setAttribute('transform', `translate(${16 + 368 * current.progress} ${70 - 184 * current.progress * (1 - current.progress)})`);
    root.toggleAttribute('data-night', current.night);
    get('weather-icon').setAttribute('href', `assets/icons/tabler.svg#${iconSymbols[weatherIcon(current.code, current.night)]}`);
    environment.style.setProperty('--daylight-paper', current.code >= 3 && !current.night ? `color-mix(in srgb, ${palette[current.phase]} 76%, #bcc7d5)` : palette[current.phase]);
    get('sunrise').textContent = clock.format(current.sunrise);
    get('sunset').textContent = clock.format(current.sunset);
    const temp = `${current.temperature > 0 ? '+' : current.temperature < 0 ? '−' : ''}${Math.abs(current.temperature)}°`;
    get('weather-temperature').textContent = temp;
    get('weather-condition').textContent = conditions(current.code);
    get('weather-summary').textContent = `${clock.format(now)} · ${temp} · ${conditions(current.code)}`;
    get('weather-detail').textContent = `Ветер — ${current.wind.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} м/с. Данные на ${clock.format(current.observed)}.`;
  }
  async function refresh() {
    if (pending || document.hidden || Date.now() - lastAttempt < 15 * 60 * 1000) return;
    pending = true;
    lastAttempt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=55.7558&longitude=37.6173&current=temperature_2m,weather_code,wind_speed_10m,cloud_cover&daily=sunrise,sunset&wind_speed_unit=ms&timeformat=unixtime&timezone=Europe%2FMoscow&forecast_days=2', { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error('Weather response unavailable');
      const data = await response.json();
      if (!readWeather(data)) throw new Error('Weather is stale or incomplete');
      weather = data;
      unavailable = false;
      try { sessionStorage.setItem('katya-weather', JSON.stringify({ saved: Date.now(), data })); } catch { /* Storage is optional. */ }
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
    const cached = JSON.parse(sessionStorage.getItem('katya-weather'));
    if (cached && Date.now() - cached.saved >= 0 && Date.now() - cached.saved < 15 * 60 * 1000 && readWeather(cached.data)) {
      weather = cached.data;
      lastAttempt = cached.saved;
    }
  } catch { /* A fresh request also handles missing or unavailable storage. */ }
  render();
  refresh();
  setInterval(() => { if (!document.hidden) { render(); refresh(); } }, 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopBreeze();
    else { render(); refresh(); }
  });
})();
