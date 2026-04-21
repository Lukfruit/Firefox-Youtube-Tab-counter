let chartInstance = null;
let currentRange = 7;
let expandedItems = new Set();
let lastData = null;

const renderLeaderboard = (listEl, items) => {
  while (listEl.firstChild) {
    listEl.removeChild(listEl.firstChild);
  }

  if (!items) return;

  items.forEach((item, index) => {
    const isChannel = item.label.startsWith("Channel:");
    const cleanName = item.label.replace(/^(Channel|Tag): /, "");
    const color = isChannel ? "#f87171" : "#60a5fa";
    const typeLabel = isChannel ? "CHANNEL" : "TAG";
    const hasTabs = item.tabs && item.tabs.length > 0;
    const isExpanded = expandedItems.has(item.label);

    const li = document.createElement("li");
    li.className = "entry-container";

    const entryHeader = document.createElement("div");
    entryHeader.className = "entry clickable";
    if (hasTabs) {
      entryHeader.addEventListener("click", () => {
        if (expandedItems.has(item.label)) {
          expandedItems.delete(item.label);
        } else {
          expandedItems.add(item.label);
        }
        render(lastData);
      });
    }

    const arrow = document.createElement("span");
    arrow.className = `toggle-arrow ${isExpanded ? 'expanded' : ''}`;
    arrow.innerHTML = hasTabs ? "&#9654;" : "";
    entryHeader.appendChild(arrow);

    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = `${index + 1}.`;
    entryHeader.appendChild(rank);

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.style.backgroundColor = color;
    badge.textContent = typeLabel;
    entryHeader.appendChild(badge);

    const infoWrapper = document.createElement("div");
    infoWrapper.style.flexGrow = "1";
    infoWrapper.style.whiteSpace = "nowrap";
    infoWrapper.style.overflow = "hidden";
    infoWrapper.style.textOverflow = "ellipsis";
    infoWrapper.style.marginRight = "10px";

    const name = document.createElement("strong");
    name.textContent = cleanName;
    infoWrapper.appendChild(name);

    const count = document.createElement("span");
    count.style.color = "#6b7280";
    count.style.fontSize = "10px";
    count.textContent = ` (${item.count}x)`;
    infoWrapper.appendChild(count);

    entryHeader.appendChild(infoWrapper);

    const duration = document.createElement("span");
    duration.style.color = "#9ca3af";
    duration.style.fontSize = "12px";
    
    // In History view, item.watchTime is our primary metric
    const timeToShow = item.watchTime > 0 ? item.watchTime : item.duration;
    duration.textContent = formatDuration(timeToShow);
    entryHeader.appendChild(duration);

    li.appendChild(entryHeader);

    if (hasTabs && isExpanded) {
      const childrenUl = document.createElement("ul");
      childrenUl.className = "entry-children";
      
      item.tabs.forEach(tab => {
        const childLi = document.createElement("li");
        childLi.className = "child-tab";
        
        let titleText = tab.title;
        if (tab.isLive) {
          const liveSpan = document.createElement("span");
          liveSpan.style.color = "#10b981";
          liveSpan.style.fontSize = "9px";
          liveSpan.style.fontWeight = "bold";
          liveSpan.style.marginRight = "5px";
          liveSpan.textContent = "[LIVE]";
          childLi.appendChild(liveSpan);
        }
        
        const titleSpan = document.createElement("span");
        titleSpan.textContent = titleText;
        childLi.appendChild(titleSpan);

        childLi.title = "Click to switch to this tab";
        childLi.addEventListener("click", (e) => {
          e.stopPropagation();
          browser.tabs.update(tab.tabId, { active: true }).then(t => {
            if (t && t.windowId) {
              browser.windows.update(t.windowId, { focused: true });
            }
          });
        });
        childrenUl.appendChild(childLi);
      });
      li.appendChild(childrenUl);
    }

    listEl.appendChild(li);
  });
};

const updateChart = (histogramData) => {
  const chartEl = document.getElementById('historyChart');
  if (!chartEl) return;
  const ctx = chartEl.getContext('2d');
  
  const sortedDates = Object.keys(histogramData).sort().reverse();
  const filteredLabels = sortedDates.slice(0, currentRange).reverse();
  
  const labels = filteredLabels.map(l => l.split('-').slice(1).join('/'));
  const watchData = filteredLabels.map(l => (histogramData[l]?.watchTime || 0) / 60);
  const sessionData = filteredLabels.map(l => (histogramData[l]?.sessionTime || 0) / 60);

  // Always destroy the old chart to prevent width morphing and "artifact" bars
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Watch Time (min)',
          data: watchData,
          backgroundColor: '#f87171',
          borderRadius: 2,
          order: 1
        },
        {
          label: 'Total Time (min)',
          data: sessionData,
          backgroundColor: '#4b5563',
          borderRadius: 2,
          order: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 800,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw;
              const h = Math.floor(val / 60);
              const m = Math.round(val % 60);
              return ` ${ctx.dataset.label}: ${h}h ${m}m`;
            }
          }
        }
      },
      scales: {
        x: { 
          stacked: true,
          grid: { display: false },
          ticks: { font: { size: 9 }, color: '#6b7280' }
        },
        y: { 
          stacked: false,
          grid: { color: '#374151' },
          ticks: { font: { size: 9 }, color: '#6b7280' }
        }
      }
    }
  });
};

