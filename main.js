// main.js

//--------------------------------------------------
// 1) Load environment variables
//--------------------------------------------------
require("dotenv").config();
const dotenv = require("dotenv");
dotenv.config();

//--------------------------------------------------
// 2) Imports
//--------------------------------------------------
const { ethers } = require("ethers");
// If Node < 18, you need node-fetch:
// const fetch = require("node-fetch");

//--------------------------------------------------
// 3) Simple console startup
//--------------------------------------------------
console.log("Script started! Listening for pending tx...");

//--------------------------------------------------
// 4) Telegram Send Function
//--------------------------------------------------
async function sendTelegramMessage(messageText) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

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
// 5) Providers
//--------------------------------------------------
// Alchemy (or other) HTTP Provider for getTransaction() calls
const httpProviderUrl = process.env.PROVIDER_HTTP;
const provider = new ethers.providers.JsonRpcProvider(httpProviderUrl);

// Alchemy (or other) WSS Provider for mempool
const wssProviderUrl = process.env.PROVIDER_WSS;
const providerWSS = new ethers.providers.WebSocketProvider(wssProviderUrl);

//--------------------------------------------------
// 6) Uniswap V3 Address & ERC20 ABI
//--------------------------------------------------
const addressUniswapV3 = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const abiERC20 = [
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

//--------------------------------------------------
// 7) Main Function
//--------------------------------------------------
const main = async () => {
  // Listen for ALL pending tx
  providerWSS.on("pending", async (txHash) => {
    // For debugging, log each pending tx hash
    console.log("New pending tx:", txHash);

    try {
      // Get the transaction details from the chain
      const tx = await provider.getTransaction(txHash);

      // Only proceed if this transaction calls Uniswap V3
      if (tx && tx.to === addressUniswapV3) {
        // Also check if data length is 522 (typical of a certain swap function)
        if (tx.data.length === 522) {
          // Decode the data (skip the first 4 bytes = function selector)
          const dataSlice = ethers.utils.hexDataSlice(tx.data, 4);

          const decoded = ethers.utils.defaultAbiCoder.decode(
            [
              "address", // tokenIn
              "address", // tokenOut
              "uint24",  // fee
              "address", // recipient
              "uint256", // amountIn
              "uint256", // amountOutMinimum
              "uint256", // amountInMaximum (or deadline param)
              "uint160", // sqrtPriceLimitX96
            ],
            dataSlice
          );

          // Log results to console
          console.log("\nOpen Transaction:", tx.hash);
          console.log(decoded);

          // Interpret the tokens
          const contract0 = new ethers.Contract(decoded[0], abiERC20, provider);
          const contract1 = new ethers.Contract(decoded[1], abiERC20, provider);

          // Fetch symbols/decimals
          const symbol0 = await contract0.symbol();
          const symbol1 = await contract1.symbol();
          const decimals0 = await contract0.decimals();
          const decimals1 = await contract1.decimals();

          // Calculate amounts in human-readable form
          const amountOut = Number(
            ethers.utils.formatUnits(decoded[5], decimals1)
          );
          const amountInMax = Number(
            ethers.utils.formatUnits(decoded[6], decimals0)
          );

          console.log("symbol0:", symbol0, decimals0);
          console.log("symbol1:", symbol1, decimals1);
          console.log("amountOut:", amountOut);
          console.log("amountInMax:", amountInMax);

          // Build a Telegram message
          const telegramMsg = `
Open Transaction: ${tx.hash}
tokenIn (symbol0): ${symbol0} (decimals: ${decimals0})
tokenOut (symbol1): ${symbol1} (decimals: ${decimals1})
amountOut (Min): ${amountOut}
amountInMax: ${amountInMax}
`.trim();

          // Send it via Telegram
          await sendTelegramMessage(telegramMsg);
        }
      }
    } catch (err) {
      console.log("Error fetching or decoding tx:", err);
    }
  });
};

//--------------------------------------------------
// 8) Run main()
//--------------------------------------------------
main();
