const { normalizeItemNames } = require('../src/lib/services/aiService');

async function test() {
  const titles = [
    "All-new Echo Dot (5th Gen, 2022 release) | Smart speaker with Alexa | Charcoal",
    "Wyze Cam v3 with Color Night Vision, Wired 1080p HD Indoor/Outdoor Video Camera, 2-Way Audio, Works with Alexa, Google Assistant, and IFTTT",
    "Bounty Quick-Size Paper Towels, White, 8 Family Rolls = 20 Regular Rolls",
    "TP-Link AC1750 Smart WiFi Router (Archer C7) - Dual Band Gigabit Wireless Internet Router for Home, Works with Alexa, VPN Server, Parental Control, QoS"
  ];

  console.log("Normalizing titles...");
  const results = await normalizeItemNames(titles);
  console.log(JSON.stringify(results, null, 2));
}

// Mock environment variables for local test if needed
process.env.OPENAI_API_KEY = "sk-placeholder";
process.env.OPENAI_BASE_URL = "http://ollama.castertr0y357.net/v1";
process.env.AI_MODEL = "gemma4:e4b";

test().catch(console.error);
