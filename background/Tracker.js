// background/Tracker.js
/**
 * Background Orchestrator: Manages tab state and events.
 */
window.YTA.Background.Tracker = {
  isScanning: false,

  /**
   * Initializes the tracker and starts daily reset checks
   */
  start: async function() {
    console.log("Tracker starting...");
    await window.YTA.Shell.Storage.load();
    this.checkAndPerformReset();
    
    // Initial scan to catch any existing tabs
    this.refreshTotals();
  },

  /**
   * Checks if we've crossed the daily reset threshold and archives open tabs
   */
  checkAndPerformReset: async function() {
    const storage = await browser.storage.local.get(["lastResetTimestamp"]);
    const lastProcessedReset = storage.lastResetTimestamp || 0;
    const currentResetThreshold = window.YTA.Core.Logic.getMostRecentResetTime(window.YTA.State.settings.resetTime);

    if (lastProcessedReset < currentResetThreshold) {
      console.log("Daily reset threshold crossed. Archiving...");
      const tabMap = window.YTA.State.tabMap;
      
      for (const tabId in tabMap) {
        const entry = tabMap[tabId];
        if (entry.watchTime > 0 || entry.sessionTime > 0) {
          const archivedEntry = { ...entry, timestamp: currentResetThreshold - 1 };
          if (window.YTA.Core.Logic.isWatchedEnough(archivedEntry, window.YTA.State.settings)) {
            await window.YTA.Shell.Storage.archiveEntry(archivedEntry);
          }
          // Reset counters for the new day
          tabMap[tabId].sessionTime = 0;
          tabMap[tabId].watchTime = 0;
        }
      }
      
      await browser.storage.local.set({ lastResetTimestamp: currentResetThreshold });
      await window.YTA.Shell.Storage.saveTabMap(tabMap);
      
      const res = await browser.storage.local.get("historyLog");
      await window.YTA.Shell.Cache.update(res.historyLog || [], Object.values(tabMap));
    }
  },

  /**
   * Processes a heartbeat from a content script
   */
  handleHeartbeat: async function(tabId, windowId, data) {
    await this.checkAndPerformReset();
    
    const now = Date.now();
    let existing = window.YTA.State.tabMap[tabId];

    if (existing) {
      // Navigation detection
      if (existing.url && existing.url !== data.url) {
        if (window.YTA.Core.Logic.isWatchedEnough(existing, window.YTA.State.settings)) {
          await window.YTA.Shell.Storage.archiveEntry({ ...existing, timestamp: now });
        }
        existing.url = data.url;
        existing.sessionTime = 0;
        existing.watchTime = 0;
      }

      // Throttling protection
      const interval = window.YTA.State.settings.heartbeatInterval || 1;
      const timeSinceLast = now - (existing.lastHeartbeat || 0);
      if (timeSinceLast < (interval * 1000) - 500) return;
    }

    const tabData = window.YTA.Core.Validation.cleanTabEntry({
      ...existing,
      ...data,
      tabId,
      lastHeartbeat: now
    });

    // Check if focused
    const win = await browser.windows.get(windowId);
    const [activeTab] = await browser.tabs.query({ active: true, windowId: windowId });
    const isActive = win.focused && activeTab && activeTab.id === tabId;

    if (isActive) {
      const interval = window.YTA.State.settings.heartbeatInterval || 1;
      tabData.sessionTime += interval;
      if (data.isPlaying) tabData.watchTime += interval;
    }

    window.YTA.State.tabMap[tabId] = tabData;
    await window.YTA.Shell.Storage.saveTabMap(window.YTA.State.tabMap);

    // If the tab just progressed, update the cache so the popup sees it
    if (isActive) {
      const res = await browser.storage.local.get("historyLog");
      await window.YTA.Shell.Cache.update(res.historyLog || [], Object.values(window.YTA.State.tabMap));
    }
  },

  /**
   * Processes a tab being closed
   */
  handleTabRemoved: async function(tabId) {
    const entry = window.YTA.State.tabMap[tabId];
    if (entry) {
      if (window.YTA.Core.Logic.isWatchedEnough(entry, window.YTA.State.settings)) {
        await window.YTA.Shell.Storage.archiveEntry({ ...entry, timestamp: Date.now() });
      }
      delete window.YTA.State.tabMap[tabId];
      await window.YTA.Shell.Storage.saveTabMap(window.YTA.State.tabMap);
    }
  },

  /**
   * Full scan of all YouTube tabs
   */
  refreshTotals: async function() {
    if (this.isScanning) return;
    this.isScanning = true;
    try {
      const tabs = await browser.tabs.query({ url: ["*://*.youtube.com/*", "*://youtu.be/*"] });
      await browser.storage.local.set({ isScanning: true, totalToScan: tabs.length, currentScanned: 0 });

      for (let i = 0; i < tabs.length; i++) {
        const t = tabs[i];
        let tabData = { ...window.YTA.State.tabMap[t.id], tabId: t.id, title: t.title, url: t.url };

        try {
          const res = await browser.tabs.sendMessage(t.id, { type: "getDuration" });
          if (res) {
            tabData = { ...tabData, ...res, duration: res.durationSeconds };
          }
        } catch (e) {
          // Fallback to scraper if tab is asleep
          if (!tabData.channel || tabData.channel === "Unknown Channel") {
            const meta = await window.YTA.Shell.Scraper.fetchMetadata(t.url);
            if (meta) tabData = { ...tabData, ...meta };
          }
        }

        window.YTA.State.tabMap[t.id] = window.YTA.Core.Validation.cleanTabEntry(tabData);
        await browser.storage.local.set({ currentScanned: i + 1 });
      }
      
      const res = await browser.storage.local.get("historyLog");
      await window.YTA.Shell.Cache.update(res.historyLog || [], Object.values(window.YTA.State.tabMap));
    } finally {
      this.isScanning = false;
      await browser.storage.local.set({ isScanning: false });
    }
  }
};
