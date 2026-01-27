const ISO_DURATION_REGEX = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;

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

const getDurationSeconds = () => {
  const metaDuration = document.querySelector('meta[itemprop="duration"]');
  const parsedMetaDuration = parseIsoDuration(metaDuration?.content);

  if (Number.isFinite(parsedMetaDuration) && parsedMetaDuration > 0) {
    return parsedMetaDuration;
  }

  const videoElement = document.querySelector("video");
  if (videoElement && Number.isFinite(videoElement.duration)) {
    return Math.floor(videoElement.duration);
  }

  return null;
};

browser.runtime.onMessage.addListener((message) => {
  if (message?.type !== "getDuration") {
    return undefined;
  }

  const durationSeconds = getDurationSeconds();
  return Promise.resolve({ durationSeconds });
});
