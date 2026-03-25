// Sends a combined weather + tides message every morning at 7:00 AM Eastern.
// Uses node-cron. The MEBOTS_TOKEN and BOT_SHORTNAME env vars are used to
// fetch the list of active groups and broadcast to all of them.

const cron = require('node-cron');
const { getWeather } = require('./weather');
const { getTides } = require('./tides');
const { getWaterTemp } = require('./watertemp');

const MEBOTS_TOKEN    = process.env.MEBOTS_TOKEN;
const BOT_SHORTNAME   = process.env.BOT_SHORTNAME;

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
    const instances = await res.json();
    return instances; // Array of { id, token, group_id, ... }
  } catch (err) {
    console.error('Failed to fetch MeBots instances:', err.message);
    return [];
  }
}

function startScheduler(sendMessage) {
  // Runs at 7:00 AM Eastern every day.
  // Cron timezone requires the 'node-cron' timezone option.
  cron.schedule(
    '0 11 * * *',
    async () => {
      console.log('Scheduler: running 11 AM broadcast...');
      const [weatherMsg, tidesMsg, waterTempMsg] = await Promise.all([
        getWeather(), getTides(), getWaterTemp(),
      ]);
      const fullMsg = `Good morning from DarbyBot! ☀️\n\n${weatherMsg}\n\n${tidesMsg}\n\n${waterTempMsg}`;

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
