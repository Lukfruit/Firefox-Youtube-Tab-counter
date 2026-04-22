// background.js
const YOUTUBE_TAB_QUERY = { url: ["*://*.youtube.com/*", "*://youtu.be/*"] };
const HEARTBEAT_INTERVAL = 5; // seconds
let isScanning = false;
let tabMap = {}; // Persistent memory: { tabId: { duration, currentTime, channel, tags, title, sessionTime, watchTime } }
let settings = { minWatchTime: 30 };

// Load existing map and settings on startup
browser.storage.local.get(["tabMap", "settings"]).then(res => {
  if (res.tabMap) tabMap = res.tabMap;
  if (res.settings) settings = { ...settings, ...res.settings };
  checkAndPerformReset();
});

// Helper to check if a tab should be saved to history
const isWatchedEnough = (entry) => {
  const isWatchedEnoughTime = entry.watchTime >= settings.minWatchTime;
  const isShortButWatchedFully = entry.duration > 0 && 
                                entry.duration < settings.minWatchTime && 
                                (entry.watchTime >= entry.duration * 0.9 || entry.currentTime >= entry.duration * 0.9);
  return isWatchedEnoughTime || isShortButWatchedFully;
};

// Helper to add entry to historyLog
const addToHistory = async (data) => {
  try {
    const res = await browser.storage.local.get("historyLog");
    const historyLog = res.historyLog || [];
    historyLog.push(data);
    await browser.storage.local.set({ historyLog });
  } catch (e) {
    console.error("Failed to save history:", e);
  }
};

// Daily Reset Logic
async function checkAndPerformReset() {
  const storage = await browser.storage.local.get(["settings", "lastResetTimestamp"]);
  const resetTimeStr = storage.settings?.resetTime || "05:00";
  const lastProcessedReset = storage.lastResetTimestamp || 0;
  
  const currentResetThreshold = getMostRecentResetTime(resetTimeStr);
  
  if (lastProcessedReset < currentResetThreshold) {
    console.log("Crossing daily reset threshold. Archiving open tabs...");
    
    // Archive currently open tabs to history as they were at the threshold
    for (const tabId in tabMap) {
      const entry = tabMap[tabId];
      if (entry.watchTime > 0 || entry.sessionTime > 0) {
        const archivedEntry = {
          ...entry,
          timestamp: currentResetThreshold - 1 // Just before the reset
        };
        delete archivedEntry.tabId;
        
        if (isWatchedEnough(archivedEntry)) {
          await addToHistory(archivedEntry);
        }
        
        // Reset the tab's counters for the new day
        tabMap[tabId].sessionTime = 0;
        tabMap[tabId].watchTime = 0;
      }
    }
    
    await browser.storage.local.set({ lastResetTimestamp: currentResetThreshold });
    processAndSaveStats(tabMap);
  }
}

// Helper to check if a tab is the active one in the focused window
const isTabActiveAndFocused = async (tabId, windowId) => {
  try {
    const window = await browser.windows.get(windowId);
    if (!window.focused) return false;
    const [activeTab] = await browser.tabs.query({ active: true, windowId: windowId });
    return activeTab && activeTab.id === tabId;
  } catch (e) {
    return false;
  }
};

// Sequential refresh logic to be very gentle on YouTube
const refreshTotals = async () => {
  if (isScanning) return;
  isScanning = true;
  try {
    const tabs = await browser.tabs.query(YOUTUBE_TAB_QUERY);
    await browser.storage.local.set({ isScanning: true, totalToScan: tabs.length, currentScanned: 0 });

    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i];
      console.log("Processing tab:", t.id, t.url);
      
      let tabData = { 
        tabId: t.id,
        duration: 0, 
        currentTime: 0,
        channel: "Unknown Channel", 
        title: t.title, 
        tags: tabMap[t.id]?.tags || [], 
        sessionTime: tabMap[t.id]?.sessionTime || 0,
        watchTime: tabMap[t.id]?.watchTime || 0
      };

      try {
        // 1. Try getting live data from the tab first (fastest, no network)
        const res = await browser.tabs.sendMessage(t.id, { type: "getDuration" });
        if (res) {
          tabData.duration = res.durationSeconds;
          tabData.currentTime = res.currentTime;
          tabData.channel = res.channel;
          tabData.tags = res.tags || tabData.tags;
        }
      } catch (e) { 
        // This is NORMAL: Modern browsers "sleep" background tabs to save RAM.
        // When a tab is asleep, we can't talk to it, so we fallback to the background fetch.
        console.log("Tab", t.id, "is likely asleep; falling back to background fetch.");
      }

      // 2. ONLY do background fetch if we still lack basic info
      if (tabData.tags.length === 0 || tabData.channel === "Unknown Channel") {
        // Add a small delay between any background fetches
        await new Promise(r => setTimeout(r, 1500)); 
        const meta = await fetchMetadataFromUrl(t.url);
        if (meta) {
          tabData.tags = meta.tags;
          if (meta.channel && meta.channel !== "Unknown Channel") tabData.channel = meta.channel;
          if (meta.duration > 0) tabData.duration = meta.duration;
        }
      }

      tabMap[t.id] = tabData;
      await browser.storage.local.set({ currentScanned: i + 1 });
    }
    
    console.log("Scanning complete. Processing stats for", Object.keys(tabMap).length, "tabs");
    await processAndSaveStats(tabMap);
  } finally {
    isScanning = false;
    await browser.storage.local.set({ isScanning: false });
  }
};

