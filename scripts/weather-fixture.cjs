// Minimal MET Norway Locationforecast / Sunrise shapes, without live network calls.
const sunDay = date => ({ properties: {
  sunrise: { time: `${date}T06:00:00+03:00` },
  sunset: { time: `${date}T18:00:00+03:00` }
} });
const sample = (now = Date.parse('2026-09-26T09:00:00Z')) => ({
  forecast: { properties: {
    meta: { updated_at: new Date(now).toISOString(), units: { air_temperature: 'celsius', apparent_air_temperature: 'celsius', wind_speed: 'm/s', cloud_area_fraction: '%', relative_humidity: '%', precipitation_amount: 'mm' } },
    timeseries: [{ time: new Date(now).toISOString(), data: {
      instant: { details: { air_temperature: 14.6, apparent_air_temperature: 12.3, wind_speed: 1.8, cloud_area_fraction: 100, relative_humidity: 46 } },
      next_1_hours: { summary: { symbol_code: 'cloudy' }, details: { precipitation_amount: 0 } }
    } }]
  } },
  sun: [sunDay('2026-09-26')]
});
module.exports = { sample, sunDay };
