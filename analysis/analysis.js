/**
 * 매출비교분석 탭
 * - 거래처별 일별 매출 그래프 (월간)
 * - 요일별 품목 평균 수량
 */

function _getFactoryId() {
  return localStorage.getItem('currentFactoryId') || localStorage.getItem('adminAccessFactoryId');
}

window.loadAnalysisTab = async function () {
  const root = document.getElementById('analysisRoot');
  if (!root) return;

  const factoryId = _getFactoryId();
  if (!factoryId) {
    root.innerHTML = `<div style="color:#94A3B8; padding:40px; text-align:center;">로그인 후 이용 가능합니다.</div>`;
    return;
  }

  // 항상 새로 렌더링 (다른 공장 로그인 시 캐시 방지)
  root.innerHTML = '';
  window._invoiceAnalysisFactoryId = null;

  root.innerHTML = `<div style="color:#94A3B8; padding:40px; text-align:center;">데이터 로딩 중...</div>`;

  try {
    // 호텔 목록 조회
    const { data: hotels, error: hErr } = await window.mySupabase
      .from('hotels')
      .select('id, name')
      .eq('factory_id', factoryId)
      .order('name');

    if (hErr) throw new Error(hErr.message);

    if (!hotels || hotels.length === 0) {
      root.innerHTML = `<div style="color:#94A3B8; padding:40px; text-align:center;">등록된 거래처가 없습니다.</div>`;
      return;
    }

    const today = new Date();
    const defaultMonth = today.toISOString().slice(0, 7);

    const hotelOptions = hotels.map(h =>
      `<option value="${h.id}">${h.name}</option>`
    ).join('');

    // 거래처 체크박스 버튼 생성 (onclick 인라인)
    const hotelCheckboxes = hotels.map((h, i) =>
      `<div class="an-hotel-chip" data-id="${h.id}" data-name="${h.name.replace(/"/g,'&quot;')}" style="--chip-color:${PALETTE[i % PALETTE.length]}" onclick="this.classList.toggle('selected')">${h.name}</div>`
    ).join('');

    root.innerHTML = `
      <style>
        .analysis-section { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:20px 22px; margin-bottom:16px; box-shadow:0 1px 4px rgba(0,0,0,0.04); }
        .analysis-section-title { display:flex; align-items:center; gap:8px; margin-bottom:16px; }
        .analysis-section-title h4 { margin:0; font-size:14px; color:#1e293b; font-weight:700; }
        .analysis-section-title .an-badge { font-size:10px; font-weight:600; background:#f0f9ff; color:#0369a1; border:1px solid #bae6fd; border-radius:20px; padding:2px 9px; }

        /* 월 선택 + 조회 버튼 */
        .an-top-ctrl { display:flex; align-items:center; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
        .an-top-ctrl input[type=month] { padding:7px 11px; border:1px solid #e2e8f0; border-radius:8px; font-size:13px; color:#334155; background:#f8fafc; outline:none; }
        .an-top-ctrl input[type=month]:focus { border-color:#00a8e8; }
        .an-btn { padding:7px 18px; background:#00a8e8; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; transition:background 0.15s; }
        .an-btn:hover { background:#0096d0; }
        .an-btn-sm { padding:5px 12px; font-size:11px; background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; border-radius:6px; cursor:pointer; }
        .an-btn-sm:hover { background:#e2e8f0; }

        /* 거래처 칩 */
        .an-hotel-chips { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:14px; }
        .an-hotel-chip { cursor:pointer; display:inline-flex; align-items:center; padding:5px 12px; border-radius:20px; font-size:12px; font-weight:500; color:#64748b; background:#f1f5f9; border:1.5px solid #e2e8f0; transition:all 0.15s; user-select:none; }
        .an-hotel-chip.selected { color:#fff; border-color:var(--chip-color); background:var(--chip-color); }
        .an-hotel-chip:hover { border-color:var(--chip-color); color:var(--chip-color); }
        .an-hotel-chip.selected:hover { opacity:0.88; }

        /* 요약 카드 */
        .an-summary-row { display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
        .an-summary-card { flex:1; min-width:100px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:9px; padding:10px 14px; }
        .an-summary-label { font-size:10px; color:#94A3B8; margin-bottom:4px; font-weight:500; }
        .an-summary-value { font-size:15px; font-weight:700; color:#1e293b; }
        .an-summary-sub { font-size:10px; color:#94A3B8; margin-top:2px; }

        /* 캔버스 */
        .analysis-canvas-wrap { position:relative; width:100%; height:240px; }
        @media(max-width:768px){ .analysis-canvas-wrap { height:180px; } }

        /* 요일 섹션 */
        .analysis-ctrl { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:12px; }
        .analysis-ctrl select { padding:7px 10px; border:1px solid #e2e8f0; border-radius:8px; font-size:13px; color:#334155; outline:none; background:#f8fafc; }
        .analysis-ctrl select:focus { border-color:#00a8e8; }
        .dow-legend { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; }
        .dow-legend-item { display:flex; align-items:center; gap:5px; font-size:11px; color:#475569; }
        .dow-legend-dot { width:10px; height:10px; border-radius:3px; flex-shrink:0; }
        @media(max-width:768px){ .an-top-ctrl,.analysis-ctrl{ flex-direction:column; align-items:stretch; } .an-summary-card{ min-width:80px; } }
      </style>

      <!-- ① 일별 매출 그래프 -->
      <div class="analysis-section">
        <div class="analysis-section-title">
          <h4>📊 거래처별 일별 매출</h4>
          <span class="an-badge">월간</span>
          <span style="font-size:11px; color:#ef4444;">※ 거래처를 선택한 후 "조회" 버튼을 클릭하세요. 추가로 거래처를 선택하면 중복 비교가 가능합니다</span>
        </div>

        <!-- 월 선택 -->
        <div class="an-top-ctrl">
          <input type="month" id="an-month-daily" value="${defaultMonth}" />
          <button class="an-btn" onclick="window.renderDailyChart()">조회</button>
          <button class="an-btn-sm" onclick="window.selectAllHotels()">전체 선택</button>
          <button class="an-btn-sm" onclick="window.clearAllHotels()">전체 해제</button>
        </div>

        <!-- 거래처 칩 -->
        <div class="an-hotel-chips" id="an-hotel-chips">${hotelCheckboxes}</div>

        <!-- 요약 카드 -->
        <div class="an-summary-row" id="an-summary-row" style="display:none;">
          <div class="an-summary-card">
            <div class="an-summary-label">월 총 매출</div>
            <div class="an-summary-value" id="an-sum-total">-</div>
          </div>
          <div class="an-summary-card">
            <div class="an-summary-label">일 평균 매출</div>
            <div class="an-summary-value" id="an-sum-avg">-</div>
          </div>
          <div class="an-summary-card">
            <div class="an-summary-label">최고 매출일</div>
            <div class="an-summary-value" id="an-sum-max">-</div>
            <div class="an-summary-sub" id="an-sum-max-date"></div>
          </div>
          <div class="an-summary-card">
            <div class="an-summary-label">조회 거래처</div>
            <div class="an-summary-value" id="an-sum-count">-</div>
          </div>
        </div>

        <div class="analysis-canvas-wrap"><canvas id="canvasDailyRevenue"></canvas></div>
      </div>

      <!-- ② 요일별 품목 평균 수량 -->
      <div class="analysis-section">
        <div class="analysis-section-title">
          <h4>📅 요일별 품목 평균 수량</h4>
        </div>
        <div class="analysis-ctrl">
          <select id="an-hotel-dow">
            <option value="">거래처 선택</option>
            ${hotelOptions}
          </select>
          <select id="an-period-dow">
            <option value="3">최근 3개월</option>
            <option value="6">최근 6개월</option>
            <option value="12">최근 12개월</option>
          </select>
          <button class="an-btn" onclick="window.renderDowChart()">조회</button>
        </div>
        <div id="dowLegend" class="dow-legend"></div>
        <div class="analysis-canvas-wrap"><canvas id="canvasDowAvg"></canvas></div>
      </div>
    `;



    await window._loadChartJs();

  } catch (e) {
    console.error('Analysis tab error:', e);
    root.innerHTML = `<div style="color:#ef4444; padding:20px; font-size:13px;">오류 발생: ${e.message}</div>`;
  }
};

