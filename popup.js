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
      listEl.innerHTML = totals.leaderboard.map((item, index) => {
        const isChannel = item.label.startsWith("Channel:");
        const cleanName = item.label.replace(/^(Channel|Tag): /, "");
        const color = isChannel ? "#e74c3c" : "#3498db";
        const typeLabel = isChannel ? "CHANNEL" : "TAG";

        return `
          <li class="entry">
            <span class="rank">${index + 1}.</span>
            <span class="badge" style="background: ${color}">${typeLabel}</span>
            <div style="flex-grow: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-right: 10px;">
              <strong>${cleanName}</strong>
            </div>
            <span style="color: #666; font-size: 12px;">${formatDuration(item.duration)}</span>
          </li>`;
      }).join('');
    }
  }
};

browser.storage.onChanged.addListener(() => browser.storage.local.get().then(render));
document.getElementById("refresh").addEventListener("click", () => browser.runtime.sendMessage({ type: "forceRefresh" }));
browser.storage.local.get().then(render);