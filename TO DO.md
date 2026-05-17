# YouTube Tab Analyzer - TO DO

This document tracks planned features and UI/UX refinements for the extension.

## Feature 1: Enhanced Tooltips for Leaderboard
- [ ] **Hover on Channel/Tag (Main Entry):**
    - **Live Now Tab:** Display full name and number of open tabs with this channel/tag.
    - **History Tab:** Display full name.
    - *Goal:* Resolve issues where long names are truncated and hide count data.
- [ ] **Hover on Tab (Expanded Entry):**
    - Display full video title.

## Feature 2: UI Refinement for Refresh Button
- [ ] Relocate "Refresh & Rescan Tabs" button to the top of the **Live Now** tab.
- [ ] Position it next to the scanned tabs counter/status text.
- [ ] Reduce button size and ensure it is in-line with the text for a cleaner look.

## Feature 3: Scan Persistence Optimization
- [ ] Implement a "scanned" flag or persistent metadata cache for tabs.
- [ ] Prevent redundant re-scanning of tabs if metadata (title, channel, tags) is already present in storage.
- [ ] *Rationale:* YouTube video metadata is static; re-scanning uses unnecessary resources/rate limits.

## Feature 4: Popup Dimension Adjustments
- [ ] Increase the height of the extension popup.
- [ ] *Goal:* Ensure all primary content (stats, status, buttons) is visible without vertical scrolling.
- [ ] Maintain independent scrolling for the leaderboard area only.

## Feature 5: Leaderboard Expansion
- [ ] Increase the total number of positions displayed in both the Live and Historical leaderboards.

## Feature 6: History Leaderboard Filtering
- [ ] **Task:** Investigate why channels with `0m 00s` watch time appear in the history leaderboard.
- [ ] **To-do:** Decide on a handling strategy:
    - Option A: Filter out entries with 0 watch time entirely.
    - Option B: Group them under a "Browsed but not Watched" section.
    - Option C: Ensure they are only archived if they meet the `minWatchTime` threshold.

## Feature 7: Track how much the backlog grew/shrunk
    
## Bugs:
 - history tab shows wrong number of watched video (like for via li for whatever reason i have like 21 videos watched, i think it double dips from active/open tabs or something)
    - it seems that the app double counts a tab when you open an unloaded tab for the first time since X event. in both the live and the history tabs at that. For example: when i opened an unloaded tab the live version went from 10 to 11 tabs open and same went for the history tab (from 46 to 47)
 - history tab doesn not change view times depending on format it always displays total times, it should switch between 30 days and 7 days segments
 - tabs do not properly update when it's the same video tab but different video. i.e you watch a video and the next video is from recommendations, so effectivively you watched two videos in a single tab, the duration from both videos will be added to the first video's tags.
