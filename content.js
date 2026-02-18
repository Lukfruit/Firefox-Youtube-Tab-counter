// content.js

// Keep your exact Regex and Parsing logic
const ISO_DURATION_REGEX = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;

const parseIsoDuration = (duration) => {
  if (!duration) return null;
  const match = duration.match(ISO_DURATION_REGEX);
  if (!match) return null;
  const hours = parseInt(match[1] ?? "0", 10);
  const minutes = parseInt(match[2] ?? "0", 10);
  const seconds = parseInt(match[3] ?? "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
};

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
  const channelLink = document.querySelector("#upload-info #channel-name a, .ytp-ce-channel-title, [itemprop='author']");
  return channelLink ? channelLink.textContent.trim() : "Unknown Channel";
};

// The Live Reporter
const sendUpdate = () => {
  const duration = getDurationSeconds();
  if (duration) {
    browser.runtime.sendMessage({
      type: "tabUpdate",
      data: {
        title: document.title,
        duration: duration,
        channel: getChannelName()
      }
    });
  }
};

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
    const duration = getDurationSeconds();
    return Promise.resolve({ 
      durationSeconds: duration,
      channel: getChannelName(),
      title: document.title
    });
  }
});