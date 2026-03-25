require('dotenv').config();
const express = require('express');
const { getWeather } = require('./weather');
const { getTides } = require('./tides');
const { getWaterTemp } = require('./watertemp');
const { startScheduler } = require('./scheduler');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Incoming message webhook ──────────────────────────────────────────────────

app.post('/callback', async (req, res) => {
  res.sendStatus(200); // Acknowledge immediately
  console.log(`Incoming: [${sender_type}] "${text}"`);
```
  const { text, sender_type, bot_id } = req.body;

  // Ignore messages sent by bots (prevents infinite loops)
  if (sender_type === 'bot') return;
  if (!text || !bot_id) return;

  const command = text.trim().toLowerCase();

  if (command === '!weather') {
    const msg = await getWeather();
    await sendMessage(bot_id, msg);
  } else if (command === '!tides') {
    const msg = await getTides();
    await sendMessage(bot_id, msg);
  } else if (command === '!watertemp') {
    const msg = await getWaterTemp();
    await sendMessage(bot_id, msg);
  } else if (command === '!help') {
    await sendMessage(bot_id,
      '📍 DarbyBot Commands:\n' +
      '!weather   — current conditions at PHL\n' +
      '!tides     — today\'s high & low tides\n' +
      '!watertemp — Delaware River water temperature\n' +
      '!help      — show this message'
    );
  }
});

// ── Health check (keeps Render awake, used by UptimeRobot) ───────────────────

app.get('/ping', (req, res) => res.send('pong'));

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Essington bot listening on port ${PORT}`);
  startScheduler(sendMessage);
});
