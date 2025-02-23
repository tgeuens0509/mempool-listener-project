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
      text: messageText,
      parse_mode: "Markdown"
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
// HTTP provider (for token lookups)
const httpProviderUrl = process.env.PROVIDER_HTTP;
const provider = new ethers.providers.JsonRpcProvider(httpProviderUrl);

// WebSocket provider for enhanced subscription
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
const trackedWallets = new Set(
  [
    "0xcadc081aa196c9e9ac0222258252ba903c0bf9b1",
    "0x547c5151ad5003b0639353ea3c3ecb188a63ad24",
    "0xce46abd3b2106a5d530a422317d2f7533578f81d",
    "0xafd4d2f726ec87d309ad5fc2a14808a2fb008d93",
    "0xf30fc0f56db3afd7d33ff0e2101847b4e86f520b",
    "0x665c9e945730cc3e6d1db671b60fc252314929b4",
    "0x4c9b04d373846c55738a0772c1404bb07fd54b66",
    "0x1cf84b3555cbe42b1d95266bf02f53f335185e36",
    "0xb75332cc720ec6cd771646e5bcf46a445c7efa2c",
    "0x4fbf520ba6c8394caf0334b4febf0460ba097fb9",
    "0x4f98f2597bee644fa343c47e82a2e322f41ec1f6",
    "0x938a1def50dc9c84c39beea111c02188f34ec80a",
    "0x37941675ddc7e08d8bb33ab2a25512299a068d46",
    "0xaf6067777949e4a0f55f8ae9bed041b9f1e01b1c",
    "0x74145f6f82a5bfeb9478f068269a2f0d43cb1b0c",
    "0x2474c9b0878663f42613b47b100f7b3feb404483",
    "0xfa3225dae25d37669a23512bdebfcec01be315da",
    "0x3c85f63612a5b351b5edc9615a9e9325c979590a",
    "0xa46f4f85061e20ead4ccae710c95f171331bb75b",
    "0xb728a5fbc8de7a1bcff0b3735acfd007e52134c2",
    "0x728abc998c1b9aa26b8d4ea970541f06f6ecc2c0",
    "0xb034024101343c821d64b253b2ebbb5e2c60ebe5",
    "0x82195b6b7dedf14565cb23ce886212c954312918",
    "0x39a3f6716654e3a279f4236257b00b4030313aed",
    "0xe2329a746c131f5f56a781b2ae18155f053e0ce1",
    "0xf0e3243ac3bbf8190ba8f672edf9f0196b261571",
    "0xaf89f946fa6b59aac08880af427f27dc1935b187",
    "0xa19aa9fe319cf41d6b76b3ab198e78e289e78b2b",
    "0x63222b3cc80a4baa4b33866f53ca7a9d63264b1f",
    "0xdb45558b20ea6b20cff8fbd4aab64355ede0e67e",
    "0xee3617677c7ba424a92b98c59ae6b78498c36b40",
    "0x89a13a733137a988f6bb42927d02ffc0c6b7fb36",
    "0x0829ccfd796660edd90a2f0c8fe72d7a1472fe39",
    "0x52e1c2f77ce083d5bf1498a1cab5c5e2a883892b",
    "0x373d9e67048e5ca3ac859959ddbf0f429e9eaf13",
    "0x1085ee9237fec258a4744fcffd3ff918e4908b61",
    "0x53017520ed045625c169508a250b62146803987c",
    "0x06a26d6513d3810429d2f95bae7aa639fe7dcd51",
    "0x8c09899c305ab37cd8067706de2ac82dd4d54d81",
    "0xed4886e0c4450c1fb78505c3525dbe3e1cba976a",
    "0x29213155d7f43a9cd2876d297c90c224614ec79a",
    "0x4c810cabeab5a37ccd4f37bc03d53d8de85ea65a",
    "0x2d9c51fe1b2c71a8547b00e7504e230153e49d34",
    "0x13b6346938d04840215de252db80da07f375c52b",
    "0xbf98f000a34cee3aee2f57fc3c6c809a0763bce6",
    "0x83fdcc94df4cf84761fcaedd92b49c109f54fa2c",
    "0x83b0d404e6bdf0200c737b202c5a164d74ca4001",
    "0x21491f369b31065a1c741f72ee0f80251c7d6628",
    "0x27556d4aaccd5867acb2c309fb9b5c918c67244b",
    "0x27b6dd2985ef2061992009e535e25944963da54a"
  ].map(addr => addr.toLowerCase())
);

