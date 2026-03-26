// Fetches today's high/low tide predictions from NOAA
// Station 8545240 — Philadelphia (closest active station to Essington)
// Moon phase calculated locally using the lunar cycle — no API needed.
// No API key required.

const STATION_ID = '8545240';

// ── Moon phase ────────────────────────────────────────────────────────────────

// Reference new moon: January 6, 2000 at 18:14 UTC (a well-known astronomical epoch)
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const LUNAR_CYCLE_MS    = 29.53059 * 24 * 60 * 60 * 1000;

function getMoonPhase(date = new Date()) {
  const elapsed   = date.getTime() - KNOWN_NEW_MOON_MS;
  const cyclePos  = ((elapsed % LUNAR_CYCLE_MS) + LUNAR_CYCLE_MS) % LUNAR_CYCLE_MS;
  const pct       = cyclePos / LUNAR_CYCLE_MS; // 0.0 = new moon, 0.5 = full moon

  // Named phases with emoji
  if      (pct < 0.033)  return { name: 'New Moon',        emoji: '🌑', pct };
  else if (pct < 0.216)  return { name: 'Waxing Crescent', emoji: '🌒', pct };
  else if (pct < 0.283)  return { name: 'First Quarter',   emoji: '🌓', pct };
  else if (pct < 0.466)  return { name: 'Waxing Gibbous',  emoji: '🌔', pct };
  else if (pct < 0.533)  return { name: 'Full Moon',       emoji: '🌕', pct };
  else if (pct < 0.716)  return { name: 'Waning Gibbous',  emoji: '🌖', pct };
  else if (pct < 0.783)  return { name: 'Last Quarter',    emoji: '🌗', pct };
  else if (pct < 0.966)  return { name: 'Waning Crescent', emoji: '🌘', pct };
  else                   return { name: 'New Moon',        emoji: '🌑', pct };
}

// Days until the next full or new moon (whichever is sooner)
function getNextMilestone(pct) {
  const daysInCycle = 29.53059;
  const daysElapsed = pct * daysInCycle;

  const daysToFull = pct < 0.5
    ? (0.5 - pct) * daysInCycle
    : (1.5 - pct) * daysInCycle;

  const daysToNew  = pct < 1
    ? (1.0 - pct) * daysInCycle
    : (2.0 - pct) * daysInCycle;

  if (daysToFull <= daysToNew) {
    return `Full moon in ${Math.round(daysToFull)}d`;
  } else {
    return `New moon in ${Math.round(daysToNew)}d`;
  }
}

// ── Tide helpers ──────────────────────────────────────────────────────────────

function todayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function formatTime(isoString) {
  const parts = isoString.split(' ');
  if (parts.length < 2) return isoString;
  const [hour, min] = parts[1].split(':').map(Number);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12  = hour % 12 || 12;
  return `${h12}:${String(min).padStart(2, '0')} ${ampm}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

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
      headers: { 'User-Agent': 'DarbyBot/1.0 (groupme-tide-bot)' },
    });
    if (!res.ok) throw new Error(`NOAA tides API returned ${res.status}`);

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const predictions = data.predictions;
    if (!predictions || predictions.length === 0) {
      return '⚠️ No tide data available for today.';
    }

    const lines = predictions.map((p) => {
      const type   = p.type === 'H' ? '🔼 High' : '🔽 Low ';
      const time   = formatTime(p.t);
      const height = parseFloat(p.v).toFixed(1);
      return `${type}  ${height} ft  @ ${time}`;
    });

    const now     = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });

    const moon      = getMoonPhase(now);
    const milestone = getNextMilestone(moon.pct);
    const moonLine  = `${moon.emoji} ${moon.name} · ${milestone}`;

    return (
      `🌊 DarbyBot Tides — ${dateStr}\n` +
      `(Philadelphia NOAA Station)\n` +
      lines.join('\n') + '\n' +
      moonLine
    );
  } catch (err) {
    console.error('Tides fetch error:', err.message);
    return '⚠️ Could not retrieve tide data right now. Try again shortly.';
  }
}

module.exports = { getTides };
