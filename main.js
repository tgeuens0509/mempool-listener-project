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
    const chatId = process.env.TELEGRAM_CHAT_ID;     // e.g. -100XXXXXXXX (for a group) or just a number

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
// 3) Setup Providers
//--------------------------------------------------
// - HTTP provider used for "getTransaction(txHash)" calls
// - WebSocket provider used to subscribe to "pending" transactions

const httpProviderUrl = process.env.PROVIDER_HTTP; 
const provider = new ethers.providers.JsonRpcProvider(httpProviderUrl);

const wssProviderUrl = process.env.PROVIDER_WSS; 
const providerWSS = new ethers.providers.WebSocketProvider(wssProviderUrl);

//--------------------------------------------------
// 4) Uniswap V3 Info
//--------------------------------------------------
const addressUniswapV3 = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

// Minimal ERC20 ABI to read symbol/decimals
const abiERC20 = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

//--------------------------------------------------
// 5) Main Function: Listen to ALL pending tx, decode Uniswap
//--------------------------------------------------
async function main() {
  console.log("Script started! Listening to ALL pending tx...");
  
  providerWSS.on("pending", async (txHash) => {
    // 5.1) Quick log so we know it's seeing the mempool
    console.log("Pending tx:", txHash);
    
    try {
      // 5.2) Fetch the transaction via HTTP
      const tx = await provider.getTransaction(txHash);
      if (!tx) return; // Sometimes null if not in node's mempool yet

      // 5.3) Check if it’s going to Uniswap V3
      if (tx.to && tx.to.toLowerCase() === addressUniswapV3.toLowerCase()) {
        // Optional check: if tx.data.length is 522, indicates a certain swap function
        if (tx.data && tx.data.length === 522) {
          // 5.4) Decode
          const dataSlice = ethers.utils.hexDataSlice(tx.data, 4);
          const decoded = ethers.utils.defaultAbiCoder.decode(
            [
              "address", // tokenIn
              "address", // tokenOut
              "uint24",  // fee
              "address", // recipient
              "uint256", // amountIn
              "uint256", // amountOutMinimum
              "uint256", // amountInMaximum or deadline param
              "uint160", // sqrtPriceLimitX96
            ],
            dataSlice
          );

          console.log("\n--- Uniswap V3 Pending Tx ---");
          console.log("Tx Hash:", tx.hash);
          console.log("Decoded Data:", decoded);

          // 5.5) Fetch token symbols/decimals
          const contractIn = new ethers.Contract(decoded[0], abiERC20, provider);
          const contractOut = new ethers.Contract(decoded[1], abiERC20, provider);

          try {
            const [symbolIn, symbolOut, decimalsIn, decimalsOut] = await Promise.all([
              contractIn.symbol(),
              contractOut.symbol(),
              contractIn.decimals(),
              contractOut.decimals(),
            ]);

            // 5.6) Format amounts
            const amountIn = ethers.utils.formatUnits(decoded[4], decimalsIn);
            const amountOutMin = ethers.utils.formatUnits(decoded[5], decimalsOut);

            // 5.7) Print a console readout
            console.log("Token In:", symbolIn, `(decimals: ${decimalsIn})`);
            console.log("Token Out:", symbolOut, `(decimals: ${decimalsOut})`);
            console.log("Amount In:", amountIn);
            console.log("Amount Out Min:", amountOutMin);
            console.log("--- End TX ---\n");

            // 5.8) Build a Telegram message
            const telegramMsg = `
*Uniswap V3 Pending Tx*
Hash: ${tx.hash}
Token In: ${symbolIn} (decimals: ${decimalsIn})
Token Out: ${symbolOut} (decimals: ${decimalsOut})
Amount In: ${amountIn}
Amount Out (Min): ${amountOutMin}
            `.trim();

            // 5.9) Send Telegram notification
            await sendTelegramMessage(telegramMsg);

          } catch (metaErr) {
            console.error("Error getting token metadata:", metaErr);
          }
        }
      }
    } catch (err) {
      console.error("Error processing tx:", err);
    }
  });
}

//--------------------------------------------------
// 6) Start the main function
//--------------------------------------------------
main();
