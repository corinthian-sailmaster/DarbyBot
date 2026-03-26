// Fetches the extended marine forecast from NWS Mt Holly
// Zone ANZ430 — Delaware Bay waters north of East Point NJ to Slaughter Beach DE
// This is the closest marine zone to Essington, PA.
// No API key required.

const ZONE_URL = 'https://api.weather.gov/zones/forecast/ANZ430/forecast';
const HEADERS  = { 'User-Agent': 'DarbyBot/1.0 (groupme-marine-bot)' };

// NWS marine forecasts use period names like "Today", "Tonight", "Wednesday", etc.
// We trim each period to keep GroupMe messages readable.
function formatPeriod(period) {
  // Cap description length so one period doesn't swamp the message
  const desc = period.detailedForecast.length > 220
    ? period.detailedForecast.slice(0, 217) + '...'
    : period.detailedForecast;
  return `${period.name.toUpperCase()}:\n${desc}`;
}

async function getMarineForecast(days = 3) {
  try {
    const res = await fetch(ZONE_URL, { headers: HEADERS });
    if (!res.ok) throw new Error(`NWS marine API returned ${res.status}`);

    const data = await res.json();
    const periods = data.properties?.periods;

    if (!periods || periods.length === 0) {
      throw new Error('No marine forecast periods available');
    }

    // Each "day" covers a day period + optional night period (2 entries).
    // Limit to requested number of days worth of periods (2 periods per day).
    const maxPeriods = days * 2;
    const selected = periods.slice(0, maxPeriods);

    const lines = selected.map(formatPeriod).join('\n\n');

    const updated = new Date(data.properties.updated).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      timeZoneName: 'short',
    });

    return (
      `⚓ Marine Forecast — Delaware Bay (Mt Holly NWS)\n` +
      `Updated: ${updated}\n\n` +
      lines
    );
  } catch (err) {
    console.error('Marine forecast error:', err.message);
    return '⚠️ Could not retrieve marine forecast right now. Try again shortly.';
  }
}

module.exports = { getMarineForecast };
