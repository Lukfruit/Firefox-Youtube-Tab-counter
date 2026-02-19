// processor.js

/**
 * The Scraper: Fetches video data for tabs that aren't currently loaded
 */
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
        channel: (details.author && details.author.trim()) ? details.author.trim() : "Unknown Channel",
        tags: details.keywords || []
      };
    }
  } catch (e) { return null; }
  return null;
};

/**
 * The Accountant: Processes raw tab data into the leaderboard format
 */
const processAndSaveStats = async (tabMap) => {
  const entries = Object.values(tabMap);
  let totalSeconds = 0;
  let knownCount = 0;
  let unknownCount = 0;
  let channelStats = {}; 
  let tagStats = {};     

  entries.forEach(meta => {
    if (meta && meta.duration > 0) {
      totalSeconds += meta.duration;
	  
	  //If channel is missing or just whitespace, use "Unknown Channel"
      const ch = (meta.channel && meta.channel.trim()) ? meta.channel.trim() : "Unknown Channel";
	  
	  if (ch === "Unknown Channel") {
	    unknownCount++;
	  } else {
	    knownCount++;
	  }
      
      if (!channelStats[ch]) channelStats[ch] = { duration: 0, count: 0 };
      channelStats[ch].duration += meta.duration;
      channelStats[ch].count += 1;

      const cleanChannel = ch.toLowerCase().replace(/\s+/g, "");
	  const cleanTitle = (meta.title || "").toLowerCase().replace(/\s+/g, "");
	  
	  (meta.tags || []).forEach(tag => {
	    const cleanTag = tag.toLowerCase().replace(/\s+/g, "");
        
	    // Skip if tag is just the channel name, "cc", or the video title itself
	    if (cleanTag === cleanChannel || cleanTag === "yt:cc=on" || cleanTag === cleanTitle) return;
        
	    if (!tagStats[tag]) {
	      tagStats[tag] = { duration: 0, count: 0, channels: new Set() };
	    }
        tagStats[tag].duration += meta.duration;
        tagStats[tag].count += 1;
        tagStats[tag].channels.add(ch);
      });
    }
  });

  let leaderboard = [];
  Object.entries(channelStats).forEach(([name, s]) => {
    leaderboard.push({ label: `Channel: ${name}`, duration: s.duration, count: s.count });
  });

  Object.entries(tagStats).forEach(([name, s]) => {
    if (s.channels.size >= 2) {
      leaderboard.push({ label: `Tag: ${name}`, duration: s.duration, count: s.count });
    }
  });

  // Save the final processed data to storage
  await browser.storage.local.set({
    isScanning: false,
    youtubeTotals: {
      totalTabs: entries.length,
	  totalSeconds,
      knownCount,
      unknownCount,
      leaderboard: leaderboard.sort((a, b) => b.duration - a.duration).slice(0, 25),
      uniqueChannels: Object.keys(channelStats).length,
      uniqueTags: Object.keys(tagStats).length
    }
  });
};