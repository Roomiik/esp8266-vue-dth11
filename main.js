const { createApp, ref, computed, onMounted, onBeforeUnmount } = Vue;

createApp({
  setup() {
    const latest = ref({ temperature: null, humidity: null, ts: null });
    const history = ref([]); // [{temperature, humidity, ts}]
    const pollMs = ref(5000);
    const status = ref('idle'); // 'idle' | 'ok' | 'warn' | 'err'
    let timer = null;
    let chart = null;

    const statusClass = computed(() => {
      if (status.value === 'ok') return 'ok';
      if (status.value === 'warn') return 'warn';
      if (status.value === 'err') return 'err';
      return 'warn';
    });

    const statusText = computed(() => {
      switch (status.value) {
        case 'ok': return 'Зв’язок у нормі';
        case 'warn': return 'Очікування даних';
        case 'err': return 'Немає зв’язку з сервером';
        default: return 'Ініціалізація';
      }
    });

    const lastUpdateText = computed(() => {
      if (!latest.value?.ts) return '---';
      const d = new Date(latest.value.ts);
      return d.toLocaleString();
    });

    function setIntervalMs(ms) {
      pollMs.value = ms;
      startPolling();
    }

    async function fetchLatest() {
      try {
        const res = await fetch('http://192.168.1.103:3000/api/latest', { cache: 'no-store' })
        if (!res.ok) throw new Error('Bad status');
        const data = await res.json();
        latest.value = data;
        status.value = data?.ts ? 'ok' : 'warn';
      } catch (e) {
        status.value = 'err';
        console.error('fetchLatest error', e);
      }
    }

    async function fetchHistory() {
      try {
        const res = await fetch('http://192.168.1.103:3000/api/history?limit=300', { cache: 'no-store' });
        if (!res.ok) throw new Error('Bad status');
        const data = await res.json();
        history.value = Array.isArray(data) ? data : [];
        upsertChart();
      } catch (e) {
        console.error('fetchHistory error', e);
      }
    }

    function startPolling() {
      if (timer) clearInterval(timer);
      // миттєве оновлення
      fetchLatest();
      fetchHistory();
      // періодичне оновлення
      timer = setInterval(async () => {
        await fetchLatest();
        await fetchHistory();
      }, pollMs.value);
    }

    function upsertChart() {
      const ctx = document.getElementById('chart');
      const labels = history.value.map(p => new Date(p.ts).toLocaleTimeString());
      const temps = history.value.map(p => p.temperature);
      const hums  = history.value.map(p => p.humidity);

      const dsTemp = {
        label: 'Температура (°C)',
        data: temps,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.15)',
        fill: true,
        tension: 0.25,
        yAxisID: 'y1'
      };
      const dsHum = {
        label: 'Вологість (%)',
        data: hums,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.15)',
        fill: true,
        tension: 0.25,
        yAxisID: 'y2'
      };

      if (!chart) {
        chart = new Chart(ctx, {
          type: 'line',
          data: { labels, datasets: [dsTemp, dsHum] },
          options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            stacked: false,
            plugins: {
              legend: { position: 'top' },
              tooltip: { enabled: true }
            },
            scales: {
              y1: {
                type: 'linear',
                position: 'left',
                title: { display: true, text: '°C' },
                suggestedMin: 0, suggestedMax: 50
              },
              y2: {
                type: 'linear',
                position: 'right',
                title: { display: true, text: '%' },
                suggestedMin: 0, suggestedMax: 100,
                grid: { drawOnChartArea: false }
              },
              x: { ticks: { maxRotation: 0 } }
            }
          }
        });
      } else {
        chart.data.labels = labels;
        chart.data.datasets[0].data = temps;
        chart.data.datasets[1].data = hums;
        chart.update('none');
      }
    }

    function manualRefresh() {
      fetchLatest();
      fetchHistory();
    }

    onMounted(() => {
      startPolling();
    });

    onBeforeUnmount(() => {
      if (timer) clearInterval(timer);
      if (chart) chart.destroy();
    });

    return {
      latest, history, pollMs,
      statusClass, statusText, lastUpdateText,
      manualRefresh, setIntervalMs
    };
  }
}).mount('#app');
