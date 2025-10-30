// Set the airdrop end date
const endDate = new Date("2025-11-1T15:20:00").getTime(); // Change this date

function updateTimer() {
  const now = new Date().getTime();
  const distance = endDate - now;

  if (distance <= 0) {
    document.getElementById("timer").innerHTML = "Airdrop Ended!";
    clearInterval(interval);
    return;
  }

  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  document.getElementById(
    "timer"
  ).innerHTML = `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

const interval = setInterval(updateTimer, 1000);
updateTimer(); // Run immediately so it doesn't show "Loading..."