// Chart.js 동적 로드
window._loadChartJs = function () {
  if (window.Chart) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
};

const PALETTE = [
  '#00a8e8','#34D399','#F59E0B','#A78BFA','#FB7185',
  '#38BDF8','#4ADE80','#FBBF24','#C084FC','#F472B6',
];

const DOW_KR = ['일','월','화','수','목','금','토'];

// 한국 공휴일 (YYYY-MM-DD)
const KR_HOLIDAYS = new Set([
  // 2025
  '2025-01-01','2025-01-28','2025-01-29','2025-01-30',
  '2025-03-01','2025-05-05','2025-05-06','2025-06-06',
  '2025-08-15','2025-10-03','2025-10-06','2025-10-07','2025-10-08','2025-10-09',
  '2025-12-25',
  // 2026
  '2026-01-01','2026-02-17','2026-02-18','2026-02-19',
  '2026-03-01','2026-03-02','2026-05-05','2026-05-25',
  '2026-06-06','2026-08-15','2026-08-17',
  '2026-09-24','2026-09-25','2026-09-26',
  '2026-10-03','2026-10-09','2026-12-25',
]);

function _getDayType(dateStr) {
  // 0: 평일, 1: 토요일, 2: 일요일/공휴일
  if (KR_HOLIDAYS.has(dateStr)) return 2;
  const dow = new Date(dateStr).getDay();
  if (dow === 0) return 2;
  if (dow === 6) return 1;
  return 0;
}
function _dayColor(dateStr) {
  const t = _getDayType(dateStr);
  if (t === 2) return '#ef4444';
  if (t === 1) return '#3b82f6';
  return '#334155';
}

