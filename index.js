require("dotenv").config();
const http = require("http");
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// ========= Keep-alive server (Render port binding) =========
const PORT = process.env.PORT || 10000;
http
  .createServer((req, res) => {
    if (req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("OK");
    }
    if (req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("OK");
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  })
  .listen(PORT, () => {
    console.log(`Keep-alive server running on port ${PORT}`);
  });

// ========= Office time settings =========
const TIMEZONE = "Asia/Dhaka";
const START_HOUR = 9;
const START_MIN = 30; // 9:30
const END_HOUR = 18;
const END_MIN = 30; // 6:30

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

// ========= Slash command: /test =========
async function registerCommands() {
  // Global command: সব server এ কাজ করবে, কিন্তু update হতে 5-60 min লাগতে পারে
  // দ্রুত দেখতে চাইলে guild command করা লাগে, কিন্তু আপনার জন্য global রাখলাম।
  try {
    await client.application.commands.set([
      {
        name: "test",
        description: "Send a test report message in the configured channel",
      },
    ]);
    console.log("Slash command registered: /test");
  } catch (e) {
    console.log("Command register error:", e);
  }
}

client.once("clientReady", async () => {
  console.log(`Bot logged in as ${client.user.tag}`);

  // Presence (online দেখাতে)
  try {
    client.user.setPresence({
      activities: [{ name: "Hourly Task Report", type: 0 }],
      status: "online",
    });
  } catch (e) {
    console.log("Presence error:", e);
  }

  // Register /test
  await registerCommands();

  // Startup test message (1 বার)
  try {
    const channel = await client.channels.fetch(process.env.CHANNEL_ID);
    if (channel) {
      await channel.send("✅ Bot restarted. Office-time reminders enabled.");
    }
  } catch (e) {
    console.log("Startup message error:", e);
  }

  // প্রতি 20 সেকেন্ডে check, send হবে শুধু xx:30 এ
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

// Handle /test interaction
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "test") return;

    const channel = await client.channels.fetch(process.env.CHANNEL_ID);
    if (!channel) {
      return interaction.reply({
        content: "CHANNEL_ID wrong or bot has no access.",
        ephemeral: true,
      });
    }

    await channel.send("🧪 Test message\n\n" + buildMessage());
    await interaction.reply({ content: "Sent ✅", ephemeral: true });
  } catch (e) {
    try {
      if (interaction.replied || interaction.deferred) return;
      await interaction.reply({ content: "Error occurred.", ephemeral: true });
    } catch {}
    console.log("Interaction error:", e);
  }
});

client.login(process.env.BOT_TOKEN);
