// Sends a combined weather + tides + water temp message every day at 11:00 AM Eastern.

const cron = require('node-cron');
const { getWeather } = require('./weather');
const { getTides } = require('./tides');
const { getWaterTemp } = require('./watertemp');

const MEBOTS_TOKEN  = process.env.MEBOTS_TOKEN;
const BOT_SHORTNAME = process.env.BOT_SHORTNAME;
console.log(`Fetching: https://mebots.io/api/bots/${BOT_SHORTNAME}/instances?token=${MEBOTS_TOKEN?.slice(0,6)}...`);
async function getActiveInstances() {
  if (!MEBOTS_TOKEN || !BOT_SHORTNAME) {
    console.warn('Scheduler: MEBOTS_TOKEN or BOT_SHORTNAME not set — skipping broadcast.');
    return [];
  }
  try {
    const res = await fetch(
      `https://mebots.io/api/bots/${BOT_SHORTNAME}/instances?token=${MEBOTS_TOKEN}`
    );
    if (!res.ok) throw new Error(`MeBots API returned ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch MeBots instances:', err.message);
    return [];
  }
}

function buildCombinedLine(airHigh, waterTempF) {
  if (airHigh == null || waterTempF == null) return null;
  const combined = airHigh + waterTempF;
  const icon = combined > 140 ? '☀️' : '❄️';
  return `${icon} Air High + Water Temp: ${airHigh}°F + ${waterTempF}°F = ${combined.toFixed(1)}`;
}

function startScheduler(sendMessage) {
  cron.schedule(
    '0 08 * * *',
    async () => {
      console.log('Scheduler: running 11 AM broadcast...');

      const [weather, tidesMsg, waterTemp] = await Promise.all([
        getWeather(),
        getTides(),
        getWaterTemp(),
      ]);

      const combinedLine = buildCombinedLine(weather.high, waterTemp.tempF);

      const parts = [
        'Good morning from DarbyBot! ☀️',
        weather.text,
        tidesMsg,
        waterTemp.text,
      ];
      if (combinedLine) parts.push(combinedLine);

      const fullMsg = parts.join('\n\n');

      const instances = await getActiveInstances();
      if (instances.length === 0) {
        console.log('Scheduler: no active instances found.');
        return;
      }
      for (const instance of instances) {
        await sendMessage(instance.id, fullMsg);
        console.log(`Scheduler: sent to group ${instance.group_id}`);
      }
    },
    { timezone: 'America/New_York' }
  );

  console.log('Scheduler: daily 11 AM Eastern broadcast armed.');
}

module.exports = { startScheduler };
