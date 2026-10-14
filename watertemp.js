// Fetches current Delaware River water temperature from USGS
// Station 01474703 — Delaware River at Fort Mifflin, Philadelphia
// (the gauge Confluence uses). The old station, 01467200 at Penn's Landing,
// stopped reporting water temp in Dec 2020 but USGS kept serving that last
// reading, so readings older than MAX_AGE_HOURS are treated as missing.
// Returns { text, tempF } so scheduler can build the combined air+water line.
// No API key required.

const STATION_ID    = '01474703';
const BASE_URL      = 'https://waterservices.usgs.gov/nwis/iv/';
const MAX_AGE_HOURS = 6;

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

    const latest = timeSeries[timeSeries.length - 1];
    const ageHrs = (Date.now() - new Date(latest.dateTime).getTime()) / 3600000;
    if (!(ageHrs <= MAX_AGE_HOURS)) {
      throw new Error(`Latest water temperature reading is stale (${latest.dateTime})`);
    }

    const tempC = parseFloat(latest.value);
    const tempF = celsiusToFahrenheit(tempC);

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
