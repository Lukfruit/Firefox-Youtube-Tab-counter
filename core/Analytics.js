// core/Analytics.js
/**
 * Pure functions for statistics and data transformation
 */
window.YTA.Core.Analytics = {
  /**
   * Processes raw entries into a leaderboard format
   */
  processEntries: (entries, sortField = "duration") => {
    let totalSeconds = 0;
    let totalSession = 0;
    let totalWatch = 0;
    let knownCount = 0;
    let unknownCount = 0;
    let channelStats = {}; 
    let tagStats = {};     

    entries.forEach(meta => {
      if (meta && (meta.duration > 0 || meta.watchTime > 0)) {
        totalSeconds += (meta.duration || 0);
        totalSession += (meta.sessionTime || 0);
        totalWatch += (meta.watchTime || 0);
	  
        const ch = (meta.channel && meta.channel.trim()) ? meta.channel.trim() : "Unknown Channel";
	  
        if (ch === "Unknown Channel") {
          unknownCount++;
        } else {
          knownCount++;
        }
      
        if (!channelStats[ch]) channelStats[ch] = { duration: 0, sessionTime: 0, watchTime: 0, count: 0, tabs: [] };
        channelStats[ch].duration += (meta.duration || 0);
        channelStats[ch].sessionTime += (meta.sessionTime || 0);
        channelStats[ch].watchTime += (meta.watchTime || 0);
        channelStats[ch].count += 1;
        if (meta.tabId) {
          channelStats[ch].tabs.push({ 
            title: meta.title, 
            tabId: meta.tabId, 
            isLive: true,
            isPlaying: !!meta.isPlaying 
          });
        }

        const cleanChannel = ch.toLowerCase().replace(/\s+/g, "");
        const cleanTitle = (meta.title || "").toLowerCase().replace(/\s+/g, "");
	  
        (meta.tags || []).forEach(tag => {
          const cleanTag = tag.toLowerCase().replace(/\s+/g, "");
          const genericTags = [
            "videosharing", "cameraphone", "videophone", "freeupload", "yt:cc=on",
            "free", "video", "upload", "sharing"
          ];
          
          if (cleanTag === cleanChannel || genericTags.includes(cleanTag) || cleanTag === cleanTitle) return;
        
          if (!tagStats[tag]) {
            tagStats[tag] = { duration: 0, sessionTime: 0, watchTime: 0, count: 0, channels: new Set(), tabs: [] };
          }
          tagStats[tag].duration += (meta.duration || 0);
          tagStats[tag].sessionTime += (meta.sessionTime || 0);
          tagStats[tag].watchTime += (meta.watchTime || 0);
          tagStats[tag].count += 1;
          tagStats[tag].channels.add(ch);
          if (meta.tabId) {
            tagStats[tag].tabs.push({ 
              title: meta.title, 
              tabId: meta.tabId, 
              isLive: true,
              isPlaying: !!meta.isPlaying 
            });
          }
        });
      }
    });

    let leaderboard = [];
    Object.entries(channelStats).forEach(([name, s]) => {
      leaderboard.push({ 
        label: `Channel: ${name}`, 
        duration: s.duration, 
        sessionTime: s.sessionTime, 
        watchTime: s.watchTime, 
        count: s.count, 
        tabs: s.tabs 
      });
    });

    Object.entries(tagStats).forEach(([name, s]) => {
      if (s.channels.size >= 2) {
        leaderboard.push({ 
          label: `Tag: ${name}`, 
          duration: s.duration, 
          sessionTime: s.sessionTime, 
          watchTime: s.watchTime, 
          count: s.count, 
          tabs: s.tabs 
        });
      }
    });

    return {
      totalTabs: entries.length,
      totalSeconds,
      totalSession,
      totalWatch,
      knownCount,
      unknownCount,
      leaderboard: leaderboard.sort((a, b) => b[sortField] - a[sortField]).slice(0, 25),
      uniqueChannels: Object.keys(channelStats).length,
      uniqueTags: Object.keys(tagStats).length
    };
  },

  /**
   * Generates histogram data for a given range (defaults to 30 days)
   */
  generateHistogram: (historyLog, progressingOpenEntries, days = 30) => {
    const now = new Date();
    const histogram = {};
    for (let i = 0; i < days; i++) {
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

    const todayStr = now.toISOString().split("T")[0];
    if (histogram[todayStr]) {
      progressingOpenEntries.forEach(entry => {
        histogram[todayStr].sessionTime += (entry.sessionTime || 0);
        histogram[todayStr].watchTime += (entry.watchTime || 0);
      });
    }

    return histogram;
  }
};
