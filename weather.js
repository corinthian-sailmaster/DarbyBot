// Fetches current conditions from NOAA — PHL airport (KPHL), falling back to KPNE.
// No API key required.
// Returns { text, high } so scheduler can build the combined air+water line.

const STATIONS = [
  'https://api.weather.gov/stations/KPHL/observations/latest',
  'https://api.weather.gov/stations/KPNE/observations/latest', // NE Philadelphia fallback
];
const HEADERS = { 'User-Agent': 'DarbyBot/1.0 (groupme-weather-bot)' };

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

async function getTodayHighLow(stationUrl) {
  try {
    // Derive observations list URL from the single-observation URL
    const listUrl = stationUrl.replace('/observations/latest', '/observations?limit=24');
    const res = await fetch(listUrl, { headers: HEADERS });
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

// Try each station in order; return first one that gives usable data
async function fetchObservation() {
  for (const url of STATIONS) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) continue;
      const data = await res.json();
      const p = data.properties;
      // Consider it usable if we at least have a temperature reading
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

async function getWeather() {
  try {
    const obs = await fetchObservation();
    if (!obs) throw new Error('All weather stations unavailable');

    const { props: p, stationId, stationUrl } = obs;

    const [{ high, low }] = await Promise.all([getTodayHighLow(stationUrl)]);

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

    const feelsStr   = feelsLikeF && feelsLikeF !== tempF
                         ? `, feels like ${feelsLikeF}°F`
                         : '';
    const highLowStr = (high != null && low != null)
                         ? `\n📈 Today's High: ${high}°F\n📉 Today's Low:  ${low}°F`
                         : '';

    // Wind line — "SW (225°) at 12 kts (gusts 18 kts)"
    let windStr;
    if (windKts != null) {
      const dirPart  = windDir  ? `${windDir} ` : '';
      const degPart  = windDeg  ? `(${windDeg}) ` : '';
      const gustPart = gustKts  ? ` (gusts ${gustKts} kts)` : '';
      windStr = `💨 Wind: ${dirPart}${degPart}at ${windKts} kts${gustPart}`;
    } else {
      windStr = `💨 Wind: data temporarily unavailable`;
    }

    // Note fallback station in output so users know
    const sourceNote = stationId !== 'KPHL' ? ` (via ${stationId})` : '';

    const weatherText =
      `☁️ ${condition}${sourceNote}\n` +
      `🌡️ Temp: ${tempF ?? '—'}°F${feelsStr}\n` +
      `💧 Humidity: ${humidity}\n` +
      `${windStr}\n` +
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
