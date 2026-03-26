// Fetches current Delaware River water temperature from USGS
// Station 01467200 — Delaware River at Burlington, NJ
// Returns { text, tempF } so scheduler can build the combined air+water line.
// No API key required.

const STATION_ID = '01467200';
const BASE_URL   = 'https://waterservices.usgs.gov/nwis/iv/';

function celsiusToFahrenheit(c) {
  return parseFloat(((c * 9) / 5 + 32).toFixed(1));
}

async function getWaterTemp() {
  try {
    const url = new URL(BASE_URL);
    url.searchParams.set('format', 'json');
    url.searchParams.set('sites', STATION_ID);
    url.searchParams.set('parameterCd', '00010');
    url.searchParams.set('siteStatus', 'all');

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'DarbyBot/1.0 (groupme-water-temp-bot)' },
    });
    if (!res.ok) throw new Error(`USGS API returned ${res.status}`);

    const data = await res.json();
    const timeSeries = data?.value?.timeSeries?.[0]?.values?.[0]?.value;

    if (!timeSeries || timeSeries.length === 0) {
      throw new Error('No water temperature readings available');
    }

    const latest    = timeSeries[timeSeries.length - 1];
    const tempC     = parseFloat(latest.value);
    const tempF     = celsiusToFahrenheit(tempC);
    const timestamp = new Date(latest.dateTime).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    });

    return {
      text: `🌊 Delaware River Water Temp: ${tempF}°F (${tempC.toFixed(1)}°C)`,
      tempF,
    };
  } catch (err) {
    console.error('Water temp fetch error:', err.message);
    return {
      text: '⚠️ Could not retrieve river water temperature right now.',
      tempF: null,
    };
  }
}

module.exports = { getWaterTemp };
