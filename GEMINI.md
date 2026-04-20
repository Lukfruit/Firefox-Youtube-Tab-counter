# YouTube Tab Analyzer - Context & Architecture

This document provides architectural context and development guidelines for the YouTube Tab Analyzer Firefox extension.

## Project Overview
YouTube Tab Analyzer is a Firefox browser extension (Manifest V2) that aggregates data from all open YouTube tabs to provide insights into potential watch time and user interests.

### Core Technologies
- **JavaScript (ES6+)**: Vanilla JS for logic and DOM manipulation.
- **WebExtensions API**: Used for tab management, storage, and cross-script communication.
- **HTML/CSS**: For the extension popup interface.

## Architecture & Data Flow

### 1. Background Layer (`background.js`, `processor.js`)
- **State Management**: Maintains a `tabMap` of all open YouTube tabs and a `historyLog` for closed tabs.
- **Tracking Engine**: 
    - **Heartbeat Listener**: Processes 5-second updates from `content.js`.
    - **Focus Awareness**: Only increments `sessionTime` if the tab is active and the window is focused.
    - **Watch Time**: Only increments `watchTime` if the video is currently playing.
- **Data Accountant**: `processor.js` aggregates both "Live" stats (open tabs) and "History" stats (open + closed tabs).

### 2. Content Layer (`content.js`)
- **Metadata Extraction**: Reads video duration and channel information.
- **Heartbeat System**: Sends a pulse every 5 seconds with the current video playback state (playing/paused).

### 3. UI Layer (`popup.html`, `popup.js`)
- **Tabbed Interface**: 
    - **Live Now**: Shows real-time statistics of open tabs.
    - **Trends & History**: Displays a 30-day interactive histogram (using Chart.js) and a combined leaderboard.
- **Histogram**: Visualizes "Time on Site" vs "Active Watch Time" with hoverable tooltips.
- **Storage Management**: Displays current database size and provides a manual "Clear History" option.

### 4. Shared Utilities (`utils.js`)
- Contains ISO 8601 duration parsing and time formatting logic.

## Key Development Conventions

- **Heartbeat Pattern**: Use heartbeats for any time-based tracking to ensure accuracy across multiple tabs.
- **Storage Monitoring**: Monitor the size of `historyLog` as it persists data indefinitely until manually cleared.
- **Library Management**: Third-party libraries like `Chart.js` are bundled locally in the `libs/` folder.

## Building and Running

### Development Mode
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select the `manifest.json` file from the root directory.

### Testing
- **Manual Verification**: Open several YouTube videos, interact with the popup, and verify that closing/opening tabs updates the counts in real-time.
- **Logs**: View background logs via the "Inspect" button in `about:debugging`. View popup logs by right-clicking the popup and selecting "Inspect Element".

## Permissions
The extension requires the following permissions:
- `tabs`: To query and communicate with YouTube tabs.
- `storage`: To persist the `tabMap` and processed statistics.
- `https://*.youtube.com/*`: To inject content scripts and fetch metadata.
