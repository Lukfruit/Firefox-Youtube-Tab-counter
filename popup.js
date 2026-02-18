const formatDuration = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
};

const render = (data) => {
  const statusEl = document.getElementById("status");
  const listEl = document.getElementById("master-leaderboard");
  const totals = data.youtubeTotals;

  statusEl.textContent = data.isScanning 
    ? `Scanning: ${data.currentScanned || 0} / ${data.totalToScan || '?'} tabs`
    : "Idle (Updated)";

  if (totals) {
    document.getElementById("total-duration").textContent = formatDuration(totals.totalSeconds || 0);
    document.getElementById("tab-count").textContent = totals.totalTabs || 0;
    document.getElementById("known-count").textContent = totals.knownCount || 0;
    document.getElementById("unknown-count").textContent = totals.unknownCount || 0;
    document.getElementById("channel-count").textContent = totals.uniqueChannels || 0;
    document.getElementById("tag-count-meta").textContent = totals.uniqueTags || 0;
    
    if (totals.leaderboard) {
      // 1. Safely clear the list before re-rendering
      while (listEl.firstChild) {
        listEl.removeChild(listEl.firstChild);
      }

      // 2. Build each list item using safe DOM methods
      totals.leaderboard.forEach((item, index) => {
        const isChannel = item.label.startsWith("Channel:");
        const cleanName = item.label.replace(/^(Channel|Tag): /, "");
        const color = isChannel ? "#e74c3c" : "#3498db";
        const typeLabel = isChannel ? "CHANNEL" : "TAG";

        const li = document.createElement("li");
        li.className = "entry";

        const rank = document.createElement("span");
        rank.className = "rank";
        rank.textContent = `${index + 1}.`;
        li.appendChild(rank);

        const badge = document.createElement("span");
        badge.className = "badge";
        badge.style.backgroundColor = color;
        badge.textContent = typeLabel;
        li.appendChild(badge);

        const infoWrapper = document.createElement("div");
        infoWrapper.style.flexGrow = "1";
        infoWrapper.style.whiteSpace = "nowrap";
        infoWrapper.style.overflow = "hidden";
        infoWrapper.style.textOverflow = "ellipsis";
        infoWrapper.style.marginRight = "10px";

        const name = document.createElement("strong");
        name.textContent = cleanName; // Safe text insertion
        infoWrapper.appendChild(name);

        const count = document.createElement("span");
        count.style.color = "#aaa";
        count.style.fontSize = "10px";
        count.textContent = ` (${item.count}x)`;
        infoWrapper.appendChild(count);

        li.appendChild(infoWrapper);

        const duration = document.createElement("span");
        duration.style.color = "#666";
        duration.style.fontSize = "12px";
        duration.textContent = formatDuration(item.duration);
        li.appendChild(duration);

        listEl.appendChild(li);
      });
    }
  }
};

browser.storage.onChanged.addListener(() => browser.storage.local.get().then(render));
document.getElementById("refresh").addEventListener("click", () => browser.runtime.sendMessage({ type: "forceRefresh" }));
browser.storage.local.get().then(render);