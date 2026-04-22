// core/Validation.js
/**
 * Pure functions for data sanitization and schema enforcement
 */
window.YTA.Core.Validation = {
  /**
   * Cleans a tab entry to ensure it matches the expected schema
   */
  cleanTabEntry: (raw) => {
    return {
      tabId: Number(raw.tabId) || 0,
      url: String(raw.url || ""),
      title: String(raw.title || "Unknown Video"),
      channel: String(raw.channel || "Unknown Channel").trim() || "Unknown Channel",
      duration: Math.max(0, parseInt(raw.duration, 10) || 0),
      currentTime: Math.max(0, parseFloat(raw.currentTime) || 0),
      sessionTime: Math.max(0, parseInt(raw.sessionTime, 10) || 0),
      watchTime: Math.max(0, parseInt(raw.watchTime, 10) || 0),
      isPlaying: !!raw.isPlaying,
      tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
      lastHeartbeat: Number(raw.lastHeartbeat) || Date.now()
    };
  },

  /**
   * Cleans a history entry for long-term storage
   */
  cleanHistoryEntry: (raw) => {
    const cleaned = window.YTA.Core.Validation.cleanTabEntry(raw);
    delete cleaned.tabId; // History entries don't need tabIds
    return {
      ...cleaned,
      timestamp: Number(raw.timestamp) || Date.now()
    };
  }
};
