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
  const duration = getDurationSeconds();
  const video = document.querySelector("video");
  const currentTime = video ? Math.floor(video.currentTime) : 0;
  
  if (duration) {
    browser.runtime.sendMessage({
      type: "tabUpdate",
      data: {
        title: document.title,
        duration: duration,
        currentTime: currentTime,
        channel: getChannelName(),
        tags: getTags()
      }
    });
  }
};

// Heartbeat system: Sends status every 5s to track active time
setInterval(() => {
  const video = document.querySelector("video");
  const isPlaying = video && !video.paused && !video.ended && video.readyState > 2;
  const currentTime = video ? Math.floor(video.currentTime) : 0;
  
  browser.runtime.sendMessage({
    type: "heartbeat",
    data: {
      isPlaying: isPlaying,
      currentTime: currentTime,
      title: document.title, // Keep title updated for background tracking
      url: window.location.href
    }
  }).catch(() => {
    // Background script might be reloaded or unavailable
  });
}, 5000);

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
});