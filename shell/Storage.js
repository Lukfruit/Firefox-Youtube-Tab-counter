// shell/Storage.js
/**
 * Imperative shell for browser storage interactions.
 * Includes a TaskQueue to prevent write collisions.
 */
window.YTA.Shell.Storage = {
  _queue: Promise.resolve(),

  /**
   * Schedules a storage operation in the sequential queue
   */
  _enqueue: function(operation) {
    this._queue = this._queue.then(operation).catch(err => {
      console.error("Storage Queue Error:", err);
    });
    return this._queue;
  },

  /**
   * Loads all state from storage
   */
  load: async function() {
    try {
      const data = await browser.storage.local.get(null);
      if (data.tabMap) window.YTA.State.tabMap = data.tabMap;
      if (data.settings) window.YTA.State.settings = { ...window.YTA.State.settings, ...data.settings };
      return data;
    } catch (e) {
      console.error("Failed to load storage:", e);
      return {};
    }
  },

  /**
   * Saves the current tabMap to storage
   */
  saveTabMap: function(tabMap) {
    return this._enqueue(async () => {
      await browser.storage.local.set({ tabMap });
    });
  },

  /**
   * Adds an entry to the historyLog
   */
  archiveEntry: function(entry) {
    return this._enqueue(async () => {
      const res = await browser.storage.local.get("historyLog");
      const historyLog = res.historyLog || [];
      const cleaned = window.YTA.Core.Validation.cleanHistoryEntry(entry);
      historyLog.push(cleaned);
      await browser.storage.local.set({ historyLog });
      
      // Trigger a cache update after archiving
      if (window.YTA.Shell.Cache) {
        window.YTA.Shell.Cache.update(historyLog, Object.values(window.YTA.State.tabMap));
      }
    });
  },

  /**
   * Clears historical data
   */
  clearHistory: function() {
    return this._enqueue(async () => {
      await browser.storage.local.set({ historyLog: [], histogramData: null });
    });
  }
};