const _chartInstances = {};
function _drawChart(canvasId, config) {
  if (_chartInstances[canvasId]) {
    _chartInstances[canvasId].destroy();
    delete _chartInstances[canvasId];
  }
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  _chartInstances[canvasId] = new window.Chart(canvas, config);
}

// 전체 선택 / 해제
window.selectAllHotels = function () {
  document.querySelectorAll('.an-hotel-chip').forEach(c => c.classList.add('selected'));
};
window.clearAllHotels = function () {
  document.querySelectorAll('.an-hotel-chip').forEach(c => c.classList.remove('selected'));
};

// ① 일별 매출 차트
window.renderDailyChart = async function () {
  try {
  const month = document.getElementById('an-month-daily').value;
  if (!month) return alert('월을 선택해주세요.');

  const chips = document.querySelectorAll('.an-hotel-chip.selected');
  console.log('[analysis] selected chips:', chips.length);
  if (chips.length === 0) return alert('거래처를 선택해주세요.');

  const selectedIds   = Array.from(chips).map(c => c.dataset.id);
  const selectedNames = Array.from(chips).map(c => c.dataset.name);

  const factoryId = _getFactoryId();
  const [y, mo] = month.split('-').map(Number);
  const startDate = `${month}-01`;
  const lastDay   = new Date(y, mo, 0).getDate();
  const endDate   = `${month}-${String(lastDay).padStart(2, '0')}`;
  const allDays   = [];
  for (let d = 1; d <= lastDay; d++) allDays.push(`${month}-${String(d).padStart(2, '0')}`);

  console.log('[analysis] factoryId:', factoryId, 'selectedIds:', selectedIds, 'range:', startDate, '~', endDate);

  const { data: invoices, error: invErr } = await window.mySupabase
    .from('invoices')
    .select('hotel_id, date, total_amount')
    .eq('factory_id', factoryId)
    .in('hotel_id', selectedIds)
    .gte('date', startDate)
    .lte('date', endDate);

  console.log('[analysis] invoices:', invoices, 'error:', invErr);
  if (invErr) return alert('조회 오류: ' + invErr.message);
  if (!invoices) return;

  const allChips = document.querySelectorAll('.an-hotel-chip');

  const datasets = selectedIds.map((hId, i) => {
    const dayMap = {};
    invoices.filter(inv => inv.hotel_id === hId).forEach(inv => {
      dayMap[inv.date] = (dayMap[inv.date] || 0) + Number(inv.total_amount || 0);
    });
    const chipIdx = Array.from(allChips).findIndex(c => c.dataset.id === hId);
    const color = PALETTE[(chipIdx >= 0 ? chipIdx : i) % PALETTE.length];
    return {
      label: selectedNames[i],
      data: allDays.map(d => dayMap[d] || 0),
      borderColor: color,
      backgroundColor: color + '22',
      borderWidth: 2,
      pointRadius: 3,
      tension: 0.3,
      fill: false,
    };
  });

  // 요약 계산 (전체 합산 기준)
  const dayTotals = {};
  allDays.forEach(d => { dayTotals[d] = 0; });
  invoices.forEach(inv => { dayTotals[inv.date] = (dayTotals[inv.date] || 0) + Number(inv.total_amount || 0); });
  const totalSum  = Object.values(dayTotals).reduce((a, b) => a + b, 0);
  const activeDays = Object.values(dayTotals).filter(v => v > 0).length;
  const avgDay    = activeDays > 0 ? Math.round(totalSum / activeDays) : 0;
  const maxEntry  = Object.entries(dayTotals).sort((a,b) => b[1]-a[1])[0];

  // 요약 카드 업데이트
  document.getElementById('an-summary-row').style.display = 'flex';
  document.getElementById('an-sum-total').textContent  = totalSum >= 10000 ? (totalSum/10000).toFixed(1)+'만원' : totalSum.toLocaleString()+'원';
  document.getElementById('an-sum-avg').textContent    = avgDay  >= 10000 ? (avgDay/10000).toFixed(1)+'만원'   : avgDay.toLocaleString()+'원';
  document.getElementById('an-sum-max').textContent    = maxEntry && maxEntry[1] > 0 ? (maxEntry[1] >= 10000 ? (maxEntry[1]/10000).toFixed(1)+'만원' : maxEntry[1].toLocaleString()+'원') : '-';
  document.getElementById('an-sum-max-date').textContent = maxEntry && maxEntry[1] > 0 ? maxEntry[0].slice(5) : '';
  document.getElementById('an-sum-count').textContent  = selectedIds.length + '개';

  console.log('[analysis] datasets:', datasets.length, 'days:', allDays.length);

  const isMobile = window.innerWidth < 768;
  const xLabels = allDays.map(d => d.slice(8)); // "01"~"31"
  const dowLabels = allDays.map(d => DOW_KR[new Date(d).getDay()]);

  // 날짜+요일 커스텀 렌더 플러그인
  const xDowPlugin = {
    id: 'xDowLabels',
    afterDraw(chart) {
      const { ctx, scales: { x, y } } = chart;
      const ticks = x.ticks;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const fontSize = isMobile ? 8 : 9;
      ctx.font = `${fontSize}px sans-serif`;
      ticks.forEach((tick, i) => {
        const idx = tick.value;
        const dateStr = allDays[idx];
        if (!dateStr) return;
        const show = isMobile
          ? (parseInt(xLabels[idx])===1 || parseInt(xLabels[idx])===11 || parseInt(xLabels[idx])===21 || idx===allDays.length-1)
          : true;
        if (!show) return;
        const xPos = x.getPixelForTick(i);
        const yPos = y.bottom + (isMobile ? 20 : 22);
        ctx.fillStyle = _dayColor(dateStr);
        ctx.fillText(dowLabels[idx], xPos, yPos);
      });
      ctx.restore();
    }
  };

  _drawChart('canvasDailyRevenue', {
    type: 'line',
    data: { labels: xLabels, datasets },
    plugins: [xDowPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { bottom: isMobile ? 14 : 16 } },
      plugins: {
        legend: { position: 'top', labels: { font: { size: isMobile ? 10 : 11 }, boxWidth: 12, padding: 10 } },
        tooltip: {
          callbacks: {
            title: ctx => {
              const idx = ctx[0].dataIndex;
              return `${allDays[idx]} (${dowLabels[idx]})`;
            },
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}원`
          }
        }
      },
      scales: {
        x: {
          ticks: {
            font: { size: isMobile ? 9 : 10 },
            color: (ctx) => {
              const idx = ctx.index;
              return allDays[idx] ? _dayColor(allDays[idx]) : '#334155';
            },
            maxRotation: 0,
            autoSkip: false,
            callback: (val, idx) => {
              const day = parseInt(xLabels[idx]);
              if (isMobile) {
                return (day===1||day===11||day===21||idx===allDays.length-1) ? xLabels[idx] : '';
              }
              return xLabels[idx];
            }
          },
          grid: { display: false }
        },
        y: {
          ticks: {
            font: { size: isMobile ? 9 : 10 },
            callback: v => v >= 10000 ? (v/10000).toFixed(0)+'만' : v.toLocaleString(),
            maxTicksLimit: 5
          },
          beginAtZero: true
        }
      }
    }
  });
  } catch(e) { console.error('[analysis] renderDailyChart error:', e); alert('차트 오류: ' + e.message); }
};

// ② 요일별 품목 평균 차트
window.renderDowChart = async function () {
  const hId    = document.getElementById('an-hotel-dow').value;
  const months = parseInt(document.getElementById('an-period-dow').value);
  if (!hId) return alert('거래처를 선택해주세요.');

  const factoryId = _getFactoryId();
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth() - months, 1).toISOString().slice(0, 10);

  const { data: invoices } = await window.mySupabase
    .from('invoices')
    .select('id, date, invoice_items(name, qty)')
    .eq('factory_id', factoryId)
    .eq('hotel_id', hId)
    .gte('date', startDate)
    .order('date');

  if (!invoices || invoices.length === 0) {
    document.getElementById('dowLegend').innerHTML = `<span style="color:#94A3B8; font-size:12px;">해당 기간 데이터가 없습니다.</span>`;
    return;
  }

  const DOW = ['일','월','화','수','목','금','토'];
  const itemDow = {};
  invoices.forEach(inv => {
    const dow = new Date(inv.date).getDay();
    (inv.invoice_items || []).forEach(item => {
      if (!item.name) return;
      if (!itemDow[item.name]) itemDow[item.name] = Array.from({length:7}, () => ({sum:0, count:0}));
      itemDow[item.name][dow].sum   += Number(item.qty || 0);
      itemDow[item.name][dow].count += 1;
    });
  });

  const itemNames = Object.keys(itemDow);
  const dowOrder  = [1,2,3,4,5,6,0]; // 월~일
  const dowLabels = dowOrder.map(d => DOW[d]);

  const datasets = itemNames.map((name, i) => ({
    label: name,
    data: dowOrder.map(d => {
      const { sum, count } = itemDow[name][d];
      return count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
    }),
    backgroundColor: PALETTE[i % PALETTE.length] + 'CC',
    borderColor:     PALETTE[i % PALETTE.length],
    borderWidth: 1,
    borderRadius: 4,
  }));

  document.getElementById('dowLegend').innerHTML = itemNames.map((name, i) =>
    `<div class="dow-legend-item">
      <div class="dow-legend-dot" style="background:${PALETTE[i % PALETTE.length]};"></div>
      <span>${name}</span>
    </div>`
  ).join('');

  _drawChart('canvasDowAvg', {
    type: 'bar',
    data: { labels: dowLabels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: 평균 ${ctx.parsed.y}개` } }
      },
      scales: {
        x: { ticks: { font: { size: 12 }, color: '#334155' } },
        y: {
          ticks: { font: { size: 10 } },
          title: { display: true, text: '평균 수량 (개)', font: { size: 10 }, color: '#94A3B8' }
        }
      }
    }
  });
};
