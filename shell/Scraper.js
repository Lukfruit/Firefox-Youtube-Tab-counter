// shell/Scraper.js
/**
 * Imperative shell for fetching YouTube metadata.
 */
window.YTA.Shell.Scraper = {
  _lastRateLimitTime: 0,
  _lastRequestTime: 0,
  _MIN_GAP: 1500, // 1.5s gap between scraper calls

  /**
   * Fetches video metadata from a YouTube URL
   */
  fetchMetadata: async function(url) {
    // 10-minute cooldown if rate limited (429)
    if (Date.now() - this._lastRateLimitTime < 10 * 60 * 1000) {
      return null;
    }

    // Ensure minimum gap
    const timeSinceLast = Date.now() - this._lastRequestTime;
    if (timeSinceLast < this._MIN_GAP) {
      await new Promise(r => setTimeout(r, this._MIN_GAP - timeSinceLast));
    }
    this._lastRequestTime = Date.now();

    try {
      const response = await fetch(url, { redirect: 'manual' });
      
      // Redirect to CAPTCHA page (opaque redirect in browser fetch often shows as status 0 or 429)
      if (response.status === 429 || response.type === 'opaqueredirect' || response.status === 0) {
        this.handleRateLimit(url);
        return null;
      }

      if (!response.ok) return null;

      const html = await response.text();
      // Verify we aren't seeing a "Sorry" page in the body
      if (html.includes("google.com/sorry") || html.includes("consent.youtube.com")) {
        this.handleRateLimit(url);
        return null;
      }

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
  },

  handleRateLimit: function(url) {
    if (Date.now() - this._lastRateLimitTime < 60000) return; // Don't spam notifications
    this._lastRateLimitTime = Date.now();
    
    window.YTA.Background.lastBlockedUrl = url;
    browser.notifications.create("yta-captcha", {
      type: "basic",
      iconUrl: "icon.svg",
      title: "YouTube Tracking Paused",
      message: "YouTube is checking if you are a robot. Click here to solve the CAPTCHA and resume tracking.",
      priority: 2
    });
  }
};
