# YouTube Tab Analyzer - TO DO

This document tracks planned features and UI/UX refinements for the extension.

## Feature 1: Enhanced Tooltips for Leaderboard
- [ ] **Hover on Channel/Tag (Main Entry):**
    - **Live Now Tab:** Display full name and number of open tabs with this channel/tag.
    - **History Tab:** Display full name.
    - *Goal:* Resolve issues where long names are truncated and hide count data.
- [ ] **Hover on Tab (Expanded Entry):**
    - Display full video title.

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
- [x] clear all history does not clear the cache.

## Visuals
 - [ut the big numbers on the live tab inside the box so it's a bit more visually consistent with the history tab]
