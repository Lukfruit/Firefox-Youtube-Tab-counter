# Design Doc: Metadata Acquisition & Rate-Limit Mitigation

This document outlines the architectural decisions made to handle YouTube metadata (tags, channels, durations) without triggering `429 Too Many Requests` errors.

## 1. Problem Statement
YouTube employs sophisticated anti-scraping measures. When an extension fetches many video pages in the background (using `fetch()`) in a short burst, YouTube:
1.  **Rate Limits**: Returns a `429` status code.
2.  **Challenges**: Redirects requests to a CAPTCHA ("sorry") page.
3.  **CORS Blocks**: Because the "sorry" page lacks CORS headers, the browser's security model blocks the response entirely, leading to `NetworkError`.

## 2. Architectural Decisions

### Decision 1: "Content Script First" Strategy
*   **Action**: `content.js` extracts tags from `<meta name="keywords">` and sends them to the background.
*   **Rationale**: The content script runs inside an already-loaded tab. The metadata is already present in the DOM. Accessing it costs zero network overhead and carries no risk of rate limiting.
*   **Expectation**: 90% of metadata should come from the DOM, not the network.

### Decision 2: Sequential Queue (Anti-Bursting)
*   **Action**: Replaced `Promise.all` (parallel) with a `for...of` loop (sequential) and a `1500ms` delay between background fetches.
*   **Rationale**: YouTube monitors "burstiness." Five requests in 10ms is a bot signal. One request every 1.5s looks more like human navigation.
*   **Expectation**: Even when background fetches are necessary (e.g., for asleep/unloaded tabs), they will be staggered enough to stay under the radar.

### Decision 3: The Circuit Breaker (Backoff)
*   **Action**: Implemented a `lastRateLimitTime` timestamp. If a `429` is hit, all background fetching is disabled for 10 minutes.
*   **Rationale**: Once an IP is "flagged," continuing to send requests only extends the duration of the ban. "Going quiet" allows the IP reputation to recover.
*   **Expectation**: Prevents "death spirals" where the extension keeps hammering a blocked endpoint.

### Decision 4: State-Aware Persistence
*   **Action**: Explicitly saving `tabMap` to `storage.local` and loading it on startup.
*   **Rationale**: If the extension forgets metadata every time the background script suspends, it is forced to re-fetch everything. Saving the state minimizes redundant requests.
*   **Expectation**: Each video is fetched at most once per "session" (as long as the tab stays open).

## 3. The "Rate Limit" Mystery
**What is the exact limit?**
There is no fixed number (e.g., "50 requests per hour"). YouTube's logic is dynamic and considers:
-   **IP Reputation**: Data center IPs are capped more strictly than residential ones.
-   **Session Cookies**: Requests without valid YouTube session cookies are more suspicious.
-   **User Agent**: Non-browser headers trigger flags.
-   **Burst Rate**: The number of requests in a 5-second window.

**Safe Operating Window**: 
Based on empirical testing, staying under **1 request per 2 seconds** for background fetches is generally safe for residential IPs.

## 4. Tracking & Validation
To monitor the health of this system, check the **Background Console**:
-   **Green Flag**: "Found metadata: [Channel Name] Tags: [X]" (Fetched successfully).
-   **Yellow Flag**: "Skipping fetch due to recent rate limiting" (Circuit breaker is active).
-   **Red Flag**: "YouTube rate limit (429) hit!" (We need to increase the 1.5s delay).

## 5. Future Navigation
If rate limiting persists even with these changes, the next steps are:
1.  **Lazy Fetching**: Only fetch tags when the user actually opens the popup.
2.  **Proxying**: (Not recommended for privacy) Routing metadata requests through a secondary service.
3.  **User-Driven Scans**: Removing the "auto-scan" on startup and making it purely manual.
