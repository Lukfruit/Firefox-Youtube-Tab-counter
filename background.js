const YOUTUBE_TAB_QUERY = { url: ["*://*.youtube.com/*", "*://youtu.be/*"] };
let isScanning = false;

// Extract metadata from YouTube's raw HTML
const fetchMetadataFromUrl = async (url) => {
  try {
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) return null;
    const html = await response.text();
    
    // Scrape the JSON config YouTube embeds in the page
    const match = html.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (match) {
      const data = JSON.parse(match[1]);
      const details = data.videoDetails || {};
      return {
        duration: parseInt(details.lengthSeconds, 10) || 0,
        channel: details.author || "Unknown Channel",
        tags: details.keywords || []
      };
    }
  } catch (e) {
    console.error("Fetch error for:", url, e);
  }
  return null;
};

const processTab = async (tab) => {
  if (!tab.url) return null;
  // Fallback to HTML fetch for metadata (channel/tags) even if tab is open
  return await fetchMetadataFromUrl(tab.url);
};

const refreshTotals = async () => {
  if (isScanning) return;
  isScanning = true;

  try {
    const tabs = await browser.tabs.query(YOUTUBE_TAB_QUERY);
    
    await browser.storage.local.set({ 
      isScanning: true, 
      totalToScan: tabs.length, 
      currentScanned: 0 
    });

    let totalSeconds = 0;
    let knownCount = 0;
    let unknownCount = 0;
    let channelSet = new Set();
    let tagSet = new Set();

    const BATCH_SIZE = 5;

    for (let i = 0; i < tabs.length; i += BATCH_SIZE) {
      const batch = tabs.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(processTab));

      results.forEach(meta => {
        if (meta && meta.duration > 0) {
          totalSeconds += meta.duration;
          knownCount++;
          if (meta.channel) channelSet.add(meta.channel);
          if (meta.tags) meta.tags.forEach(tag => tagSet.add(tag));
        } else {
          unknownCount++;
        }
      });

      const current = Math.min(i + BATCH_SIZE, tabs.length);
      
      // Update storage so Popup sees live progress
      await browser.storage.local.set({ 
        currentScanned: current,
        youtubeTotals: {
          totalTabs: tabs.length,
          knownCount,
          unknownCount,
          totalSeconds,
          uniqueChannels: channelSet.size,
          uniqueTags: tagSet.size
        }
      });

      if (i + BATCH_SIZE < tabs.length) {
        await new Promise(r => setTimeout(r, 400)); 
      }
    }
  } catch (err) {
    console.error("Scan failed:", err);
  } finally {
    isScanning = false;
    await browser.storage.local.set({ isScanning: false });
  }
};

browser.runtime.onMessage.addListener((message) => {
  if (message.type === "forceRefresh") {
    refreshTotals();
    return Promise.resolve({ started: true });
  }
});

browser.runtime.onInstalled.addListener(refreshTotals);