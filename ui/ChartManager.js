// ui/ChartManager.js
/**
 * Chart Manager: Encapsulates Chart.js logic for the trends view.
 */
window.YTA.Popup.ChartManager = {
  instance: null,
  currentRange: 7,
  lastRange: null,

  /**
   * Updates or creates the trend chart
   */
  update: function(histogramData) {
    const chartEl = document.getElementById('historyChart');
    if (!chartEl || !histogramData) return;
    const ctx = chartEl.getContext('2d');
    
    const sortedDates = Object.keys(histogramData).sort().reverse();
    const filteredLabels = sortedDates.slice(0, this.currentRange).reverse();
    
    const labels = filteredLabels.map(l => l.split('-').slice(1).join('/'));
    const watchData = filteredLabels.map(l => (histogramData[l]?.watchTime || 0) / 60);
    const sessionData = filteredLabels.map(l => (histogramData[l]?.sessionTime || 0) / 60);

    // If the range changed, destroy the old chart to trigger a full growth animation
    if (this.instance && this.lastRange !== this.currentRange) {
      this.instance.destroy();
      this.instance = null;
    }
    this.lastRange = this.currentRange;

    if (this.instance) {
      this.instance.data.labels = labels;
      this.instance.data.datasets[0].data = watchData;
      this.instance.data.datasets[1].data = sessionData;
      this.instance.update();
      return;
    }

    this.instance = new Chart(ctx, {
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
                const pad = (n) => String(n).padStart(2, '0');
                return ` ${ctx.dataset.label}: ${h}h ${pad(m)}m`;
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
  }
};
