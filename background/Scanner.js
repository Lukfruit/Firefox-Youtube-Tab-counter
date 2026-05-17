// background/Scanner.js
/**
 * Scanner: API Shell for full tab metadata extraction.
 */
window.YTA.Background.Scanner = {
  isScanning: false,
  lastScanStats: { totalRequests: 0, error429Count: 0, usedDelay: 1000 },

  /**
   * Performs a fast cleanup of tabs that no longer exist in the browser
   */
  cleanupStaleTabs: async function() {
    console.log("[Scanner] Cleaning up stale tabs...");
    const openTabs = await browser.tabs.query({});
    const openTabIds = new Set(openTabs.map(t => t.id));
    const currentMap = window.YTA.State.tabMap;
    let changed = false;

    for (const tabIdStr in currentMap) {
      const tabId = parseInt(tabIdStr, 10);
      if (!openTabIds.has(tabId)) {
        console.log(`[Scanner] Removing stale tab: ${tabId}`);
        const entry = currentMap[tabId];
        if (window.YTA.Core.Logic.isWatchedEnough(entry, window.YTA.State.settings)) {
          await window.YTA.Shell.Storage.archiveEntry({ ...entry, timestamp: Date.now() });
        }
        delete currentMap[tabId];
        changed = true;
      }
    }

    if (changed) {
      await window.YTA.Shell.Storage.saveTabMap(currentMap);
      const res = await browser.storage.local.get("historyLog");
      await window.YTA.Shell.Cache.update(res.historyLog || [], Object.values(currentMap));
    }
  },

  /**
   * Performs a full scan of all open YouTube tabs
   */
  refreshTotals: async function() {
    if (this.isScanning) return;
    
    // Fast cleanup first
    await this.cleanupStaleTabs();

    this.isScanning = true;
    
    let baseDelay = window.YTA.State.settings.scannerDelay || 1000;
    let currentDelay = baseDelay;
    const retryQueue = [];
    
    this.lastScanStats = { totalRequests: 0, error429Count: 0, usedDelay: baseDelay };

    try {
      const tabs = await browser.tabs.query({ url: ["*://*.youtube.com/*", "*://youtu.be/*"] });
      await browser.storage.local.set({ isScanning: true, totalToScan: tabs.length, currentScanned: 0 });

      for (let i = 0; i < tabs.length; i++) {
        const t = tabs[i];
        let tabData = { ...window.YTA.State.tabMap[t.id], tabId: t.id, title: t.title, url: t.url };
        
        console.log(`[Scanner] Processing: ${t.title}`);

        if (window.YTA.Core.Logic.isTabFresh(tabData)) {
          console.log(`[Scanner] Skipping fetch (Metadata is fresh)`);
          await browser.storage.local.set({ currentScanned: i + 1 });
          continue;
        }

        try {
          const res = await browser.tabs.sendMessage(t.id, { type: "getDuration" });
          if (res) {
            console.log(`[Scanner] Method: Content Script`);
            tabData = { ...tabData, ...res, duration: res.durationSeconds };
          }
        } catch (e) {
          console.log(`[Scanner] Method: Scraper (Tab asleep)`);
          this.lastScanStats.totalRequests++;
          const meta = await window.YTA.Shell.Scraper.fetchMetadata(t.url);
          if (meta) {
            tabData = { ...tabData, ...meta };
          } else {
            if (window.YTA.Shell.Scraper._lastRateLimitTime > Date.now() - 5000) {
              this.lastScanStats.error429Count++;
              console.log(`[Scanner] !! Rate limit detected. Slowing down...`);
              currentDelay = Math.max(10000, baseDelay * 5); 
            }
            retryQueue.push(t);
          }
        }

        console.log(`[Scanner] Result: Channel=${tabData.channel}`);
        window.YTA.State.tabMap[t.id] = window.YTA.Core.Validation.cleanTabEntry(tabData);
        await browser.storage.local.set({ currentScanned: i + 1 });
        await new Promise(r => setTimeout(r, currentDelay));
      }
      
      const res = await browser.storage.local.get("historyLog");
      await window.YTA.Shell.Cache.update(res.historyLog || [], Object.values(window.YTA.State.tabMap));
      await browser.storage.local.set({ lastScanStats: this.lastScanStats });

      if (retryQueue.length > 0) {
        console.log(`[Scanner] Scan finished with ${retryQueue.length} failures. Retry scheduled.`);
        setTimeout(() => this.processRetryQueue(retryQueue), 2 * 60 * 1000);
      }
    } finally {
      this.isScanning = false;
      await browser.storage.local.set({ isScanning: false });
    }
  },

  /**
   * Processes the retry queue
   */
  processRetryQueue: async function(queue) {
    console.log("[Scanner] Processing retry queue...");
    for (const t of queue) {
      const meta = await window.YTA.Shell.Scraper.fetchMetadata(t.url);
      if (meta) {
        window.YTA.State.tabMap[t.id] = window.YTA.Core.Validation.cleanTabEntry({
          ...window.YTA.State.tabMap[t.id],
          ...meta
        });
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    const res = await browser.storage.local.get("historyLog");
    await window.YTA.Shell.Cache.update(res.historyLog || [], Object.values(window.YTA.State.tabMap));
  }
};
