// Fetches current conditions + forecast from NOAA — PHL airport station (KPHL)
// No API key required.

const STATION_URL   = 'https://api.weather.gov/stations/KPHL/observations/latest';
const FORECAST_URL  = 'https://api.weather.gov/gridpoints/PHI/49,67/forecast'; // NWS grid for PHL area
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

// Fetch today's high/low from the NWS hourly observations for KPHL
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

// Fetch tomorrow's forecast summary from NWS
async function getTomorrowForecast() {
  try {
    const res = await fetch(FORECAST_URL, { headers: HEADERS });
    if (!res.ok) return null;

    const data = await res.json();
    const periods = data.properties.periods;

    // NWS returns named periods like "Tomorrow", "Tomorrow Night"
    const tomorrow = periods.find(p => p.name.toLowerCase().includes('tomorrow') &&
                                       !p.name.toLowerCase().includes('night'));
    if (!tomorrow) return null;

    return {
      temp:      tomorrow.temperature,       // already in °F from NWS
      condition: tomorrow.shortForecast,
    };
  } catch {
    return null;
  }
}

async function getWeather() {
  try {
    // Fetch current conditions, today high/low, and tomorrow forecast in parallel
    const [obsRes, { high, low }, tomorrow] = await Promise.all([
      fetch(STATION_URL, { headers: HEADERS }),
      getTodayHighLow(),
      getTomorrowForecast(),
    ]);

    if (!obsRes.ok) throw new Error(`NOAA observations API returned ${obsRes.status}`);

    const data = await obsRes.json();
    const p = data.properties;

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

    const gustStr    = gustKts  ? ` (gusts ${gustKts} kts)` : '';
    const windDegStr = windDeg  ? ` at ${windDeg}` : '';
    const feelsStr   = feelsLikeF && feelsLikeF !== tempF
                         ? `, feels like ${feelsLikeF}°F`
                         : '';
    const highLowStr = (high != null && low != null)
                         ? `\n📈 Today's High: ${high}°F\n📉 Today's Low:  ${low}°F`
                         : '';
    const tomorrowStr = tomorrow
                         ? `\n🔮 Tomorrow: ${tomorrow.condition}, around ${tomorrow.temp}°F`
                         : '';

    return (
      `🌤️ DarbyBot Weather (PHL)\n` +
      `☁️ ${condition}\n` +
      `🌡️ Temp: ${tempF ?? '—'}°F${feelsStr}\n` +
      `💧 Humidity: ${humidity}\n` +
      `💨 Wind: ${windDir}${windDegStr} ${windKts ?? '—'} kts${gustStr}\n` +
      `🔵 Pressure: ${baroMb}` +
      highLowStr +
      tomorrowStr
    );
  } catch (err) {
    console.error('Weather fetch error:', err.message);
    return '⚠️ Could not retrieve weather data right now. Try again shortly.';
  }
}

module.exports = { getWeather };