//--------------------------------------------------
// 8) Health Check Counters
//--------------------------------------------------
let totalTxCount = 0;
let swapTxCount = 0;

// Log heartbeat every 60 seconds
setInterval(() => {
  console.log(`❤️ Heartbeat: Processed ${totalTxCount} transactions, ${swapTxCount} swaps detected in the last minute.`);
  totalTxCount = 0;
  swapTxCount = 0;
}, 60000);

//--------------------------------------------------
// 9) Main Function
//--------------------------------------------------
const main = async () => {
  // Prepare filter: track transactions where either the sender or receiver is in our list.
  const filter = {
    fromAddress: Array.from(trackedWallets),
    toAddress: Array.from(trackedWallets)
  };

  try {
    // Note: Use "eth_subscribe" with parameters as per Alchemy docs
    await providerWSS.send("eth_subscribe", ["alchemy_pendingTransactions", filter]);
    console.log("Subscribed to alchemy_pendingTransactions with filter:", filter);
  } catch (err) {
    console.error("Subscription error:", err);
    return;
  }

  // Listen for full transaction objects via the subscription
  providerWSS.on("alchemy_pendingTransactions", async (tx) => {
    try {
      if (!tx) return;
      totalTxCount++;

      // Normalize addresses
      const fromAddress = tx.from?.toLowerCase();
      const toAddress = tx.to?.toLowerCase();

      // Double-check if the transaction involves one of our tracked wallets
      if (!trackedWallets.has(fromAddress) && !trackedWallets.has(toAddress)) {
        return;
      }

      console.log(`🔍 Tracked wallet transaction detected: ${tx.hash}`);

      // Check if transaction is a Uniswap V3 swap (you can extend for other protocols)
      if (tx.to && tx.to.toLowerCase() === addressUniswapV3.toLowerCase() && tx.data && tx.data.length > 10) {
        // Decode transaction data (skip the first 4 bytes which is the function selector)
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

        console.log("\n🔄 Uniswap Swap Detected:", tx.hash);
        console.log(decoded);

        // Fetch token details for readability
        const tokenInContract = new ethers.Contract(decoded[0], abiERC20, provider);
        const tokenOutContract = new ethers.Contract(decoded[1], abiERC20, provider);

        const symbolIn = await tokenInContract.symbol();
        const symbolOut = await tokenOutContract.symbol();
        const decimalsIn = await tokenInContract.decimals();
        const decimalsOut = await tokenOutContract.decimals();

        const amountOutMin = Number(ethers.utils.formatUnits(decoded[5], decimalsOut));
        const amountInMax = Number(ethers.utils.formatUnits(decoded[6], decimalsIn));

        console.log("🔹 Token In:", symbolIn, `(decimals: ${decimalsIn})`);
        console.log("🔹 Token Out:", symbolOut, `(decimals: ${decimalsOut})`);
        console.log("🔹 Amount Out (Min):", amountOutMin);
        console.log("🔹 Amount In (Max):", amountInMax);

        swapTxCount++;

        // Build and send Telegram message
        const telegramMsg = `
🚀 *Uniswap Swap Alert!*
🔹 *Tx Hash:* [View on Etherscan](https://etherscan.io/tx/${tx.hash})
🔹 *From:* [${fromAddress}](https://etherscan.io/address/${fromAddress})
🔹 *To:* [${toAddress}](https://etherscan.io/address/${toAddress})
🔹 *Swapped:* ${symbolIn} → ${symbolOut}
🔹 *Amount In (Max):* ${amountInMax}
🔹 *Amount Out (Min):* ${amountOutMin}
        `.trim();

        await sendTelegramMessage(telegramMsg);
      }
    } catch (err) {
      console.log("❌ Error processing transaction:", err);
    }
  });
};

//--------------------------------------------------
// 10) Run main()
//--------------------------------------------------
main();