// LISTENERS
browser.runtime.onMessage.addListener(async (m, sender) => { 
  if (m.type === "forceRefresh") refreshTotals(); 
  
  if (m.type === "heartbeat" && sender.tab) {
    const tabId = sender.tab.id;
    await checkAndPerformReset();
    
    const now = Date.now();
    const existing = tabMap[tabId];

    if (existing) {
      // 1. NAVIGATION DETECTION (Backup for tabUpdate)
      if (existing.url && existing.url !== m.data.url) {
        if (isWatchedEnough(existing)) {
          console.log("Navigation detected in heartbeat. Archiving:", existing.title);
          addToHistory({ ...existing, timestamp: now });
        }
        existing.url = m.data.url;
        existing.sessionTime = 0;
        existing.watchTime = 0;
      }

      // 2. DOUBLE-HEARTBEAT PROTECTION
      // If we got a heartbeat too recently, don't increment time
      const timeSinceLast = now - (existing.lastHeartbeat || 0);
      if (timeSinceLast < (HEARTBEAT_INTERVAL * 1000) - 500) {
        return; 
      }
      existing.lastHeartbeat = now;
    }

    if (!tabMap[tabId]) {
      tabMap[tabId] = { 
        tabId: tabId,
        url: m.data.url,
        duration: 0, 
        currentTime: 0,
        channel: "Unknown Channel", 
        title: m.data.title, 
        tags: [], 
        sessionTime: 0, 
        watchTime: 0,
        lastHeartbeat: now
      };
    }

    tabMap[tabId].currentTime = m.data.currentTime;
    tabMap[tabId].isPlaying = !!m.data.isPlaying;
    const isActive = await isTabActiveAndFocused(tabId, sender.tab.windowId);
    if (isActive) {
      tabMap[tabId].sessionTime += HEARTBEAT_INTERVAL;
      if (m.data.isPlaying) {
        tabMap[tabId].watchTime += HEARTBEAT_INTERVAL;
      }
      processAndSaveStats(tabMap);
    }
  }

  if (m.type === "tabUpdate" && sender.tab) {
	  const existing = tabMap[sender.tab.id];
    
    // NAVIGATION DETECTION
    // If we already have data for this tab, but the URL changed, archive the old one
    if (existing && existing.url && existing.url !== sender.tab.url) {
      if (isWatchedEnough(existing)) {
        console.log("Navigation detected. Archiving previous video:", existing.title);
        addToHistory({
          ...existing,
          timestamp: Date.now()
        });
      }
      // Reset counters for the new video
      existing.sessionTime = 0;
      existing.watchTime = 0;
    }

	  const newEntry = { 
	        tabId: sender.tab.id,
          url: sender.tab.url,
	        duration: m.data.duration, 
          currentTime: m.data.currentTime,
	        channel: m.data.channel, 
	        title: m.data.title, 
	        tags: m.data.tags || existing?.tags || [],
          sessionTime: existing?.sessionTime || 0,
          watchTime: existing?.watchTime || 0
	      };
    
	      tabMap[sender.tab.id] = newEntry;

	      // Trigger an immediate background fetch for tags ONLY if we still don't have them
	      if (newEntry.tags.length === 0) {
	        fetchMetadataFromUrl(sender.tab.url).then(meta => {
	          if (meta && tabMap[sender.tab.id]) {
	            tabMap[sender.tab.id].tags = meta.tags;
	            processAndSaveStats(tabMap);
	          }
	        });
	      }
		  
	      processAndSaveStats(tabMap);
  }

  if (m.type === "updateSettings") {
    settings = { ...settings, ...m.settings };
    await browser.storage.local.set({ settings });
    processAndSaveStats(tabMap);
  }
});

// Instant cleanup on close
browser.tabs.onRemoved.addListener(async (tabId) => {
  if (tabMap[tabId]) {
    const entry = tabMap[tabId];
    const { tabId: _, ...dataWithoutTabId } = entry;
    
    const dataToSave = {
      ...dataWithoutTabId,
      timestamp: Date.now()
    };

    if (isWatchedEnough(entry)) {
      await addToHistory(dataToSave);
    } else {
      console.log("Tab removed but did not meet watch time threshold:", entry.title);
    }

    delete tabMap[tabId];
    processAndSaveStats(tabMap);
  }
});

browser.runtime.onInstalled.addListener(() => {
  console.log("Extension installed/updated. Triggering initial scan...");
  refreshTotals();
});
browser.runtime.onStartup.addListener(() => {
  console.log("Browser startup. Triggering initial scan...");
  refreshTotals();
});