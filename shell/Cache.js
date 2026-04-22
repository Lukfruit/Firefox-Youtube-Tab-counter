// shell/Cache.js
/**
 * Imperative shell for pre-calculating and caching expensive statistics.
 */
window.YTA.Shell.Cache = {
  /**
   * Updates cached stats based on current history and tabs
   */
  update: async function(historyLog, tabMapEntries) {
    const progressingOpen = tabMapEntries.filter(e => e.watchTime > 0);
    
    const histogramData = window.YTA.Core.Analytics.generateHistogram(historyLog, progressingOpen);
    
    // Pre-calculate today's totals for the popup
    const settings = window.YTA.State.settings;
    const resetThreshold = window.YTA.Core.Logic.getMostRecentResetTime(settings.resetTime);
    const todayHistory = historyLog.filter(e => e.timestamp >= resetThreshold);
    const todayTotals = window.YTA.Core.Analytics.processEntries([...todayHistory, ...progressingOpen], "watchTime");

    // Also calculate full history totals
    const historyTotals = window.YTA.Core.Analytics.processEntries([...historyLog, ...progressingOpen], "watchTime");

    const storageJson = JSON.stringify({ historyLog, tabMap: window.YTA.State.tabMap });
    const storageSizeKB = (new Blob([storageJson]).size / 1024).toFixed(1);

    await browser.storage.local.set({
      histogramData,
      todayTotals,
      historyTotals,
      storageSizeKB
    });
    
    console.log("Stats cache updated.");
  }
};
