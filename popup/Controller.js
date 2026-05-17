// popup/Controller.js
/**
 * Popup Controller: Orchestrates UI updates and user events.
 */
window.YTA.Popup.Controller = {
  lastData: null,

  /**
   * Initializes the popup
   */
  init: async function() {
    this.setupListeners();
    this.refreshUI();
    
    // Listen for storage changes to update live
    browser.storage.onChanged.addListener(() => this.refreshUI());
  },

  /**
   * Sets up DOM event listeners
   */
  setupListeners: function() {
    document.getElementById("tab-live").addEventListener("click", () => this.showView("view-live"));
    document.getElementById("tab-trends").addEventListener("click", () => this.showView("view-trends"));
    document.getElementById("tab-settings").addEventListener("click", () => this.showView("view-settings"));
    
    document.getElementById("range-7").addEventListener("click", () => this.onRangeChange(7));
    document.getElementById("range-30").addEventListener("click", () => this.onRangeChange(30));
    
    document.getElementById("save-settings").addEventListener("click", () => this.saveSettings());
    document.getElementById("clear-history").addEventListener("click", (e) => {
      e.preventDefault();
      if (confirm("Clear all historical data?")) {
        browser.runtime.sendMessage({ type: "forceRefresh" });
        // Storage clear will trigger refreshUI via onChanged
      }
    });
    
    document.getElementById("refresh").addEventListener("click", () => browser.runtime.sendMessage({ type: "forceRefresh" }));
  },

  /**
   * Fetches latest data and updates the UI
   */
  refreshUI: async function() {
    const data = await browser.storage.local.get(null);
    this.lastData = data;
    this.render(data);
  },

  /**
   * Main render loop
   */
  render: function(data) {
    if (!data) return;

    // 1. Status
    const statusEl = document.getElementById("status");
    if (statusEl) {
      statusEl.textContent = data.isScanning 
        ? `Scanning: ${data.currentScanned || 0} / ${data.totalToScan || '?'} tabs`
        : "Idle (Updated)";
    }

    // 2. Live Totals
    const liveTotals = data.youtubeTotals;
    if (liveTotals) {
      document.getElementById("total-duration").textContent = formatDuration(liveTotals.totalSeconds || 0);
      document.getElementById("tab-count").textContent = liveTotals.totalTabs || 0;
      document.getElementById("channel-count").textContent = liveTotals.uniqueChannels || 0;
      document.getElementById("known-count").textContent = liveTotals.knownCount || 0;
      document.getElementById("tag-count-meta").textContent = liveTotals.uniqueTags || 0;
      document.getElementById("unknown-count").textContent = liveTotals.unknownCount || 0;
      window.YTA.Popup.Renderer.renderLeaderboard(document.getElementById("live-leaderboard"), liveTotals.leaderboard, false);
    }

    // 3. Today's Stats
    const todayTotals = data.todayTotals;
    if (todayTotals) {
      document.getElementById("today-watch").textContent = formatDuration(todayTotals.totalWatch || 0);
      document.getElementById("today-session").textContent = formatDuration(todayTotals.totalSession || 0);
    }

    // 4. History View
    const currentRange = window.YTA.Popup.ChartManager.currentRange || 7;
    const historyTotals = currentRange === 7 ? data.historyTotals7 : data.historyTotals30;
    
    if (historyTotals) {
      document.getElementById("history-watch").textContent = formatDuration(historyTotals.totalWatch || 0);
      document.getElementById("history-session").textContent = formatDuration(historyTotals.totalSession || 0);
      window.YTA.Popup.Renderer.renderLeaderboard(document.getElementById("history-leaderboard"), historyTotals.leaderboard, true);
    }

    // 5. Trends (Chart)
    const trendsVisible = document.getElementById("view-trends").style.display === "flex";
    if (data.histogramData && trendsVisible) {
      window.YTA.Popup.ChartManager.update(data.histogramData);
    }

    // 6. Settings & Metadata
    if (data.storageSizeKB) document.getElementById("storage-size").textContent = data.storageSizeKB;
    if (data.settings) {
      document.getElementById("min-watch-time").value = data.settings.minWatchTime || 30;
      document.getElementById("reset-time").value = data.settings.resetTime || "05:00";
      document.getElementById("heartbeat-interval").value = data.settings.heartbeatInterval || 1;
      document.getElementById("afk-timeout").value = data.settings.afkTimeout || 15;
      document.getElementById("scanner-delay").value = data.settings.scannerDelay || 1000;
    }

    // Update scanner recommendation
    const stats = data.lastScanStats;
    const recEl = document.getElementById("scan-recommendation");
    if (recEl) {
      if (stats && stats.totalRequests > 0) {
        const failureRate = stats.error429Count / stats.totalRequests;
        if (failureRate > 0) {
          // User formula: recommended = usedDelay / failureRate
          const recDelay = Math.round(stats.usedDelay / failureRate);
          recEl.textContent = `Recommended: ${recDelay}ms (Last failure rate: ${Math.round(failureRate * 100)}%)`;
          recEl.style.color = "#f87171"; // Reddish
        } else {
          recEl.textContent = "Recommended: Current speed is optimal (0% failures)";
          recEl.style.color = "#10b981"; // Green
        }
      } else {
        recEl.textContent = "Recommended: Run a scan to see data";
        recEl.style.color = "#60a5fa";
      }
    }
  },

  /**
   * Navigation between views
   */
  showView: function(viewId) {
    const views = ["view-live", "view-trends", "view-settings"];
    const tabs = ["tab-live", "tab-trends", "tab-settings"];
    views.forEach(v => document.getElementById(v).style.display = v === viewId ? "flex" : "none");
    tabs.forEach(t => document.getElementById(t).classList.toggle("active", t === viewId.replace("view-", "tab-")));
    if (viewId === "view-trends") this.refreshUI();
  },

  /**
   * Range switching for chart
   */
  onRangeChange: function(range) {
    window.YTA.Popup.ChartManager.currentRange = range;
    document.getElementById("range-7").classList.toggle("active", range === 7);
    document.getElementById("range-30").classList.toggle("active", range === 30);
    this.refreshUI();
  },

  /**
   * Saves settings to background
   */
  saveSettings: function() {
    const minWatchTime = parseInt(document.getElementById("min-watch-time").value, 10) || 0;
    const resetTime = document.getElementById("reset-time").value || "05:00";
    const heartbeatInterval = parseInt(document.getElementById("heartbeat-interval").value, 10) || 1;
    const afkTimeout = parseInt(document.getElementById("afk-timeout").value, 10) || 15;
    const scannerDelay = parseInt(document.getElementById("scanner-delay").value, 10) || 1000;
    browser.runtime.sendMessage({ 
      type: "updateSettings", 
      settings: { minWatchTime, resetTime, heartbeatInterval, afkTimeout, scannerDelay } 
    }).then(() => {
      const btn = document.getElementById("save-settings");
      btn.textContent = "Saved!";
      btn.style.background = "#059669";
      setTimeout(() => {
        btn.textContent = "Save Changes";
        btn.style.background = "";
      }, 2000);
    });
  }
};
