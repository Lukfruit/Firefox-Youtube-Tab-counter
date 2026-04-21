let chartInstance = null;
let currentRange = 7;

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
    name.textContent = cleanName;
    infoWrapper.appendChild(name);

    const count = document.createElement("span");
    count.style.color = "#6b7280";
    count.style.fontSize = "10px";
    count.textContent = ` (${item.count}x)`;
    infoWrapper.appendChild(count);

    li.appendChild(infoWrapper);

    const duration = document.createElement("span");
    duration.style.color = "#9ca3af";
    duration.style.fontSize = "12px";
    // For live, show duration. For history, show watchTime.
    const timeToShow = item.watchTime > 0 ? item.watchTime : item.duration;
    duration.textContent = formatDuration(timeToShow);
    li.appendChild(duration);

    listEl.appendChild(li);
  });
};

const updateChart = (histogramData, animationConfig = {}) => {
  const chartEl = document.getElementById('historyChart');
  if (!chartEl) return;
  const ctx = chartEl.getContext('2d');
  
  const sortedDates = Object.keys(histogramData).sort().reverse();
  const filteredLabels = sortedDates.slice(0, currentRange).reverse();
  
  const labels = filteredLabels.map(l => l.split('-').slice(1).join('/'));
  const watchData = filteredLabels.map(l => (histogramData[l]?.watchTime || 0) / 60);
  const sessionData = filteredLabels.map(l => (histogramData[l]?.sessionTime || 0) / 60);

  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = watchData;
    chartInstance.data.datasets[1].data = sessionData;
    chartInstance.update(animationConfig);
  } else {
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
            order: 1 // Draw on top
          },
          {
            label: 'Total Time (min)',
            data: sessionData,
            backgroundColor: '#4b5563',
            borderRadius: 2,
            order: 2 // Draw behind
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
        animations: {
          x: { duration: 0 }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw;
                const h = Math.floor(val / 60);
                const m = Math.round(val % 60);
                return `${ctx.dataset.label}: ${h}h ${m}m`;
              }
            }
          }
        },
        scales: {
          x: { 
            stacked: true, // Overlap bars by sharing the same stack
            grid: { display: false },
            ticks: { font: { size: 9 }, color: '#6b7280' }
          },
          y: { 
            stacked: false, // Don't add heights
            grid: { color: '#374151' },
            ticks: { font: { size: 9 }, color: '#6b7280' }
          }
        }
      }
    });
  }
};

const render = (data) => {
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
  if (data.histogramData && trendsVisible) {
    updateChart(data.histogramData, { duration: 0 });
  }

  if (data.storageSizeKB) {
    document.getElementById("storage-size").textContent = data.storageSizeKB;
  }
};

// TAB SWITCHING
document.getElementById("tab-live").addEventListener("click", () => {
  document.getElementById("tab-live").classList.add("active");
  document.getElementById("tab-trends").classList.remove("active");
  document.getElementById("view-live").style.display = "flex";
  document.getElementById("view-trends").style.display = "none";
});

document.getElementById("tab-trends").addEventListener("click", () => {
  if (document.getElementById("tab-trends").classList.contains("active")) return;

  document.getElementById("tab-trends").classList.add("active");
  document.getElementById("tab-live").classList.remove("active");
  document.getElementById("view-trends").style.display = "flex";
  document.getElementById("view-live").style.display = "none";
  
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  browser.storage.local.get("histogramData").then(data => {
    if (data.histogramData) updateChart(data.histogramData);
  });
});

// RANGE SWITCHING
const onRangeChange = (range) => {
  if (currentRange === range) return;
  
  // 1. Make current bars disappear instantly
  if (chartInstance) {
    chartInstance.data.datasets.forEach(ds => {
      ds.data = ds.data.map(() => 0);
    });
    chartInstance.update({ duration: 0 });
  }

  // 2. Short delay to ensure the "empty" state is cleared, then unfold
  setTimeout(() => {
    currentRange = range;
    document.getElementById("range-7").classList.toggle("active", range === 7);
    document.getElementById("range-30").classList.toggle("active", range === 30);
    
    browser.storage.local.get("histogramData").then(data => {
      if (data.histogramData) {
        updateChart(data.histogramData, {
          duration: 600,
          easing: 'easeOutQuart'
        });
      }
    });
  }, 50);
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