// shell/Cache.js
/**
 * Imperative shell for pre-calculating and caching expensive statistics.
 */
window.YTA.Shell.Cache = {
  /**
   * Updates cached stats based on current history and tabs
   */
  update: async function(historyLog, tabMapEntries) {
    const progressingOpen = tabMapEntries.filter(e => e.watchTime > 0 || e.sessionTime > 0);
    
    const histogramData = window.YTA.Core.Analytics.generateHistogram(historyLog, progressingOpen);
    
    // Pre-calculate today's totals for the popup
    const settings = window.YTA.State.settings;
    const resetThreshold = window.YTA.Core.Logic.getMostRecentResetTime(settings.resetTime);
    const todayHistory = historyLog.filter(e => e.timestamp >= resetThreshold);
    const todayTotals = window.YTA.Core.Analytics.processEntries([...todayHistory, ...progressingOpen], "watchTime");

    // Pre-calculate 7-day and 30-day history totals
    const now = Date.now();
    const threshold7 = now - (7 * 24 * 60 * 60 * 1000);
    const threshold30 = now - (30 * 24 * 60 * 60 * 1000);

    const history7 = historyLog.filter(e => e.timestamp >= threshold7);
    const history30 = historyLog.filter(e => e.timestamp >= threshold30);

    const historyTotals7 = window.YTA.Core.Analytics.processEntries([...history7, ...progressingOpen], "watchTime");
    const historyTotals30 = window.YTA.Core.Analytics.processEntries([...history30, ...progressingOpen], "watchTime");

    // Also calculate live totals for the "Live Now" tab
    const youtubeTotals = window.YTA.Core.Analytics.processEntries(tabMapEntries, "duration");

    const storageJson = JSON.stringify({ historyLog, tabMap: window.YTA.State.tabMap });
    const storageSizeKB = (new Blob([storageJson]).size / 1024).toFixed(1);

    await browser.storage.local.set({
      youtubeTotals,
      histogramData,
      todayTotals,
      historyTotals7,
      historyTotals30,
      storageSizeKB
    });
    
    console.log("Stats cache updated.");
  }
};
