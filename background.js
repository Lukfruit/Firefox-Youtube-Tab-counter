const YOUTUBE_TAB_QUERY = {
  url: ["*://*.youtube.com/*", "*://youtu.be/*"],
};

let refreshTimeout = null;

const scheduleRefresh = (delay = 250) => {
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
  }

  refreshTimeout = setTimeout(() => {
    refreshTimeout = null;
    refreshTotals();
  }, delay);
};

const refreshTotals = async () => {
  const tabs = await browser.tabs.query(YOUTUBE_TAB_QUERY);
  const durationPromises = tabs.map(async (tab) => {
    if (!tab.id) {
      return null;
    }

    try {
      const response = await browser.tabs.sendMessage(tab.id, { type: "getDuration" });
      return response?.durationSeconds ?? null;
    } catch (error) {
      return null;
    }
  });

  const durations = await Promise.all(durationPromises);

  let totalSeconds = 0;
  let knownCount = 0;
  let unknownCount = 0;

  durations.forEach((durationSeconds) => {
    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
      totalSeconds += durationSeconds;
      knownCount += 1;
    } else {
      unknownCount += 1;
    }
  });

  await browser.storage.local.set({
    youtubeTotals: {
      totalTabs: tabs.length,
      knownCount,
      unknownCount,
      totalSeconds,
      updatedAt: Date.now(),
    },
  });
};

browser.runtime.onInstalled.addListener(() => {
  refreshTotals();
});

browser.runtime.onStartup.addListener(() => {
  refreshTotals();
});

browser.tabs.onCreated.addListener(() => {
  scheduleRefresh();
});

browser.tabs.onRemoved.addListener(() => {
  scheduleRefresh();
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    scheduleRefresh();
  }
});

browser.runtime.onMessage.addListener((message) => {
  if (message?.type === "refreshTotals") {
    refreshTotals();
  }
});
