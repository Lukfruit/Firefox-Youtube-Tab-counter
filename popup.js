const statusEl = document.getElementById("status");
const tabCountEl = document.getElementById("tab-count");
const totalDurationEl = document.getElementById("total-duration");
const knownCountEl = document.getElementById("known-count");
const unknownCountEl = document.getElementById("unknown-count");

const formatDuration = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}` : `${m}:${String(sec).padStart(2,"0")}`;
};

const render = (data) => {
  if (data.isScanning) {
    statusEl.textContent = `Scanning: ${data.currentScanned || 0} / ${data.totalToScan || '?'} tabs`;
  } else {
    statusEl.textContent = "Idle (Updated)";
  }

  if (data.youtubeTotals) {
    tabCountEl.textContent = data.youtubeTotals.totalTabs || 0;
    knownCountEl.textContent = data.youtubeTotals.knownCount || 0;
    unknownCountEl.textContent = data.unknownCount || 0;
    totalDurationEl.textContent = formatDuration(data.youtubeTotals.totalSeconds || 0);
  }
};

// 1. Initial Load
browser.storage.local.get().then(render);

// 2. Listen for Storage changes (Progress updates)
browser.storage.onChanged.addListener(() => {
  browser.storage.local.get().then(render);
});

// 3. Refresh Button
document.getElementById("refresh").addEventListener("click", () => {
  browser.runtime.sendMessage({ type: "forceRefresh" })
    .catch(err => console.error("Could not reach background script. Is it registered in manifest?", err));
});