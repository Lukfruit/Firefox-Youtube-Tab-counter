const YOUTUBE_TAB_QUERY = {
  url: ["*://*.youtube.com/*", "*://youtu.be/*"],
};

let refreshTimeout = null;

const ISO_DURATION_REGEX = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;
const LENGTH_SECONDS_REGEX = /"lengthSeconds":"(\d+)"/;
const APPROX_DURATION_REGEX = /"approxDurationMs":"(\d+)"/;
const META_DURATION_REGEX = /itemprop="duration"\s+content="([^"]+)"/i;

const parseIsoDuration = (duration) => {
  if (!duration) {
    return null;
  }

  const match = duration.match(ISO_DURATION_REGEX);
  if (!match) {
    return null;
  }

  const hours = Number.parseInt(match[1] ?? "0", 10);
  const minutes = Number.parseInt(match[2] ?? "0", 10);
  const seconds = Number.parseInt(match[3] ?? "0", 10);

  return hours * 3600 + minutes * 60 + seconds;
};

const isVideoUrl = (url) => {
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname;

    if (host === "youtu.be") {
      return parsedUrl.pathname.length > 1;
    }

    if (!host.endsWith("youtube.com")) {
      return false;
    }

    if (parsedUrl.pathname === "/watch") {
      return parsedUrl.searchParams.has("v");
    }

    return parsedUrl.pathname.startsWith("/shorts/");
  } catch (error) {
    return false;
  }
};

const normalizeVideoUrl = (url) => {
  const parsedUrl = new URL(url);
  if (parsedUrl.hostname === "youtu.be") {
    const videoId = parsedUrl.pathname.replace("/", "");
    const watchUrl = new URL("https://www.youtube.com/watch");
    watchUrl.searchParams.set("v", videoId);
    return watchUrl.toString();
  }

  return parsedUrl.toString();
};

const extractDurationFromHtml = (html) => {
  const lengthSecondsMatch = html.match(LENGTH_SECONDS_REGEX);
  if (lengthSecondsMatch) {
    const lengthSeconds = Number.parseInt(lengthSecondsMatch[1], 10);
    if (Number.isFinite(lengthSeconds) && lengthSeconds > 0) {
      return lengthSeconds;
    }
  }

  const approxDurationMatch = html.match(APPROX_DURATION_REGEX);
  if (approxDurationMatch) {
    const approxDurationMs = Number.parseInt(approxDurationMatch[1], 10);
    if (Number.isFinite(approxDurationMs) && approxDurationMs > 0) {
      return Math.floor(approxDurationMs / 1000);
    }
  }

  const metaDurationMatch = html.match(META_DURATION_REGEX);
  if (metaDurationMatch) {
    const parsedMetaDuration = parseIsoDuration(metaDurationMatch[1]);
    if (Number.isFinite(parsedMetaDuration) && parsedMetaDuration > 0) {
      return parsedMetaDuration;
    }
  }

  return null;
};

const fetchDurationFromUrl = async (url) => {
  if (!isVideoUrl(url)) {
    return null;
  }

  try {
    const response = await fetch(normalizeVideoUrl(url), {
      credentials: "omit",
      redirect: "follow",
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return extractDurationFromHtml(html);
  } catch (error) {
    return null;
  }
};

const getDurationForTab = async (tab) => {
  if (tab?.id) {
    try {
      const response = await browser.tabs.sendMessage(tab.id, { type: "getDuration" });
      if (Number.isFinite(response?.durationSeconds) && response.durationSeconds > 0) {
        return response.durationSeconds;
      }
    } catch (error) {
      // Ignore and try a background fetch fallback.
    }
  }

  if (tab?.url) {
    return fetchDurationFromUrl(tab.url);
  }

  return null;
};

const scheduleRefresh = (delay = 250) => {
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
  }

  refreshTimeout = setTimeout(() => {
    refreshTimeout = null;
    refreshTotals();
  }, delay);
};

const refreshTotals = async () => {
  const tabs = await browser.tabs.query(YOUTUBE_TAB_QUERY);
  const durationPromises = tabs.map((tab) => getDurationForTab(tab));

  const durations = await Promise.all(durationPromises);

  let totalSeconds = 0;
  let knownCount = 0;
  let unknownCount = 0;

  durations.forEach((durationSeconds) => {
    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
      totalSeconds += durationSeconds;
      knownCount += 1;
    } else {
      unknownCount += 1;
    }
  });

  await browser.storage.local.set({
    youtubeTotals: {
      totalTabs: tabs.length,
      knownCount,
      unknownCount,
      totalSeconds,
      updatedAt: Date.now(),
    },
  });
};

browser.runtime.onInstalled.addListener(() => {
  refreshTotals();
});

browser.runtime.onStartup.addListener(() => {
  refreshTotals();
});

browser.tabs.onCreated.addListener(() => {
  scheduleRefresh();
});

browser.tabs.onRemoved.addListener(() => {
  scheduleRefresh();
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    scheduleRefresh();
  }
});

browser.runtime.onMessage.addListener((message) => {
  if (message?.type === "refreshTotals") {
    refreshTotals();
  }
});
