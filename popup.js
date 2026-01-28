const refreshButton = document.getElementById("refresh");
const tabCountEl = document.getElementById("tab-count");
const totalDurationEl = document.getElementById("total-duration");
const knownCountEl = document.getElementById("known-count");
const unknownCountEl = document.getElementById("unknown-count");
const statusEl = document.getElementById("status");

const YOUTUBE_TAB_QUERY = {
  url: ["*://*.youtube.com/*", "*://youtu.be/*"],
};

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

const fetchDurations = async () => {
  statusEl.textContent = "Scanning tabs...";

  const tabs = await browser.tabs.query(YOUTUBE_TAB_QUERY);
  const durationPromises = tabs.map(async (tab) => {
    if (!tab.id) {
      return { tabId: null, durationSeconds: null };
    }

    try {
      const response = await browser.tabs.sendMessage(tab.id, { type: "getDuration" });
      return { tabId: tab.id, durationSeconds: response?.durationSeconds ?? null };
    } catch (error) {
      return { tabId: tab.id, durationSeconds: null };
    }
  });

  const durations = await Promise.all(durationPromises);

  let totalSeconds = 0;
  let knownCount = 0;
  let unknownCount = 0;

  durations.forEach(({ durationSeconds }) => {
    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
      totalSeconds += durationSeconds;
      knownCount += 1;
    } else {
      unknownCount += 1;
    }
  });

  updateSummary({
    totalTabs: tabs.length,
    knownCount,
    unknownCount,
    totalSeconds,
  });

  statusEl.textContent = "Done.";
};

refreshButton.addEventListener("click", () => {
  fetchDurations();
});

fetchDurations();
