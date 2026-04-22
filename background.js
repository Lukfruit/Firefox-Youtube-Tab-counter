// background.js
// Orchestrator for the YouTube Tab Analyzer

// 1. Listeners
browser.runtime.onMessage.addListener(async (m, sender) => { 
  if (m.type === "forceRefresh") {
    window.YTA.Background.Tracker.refreshTotals();
  }
  
  if (m.type === "heartbeat" && sender.tab) {
    window.YTA.Background.Tracker.handleHeartbeat(sender.tab.id, sender.tab.windowId, m.data);
  }

  if (m.type === "tabUpdate" && sender.tab) {
    // Treat tab updates similarly to heartbeats for state management
    window.YTA.Background.Tracker.handleHeartbeat(sender.tab.id, sender.tab.windowId, m.data);
  }

  if (m.type === "updateSettings") {
    window.YTA.State.settings = { ...window.YTA.State.settings, ...m.settings };
    await browser.storage.local.set({ settings: window.YTA.State.settings });
    // Trigger a cache update to reflect new settings if needed
    const res = await browser.storage.local.get("historyLog");
    window.YTA.Shell.Cache.update(res.historyLog || [], Object.values(window.YTA.State.tabMap));
  }
});

browser.tabs.onRemoved.addListener((tabId) => {
  window.YTA.Background.Tracker.handleTabRemoved(tabId);
});

browser.runtime.onInstalled.addListener(() => {
  window.YTA.Background.Tracker.start();
});

browser.runtime.onStartup.addListener(() => {
  window.YTA.Background.Tracker.start();
});

// 2. Initialize
window.YTA.Background.Tracker.start();
