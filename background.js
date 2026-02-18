// background.js
const YOUTUBE_TAB_QUERY = { url: ["*://*.youtube.com/*", "*://youtu.be/*"] };
let isScanning = false;
let tabMap = {}; // Persistent memory: { tabId: { duration, channel, tags, title } }

// Your scraper logic for unloaded tabs
const fetchMetadataFromUrl = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const html = await response.text();
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
  } catch (e) { return null; }
  return null;
};

// New Accountant: Processes the tabMap and updates storage
const updateStorage = async () => {
  const entries = Object.values(tabMap);
  let totalSeconds = 0;
  let channelStats = {}; 
  let tagStats = {};     

  entries.forEach(meta => {
    if (meta && meta.duration > 0) {
      totalSeconds += meta.duration;
      
      // Process Channel
      if (!channelStats[meta.channel]) channelStats[meta.channel] = { duration: 0, count: 0 };
      channelStats[meta.channel].duration += meta.duration;
      channelStats[meta.channel].count += 1;

      // Process Tags (Cross-Channel Rule)
      const cleanChannel = (meta.channel || "").toLowerCase().replace(/\s+/g, "");
      (meta.tags || []).forEach(tag => {
        const cleanTag = tag.toLowerCase().replace(/\s+/g, "");
        if (cleanTag === cleanChannel || cleanTag === "yt:cc=on") return;

        if (!tagStats[tag]) {
          tagStats[tag] = { duration: 0, count: 0, channels: new Set() };
        }
        tagStats[tag].duration += meta.duration;
        tagStats[tag].count += 1;
        tagStats[tag].channels.add(meta.channel);
      });
    }
  });

  let combined = [];
  Object.entries(channelStats).forEach(([name, stats]) => {
    combined.push({ label: `Channel: ${name}`, duration: stats.duration, count: stats.count });
  });

  Object.entries(tagStats).forEach(([name, stats]) => {
    if (stats.channels.size >= 2) {
      combined.push({ label: `Tag: ${name}`, duration: stats.duration, count: stats.count });
    }
  });

  const sortedLeaderboard = combined.sort((a, b) => b.duration - a.duration).slice(0, 25);

  await browser.storage.local.set({
    isScanning: false,
    youtubeTotals: {
      totalTabs: entries.length,
      totalSeconds,
      leaderboard: sortedLeaderboard,
      uniqueChannels: Object.keys(channelStats).length,
      uniqueTags: Object.keys(tagStats).length,
      knownCount: entries.length,
      unknownCount: 0
    }
  });
};

// Your batching refresh logic, modified to update tabMap
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
        try {
          // Try Content Script first
          const response = await browser.tabs.sendMessage(t.id, { type: "getDuration" });
          if (response) {
            tabMap[t.id] = { duration: response.durationSeconds, channel: response.channel, title: response.title, tags: [] };
          } else { throw new Error("No response"); }
        } catch (e) {
          // Fallback to fetch for unloaded tabs
          const meta = await fetchMetadataFromUrl(t.url);
          if (meta) tabMap[t.id] = { ...meta, title: t.title };
        }
      }));

      await browser.storage.local.set({ currentScanned: Math.min(i + BATCH_SIZE, tabs.length) });
      if (i + BATCH_SIZE < tabs.length) await new Promise(r => setTimeout(r, 400));
    }

    await updateStorage();
  } catch (err) { console.error(err); } finally { isScanning = false; }
};

// LISTENERS
browser.runtime.onMessage.addListener((m, sender) => { 
  if (m.type === "forceRefresh") refreshTotals(); 
  if (m.type === "tabUpdate" && sender.tab) {
    tabMap[sender.tab.id] = {
      duration: m.data.duration,
      channel: m.data.channel,
      title: m.data.title,
      tags: [] // Content scripts don't easily see tags, background fetch handles this best
    };
    updateStorage();
  }
});

// Instant cleanup on close
browser.tabs.onRemoved.addListener((tabId) => {
  if (tabMap[tabId]) {
    delete tabMap[tabId];
    updateStorage();
  }
});

browser.runtime.onInstalled.addListener(refreshTotals);
browser.runtime.onStartup.addListener(refreshTotals);