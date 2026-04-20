// processor.js

/**
 * The Scraper: Fetches video data for tabs that aren't currently loaded
 */
const fetchMetadataFromUrl = async (url) => {
  console.log("Fetching metadata for:", url);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("Fetch failed with status:", response.status);
      return null;
    }
    const html = await response.text();
    const match = html.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (match) {
      const data = JSON.parse(match[1]);
      const details = data.videoDetails || {};
      const result = {
        duration: parseInt(details.lengthSeconds, 10) || 0,
        channel: (details.author && details.author.trim()) ? details.author.trim() : "Unknown Channel",
        tags: details.keywords || []
      };
      console.log("Found metadata:", result.channel, "Tags:", result.tags.length);
      return result;
    } else {
      console.warn("ytInitialPlayerResponse not found in HTML");
    }
  } catch (e) { 
    console.error("Metadata fetch error:", e);
    return null; 
  }
  return null;
};

/**
 * The Accountant: Processes raw tab data into the leaderboard format
 */
const processAndSaveStats = async (tabMap) => {
  const openEntries = Object.values(tabMap);
  const storage = await browser.storage.local.get("historyLog");
  const historyLog = storage.historyLog || [];

  const processEntries = (entries) => {
    let totalSeconds = 0;
    let totalSession = 0;
    let totalWatch = 0;
    let knownCount = 0;
    let unknownCount = 0;
    let channelStats = {}; 
    let tagStats = {};     

    entries.forEach(meta => {
      if (meta && meta.duration > 0) {
        totalSeconds += meta.duration;
        totalSession += (meta.sessionTime || 0);
        totalWatch += (meta.watchTime || 0);
	  
        const ch = (meta.channel && meta.channel.trim()) ? meta.channel.trim() : "Unknown Channel";
	  
        if (ch === "Unknown Channel") {
          unknownCount++;
        } else {
          knownCount++;
        }
      
        if (!channelStats[ch]) channelStats[ch] = { duration: 0, sessionTime: 0, watchTime: 0, count: 0 };
        channelStats[ch].duration += meta.duration;
        channelStats[ch].sessionTime += (meta.sessionTime || 0);
        channelStats[ch].watchTime += (meta.watchTime || 0);
        channelStats[ch].count += 1;

        const cleanChannel = ch.toLowerCase().replace(/\s+/g, "");
        const cleanTitle = (meta.title || "").toLowerCase().replace(/\s+/g, "");
	  
        (meta.tags || []).forEach(tag => {
          const cleanTag = tag.toLowerCase().replace(/\s+/g, "");
          if (cleanTag === cleanChannel || cleanTag === "yt:cc=on" || cleanTag === cleanTitle) return;
        
          if (!tagStats[tag]) {
            tagStats[tag] = { duration: 0, sessionTime: 0, watchTime: 0, count: 0, channels: new Set() };
          }
          tagStats[tag].duration += meta.duration;
          tagStats[tag].sessionTime += (meta.sessionTime || 0);
          tagStats[tag].watchTime += (meta.watchTime || 0);
          tagStats[tag].count += 1;
          tagStats[tag].channels.add(ch);
        });
      }
    });

    let leaderboard = [];
    Object.entries(channelStats).forEach(([name, s]) => {
      leaderboard.push({ label: `Channel: ${name}`, duration: s.duration, sessionTime: s.sessionTime, watchTime: s.watchTime, count: s.count });
    });

    Object.entries(tagStats).forEach(([name, s]) => {
      if (s.channels.size >= 2) {
        leaderboard.push({ label: `Tag: ${name}`, duration: s.duration, sessionTime: s.sessionTime, watchTime: s.watchTime, count: s.count });
      }
    });

    return {
      totalTabs: entries.length,
      totalSeconds,
      totalSession,
      totalWatch,
      knownCount,
      unknownCount,
      leaderboard: leaderboard.sort((a, b) => b.duration - a.duration).slice(0, 25),
      uniqueChannels: Object.keys(channelStats).length,
      uniqueTags: Object.keys(tagStats).length
    };
  };

  // 1. Live Stats
  const liveTotals = processEntries(openEntries);

  // 2. Combined Stats (History + Open Tabs)
  const combinedEntries = [...openEntries, ...historyLog];
  const historyTotals = processEntries(combinedEntries);

  // 3. Histogram Data
  const now = new Date();
  const histogram = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    histogram[dateStr] = { sessionTime: 0, watchTime: 0 };
  }

  historyLog.forEach(entry => {
    const dateStr = new Date(entry.timestamp).toISOString().split("T")[0];
    if (histogram[dateStr]) {
      histogram[dateStr].sessionTime += (entry.sessionTime || 0);
      histogram[dateStr].watchTime += (entry.watchTime || 0);
    }
  });

  const storageJson = JSON.stringify({ historyLog, tabMap });
  const storageSizeKB = (new Blob([storageJson]).size / 1024).toFixed(1);

  await browser.storage.local.set({
    isScanning: false,
    youtubeTotals: liveTotals,
    historyTotals: historyTotals,
    histogramData: histogram,
    storageSizeKB: storageSizeKB
  });
};