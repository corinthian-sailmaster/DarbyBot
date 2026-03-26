// Fetches the extended marine forecast from NWS Mt Holly
// Zone ANZ430 — Delaware Bay waters north of East Point NJ to Slaughter Beach DE
// Uses NOAA's text product server (tgftp.nws.noaa.gov) which is what the
// NWS website itself uses — the api.weather.gov /zones/forecast/ endpoint
// does not support marine zones.
// No API key required.

const TEXT_URL = 'https://tgftp.nws.noaa.gov/data/forecasts/marine/coastal/an/anz430.txt';
const HEADERS  = { 'User-Agent': 'DarbyBot/1.0 (groupme-marine-bot)' };

// Parse the raw NWS text product into an array of { name, text } periods.
// NWS marine text format uses ".PERIODNAME..." as period headers.
function parsePeriods(raw) {
  const periods = [];

  // Strip the header block (everything before the first period marker)
  const bodyStart = raw.indexOf('\n.');
  if (bodyStart === -1) return periods;
  const body = raw.slice(bodyStart);

  // Split on period markers like ".TODAY...", ".TONIGHT...", ".WEDNESDAY..."
  const chunks = body.split(/\n(?=\.[A-Z][A-Z\s]+\.\.\.)/);

  for (const chunk of chunks) {
    const match = chunk.match(/^\.([A-Z][A-Z\s]+)\.\.\.([\s\S]+)/);
    if (!match) continue;
    const name = match[1].trim();
    const text = match[2].replace(/\s+/g, ' ').trim();
    if (name && text) periods.push({ name, text });
  }

  return periods;
}

// Extract any active advisories from the header (e.g. SMALL CRAFT ADVISORY)
function parseAdvisory(raw) {
  const match = raw.match(/\.\.\.(.*?ADVISORY.*?|.*?WARNING.*?|.*?WATCH.*?)\.\.\./i);
  return match ? `⚠️ ${match[1].trim()}` : null;
}

async function getMarineForecast(days = 3) {
  try {
    const res = await fetch(TEXT_URL, { headers: HEADERS });
    if (!res.ok) throw new Error(`NOAA text server returned ${res.status}`);

    const raw = await res.text();

    const advisory = parseAdvisory(raw);
    const periods  = parsePeriods(raw);

    if (periods.length === 0) {
      throw new Error('Could not parse forecast periods from text product');
    }

    // Each day = day period + night period = up to 2 entries
    const maxPeriods = days * 2;
    const selected   = periods.slice(0, maxPeriods);

    const lines = selected.map(p => {
      const desc = p.text.length > 220 ? p.text.slice(0, 217) + '...' : p.text;
      return `${p.name}:\n${desc}`;
    }).join('\n\n');

    const header = [
      `⚓ Marine Forecast — Delaware Bay (Mt Holly NWS)`,
      advisory,
    ].filter(Boolean).join('\n');

    return `${header}\n\n${lines}`;
  } catch (err) {
    console.error('Marine forecast error:', err.message);
    return '⚠️ Could not retrieve marine forecast right now. Try again shortly.';
  }
}

module.exports = { getMarineForecast };
