// Fetches the extended marine forecast from NWS Mt Holly
// Zone ANZ430 — Delaware Bay waters north of East Point NJ to Slaughter Beach DE
// Uses the NWS product API (api.weather.gov) which is reliably accessible
// from cloud hosting environments like Render.
// No API key required.

// Two URLs: the product endpoint returns the latest CWF (Coastal Waters Forecast)
// for the Philadelphia/Mt Holly office, which covers ANZ430.
const PRODUCT_URL = 'https://api.weather.gov/products/types/CWF/locations/PHI';
const HEADERS     = { 'User-Agent': 'DarbyBot/1.0 (groupme-marine-bot)' };

// Parse the raw NWS text product into { synopsis, periods[] }
// NWS marine text uses ".PERIOD..." markers and "$$" to end each zone block.
function extractANZ430Block(raw) {
  // Find the ANZ430 section
  const start = raw.indexOf('ANZ430');
  if (start === -1) return null;

  // Find the end of the ANZ430 block (next $$ or ANZ431)
  const after  = raw.slice(start);
  const endIdx = after.search(/\$\$|ANZ431/);
  return endIdx !== -1 ? after.slice(0, endIdx) : after;
}

function parsePeriods(block) {
  const periods = [];
  const chunks  = block.split(/\n(?=\.[A-Z][A-Z\s]+\.\.\.)/);

  for (const chunk of chunks) {
    const match = chunk.match(/^\.([A-Z][A-Z\s]+)\.\.\.([\s\S]+)/);
    if (!match) continue;
    const name = match[1].trim();
    const text = match[2].replace(/\s+/g, ' ').trim();
    if (name && text) periods.push({ name, text });
  }
  return periods;
}

function parseAdvisory(block) {
  const match = block.match(/\.\.\.(.*?(?:ADVISORY|WARNING|WATCH).*?)\.\.\./i);
  return match ? `⚠️ ${match[1].trim()}` : null;
}

async function getMarineForecast(days = 3) {
  try {
    // Step 1: get the list of recent CWF products for PHI office
    const listRes = await fetch(PRODUCT_URL, { headers: HEADERS });
    if (!listRes.ok) throw new Error(`NWS product list returned ${listRes.status}`);

    const listData = await listRes.json();
    const products = listData['@graph'];
    if (!products || products.length === 0) throw new Error('No CWF products found');

    // Step 2: fetch the most recent product text
    const latestUrl = products[0]['@id'];
    const prodRes   = await fetch(latestUrl, { headers: HEADERS });
    if (!prodRes.ok) throw new Error(`NWS product fetch returned ${prodRes.status}`);

    const prodData  = await prodRes.json();
    const raw       = prodData.productText;
    if (!raw) throw new Error('Product text empty');

    // Step 3: extract the ANZ430 block and parse it
    const block = extractANZ430Block(raw);
    if (!block) throw new Error('ANZ430 zone not found in product');

    const advisory = parseAdvisory(block);
    const periods  = parsePeriods(block);

    if (periods.length === 0) throw new Error('No forecast periods parsed');

    const maxPeriods = days * 2;
    const selected   = periods.slice(0, maxPeriods);

    const lines = selected.map(p => {
      const desc = p.text.length > 220 ? p.text.slice(0, 217) + '...' : p.text;
      return `${p.name}:\n${desc}`;
    }).join('\n\n');

    // Parse issuance time from product
    const issued = prodData.issuanceTime
      ? new Date(prodData.issuanceTime).toLocaleString('en-US', {
          month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
        })
      : null;

    const header = [
      `⚓ Marine Forecast — Delaware Bay (Mt Holly NWS)`,
      issued   ? `Updated: ${issued}` : null,
      advisory ? advisory             : null,
    ].filter(Boolean).join('\n');

    return `${header}\n\n${lines}`;
  } catch (err) {
    console.error('Marine forecast error:', err.message);
    return '⚠️ Could not retrieve marine forecast right now. Try again shortly.';
  }
}

module.exports = { getMarineForecast };
