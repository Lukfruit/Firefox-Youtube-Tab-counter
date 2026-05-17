// core/Logic.js
/**
 * Pure business rules for the YouTube Tab Analyzer
 */
window.YTA.Core.Logic = {
  /**
   * Determines if a video has been watched enough to be archived
   */
  isWatchedEnough: (entry, settings) => {
    const minTime = settings?.minWatchTime || 30;
    const isWatchedEnoughTime = entry.watchTime >= minTime || entry.sessionTime >= minTime;
    
    const isShortButWatchedFully = entry.duration > 0 && 
                                  entry.duration < minTime && 
                                  (entry.watchTime >= entry.duration * 0.9 || entry.currentTime >= entry.duration * 0.9);
    
    return isWatchedEnoughTime || isShortButWatchedFully;
  },

  /**
   * Calculates the most recent reset timestamp based on a time string (e.g., "05:00")
   */
  getMostRecentResetTime: (resetTimeStr = "05:00") => {
    const [hours, minutes] = resetTimeStr.split(':').map(Number);
    const now = new Date();
    const threshold = new Date(now);
    threshold.setHours(hours, minutes, 0, 0);

    if (now < threshold) {
      threshold.setDate(threshold.getDate() - 1);
    }

    return threshold.getTime();
  },

  /**
   * Logic for processing the daily reset
   */
  processDailyReset: (tabMap, lastReset, resetTimeSetting, settings) => {
    const currentResetThreshold = window.YTA.Core.Logic.getMostRecentResetTime(resetTimeSetting);
    if (lastReset >= currentResetThreshold) return null;

    const newTabMap = { ...tabMap };
    const archiveEntries = [];

    for (const tabId in newTabMap) {
      const entry = newTabMap[tabId];
      if (entry.watchTime > 0 || entry.sessionTime > 0) {
        const archivedEntry = { ...entry, timestamp: currentResetThreshold - 1 };
        if (window.YTA.Core.Logic.isWatchedEnough(archivedEntry, settings)) {
          archiveEntries.push(archivedEntry);
        }
        // Reset counters for the new day
        newTabMap[tabId] = { ...entry, sessionTime: 0, watchTime: 0 };
      }
    }

    return { newTabMap, archiveEntries, newTimestamp: currentResetThreshold };
  },

  /**
   * Logic for updating tab state from a heartbeat
   */
  updateTabState: (existing, data, settings, systemState) => {
    const now = Date.now();
    let tabData = { ...existing };
    let shouldArchive = null;

    if (existing && existing.url && existing.url !== data.url) {
      if (window.YTA.Core.Logic.isWatchedEnough(existing, settings)) {
        shouldArchive = { ...existing, timestamp: now };
      }
      // Reset for new video
      tabData.url = data.url;
      tabData.sessionTime = 0;
      tabData.watchTime = 0;
      // Enter "Loading" state with a grace period
      tabData.channel = "Unknown Channel";
      tabData.tags = [];
      tabData.duration = 0;
      tabData.title = "Loading...";
      tabData.metadataLoadingSince = now; 
    }

    const interval = settings.heartbeatInterval || 1;
    const timeSinceLast = now - (tabData.lastHeartbeat || 0);
    // Throttling check
    if (existing && timeSinceLast < (interval * 1000) - 500) return { throttled: true };

    // Metadata Grace Period:
    // If we just changed URL, ignore heartbeats until metadata (channel/duration) is provided,
    // or until 5 seconds have passed. This prevents "Unknown Channel" spam during loading.
    const isActuallyVideo = data.url.includes("/watch") || data.url.includes("/shorts");
    const hasMetadata = data.channel && data.channel !== "Unknown Channel";
    
    if (tabData.metadataLoadingSince && (now - tabData.metadataLoadingSince < 5000)) {
      if (isActuallyVideo && !hasMetadata) {
        // Still waiting for video metadata, don't increment yet
        return { throttled: true }; 
      }
    }
    
    // Clear the loading flag if we have metadata or timeout reached
    if (hasMetadata || (tabData.metadataLoadingSince && now - tabData.metadataLoadingSince >= 5000)) {
      delete tabData.metadataLoadingSince;
    }

    tabData = window.YTA.Core.Validation.cleanTabEntry({
      ...tabData,
      ...data,
      lastHeartbeat: now
    });

    if (systemState.isActiveTab) {
      const isUserReallyActive = !systemState.isSystemIdle && data.isUserActive !== false;
      const shouldIncrement = data.isPlaying || isUserReallyActive;

      if (shouldIncrement) {
        tabData.sessionTime += interval;
        if (data.isPlaying) tabData.watchTime += interval;
      }
    }

    return { tabData, shouldArchive, progressed: systemState.isActiveTab };
  },

  /**
   * Logic for calculating recommended delay based on failure rates
   */
  calculateRecommendedDelay: (stats) => {
    if (!stats || stats.totalRequests === 0) return 1000;
    const failureRate = stats.error429Count / stats.totalRequests;
    if (failureRate === 0) return Math.max(100, Math.round(stats.usedDelay * 0.9));
    return Math.round(stats.usedDelay / failureRate);
  },

  /**
   * Logic to decide if a tab needs re-scanning
   */
  isTabFresh: (tabData) => {
    if (!tabData) return false;
    const isFresh = tabData.lastHeartbeat && (Date.now() - tabData.lastHeartbeat < 10 * 60 * 1000);
    const hasMetadata = tabData.channel && tabData.channel !== "Unknown Channel";
    return !!(isFresh && hasMetadata);
  }
};
