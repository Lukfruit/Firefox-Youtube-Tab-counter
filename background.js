// background.js
const YOUTUBE_TAB_QUERY = { url: ["*://*.youtube.com/*", "*://youtu.be/*"] };
const HEARTBEAT_INTERVAL = 5; // seconds
let isScanning = false;
let tabMap = {}; // Persistent memory: { tabId: { duration, channel, tags, title, sessionTime, watchTime } }

// Load existing map on startup to prevent "stale" leaderboard
browser.storage.local.get("tabMap").then(res => {
  if (res.tabMap) tabMap = res.tabMap;
});

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

//Batching refresh logic, modified to update tabMap
const refreshTotals = async () => {
  if (isScanning) return;
  isScanning = true;
  try {
    const tabs = await browser.tabs.query(YOUTUBE_TAB_QUERY);
    await browser.storage.local.set({ isScanning: true, totalToScan: tabs.length, currentScanned: 0 });

    const BATCH_SIZE = 5;
    for (let i = 0; i < tabs.length; i += BATCH_SIZE) {
      const batch = tabs.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (t) => {
        let meta = null;
        let tabData = { 
          duration: 0, 
          channel: "Unknown Channel", 
          title: t.title, 
          tags: [],
          sessionTime: tabMap[t.id]?.sessionTime || 0,
          watchTime: tabMap[t.id]?.watchTime || 0
        };

        try {
          // Try getting live data from the tab first
          const res = await browser.tabs.sendMessage(t.id, { type: "getDuration" });
          if (res) {
            tabData.duration = res.durationSeconds;
            tabData.channel = res.channel;
          }
        } catch (e) { /* Tab might be asleep */ }

        // ALWAYS do the background fetch for tags and to verify the channel name
        meta = await fetchMetadataFromUrl(t.url);
        if (meta) {
          tabData.tags = meta.tags;
          // Priority: If background fetch found a name, use it over the content script's guess
          if (meta.channel && meta.channel !== "Unknown Channel") {
            tabData.channel = meta.channel;
          }
          if (meta.duration > 0) tabData.duration = meta.duration;
        }

        tabMap[t.id] = tabData;
      }));

      await browser.storage.local.set({ currentScanned: Math.min(i + BATCH_SIZE, tabs.length) });
    }
    
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
    if (!tabMap[tabId]) {
      tabMap[tabId] = { 
        duration: 0, 
        channel: "Unknown Channel", 
        title: m.data.title, 
        tags: [], 
        sessionTime: 0, 
        watchTime: 0 
      };
    }

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
	  const newEntry = { 
	        duration: m.data.duration, 
	        channel: m.data.channel, 
	        title: m.data.title, 
	        tags: existing?.tags || [],
          sessionTime: existing?.sessionTime || 0,
          watchTime: existing?.watchTime || 0
	      };
    
	      tabMap[sender.tab.id] = newEntry;

	      // Trigger an immediate background fetch for tags if we don't have them
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
});

// Instant cleanup on close
browser.tabs.onRemoved.addListener(async (tabId) => {
  if (tabMap[tabId]) {
    const closedTabData = {
      ...tabMap[tabId],
      timestamp: Date.now()
    };

    try {
      const res = await browser.storage.local.get("historyLog");
      const historyLog = res.historyLog || [];
      historyLog.push(closedTabData);
      await browser.storage.local.set({ historyLog });
    } catch (e) {
      console.error("Failed to save history:", e);
    }

    delete tabMap[tabId];
    processAndSaveStats(tabMap);
  }
});

browser.runtime.onInstalled.addListener(refreshTotals);
browser.runtime.onStartup.addListener(refreshTotals);