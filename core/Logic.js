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
  }
};