const render = (data) => {
  if (!data) return;
  lastData = data;
  
  // Update scanning status regardless of whether we have totals yet
  const statusEl = document.getElementById("status");
  if (statusEl) {
    statusEl.textContent = data.isScanning 
      ? `Scanning: ${data.currentScanned || 0} / ${data.totalToScan || '?'} tabs`
      : "Idle (Updated)";
  }

  // Live View
  const liveTotals = data.youtubeTotals;
  if (liveTotals) {
    document.getElementById("total-duration").textContent = formatDuration(liveTotals.totalSeconds || 0);
    document.getElementById("tab-count").textContent = liveTotals.totalTabs || 0;
    document.getElementById("channel-count").textContent = liveTotals.uniqueChannels || 0;
    document.getElementById("known-count").textContent = liveTotals.knownCount || 0;
    document.getElementById("tag-count-meta").textContent = liveTotals.uniqueTags || 0;
    document.getElementById("unknown-count").textContent = liveTotals.unknownCount || 0;
    renderLeaderboard(document.getElementById("live-leaderboard"), liveTotals.leaderboard);
  }

  // History View
  const historyTotals = data.historyTotals;
  if (historyTotals) {
    document.getElementById("history-watch").textContent = formatDuration(historyTotals.totalWatch || 0);
    document.getElementById("history-session").textContent = formatDuration(historyTotals.totalSession || 0);
    renderLeaderboard(document.getElementById("history-leaderboard"), historyTotals.leaderboard);
  }

  const trendsVisible = document.getElementById("view-trends").style.display === "flex";
  // Only update on heartbeat if trends are visible AND chart doesn't exist yet
  // We avoid re-creating the chart every 5 seconds while looking at it
  if (data.histogramData && trendsVisible && !chartInstance) {
    updateChart(data.histogramData);
  }

  if (data.storageSizeKB) {
    document.getElementById("storage-size").textContent = data.storageSizeKB;
  }

  if (data.settings && data.settings.minWatchTime !== undefined) {
    document.getElementById("min-watch-time").value = data.settings.minWatchTime;
  }
};

// TAB SWITCHING
const showView = (viewId) => {
  const views = ["view-live", "view-trends", "view-settings"];
  const tabs = ["tab-live", "tab-trends", "tab-settings"];
  
  views.forEach(v => document.getElementById(v).style.display = v === viewId ? "flex" : "none");
  tabs.forEach(t => document.getElementById(t).classList.toggle("active", t === viewId.replace("view-", "tab-")));
  
  if (viewId === "view-trends") {
    browser.storage.local.get("histogramData").then(data => {
      if (data.histogramData) updateChart(data.histogramData);
    });
  }
};

document.getElementById("tab-live").addEventListener("click", () => showView("view-live"));
document.getElementById("tab-trends").addEventListener("click", () => showView("view-trends"));
document.getElementById("tab-settings").addEventListener("click", () => showView("view-settings"));

// SETTINGS
document.getElementById("save-settings").addEventListener("click", () => {
  const minWatchTime = parseInt(document.getElementById("min-watch-time").value, 10) || 0;
  browser.runtime.sendMessage({ 
    type: "updateSettings", 
    settings: { minWatchTime } 
  }).then(() => {
    const btn = document.getElementById("save-settings");
    const originalText = btn.textContent;
    btn.textContent = "Saved!";
    btn.style.background = "#059669";
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = "";
    }, 2000);
  });
});

// Load version
const manifest = browser.runtime.getManifest();
if (document.getElementById("ext-version")) {
  document.getElementById("ext-version").textContent = manifest.version;
}

// RANGE SWITCHING
const onRangeChange = (range) => {
  if (currentRange === range) return;
  currentRange = range;
  
  document.getElementById("range-7").classList.toggle("active", range === 7);
  document.getElementById("range-30").classList.toggle("active", range === 30);
  
  browser.storage.local.get("histogramData").then(data => {
    if (data.histogramData) {
      updateChart(data.histogramData);
    }
  });
};

document.getElementById("range-7").addEventListener("click", () => onRangeChange(7));
document.getElementById("range-30").addEventListener("click", () => onRangeChange(30));

// CLEAR HISTORY
document.getElementById("clear-history").addEventListener("click", (e) => {
  e.preventDefault();
  if (confirm("Clear all historical data?")) {
    browser.storage.local.set({ historyLog: [] }).then(() => {
      browser.runtime.sendMessage({ type: "forceRefresh" });
    });
  }
});

browser.storage.onChanged.addListener(() => browser.storage.local.get().then(render));
document.getElementById("refresh").addEventListener("click", () => browser.runtime.sendMessage({ type: "forceRefresh" }));
browser.storage.local.get().then(render);