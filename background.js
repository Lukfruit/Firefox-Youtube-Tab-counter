const YOUTUBE_TAB_QUERY = { url: ["*://*.youtube.com/*", "*://youtu.be/*"] };
let isScanning = false;

const fetchMetadataFromUrl = async (url) => {
  try {
    // No 'omit' credentials to bypass consent walls for unloaded tabs
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

const refreshTotals = async () => {
  if (isScanning) return;
  isScanning = true;

  try {
    const tabs = await browser.tabs.query(YOUTUBE_TAB_QUERY);
    await browser.storage.local.set({ isScanning: true, totalToScan: tabs.length, currentScanned: 0 });

    let totalSeconds = 0;
    let channelStats = {}; // { name: { duration, count } }
    let tagStats = {};     // { name: { duration, count, channels: Set() } }

    const BATCH_SIZE = 5;
    for (let i = 0; i < tabs.length; i += BATCH_SIZE) {
      const batch = tabs.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(t => fetchMetadataFromUrl(t.url)));

      results.forEach(meta => {
        if (meta && meta.duration > 0) {
          totalSeconds += meta.duration;
          
          // 1. Process Channel
          if (!channelStats[meta.channel]) channelStats[meta.channel] = { duration: 0, count: 0 };
          channelStats[meta.channel].duration += meta.duration;
          channelStats[meta.channel].count += 1;

          const cleanChannel = meta.channel.toLowerCase().replace(/\s+/g, "");

          // 2. Process Tags
          meta.tags.forEach(tag => {
            const cleanTag = tag.toLowerCase().replace(/\s+/g, "");
            
            // Filter: Skip if tag is just the channel name or system noise
            if (cleanTag === cleanChannel || cleanTag === "yt:cc=on") return;

            if (!tagStats[tag]) {
              tagStats[tag] = { duration: 0, count: 0, channels: new Set() };
            }
            tagStats[tag].duration += meta.duration;
            tagStats[tag].count += 1;
            tagStats[tag].channels.add(meta.channel); // Track which channel used this tag
          });
        }
      });

      await browser.storage.local.set({ currentScanned: Math.min(i + BATCH_SIZE, tabs.length) });
      if (i + BATCH_SIZE < tabs.length) await new Promise(r => setTimeout(r, 400));
    }

    // Merge into one Leaderboard with the Cross-Channel Rule
    let combined = [];

    // Add all Channels
    Object.entries(channelStats).forEach(([name, stats]) => {
      combined.push({ label: `Channel: ${name}`, duration: stats.duration, count: stats.count });
    });

    // Add Tags ONLY if they appear on 2+ different channels
    Object.entries(tagStats).forEach(([name, stats]) => {
      if (stats.channels.size >= 2) {
        combined.push({ label: `Tag: ${name}`, duration: stats.duration, count: stats.count });
      }
    });

    const sortedLeaderboard = combined
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 25);

    await browser.storage.local.set({
      isScanning: false,
      youtubeTotals: {
        totalTabs: tabs.length,
        totalSeconds,
        leaderboard: sortedLeaderboard,
        uniqueChannels: Object.keys(channelStats).length,
        uniqueTags: Object.keys(tagStats).length
      }
    });
  } catch (err) { console.error(err); } finally { isScanning = false; }
};

browser.runtime.onMessage.addListener((m) => { if (m.type === "forceRefresh") refreshTotals(); });
browser.runtime.onInstalled.addListener(refreshTotals);