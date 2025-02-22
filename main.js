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

//--------------------------------------------------
// 3) Console Startup
//--------------------------------------------------
console.log("Script started! Listening for Uniswap transactions from specific wallets...");

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
// 7) List of Wallets to Track
//--------------------------------------------------
// Define an array of wallet addresses to monitor (all lowercase for easy comparison)
const trackedWallets = new Set([
  "0x1234567890abcdef1234567890abcdef12345678",
  "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
  // Add more wallet addresses here
].map(addr => addr.toLowerCase())); // Convert all to lowercase

//--------------------------------------------------
// 8) Main Function
//--------------------------------------------------
const main = async () => {
  providerWSS.on("pending", async (txHash) => {
    try {
      // Get transaction details
      const tx = await provider.getTransaction(txHash);
      if (!tx) return;

      // Convert addresses to lowercase for consistent matching
      const fromAddress = tx.from?.toLowerCase();
      const toAddress = tx.to?.toLowerCase();

      // ✅ Filter: Only proceed if the transaction involves a tracked wallet
      if (!trackedWallets.has(fromAddress) && !trackedWallets.has(toAddress)) {
        return; // Ignore transactions not involving tracked wallets
      }

      console.log(`🔍 Tracked wallet transaction detected: ${tx.hash}`);

      // ✅ Check if transaction calls Uniswap V3
      if (tx.to === addressUniswapV3 && tx.data.length > 10) {
        // Decode transaction data (skip first 4 bytes)
        const dataSlice = ethers.utils.hexDataSlice(tx.data, 4);
        const decoded = ethers.utils.defaultAbiCoder.decode(
          [
            "address", // tokenIn
            "address", // tokenOut
            "uint24",  // fee
            "address", // recipient
            "uint256", // amountIn
            "uint256", // amountOutMinimum
            "uint256", // amountInMaximum
            "uint160", // sqrtPriceLimitX96
          ],
          dataSlice
        );

        // Log raw transaction details
        console.log("\n🔄 Uniswap Swap Detected:", tx.hash);
        console.log(decoded);

        // Get token contract details
        const contract0 = new ethers.Contract(decoded[0], abiERC20, provider);
        const contract1 = new ethers.Contract(decoded[1], abiERC20, provider);

        // Fetch token symbols & decimals
        const symbol0 = await contract0.symbol();
        const symbol1 = await contract1.symbol();
        const decimals0 = await contract0.decimals();
        const decimals1 = await contract1.decimals();

        // Convert values to human-readable format
        const amountOut = Number(ethers.utils.formatUnits(decoded[5], decimals1));
        const amountInMax = Number(ethers.utils.formatUnits(decoded[6], decimals0));

        console.log("🔹 tokenIn:", symbol0, decimals0);
        console.log("🔹 tokenOut:", symbol1, decimals1);
        console.log("🔹 amountOut (Min):", amountOut);
        console.log("🔹 amountInMax:", amountInMax);

       // ✅ Build a Telegram message (Updated format)
        const telegramMsg = `
🚀 *Uniswap Swap Alert!*
🔹 *Tx Hash:* [View on Etherscan](https://etherscan.io/tx/${txHash})
🔹 *From:* [${fromAddress}](https://etherscan.io/address/${fromAddress})
🔹 *To:* [${toAddress}](https://etherscan.io/address/${toAddress})
🔹 *Token In:* ${symbol0} (Max: ${amountInMax})
🔹 *Token Out:* ${symbol1} (Min: ${amountOut})
        `.trim();

        // ✅ Send alert to Telegram
        await sendTelegramMessage(telegramMsg);
      }
    } catch (err) {
      console.log("❌ Error fetching or decoding tx:", err);
    }
  });
};

//--------------------------------------------------
// 9) Run main()
//--------------------------------------------------
main();
