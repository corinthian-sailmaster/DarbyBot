// Fetches current conditions from NOAA -- PHL airport (KPHL), falling back to KPNE.
// No API key required.
// Returns { text, high } so scheduler can build the combined air+water line.

const STATIONS = [
  'https://api.weather.gov/stations/KPHL/observations/latest',
  'https://api.weather.gov/stations/KPNE/observations/latest', // NE Philadelphia fallback
];
const HEADERS = { 'User-Agent': 'DarbyBot/1.0 (groupme-weather-bot)' };

// ── Unit converters ───────────────────────────────────────────────────────────

function metersPerSecondToKnots(mps) {
  return mps != null ? Math.round(mps * 1.944) : null;
}

function celsiusToFahrenheit(c) {
  return c != null ? parseFloat(((c * 9) / 5 + 32).toFixed(1)) : null;
}

function formatDirection(degrees) {
  if (degrees == null) return null;
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(degrees / 22.5) % 16];
}

// Convert wind speed to knots based on the unitCode field.
// The /observations list endpoint returns km/h; /observations/latest returns m/s.
function windToKnots(value, unitCode) {
  if (value == null) return null;
  if (unitCode && (unitCode.includes('km_h') || unitCode.includes('km/h'))) {
    return Math.round(value * 0.53996);
  }
  if (unitCode && (unitCode.includes('m_s') || unitCode.includes('m/s'))) {
    return Math.round(value * 1.944);
  }
  if (unitCode && unitCode.includes('knot')) {
    return Math.round(value);
  }
  return Math.round(value * 0.53996);
}

// ── Recent observations: high/low temps + 4-hour wind average ─────────────────

async function getRecentObservations(stationUrl) {
  const empty = { high: null, low: null, avgWindKts: null, avgWindDeg: null, sampleCount: 0 };
  try {
    const listUrl = stationUrl.replace('/observations/latest', '/observations?limit=24');
    const res = await fetch(listUrl, { headers: HEADERS });
    if (!res.ok) return empty;

    const data     = await res.json();
    const features = data.features ?? [];
    const todayStr = new Date().toDateString();
    const fourHrsAgo = Date.now() - 4 * 60 * 60 * 1000;

    // Today's high/low temps
    const tempsToday = features
      .filter(f => new Date(f.properties.timestamp).toDateString() === todayStr)
      .map(f => f.properties.temperature?.value)
      .filter(v => v != null)
      .map(celsiusToFahrenheit);

    // Last 4 hours of wind speed -- convert to knots using each reading's unitCode
    const recentWindSpeeds = features
      .filter(f => new Date(f.properties.timestamp).getTime() >= fourHrsAgo)
      .map(f => windToKnots(f.properties.windSpeed?.value, f.properties.windSpeed?.unitCode))
      .filter(v => v != null);

    // Most recent valid wind direction in the last 4 hours
    const recentWindDirs = features
      .filter(f => new Date(f.properties.timestamp).getTime() >= fourHrsAgo)
      .map(f => f.properties.windDirection?.value)
      .filter(v => v != null);

    const avgWindKts = recentWindSpeeds.length > 0
      ? Math.round(recentWindSpeeds.reduce((a, b) => a + b, 0) / recentWindSpeeds.length)
      : null;

    const avgWindDeg = recentWindDirs.length > 0 ? recentWindDirs[0] : null;

    return {
      high:        tempsToday.length > 0 ? Math.max(...tempsToday) : null,
      low:         tempsToday.length > 0 ? Math.min(...tempsToday) : null,
      avgWindKts,
      avgWindDeg,
      sampleCount: recentWindSpeeds.length,
    };
  } catch {
    return empty;
  }
}

// ── Station fetch ─────────────────────────────────────────────────────────────

