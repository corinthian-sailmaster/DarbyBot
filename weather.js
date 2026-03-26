// Fetches current conditions + forecast from NOAA — PHL airport station (KPHL)
// No API key required.
// Returns { text, high } so scheduler can build the combined air+water line.

const STATION_URL   = 'https://api.weather.gov/stations/KPHL/observations/latest';
const FORECAST_URL  = 'https://api.weather.gov/gridpoints/PHI/49,67/forecast';
const HEADERS       = { 'User-Agent': 'DarbyBot/1.0 (groupme-weather-bot)' };

function metersPerSecondToKnots(mps) {
  return mps != null ? Math.round(mps * 1.944) : null;
}

function celsiusToFahrenheit(c) {
  return c != null ? parseFloat(((c * 9) / 5 + 32).toFixed(1)) : null;
}

function formatDirection(degrees) {
  if (degrees == null) return '—';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(degrees / 22.5) % 16];
}

async function getTodayHighLow() {
  try {
    const url = 'https://api.weather.gov/stations/KPHL/observations?limit=24';
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return { high: null, low: null };

    const data = await res.json();
    const todayStr = new Date().toDateString();

    const tempsToday = data.features
      .filter(f => new Date(f.properties.timestamp).toDateString() === todayStr)
      .map(f => f.properties.temperature?.value)
      .filter(v => v != null)
      .map(celsiusToFahrenheit);

    if (tempsToday.length === 0) return { high: null, low: null };
    return {
      high: Math.max(...tempsToday),
      low:  Math.min(...tempsToday),
    };
  } catch {
    return { high: null, low: null };
  }
}

async function getWeather() {
  try {
    const [obsRes, { high, low }] = await Promise.all([
      fetch(STATION_URL, { headers: HEADERS }),
      getTodayHighLow(),
    ]);

    if (!obsRes.ok) throw new Error(`NOAA observations API returned ${obsRes.status}`);

    const data = await obsRes.json();
    const p = data.properties;
console.log('Wind raw:', JSON.stringify(p.windSpeed), JSON.stringify(p.windDirection));
    const tempF      = celsiusToFahrenheit(p.temperature?.value);
    const feelsLikeF = celsiusToFahrenheit(p.windChill?.value ?? p.heatIndex?.value);
    const humidity   = p.relativeHumidity?.value != null
                         ? Math.round(p.relativeHumidity.value) + '%'
                         : '—';
    const windKts    = metersPerSecondToKnots(p.windSpeed?.value);
    const gustKts    = metersPerSecondToKnots(p.windGust?.value);
    const windDeg    = p.windDirection?.value != null
                         ? Math.round(p.windDirection.value) + '°'
                         : null;
    const windDir    = formatDirection(p.windDirection?.value);
    const condition  = p.textDescription || '—';
    const baroMb     = p.barometricPressure?.value != null
                         ? Math.round(p.barometricPressure.value / 100) + ' mb'
                         : '—';

    const gustStr    = gustKts ? ` (gusts ${gustKts} kts)` : '';
    const windDegStr = windDeg ? ` at ${windDeg}` : '';
    const feelsStr   = feelsLikeF && feelsLikeF !== tempF
                         ? `, feels like ${feelsLikeF}°F`
                         : '';
    const highLowStr = (high != null && low != null)
                         ? `\n📈 Today's High: ${high}°F\n📉 Today's Low:  ${low}°F`
                         : '';

    const weatherText =
      `☁️ ${condition}\n` +
      `🌡️ Temp: ${tempF ?? '—'}°F${feelsStr}\n` +
      `💧 Humidity: ${humidity}\n` +
      `💨 Wind: ${windDir}${windDegStr} ${windKts ?? '—'} kts${gustStr}\n` +
      `🔵 Pressure: ${baroMb}` +
      highLowStr;

    return { text: weatherText, high };
  } catch (err) {
    console.error('Weather fetch error:', err.message);
    return {
      text: '⚠️ Could not retrieve weather data right now. Try again shortly.',
      high: null,
    };
  }
}

module.exports = { getWeather };
