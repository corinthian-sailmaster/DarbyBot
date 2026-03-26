require('dotenv').config();
const express = require('express');
const { getWeather } = require('./weather');
const { getTides } = require('./tides');
const { getWaterTemp } = require('./watertemp');
const { getMarineForecast } = require('./marine');
const { startScheduler } = require('./scheduler');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sendMessage(botId, text) {
  const res = await fetch('https://api.groupme.com/v3/bots/post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bot_id: botId, text }),
  });
  if (!res.ok) {
    console.error(`GroupMe post failed: ${res.status} ${await res.text()}`);
  }
}

// ── Incoming message webhook ───────────────────────────────────────────────────

app.post('/callback', async (req, res) => {
  res.sendStatus(200); // Acknowledge immediately

  const { text, sender_type, bot_id } = req.body;

  if (sender_type === 'bot') return;
  if (!text || !bot_id) return;

  console.log(`Incoming: [${sender_type}] "${text}"`);

  const command = text.trim().toLowerCase();

  if (command === '!weather') {
    const weather = await getWeather();
    await sendMessage(bot_id, weather.text);

  } else if (command === '!tides') {
    const msg = await getTides();
    await sendMessage(bot_id, msg);

  } else if (command === '!watertemp') {
    const wt = await getWaterTemp();
    await sendMessage(bot_id, wt.text);

  } else if (command === '!marine') {
    // Default: 3-day forecast
    const msg = await getMarineForecast(3);
    await sendMessage(bot_id, msg);

  } else if (command.startsWith('!marine ')) {
    // Allow !marine 1, !marine 2, !marine 5, etc.
    const days = parseInt(command.split(' ')[1], 10);
    const safeDays = (!isNaN(days) && days >= 1 && days <= 7) ? days : 3;
    const msg = await getMarineForecast(safeDays);
    await sendMessage(bot_id, msg);

  } else if (command === '!help') {
    await sendMessage(bot_id,
      `☀️ Hello, World!` +  
      `🤖 DarbyBot fetches weather data for Darby Creek at the Delaware River. Allow a minute for initialization. Always remember that weather and tide forecasts are a starting point; use judgement and proceed with caution.` +
      `📍 Try these commands:\n` +
      `!weather      — current conditions at PHL\n` +
      `!tides        — today\'s high & low tides\n` +
      `!watertemp    — Delaware River water temperature\n` +
      `!marine       — 3-day Delaware Bay marine forecast\n` +
      `!marine [1-7] — marine forecast for N days\n` +
      `!help         — show this message` +
      `📍 DarbyBot is maintained by the Main Line Scholastic Sailing Association of The Corinthian Yacht Club of Philadelphia`
    );
  }
});

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/ping', (req, res) => res.send('pong'));

// ── Start ──────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`DarbyBot listening on port ${PORT}`);
  startScheduler(sendMessage);
});
