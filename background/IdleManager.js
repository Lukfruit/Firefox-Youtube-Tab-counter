// background/IdleManager.js
/**
 * Idle Manager: API Shell for system-wide activity detection.
 */
window.YTA.Background.IdleManager = {
  isSystemIdle: false,

  /**
   * Initializes idle listeners
   */
  init: function() {
    this.updateInterval();
    
    browser.idle.onStateChanged.addListener((state) => {
      this.isSystemIdle = (state !== "active");
      console.log("[IdleManager] System state changed:", state);
    });
  },

  /**
   * Updates the browser idle detection interval based on settings
   */
  updateInterval: function() {
    const timeout = window.YTA.State.settings.afkTimeout || 15;
    browser.idle.setDetectionInterval(Math.max(15, timeout));
    
    browser.idle.queryState(timeout, (state) => {
      this.isSystemIdle = (state !== "active");
    });
  }
};
