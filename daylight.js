/* Moscow is the training city, not a claim about Katya's current location. */
(() => {
  'use strict';
  const MAX_AGE = 3 * 60 * 60 * 1000;
  const clock = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' });
  const calendar = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' });
  function readWeather(data, now = Date.now()) {
    const current = data?.current;
    if (!current || ![current.time, current.temperature_2m, current.wind_speed_10m, current.weather_code].every(Number.isFinite)) return null;
    if (Math.abs(now - current.time * 1000) > MAX_AGE) return null;
    if (data.current_units?.wind_speed_10m !== 'm/s' || data.current_units?.temperature_2m !== '°C') return null;
    const index = data.daily?.time?.findIndex(time => Number.isFinite(time) && calendar.format(time * 1000) === calendar.format(now));
    if (!Number.isInteger(index) || index < 0) return null;
    const sunrise = data.daily.sunrise?.[index] * 1000;
    const sunset = data.daily.sunset?.[index] * 1000;
    if (!Number.isFinite(sunrise) || !Number.isFinite(sunset) || sunset <= sunrise) return null;
    const progress = Math.max(0, Math.min(1, (now - sunrise) / (sunset - sunrise)));
    const night = now < sunrise || now > sunset;
    const phase = night ? 'night' : progress < .12 ? 'morning' : progress > .85 ? 'evening' : 'day';
    return { temperature: Math.round(current.temperature_2m), wind: current.wind_speed_10m, code: current.weather_code, observed: current.time * 1000, sunrise, sunset, progress, phase, night };
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
  if (typeof module !== 'undefined' && module.exports) module.exports = { readWeather, conditions };
  if (typeof document === 'undefined') return;
  const root = document.querySelector('#daylight');
  if (!root) return;
  const get = name => root.querySelector(`[data-${name}]`);
  const environment = root;
  const palette = { morning: '#ffcfaa', day: '#ffb8d2', evening: '#edb6d7', night: '#c2b6e8' };
  const titles = { morning: 'Москва просыпается.', day: 'День в самом разгаре.', evening: 'Ловим вечерний свет.', night: 'У Москвы — пауза.' };
  let weather = null;
  let pending = false;
  let lastAttempt = 0;
  function render() {
    const now = Date.now();
    const current = weather && readWeather(weather, now);
    root.toggleAttribute('data-weather-ready', Boolean(current));
    get('daylight-clock').textContent = clock.format(now);
    if (!current) {
      get('weather-summary').textContent = `${clock.format(now)} · московское время`;
      get('sun-position').style.visibility = 'hidden';
      get('sunrise').textContent = 'Рассвет';
      get('sunset').textContent = 'Закат';
      root.removeAttribute('data-night');
      get('daylight-title').textContent = 'У каждого дня — свой ритм.';
      if (weather) get('weather-detail').textContent = 'Свежая погода сейчас недоступна. Время — московское.';
      environment.style.removeProperty('--daylight-paper');
      return;
    }
    get('sun-position').style.visibility = '';
    get('sun-position').setAttribute('transform', `translate(${30 + 340 * current.progress} ${150 - 500 * current.progress * (1 - current.progress)})`);
    root.toggleAttribute('data-night', current.night);
    environment.style.setProperty('--daylight-paper', current.code >= 3 && !current.night ? `color-mix(in srgb, ${palette[current.phase]} 76%, #bcc7d5)` : palette[current.phase]);
    get('daylight-title').textContent = titles[current.phase];
    get('sunrise').textContent = `Рассвет ${clock.format(current.sunrise)}`;
    get('sunset').textContent = `Закат ${clock.format(current.sunset)}`;
    const temp = `${current.temperature > 0 ? '+' : current.temperature < 0 ? '−' : ''}${Math.abs(current.temperature)}°`;
    get('weather-summary').textContent = `${clock.format(now)} · ${temp} · ${conditions(current.code)}`;
    get('weather-detail').textContent = `Ветер ${current.wind.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} м/с. Данные на ${clock.format(current.observed)}.`;
  }
  async function refresh() {
    if (pending || document.hidden || Date.now() - lastAttempt < 15 * 60 * 1000) return;
    pending = true;
    lastAttempt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=55.7558&longitude=37.6173&current=temperature_2m,weather_code,wind_speed_10m&daily=sunrise,sunset&wind_speed_unit=ms&timeformat=unixtime&timezone=Europe%2FMoscow&forecast_days=2', { signal: controller.signal, credentials: 'omit' });
      if (!response.ok) throw new Error('Weather response unavailable');
      const data = await response.json();
      if (!readWeather(data)) throw new Error('Weather is stale or incomplete');
      weather = data;
      try { sessionStorage.setItem('katya-weather', JSON.stringify({ saved: Date.now(), data })); } catch { /* Storage is optional. */ }
    } catch {
      if (!weather || !readWeather(weather)) get('weather-detail').textContent = 'Погода сейчас недоступна. Время — московское.';
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
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); refresh(); } });
})();
