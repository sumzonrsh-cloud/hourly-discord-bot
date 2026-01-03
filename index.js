require("dotenv").config();
const http = require("http");
const { Client, GatewayIntentBits } = require("discord.js");

/* =======================
   Discord Client
======================= */
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

/* =======================
   Keep-alive Server
======================= */
const PORT = process.env.PORT || 10000;
http
  .createServer((req, res) => {
    if (req.url === "/" || req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("OK");
    }
    res.writeHead(404);
    res.end("Not Found");
  })
  .listen(PORT, () => {
    console.log(`Keep-alive server running on port ${PORT}`);
  });

/* =======================
   Office Time Config
======================= */
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
    "• Received:\n" +
    "• Confirmed:"
  );
}

let lastSentKey = "";

/* =======================
   Slash Command Register
======================= */
async function registerCommands() {
  try {
    await client.application.commands.set([
      {
        name: "test",
        description: "Send a test report message",
      },
    ]);
    console.log("Slash command registered: /test");
  } catch (e) {
    console.log("Command register error:", e);
  }
}

/* =======================
   Ready Event
======================= */
client.once("ready", async () => {
  console.log(`Bot logged in as ${client.user.tag}`);

  try {
    client.user.setPresence({
      activities: [{ name: "Hourly Task Report", type: 0 }],
      status: "online",
    });
  } catch (e) {
    console.log("Presence error:", e);
  }

  await registerCommands();

  try {
    const channel = await client.channels.fetch(process.env.CHANNEL_ID);
    if (channel) {
      await channel.send("✅ Bot restarted. Office-time reminders enabled.");
    }
  } catch (e) {
    console.log("Startup message error:", e);
  }

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

/* =======================
   Slash Command Handler
======================= */
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "test") return;

    await interaction.deferReply({ ephemeral: true });

    const channel = await client.channels.fetch(process.env.CHANNEL_ID);
    if (!channel) {
      return interaction.editReply(
        "CHANNEL_ID wrong or bot has no access."
      );
    }

    await channel.send("🧪 Test message\n\n" + buildMessage());
    await interaction.editReply("Sent ✅");
  } catch (e) {
    console.log("Interaction error:", e);
    try {
      if (interaction.deferred) {
        await interaction.editReply("Error occurred.");
      } else if (!interaction.replied) {
        await interaction.reply({
          content: "Error occurred.",
          ephemeral: true,
        });
      }
    } catch {}
  }
});

/* =======================
   Safety Logs
======================= */
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

/* =======================
   Login
======================= */
client.login(process.env.BOT_TOKEN);
