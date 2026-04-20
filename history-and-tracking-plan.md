# Design Doc: Historical Tracking & Multi-Tab Interface

This document outlines the implementation plan for adding historical data tracking and a visual history dashboard to the YouTube Tab Analyzer.

## 1. Objective
Add a "History" tab to the extension popup that displays:
- A 7-day/30-day histogram of time spent on YouTube vs. active watch time.
- A leaderboard of channels and tags aggregated from both current open tabs and historical closed tabs.
- Storage monitoring and manual data management.

## 2. Key Files & Context
- `manifest.json`: Needs `storage` and library inclusions.
- `content.js`: Needs playback listeners and heartbeat logic.
- `background.js`: Needs to handle heartbeats, track focus, and manage the event log.
- `processor.js`: Needs to aggregate history + live data.
- `popup.html/js`: Needs tabbed UI and Chart.js integration.
- `libs/chart.min.js`: New dependency for the histogram.

## 3. Implementation Steps

### Phase 1: Enhanced Tracking Logic (`content.js` & `background.js`)
1.  **Heartbeat System**: 
    - `content.js` sends a message every 5 seconds if a YouTube video is detected.
    - Message includes: `isPaused` (boolean), `tabId`.
2.  **Focus Filtering**:
    - `background.js` maintains a `lastHeartbeat` timestamp.
    - It only increments `sessionTime` if the tab is `active` and the window is `focused`.
    - It only increments `watchTime` if the above is true AND `isPaused` is false.
3.  **Live State**: 
    - Store these counters in the existing `tabMap` so they are "live" for open tabs.

### Phase 2: Historical Persistence (`background.js`)
1.  **Event Log Schema**:
    - Listen to `browser.tabs.onRemoved`.
    - On close, move the tab's data (Channel, Tags, SessionTime, WatchTime) into a `historyLog` array in `storage.local`.
    - Add a `timestamp: Date.now()` to each entry.
2.  **Manual Purge**:
    - Create a background function to clear the `historyLog` or entries within a specific range.

### Phase 3: UI Overhaul (`popup.html` & `popup.js`)
1.  **Tabbed Navigation**:
    - Add two buttons: "Live Now" and "Trends/History".
    - Use CSS to toggle visibility of two main containers.
2.  **Chart.js Integration**:
    - Bundle `chart.min.js` locally.
    - Implement a 30-day histogram with two datasets: "Time on Site" and "Watch Time".
    - Configure tooltips to show exact HH:MM:SS on hover.
3.  **Storage Tracker**:
    - Add a small footer in the History tab showing: "Database Size: ~X.X MB [Clear All]".

### Phase 4: Data Aggregation (`processor.js`)
1.  **The "Combined" View**:
    - Modify the processing logic to fetch both `tabMap` (open) and `historyLog` (closed).
    - Aggregate Channel/Tag totals by summing values from both sources.
    - Filter the `historyLog` based on the selected UI range (7 days or 30 days).

## 4. Verification & Testing
- **Active vs. Passive Test**: Open a video, mute it, and switch to another browser window. Verify `sessionTime` and `watchTime` stop incrementing.
- **Closure Test**: Close a tab and verify its totals appear in the "History" tab leaderboard immediately.
- **Persistence Test**: Restart Firefox and verify the 30-day histogram still displays previous days' data.
- **Storage Test**: Verify the "Database Size" increases as tabs are closed.
