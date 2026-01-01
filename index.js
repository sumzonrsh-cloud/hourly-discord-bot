const http = require("http");

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OK");
}).listen(PORT, () => {
  console.log("Keep-alive server running on port", PORT);
});
require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// Office time (Asia/Dhaka)
const TIMEZONE = "Asia/Dhaka";
const START_HOUR = 9;
const START_MIN = 30;
const END_HOUR = 18;
const END_MIN = 30;

function getDhakaTimeParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date());

  const map = {};
  for (const p of parts) map[p.type] = p.value;

  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    hh: Number(map.hour),
    mm: Number(map.minute),
  };
}

function isWithinOfficeWindow(hh, mm) {
  const now = hh * 60 + mm;
  const start = START_HOUR * 60 + START_MIN;
  const end = END_HOUR * 60 + END_MIN;
  return now >= start && now <= end;
}

function buildMessage() {
  return (
    "@everyone\n" +
    "⏰ Hourly Task Report\n\n" +
    "Please submit:\n" +
    "• Dialed:\n" +
    "• Receive:\n" +
    "• Confirmed:"
  );
}

let lastSentKey = "";

client.once("clientReady", async () => {
  console.log(`Bot logged in as ${client.user.tag}`);

  setInterval(async () => {
    try {
      const { y, m, d, hh, mm } = getDhakaTimeParts();

      if (mm !== 30) return;
      if (!isWithinOfficeWindow(hh, mm)) return;

      const key = `${y}-${m}-${d} ${hh}:${mm}`;
      if (key === lastSentKey) return;

      const channel = await client.channels.fetch(process.env.CHANNEL_ID);
      if (!channel) return;

      await channel.send(buildMessage());
      lastSentKey = key;
    } catch (err) {
      console.log("Send error:", err);
    }
  }, 20 * 1000);
});

client.login(process.env.BOT_TOKEN);
