const YOUTUBE_TAB_QUERY = { url: ["*://*.youtube.com/*", "*://youtu.be/*"] };
let isScanning = false;

const fetchMetadataFromUrl = async (url) => {
  try {
    const response = await fetch(url, { credentials: 'omit' });
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
    let combinedStats = {}; // Key will be "Type: Name"

    const BATCH_SIZE = 5;
    for (let i = 0; i < tabs.length; i += BATCH_SIZE) {
      const batch = tabs.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(t => fetchMetadataFromUrl(t.url)));

      results.forEach(meta => {
        if (meta && meta.duration > 0) {
          totalSeconds += meta.duration;

          // Add Channel to combined stats
          const channelKey = `Channel: ${meta.channel}`;
          combinedStats[channelKey] = (combinedStats[channelKey] || 0) + meta.duration;

          // Add Tags to combined stats
          meta.tags.forEach(tag => {
            const tagKey = `Tag: ${tag}`;
            combinedStats[tagKey] = (combinedStats[tagKey] || 0) + meta.duration;
          });
        }
      });

      await browser.storage.local.set({ currentScanned: Math.min(i + BATCH_SIZE, tabs.length) });
      if (i + BATCH_SIZE < tabs.length) await new Promise(r => setTimeout(r, 400));
    }

    // Sort the combined list by duration
    const sortedLeaderboard = Object.entries(combinedStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25) // Get Top 25 combined
      .map(([label, sec]) => ({ label, duration: sec }));

    await browser.storage.local.set({
      isScanning: false,
      youtubeTotals: {
        totalTabs: tabs.length,
        totalSeconds,
        leaderboard: sortedLeaderboard,
        uniqueChannels: Object.keys(combinedStats).filter(k => k.startsWith("Channel:")).length,
        uniqueTags: Object.keys(combinedStats).filter(k => k.startsWith("Tag:")).length
      }
    });
  } catch (err) { console.error(err); } finally { isScanning = false; }
};

browser.runtime.onMessage.addListener((m) => { if (m.type === "forceRefresh") refreshTotals(); });
browser.runtime.onInstalled.addListener(refreshTotals);