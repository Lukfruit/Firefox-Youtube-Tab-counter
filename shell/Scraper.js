// shell/Scraper.js
/**
 * Imperative shell for fetching YouTube metadata.
 */
window.YTA.Shell.Scraper = {
  _lastRateLimitTime: 0,

  /**
   * Fetches video metadata from a YouTube URL
   */
  fetchMetadata: async function(url) {
    // 10-minute cooldown if rate limited (429)
    if (Date.now() - this._lastRateLimitTime < 10 * 60 * 1000) {
      console.warn("Scraper cooling down due to rate limiting.");
      return null;
    }

    try {
      const response = await fetch(url);
      if (response.status === 429) {
        this._lastRateLimitTime = Date.now();
        console.error("YouTube Rate Limit Hit (429)");
        return null;
      }
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
    } catch (e) {
      console.error("Scraper Error:", e);
    }
    return null;
  }
};
