const refreshButton = document.getElementById("refresh");
const tabCountEl = document.getElementById("tab-count");
const totalDurationEl = document.getElementById("total-duration");
const knownCountEl = document.getElementById("known-count");
const unknownCountEl = document.getElementById("unknown-count");
const statusEl = document.getElementById("status");

const formatDuration = (totalSeconds) => {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "0:00";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const updateSummary = ({ totalTabs, knownCount, unknownCount, totalSeconds }) => {
  tabCountEl.textContent = totalTabs;
  knownCountEl.textContent = knownCount;
  unknownCountEl.textContent = unknownCount;
  totalDurationEl.textContent = formatDuration(totalSeconds);
};

const refreshTotals = async () => {
  statusEl.textContent = "Refreshing totals...";
  await browser.runtime.sendMessage({ type: "refreshTotals" });
  await loadTotals();
  statusEl.textContent = "Done.";
};

const loadTotals = async () => {
  const stored = await browser.storage.local.get("youtubeTotals");
  const totals = stored.youtubeTotals ?? {
    totalTabs: 0,
    knownCount: 0,
    unknownCount: 0,
    totalSeconds: 0,
  };

  updateSummary(totals);
};

refreshButton.addEventListener("click", () => {
  refreshTotals();
});

loadTotals();
