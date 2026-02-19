// background.js
const YOUTUBE_TAB_QUERY = { url: ["*://*.youtube.com/*", "*://youtu.be/*"] };
let isScanning = false;
let tabMap = {}; // Persistent memory: { tabId: { duration, channel, tags, title } }

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
        let tabData = { duration: 0, channel: "Unknown Channel", title: t.title, tags: [] };

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
browser.runtime.onMessage.addListener((m, sender) => { 
  if (m.type === "forceRefresh") refreshTotals(); 
  if (m.type === "tabUpdate" && sender.tab) {
	  const existing = tabMap[sender.tab.id];
	      tabMap[sender.tab.id] = { 
	          duration: m.data.duration, 
	          channel: m.data.channel, 
	          title: m.data.title, 
	          tags: existing?.tags || [] // Content scripts don't easily see tags, background fetch handles this best
	      };
	      processAndSaveStats(tabMap);
  }
});

// Instant cleanup on close
browser.tabs.onRemoved.addListener((tabId) => {
  if (tabMap[tabId]) {
    delete tabMap[tabId];
    processAndSaveStats(tabMap);
  }
});

browser.runtime.onInstalled.addListener(refreshTotals);
browser.runtime.onStartup.addListener(refreshTotals);