async function fetchObservation() {
  for (const url of STATIONS) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) continue;
      const data = await res.json();
      const p = data.properties;
      if (p.temperature?.value != null) {
        const stationId = url.match(/stations\/(\w+)\//)?.[1] ?? 'unknown';
        return { props: p, stationId, stationUrl: url };
      }
    } catch (err) {
      console.warn(`Station ${url} failed: ${err.message}`);
    }
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
function weatherEmojis(condition) {
  if (!condition) return '🌡️';
  const c = condition.toLowerCase();

  if (c.includes('tornado'))                          return '🌪️';
  if (c.includes('hurricane') || c.includes('tropical storm')) return '🌀';
  if (c.includes('freezing rain') || c.includes('ice'))        return '🌨️🌧️❄️';
  if (c.includes('blizzard'))                         return '❄️🌨️❄️🌨️❄️';
  if (c.includes('heavy snow'))                       return '❄️🌨️❄️';
  if (c.includes('snow'))                             return '🌨️❄️';
  if (c.includes('flurr'))                            return '🌨️';
  if (c.includes('thunder') || c.includes('tstm'))   return '⛈️🌩️⛈️';
  if (c.includes('heavy rain') || c.includes('heavy drizzle')) return '🌧️🌧️';
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return '🌧️';
  if (c.includes('fog') || c.includes('mist') || c.includes('haze')) return '🌫️';
  if (c.includes('overcast') || c.includes('cloudy')) return '☁️';
  if (c.includes('mostly cloudy') || c.includes('considerable cloudiness')) return '🌥️';
  if (c.includes('partly cloudy') || c.includes('partly sunny')) return '⛅';
  if (c.includes('mostly clear') || c.includes('mostly sunny')) return '🌤️';
  if (c.includes('clear') || c.includes('sunny') || c.includes('fair')) return '☀️';
  if (c.includes('wind'))                             return '💨';
  return '🌡️';
}
async function getWeather() {
  try {
    const obs = await fetchObservation();
    if (!obs) throw new Error('All weather stations unavailable');

    const { props: p, stationId, stationUrl } = obs;
    const recent = await getRecentObservations(stationUrl);

    const tempF      = celsiusToFahrenheit(p.temperature?.value);
    const feelsLikeF = celsiusToFahrenheit(p.windChill?.value ?? p.heatIndex?.value);
    const humidity   = p.relativeHumidity?.value != null
                         ? Math.round(p.relativeHumidity.value) + '%'
                         : '—';
    const windKts    = windToKnots(p.windSpeed?.value, p.windSpeed?.unitCode);
    const gustKts    = windToKnots(p.windGust?.value, p.windGust?.unitCode);
    const windDeg    = p.windDirection?.value != null
                         ? Math.round(p.windDirection.value) + '°'
                         : null;
    const windDir    = formatDirection(p.windDirection?.value);
    const condition  = p.textDescription || '—';
    const baroMb     = p.barometricPressure?.value != null
                         ? Math.round(p.barometricPressure.value / 100) + ' mb'
                         : '—';

    const feelsStr   = feelsLikeF && feelsLikeF !== tempF
                         ? `, feels like ${feelsLikeF}°F`
                         : '';
    const highLowStr = (recent.high != null && recent.low != null)
                         ? `\n📈 Today's High: ${recent.high}°F\n📉 Today's Low:  ${recent.low}°F`
                         : '';

    // Wind: current reading preferred, 4-hour average as fallback
    let windStr;
    if (windKts != null) {
      const dirPart  = windDir ? `${windDir} ` : '';
      const degPart  = windDeg ? `(${windDeg}) ` : '';
      const gustPart = gustKts ? ` (gusts ${gustKts} kts)` : '';
      windStr = `💨 Wind: ${dirPart}${degPart}at ${windKts} kts${gustPart}`;
    } else if (recent.avgWindKts != null) {
      const avgDir  = formatDirection(recent.avgWindDeg);
      const avgDeg  = recent.avgWindDeg != null ? `(${Math.round(recent.avgWindDeg)}°) ` : '';
      const dirPart = avgDir ? `${avgDir} ` : '';
      windStr = `💨 Wind: ${dirPart}${avgDeg}~${recent.avgWindKts} kts (4-hr avg, ${recent.sampleCount} readings)`;
    } else {
      windStr = `💨 Wind: data temporarily unavailable`;
    }

    const sourceNote = stationId !== 'KPHL' ? ` (via ${stationId})` : '';

    const weatherText =
      `${weatherEmojis(condition)} ${condition}${sourceNote}\n` +
      `🌡️ Temp: ${tempF ?? '—'}°F${feelsStr}\n` +
      `${windStr}\n` +
      `💧 Humidity: ${humidity}\n` +
      `🔵 Pressure: ${baroMb}` +
      highLowStr;

    return { text: weatherText, high: recent.high };
  } catch (err) {
    console.error('Weather fetch error:', err.message);
    return {
      text: '⚠️ Could not retrieve weather data right now. Try again shortly.',
      high: null,
    };
  }
}

module.exports = { getWeather };
