// background/Tracker.js
/**
 * Background Tracker: Central orchestrator for tab lifecycle and events.
 */
window.YTA.Background.Tracker = {
  /**
   * Initializes the tracker
   */
  start: async function() {
    console.log("[Tracker] Starting...");
    await window.YTA.Shell.Storage.load();
    await window.YTA.Background.Scanner.cleanupStaleTabs();
    await this.checkAndPerformReset();
    
    window.YTA.Background.IdleManager.init();
    
    // Initial scan
    window.YTA.Background.Scanner.refreshTotals();
  },

  /**
   * Orchestrates the daily reset check
   */
  checkAndPerformReset: async function() {
    const storage = await browser.storage.local.get(["lastResetTimestamp", "historyLog"]);
    const result = window.YTA.Core.Logic.processDailyReset(
      window.YTA.State.tabMap, 
      storage.lastResetTimestamp || 0,
      window.YTA.State.settings.resetTime,
      window.YTA.State.settings
    );

    if (result) {
      console.log("[Tracker] Daily reset threshold crossed. Archiving...");
      const { newTabMap, archiveEntries, newTimestamp } = result;
      
      for (const entry of archiveEntries) {
        await window.YTA.Shell.Storage.archiveEntry(entry);
      }
      
      await browser.storage.local.set({ lastResetTimestamp: newTimestamp });
      await window.YTA.Shell.Storage.saveTabMap(newTabMap);
      
      const res = await browser.storage.local.get("historyLog");
      await window.YTA.Shell.Cache.update(res.historyLog || [], Object.values(newTabMap));
    }
  },

  /**
   * Orchestrates heartbeat processing
   */
  handleHeartbeat: async function(tabId, windowId, data) {
    await this.checkAndPerformReset();
    
    const existing = window.YTA.State.tabMap[tabId];
    
    // Determine system state
    const win = await browser.windows.get(windowId);
    const [activeTab] = await browser.tabs.query({ active: true, windowId: windowId });
    const isActiveTab = win.focused && activeTab && activeTab.id === tabId;

    const result = window.YTA.Core.Logic.updateTabState(
      existing, 
      data, 
      window.YTA.State.settings,
      { 
        isActiveTab, 
        isSystemIdle: window.YTA.Background.IdleManager.isSystemIdle 
      }
    );

    if (result.throttled) return;

    if (result.shouldArchive) {
      await window.YTA.Shell.Storage.archiveEntry(result.shouldArchive);
    }

    window.YTA.State.tabMap[tabId] = result.tabData;
    await window.YTA.Shell.Storage.saveTabMap(window.YTA.State.tabMap);

    if (result.progressed) {
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
  }
};
