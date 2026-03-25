// Fetches today's high/low tide predictions from NOAA
// Station 8545240 — Philadelphia (closest active station to Essington)
// No API key required.

const STATION_ID = '8545240';

function todayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function formatTime(isoString) {
  // NOAA returns times like "2025-07-04 06:12"
  const parts = isoString.split(' ');
  if (parts.length < 2) return isoString;
  const [hour, min] = parts[1].split(':').map(Number);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12  = hour % 12 || 12;
  return `${h12}:${String(min).padStart(2, '0')} ${ampm}`;
}

async function getTides() {
  try {
    const today = todayString();
    const url =
      `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter` +
      `?station=${STATION_ID}` +
      `&product=predictions` +
      `&datum=MLLW` +
      `&time_zone=lst_ldt` +
      `&interval=hilo` +
      `&units=english` +
      `&format=json` +
      `&begin_date=${today}` +
      `&end_date=${today}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'EsssingtonBot/1.0 (groupme-tide-bot)' },
    });
    if (!res.ok) throw new Error(`NOAA tides API returned ${res.status}`);

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const predictions = data.predictions;
    if (!predictions || predictions.length === 0) {
      return '⚠️ No tide data available for today.';
    }

    const lines = predictions.map((p) => {
      const type  = p.type === 'H' ? '🔼 High' : '🔽 Low ';
      const time  = formatTime(p.t);
      const height = parseFloat(p.v).toFixed(1);
      return `${type}  ${height} ft  @ ${time}`;
    });

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric'
    });

    return (
      `🌊 DarbyBot Tides — ${dateStr}\n` +
      `(Philadelphia NOAA Station)\n` +
      lines.join('\n')
    );
  } catch (err) {
    console.error('Tides fetch error:', err.message);
    return '⚠️ Could not retrieve tide data right now. Try again shortly.';
  }
}

module.exports = { getTides };
