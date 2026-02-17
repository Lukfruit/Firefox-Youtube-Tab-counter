const YOUTUBE_TAB_QUERY = { url: ["*://*.youtube.com/*", "*://youtu.be/*"] };
let isScanning = false;

// Extract duration from YouTube's raw HTML
const fetchDurationFromUrl = async (url) => {
  try {
    const response = await fetch(url, { credentials: 'omit' });
    const html = await response.text();
    const match = html.match(/"lengthSeconds":"(\d+)"/);
    return match ? parseInt(match[1], 10) : null;
  } catch (e) {
    return null;
  }
};

const processTab = async (tab) => {
  if (!tab.url) return null;
  // If tab is loaded, try messaging content script
  if (!tab.discarded && tab.id) {
    try {
      const res = await browser.tabs.sendMessage(tab.id, { type: "getDuration" });
      if (res?.durationSeconds) return res.durationSeconds;
    } catch (e) { /* ignore and fallback */ }
  }
  return await fetchDurationFromUrl(tab.url);
};

const refreshTotals = async () => {
  if (isScanning) return;
  isScanning = true;

  try {
    const tabs = await browser.tabs.query(YOUTUBE_TAB_QUERY);
    
    // Reset state in storage
    await browser.storage.local.set({ 
      isScanning: true, 
      totalToScan: tabs.length, 
      currentScanned: 0,
      youtubeTotals: { totalTabs: tabs.length, knownCount: 0, unknownCount: 0, totalSeconds: 0 }
    });

    let totalSeconds = 0, knownCount = 0, unknownCount = 0;
    const BATCH_SIZE = 5;

    for (let i = 0; i < tabs.length; i += BATCH_SIZE) {
      const batch = tabs.slice(i, i + BATCH_SIZE);
      const durations = await Promise.all(batch.map(processTab));

      durations.forEach(d => {
        if (d) { totalSeconds += d; knownCount++; } 
        else { unknownCount++; }
      });

      const current = Math.min(i + BATCH_SIZE, tabs.length);
      
      // Update storage so Popup can see progress
      await browser.storage.local.set({ 
        currentScanned: current,
        youtubeTotals: { totalTabs: tabs.length, knownCount, unknownCount, totalSeconds }
      });

      if (i + BATCH_SIZE < tabs.length) {
        await new Promise(r => setTimeout(r, 400)); 
      }
    }
  } catch (err) {
    console.error("Scan error:", err);
  } finally {
    isScanning = false;
    await browser.storage.local.set({ isScanning: false });
  }
};

// Start listening for the refresh command
browser.runtime.onMessage.addListener((message) => {
  if (message.type === "forceRefresh") {
    refreshTotals();
    return Promise.resolve({ started: true }); // Acknowledge receipt
  }
});

// Auto-run on install
browser.runtime.onInstalled.addListener(refreshTotals);