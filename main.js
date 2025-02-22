// main.js

//--------------------------------------------------
// 1) Imports & Environment Variables
//--------------------------------------------------
const ethers = require("ethers");
const dotenv = require("dotenv");
dotenv.config();

// If Node < 18, install node-fetch: npm install node-fetch
// Then uncomment the line below:
// const fetch = require("node-fetch");

//--------------------------------------------------
// 2) Telegram Send Function
//--------------------------------------------------
async function sendTelegramMessage(messageText) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN; // e.g. 123456789:ABC-YourToken
    const chatId = process.env.TELEGRAM_CHAT_ID;     // e.g. 123456789

    if (!botToken || !chatId) {
      console.error("Telegram token or chat ID missing in .env!");
      return;
    }

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const body = {
      chat_id: chatId,
      text: messageText
    };

    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Telegram API error:", errText);
    } else {
      console.log("Telegram notification sent!");
    }
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
  }
}

//--------------------------------------------------
// 3) Main Logic
//--------------------------------------------------
async function main() {
  // A startup message
  console.log("Script started. Subscribing to ALL pending tx. Stand by...");

  // Create a WebSocket provider
  const wssProviderUrl = process.env.PROVIDER_WSS; 
  if (!wssProviderUrl) {
    console.error("No PROVIDER_WSS found in .env");
    return;
  }

  const providerWSS = new ethers.providers.WebSocketProvider(wssProviderUrl);

  // Listen for EVERY pending transaction
  providerWSS.on("pending", async (txHash) => {
    console.log("New pending tx:", txHash);

    // Send the txHash via Telegram
    await sendTelegramMessage(`New pending tx: ${txHash}`);
  });
}

//--------------------------------------------------
// 4) Run the Script
//--------------------------------------------------
main();

