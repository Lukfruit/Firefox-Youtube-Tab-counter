// content.js
const getDurationSeconds = () => {
  const metaDuration = document.querySelector('meta[itemprop="duration"]');
  const parsedMetaDuration = parseIsoDuration(metaDuration?.content);
  if (Number.isFinite(parsedMetaDuration) && parsedMetaDuration > 0) return parsedMetaDuration;

  const videoElement = document.querySelector("video");
  if (videoElement && Number.isFinite(videoElement.duration)) return Math.floor(videoElement.duration);
  return null;
};

// Logic to identify channel name for the live report
const getChannelName = () => {
  const path = window.location.pathname;
  const url = new URL(window.location.href);

  // Categorize non-video pages as "YouTube" with sub-types
  if (path === "/" || path === "/feed/trending") return "YouTube (Home)";
  if (path === "/results") return "YouTube (Search)";
  if (path.startsWith("/feed/subscriptions")) return "YouTube (Subscriptions)";
  if (path.startsWith("/feed/library") || path.startsWith("/feed/history")) return "YouTube (Library/History)";
  if (path.startsWith("/channel/") || path.startsWith("/@")) {
    // If we are on a channel page but not a video, it's just browsing that channel
    const channelName = document.querySelector("#channel-name #text")?.textContent?.trim();
    return channelName ? `YouTube (Browsing ${channelName})` : "YouTube (Browsing Channel)";
  }

  // 1. Try standard visible UI elements first
  const channelLink = document.querySelector("#upload-info #channel-name a, .ytp-ce-channel-title");
  if (channelLink && channelLink.textContent.trim()) {
    return channelLink.textContent.trim();
  }

  // 2. Look for the metadata link which is very reliable for video pages
  const metaName = document.querySelector('span[itemprop="author"] link[itemprop="name"], [itemprop="author"] [itemprop="name"]');
  if (metaName) {
    const val = metaName.getAttribute("content") || metaName.textContent;
    if (val && val.trim()) return val.trim();
  }

  // 3. Last resort: the author meta tag
  const authorMeta = document.querySelector('meta[itemprop="author"], link[itemprop="author"]');
  if (authorMeta) {
    const val = authorMeta.getAttribute("content") || authorMeta.textContent;
    if (val && val.trim()) return val.trim();
  }

  return "Unknown Channel";
};

const getTags = () => {
  const metaKeywords = document.querySelector('meta[name="keywords"]');
  if (metaKeywords && metaKeywords.content) {
    return metaKeywords.content.split(",").map(t => t.trim()).filter(t => t.length > 0);
  }
  return [];
};

// The Live Reporter
const sendUpdate = () => {
  const duration = getDurationSeconds() || 0;
  const video = document.querySelector("video");
  const currentTime = video ? Math.floor(video.currentTime) : 0;
  
  browser.runtime.sendMessage({
    type: "tabUpdate",
    data: {
      title: document.title,
      url: window.location.href,
      duration: duration,
      currentTime: currentTime,
      channel: getChannelName(),
      tags: getTags()
    }
  });
};

let heartbeatIntervalId = null;
let lastActivity = Date.now();
let afkTimeoutSeconds = 15;

const updateActivity = () => {
  lastActivity = Date.now();
};

// Listen for activity: mouse, keyboard, scroll, wheel
['mousedown', 'mousemove', 'keydown', 'scroll', 'wheel', 'touchstart'].forEach(evt => {
  window.addEventListener(evt, updateActivity, { passive: true });
});

const startHeartbeat = (intervalSeconds) => {
  if (heartbeatIntervalId) clearInterval(heartbeatIntervalId);
  
  const ms = (intervalSeconds || 1) * 1000;
  heartbeatIntervalId = setInterval(() => {
    const video = document.querySelector("video");
    const isVideoPage = window.location.pathname.startsWith('/watch') || window.location.pathname.startsWith('/shorts');
    const isPlaying = isVideoPage && video && !video.paused && !video.ended && video.readyState > 2;
    const currentTime = video ? Math.floor(video.currentTime) : 0;
    
    // Tab-level AFK check
    const isUserActive = (Date.now() - lastActivity) < (afkTimeoutSeconds * 1000);

    browser.runtime.sendMessage({
      type: "heartbeat",
      data: {
        isPlaying: isPlaying,
        isUserActive: isUserActive,
        currentTime: currentTime,
        title: document.title, // Keep title updated for background tracking
        url: window.location.href
      }
    }).catch(() => {
      // Background script might be reloaded or unavailable
    });
  }, ms);
};

// Initial start: fetch settings or default to 1s as requested
browser.storage.local.get("settings").then(res => {
  const interval = res.settings?.heartbeatInterval || 1;
  afkTimeoutSeconds = res.settings?.afkTimeout || 15;
  startHeartbeat(interval);
});

// 1. Send update when the page finishes loading
if (document.readyState === 'complete') {
  sendUpdate();
} else {
  window.addEventListener('load', sendUpdate);
}

// 2. Watch for title changes (for YouTube's same-page navigation)
let lastTitle = document.title;
const observer = new MutationObserver(() => {
  if (document.title !== lastTitle) {
    lastTitle = document.title;
    setTimeout(sendUpdate, 1500); // Small delay to let metadata load
  }
});

const titleTag = document.querySelector('title');
if (titleTag) {
  observer.observe(titleTag, { subtree: true, characterData: true, childList: true });
}

// 3. Keep the listener for the background's manual scan/initial scan
browser.runtime.onMessage.addListener((message) => {
  if (message?.type === "getDuration") {
    const video = document.querySelector("video");
    return Promise.resolve({ 
      durationSeconds: getDurationSeconds(),
      currentTime: video ? Math.floor(video.currentTime) : 0,
      channel: getChannelName(),
      title: document.title,
      tags: getTags()
    });
  }

  if (message?.type === "settingsUpdated") {
    afkTimeoutSeconds = message.settings?.afkTimeout || 15;
    startHeartbeat(message.settings?.heartbeatInterval);
  }
});