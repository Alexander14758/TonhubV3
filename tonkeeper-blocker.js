
// Tonkeeper Wallet Blocker
// This file blocks Tonkeeper wallet connections
// Delete this file to allow Tonkeeper connections

function checkAndBlockTonkeeper(wallet) {
  if (!wallet || !wallet.account?.address) return false;

  // Check if connected wallet is Tonkeeper with comprehensive debugging
  console.log("Connected wallet full object:", wallet);
  console.log("Connected wallet device:", wallet.device);

  // More comprehensive Tonkeeper detection
  const deviceName = wallet.device?.name?.toLowerCase() || '';
  const appName = wallet.device?.appName?.toLowerCase() || '';
  const platform = wallet.device?.platform?.toLowerCase() || '';

  console.log("Device name:", deviceName);
  console.log("App name:", appName);
  console.log("Platform:", platform);

  // Detect Tonkeeper wallet by checking multiple possible identifiers
  const isTokeeper = wallet.device && (
    deviceName.includes('tonkeeper') ||
    appName.includes('tonkeeper') ||
    deviceName === 'tonkeeper' ||
    appName === 'tonkeeper' ||
    deviceName === 'tonkeeper pro' ||
    appName === 'tonkeeper-pro' ||
    deviceName.includes('tonkeeper pro')
  );

  console.log("Is Tonkeeper detected:", isTokeeper);

  if (isTokeeper) {
    // Alert user and disconnect
    alert("❌ Tonkeeper Wallet Not Supported\n\nThis application does not support Tonkeeper wallet connections. Please connect using other supported wallets like Telegram-wallet, Tonhub, MyTonWallet, or other compatible wallets.");

    console.log("Attempting to disconnect Tonkeeper...");
    return true; // Indicates Tonkeeper was detected and should be blocked
  }

  return false; // Wallet is not Tonkeeper, allow connection
}

// Make function available globally
window.checkAndBlockTonkeeper = checkAndBlockTonkeeper;
