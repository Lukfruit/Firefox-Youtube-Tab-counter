# YouTube Tab Time Counter (Firefox)

## Install (temporary add-on)

1. Open Firefox and visit `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select the `manifest.json` file from this folder.
4. Open some YouTube video tabs, then click the extension icon to see totals.

## Notes

- Totals refresh in the background as you open or close YouTube tabs, and you can click **Refresh totals** to force an update.
- The extension reads video durations from open pages, and it caches durations by video ID so unloaded tabs can reuse known values.
- When a tab is unloaded and no cached duration exists, the background worker first tries to fetch the public HTML, then (as a last resort) opens a hidden temporary tab to read the duration and closes it.
- The YouTube Data API requires an API key and has a free daily quota (with optional billing for higher limits), which is why this extension avoids using personal keys for a public release.
- To see debug logs, open `about:debugging#/runtime/this-firefox`, find the extension, and click **Inspect** under the service worker to view console output. If the console is empty, click the extension icon or **Refresh totals** to wake the worker and generate logs.
