/* =============================================================
 * features/factory-expenses.js  — 공장매입(지출) 기능
 * -------------------------------------------------------------
 * Task 3: 스캐폴드 + 메뉴 주입 (뼈대만, 실제 지출 UI는 다음 태스크)
 *
 * 규칙:
 *  - app_v38.js 절대 수정 금지. 모든 것은 window.* 오버라이드 +
 *    DOM 주입으로만.
 *  - "설정 및 관리" 툴바의 "기본단가"(#tour-step-1)와
 *    "시작 가이드"(#tour-restart) 사이에 "공장매입" 버튼 주입.
 *  - 클릭 시 자리표시 모달(제목 "공장매입"만) 표시.
 *    형제 "기본단가"와 동일하게 modal-overlay 패턴 사용.
 *  - 이모지 금지. 아이콘은 기존 라인 아이콘(<use href="#i-...">) 재활용.
 * ============================================================= */
(function () {
  'use strict';

  var MODAL_ID = 'factoryExpensesModal';
  var BTN_ID = 'btnFactoryExpenses';

  // ---- 스코프드 스타일 (공용 클래스와 충돌 없게 #factoryExpensesModal 하위) ----
  function injectStyles() {
    if (document.getElementById('fe-styles')) return;
    var css = [
      '#factoryExpensesModal .modal-content{background:#fff;}',
      '#factoryExpensesModal .fe-header{display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid #e2e8f0;}',
      '#factoryExpensesModal .fe-title{font-weight:800;font-size:16px;color:#0f172a;}',
      '#factoryExpensesModal .fe-monthnav{display:flex;align-items:center;gap:8px;margin-left:auto;}',
      '#factoryExpensesModal .fe-navbtn{border:1px solid #cbd5e1;background:#fff;border-radius:6px;width:28px;height:28px;cursor:pointer;font-size:11px;line-height:1;color:#334155;}',
      '#factoryExpensesModal .fe-navbtn:hover{background:#f1f5f9;}',
      '#factoryExpensesModal .fe-ym-label{font-weight:700;font-size:14px;min-width:96px;text-align:center;color:#0f172a;}',
      '#factoryExpensesModal .fe-close{border:none;background:none;font-size:18px;cursor:pointer;color:#64748b;line-height:1;padding:0 2px;}',
      '#factoryExpensesModal .fe-tabs{display:flex;gap:4px;padding:12px 20px 0;border-bottom:1px solid #e2e8f0;}',
      '#factoryExpensesModal .fe-tab{border:none;background:transparent;color:#64748b;font-weight:600;font-size:13px;padding:8px 14px;border-radius:8px 8px 0 0;cursor:pointer;}',
      '#factoryExpensesModal .fe-tab:hover{color:#334155;}',
      '#factoryExpensesModal .fe-tab-active{background:#e6f0f9;color:#005b9f;}',
      '#factoryExpensesModal .fe-body{padding:16px 20px 20px;}',
      '#factoryExpensesModal .fe-intro{font-size:12px;color:#64748b;margin-bottom:10px;}',
      '#factoryExpensesModal .fe-addbox{background:#f0f7ff;border:1px solid #dbeafe;border-radius:8px;padding:12px;margin-bottom:12px;}',
      '#factoryExpensesModal .fe-addrow{display:flex;gap:8px;align-items:center;}',
      '#factoryExpensesModal .fe-guide{font-size:12px;color:#64748b;margin-bottom:6px;}',
      '#factoryExpensesModal .fe-input{padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;box-sizing:border-box;background:#fff;}',
      '#factoryExpensesModal .fe-grow{flex:1;}',
      '#factoryExpensesModal .fe-btn-accent{background:#005b9f;color:#fff;border:none;border-radius:6px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;}',
      '#factoryExpensesModal .fe-btn-accent:hover{background:#00487d;}',
      '#factoryExpensesModal .fe-btn-quiet{background:#fff;color:#475569;border:1px solid #cbd5e1;border-radius:6px;font-size:15px;line-height:1;cursor:pointer;height:30px;}',
      '#factoryExpensesModal .fe-btn-quiet:hover{background:#f1f5f9;}',
      '#factoryExpensesModal .fe-total{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:12px;font-size:13px;color:#64748b;}',
      '#factoryExpensesModal .fe-total-left{white-space:nowrap;}',
      '#factoryExpensesModal .fe-total-right{text-align:right;}',
      '#factoryExpensesModal .fe-total b{font-size:15px;color:#0f172a;font-weight:800;}',
      '#factoryExpensesModal .fe-pct-accent{color:#005b9f;font-weight:700;white-space:nowrap;}',
      '#factoryExpensesModal .fe-pct-danger{color:var(--text-danger, var(--danger, #dc2626));font-weight:700;white-space:nowrap;font-size:12px;}',
      '#factoryExpensesModal .fe-carry-banner{background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px 12px;margin-bottom:12px;}',
      '#factoryExpensesModal .fe-carry-btn{border:1px solid var(--text-danger, var(--danger, #dc2626));background:#fff;color:var(--text-danger, var(--danger, #dc2626));font-weight:700;font-size:13px;padding:7px 12px;border-radius:6px;cursor:pointer;}',
      '#factoryExpensesModal .fe-carry-btn:hover{background:#fef2f2;}',
      '#factoryExpensesModal .fe-carry-note{font-size:12px;color:#9a3412;margin-top:6px;}',
      '#factoryExpensesModal .fe-import-row{margin-bottom:12px;}',
      '#factoryExpensesModal .fe-muted{opacity:0.5;}',
      '#factoryExpensesModal .fe-unapplied{color:var(--text-danger, var(--danger, #dc2626));font-weight:700;font-size:12px;margin-left:4px;}',
      '#factoryExpensesModal .fe-empty{color:#64748b;padding:10px 2px;font-size:13px;}',
      '#factoryExpensesModal .fe-groupbox{border:1px solid #e2e8f0;border-radius:8px;margin-bottom:10px;overflow:hidden;}',
      '#factoryExpensesModal .fe-grp-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 12px;background:#f8fafc;border-bottom:2px solid #e2e8f0;font-weight:700;font-size:13px;color:#0f172a;}',
      '#factoryExpensesModal .fe-grp-left{display:flex;align-items:center;gap:10px;min-width:0;}',
      '#factoryExpensesModal .fe-grp-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#factoryExpensesModal .fe-additem-link{border:none;background:none;color:#005b9f;font-size:12px;font-weight:600;cursor:pointer;padding:0;white-space:nowrap;}',
      '#factoryExpensesModal .fe-additem-link:hover{text-decoration:underline;}',
      '#factoryExpensesModal .fe-grp-sub{color:#475569;font-weight:700;white-space:nowrap;}',
      '#factoryExpensesModal .fe-grp-empty{padding:8px 12px;font-size:12px;color:#94a3b8;}',
      '#factoryExpensesModal .fe-item-row{display:grid;grid-template-columns:1fr 110px 1fr 30px;gap:6px;align-items:center;padding:5px 10px;border-top:1px solid #eef2f7;}',
      '#factoryExpensesModal .fe-cell-input{width:100%;box-sizing:border-box;border:1px solid transparent;border-radius:5px;padding:4px 6px;font-size:13px;background:transparent;color:#0f172a;}',
      '#factoryExpensesModal .fe-cell-input:hover,#factoryExpensesModal .fe-cell-input:focus{border-color:#cbd5e1;background:#fff;outline:none;}',
      '#factoryExpensesModal .fe-amount{text-align:right;}',
      '#factoryExpensesModal .fe-item-name{font-size:13px;color:#0f172a;}',
      '#factoryExpensesModal .fe-item-note{font-size:12px;color:#94a3b8;}',
      '#factoryExpensesModal .fe-del{border:none;background:none;color:#94a3b8;font-size:16px;cursor:pointer;line-height:1;}',
      '#factoryExpensesModal .fe-del:hover{color:#ef4444;}',
      '#factoryExpensesModal .fe-additem{grid-template-columns:1fr 110px 1fr auto;gap:6px;align-items:center;padding:8px 10px;background:#fafcff;border-top:1px solid #eef2f7;}',
      '#factoryExpensesModal .fe-profit-wrap{padding:4px 0 10px;}',
      '#factoryExpensesModal .fe-profit-label{font-size:13px;color:#64748b;}',
      '#factoryExpensesModal .fe-profit-value{font-size:28px;font-weight:800;margin-top:2px;}',
      '#factoryExpensesModal .fe-margin-badge{display:inline-block;font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px;background:#eef2f7;color:#475569;margin-left:10px;vertical-align:middle;}',
      '#factoryExpensesModal .fe-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:6px;}',
      '#factoryExpensesModal .fe-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;}',
      '#factoryExpensesModal .fe-card-label{font-size:13px;color:#64748b;}',
      '#factoryExpensesModal .fe-card-value{font-size:18px;font-weight:700;color:#0f172a;margin-top:4px;}'
    ].join('');
    var st = document.createElement('style');
    st.id = 'fe-styles';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ---- 모달 셸 생성 (1회). 헤더/탭/패널은 feBuildScaffold가 채움 --------
  function ensureModal() {
    if (document.getElementById(MODAL_ID)) return;
    injectStyles();

    var overlay = document.createElement('div');
    overlay.id = MODAL_ID;
    overlay.className = 'modal-overlay';
    overlay.style.cssText =
      'display:none; align-items:center; justify-content:center; z-index:1001;';

    overlay.innerHTML =
      '<div class="modal-content" style="width:640px; max-width:96vw; max-height:90vh; overflow:auto; padding:0; border-radius:12px; position:relative;">' +
        '<div id="factoryExpensesRoot"></div>' +
      '</div>';

    document.body.appendChild(overlay);

    // 닫기: 오버레이 바깥 클릭 (헤더 X는 feBuildScaffold에서 바인딩)
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeFactoryExpenses();
    });
  }

  // ---- 뷰 열기/닫기 -----------------------------------------
  function openFactoryExpenses() {
    ensureModal();
    var el = document.getElementById(MODAL_ID);
    if (el) el.style.display = 'flex';
  }

  function closeFactoryExpenses() {
    var el = document.getElementById(MODAL_ID);
    if (el) el.style.display = 'none';
  }

  // ---- 메뉴 버튼 주입 (렌더 함수가 없으므로 DOM 주입) --------
  function injectMenuButton() {
    if (document.getElementById(BTN_ID)) return true; // 중복 주입 방지

    var anchor = document.getElementById('tour-step-1');   // "기본단가" 버튼
    if (!anchor || !anchor.parentNode) return false;       // 아직 DOM 준비 안 됨

    var btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.className = 'btn btn-neutral';
    btn.style.cssText = 'flex:1; min-width:110px; font-size:13px;';
    btn.innerHTML =
      '<svg class="icon" aria-hidden="true"><use href="#i-building-2"/></svg> 공장매입';
    // [fix] 항상 최신 window.openFactoryExpenses(전체 초기화 래퍼)를 호출.
    // 이 IIFE의 로컬 openFactoryExpenses(모달 표시만)를 직접 바인딩하면
    // 스캐폴드/데이터 로드를 안 타서 첫 클릭에 빈 모달이 뜬다.
    btn.addEventListener('click', function () { window.openFactoryExpenses(); });

    // "기본단가"(#tour-step-1) 바로 뒤 = "시작 가이드"(#tour-restart) 앞
    anchor.parentNode.insertBefore(btn, anchor.nextSibling);
    return true;
  }

  // ---- 부트스트랩: DOM 준비 시점 보정 -----------------------
  function boot() {
    if (injectMenuButton()) return;
    // 아직 앵커가 없으면 몇 차례 재시도 (로그인 전/뷰 전환 등)
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (injectMenuButton() || tries >= 20) clearInterval(timer);
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // ---- 전역 노출 (app_v38.js는 건드리지 않음) ---------------
  window.openFactoryExpenses = openFactoryExpenses;
  window.closeFactoryExpenses = closeFactoryExpenses;
})();


/* =============================================================
 * Task 4: 매출 유틸 + 차감 명세서 정정 오버라이드
 * -------------------------------------------------------------
 * 배경(코드 확인 결과):
 *  - window.updateTrendChartOnly는 app_v38.js에 3번 정의됨
 *    (1175 / 4165 / 7043) → 파일 뒤쪽인 7043이 최종.
 *    다시 consignment-hotel.js가 7043을 _orig로 감싸 증감율
 *    (#adminGrowthRate)을 덧붙임. 즉 실제 활성 함수는
 *    consignment 래퍼(→7043)이며, 태스크가 지목한 4165가 아님.
 *  - 7043은 월별 병렬쿼리로 1000행 캡을 이미 우회하고,
 *    hotels!inner(contract_type='unit')로 단가제 매출만 합산,
 *    정액제는 hotels.fixed_amount를 생성월 이후 가산함.
 *  - 버그: 7043의 invoices select에 staff_name이 없어
 *    '관리자(차감)' 제외 분기(7083)가 절대 발동하지 않음
 *    → 차감 명세서가 매출에 그대로 더해짐. (4165도 동일 버그)
 *
 * 이 블록:
 *  - computeMonthlyRevenue(): 정정된 월별 매출 유틸(차감 제외 +
 *    1000행 페이지네이션). 영업이익 계산에서 재사용 가능하게 노출.
 *  - updateTrendChartOnly 오버라이드: 기존 체인(_orig)의 부수효과
 *    (consignment 증감율 등)는 보존하되, 최종 차트는 정정 유틸로
 *    다시 그려 차감만 빠지게 함.
 * ============================================================= */
(function () {
  'use strict';

  var DEDUCT_PREFIX = '관리자(차감)';
  var PAGE = 1000;
  var INV_SEL = 'date, total_amount, hotel_id, staff_name, hotels!inner(contract_type)';

  function ymKey(y, mo) { return y + '-' + String(mo).padStart(2, '0'); }
  function lastDay(y, mo) { return new Date(y, mo, 0).getDate(); } // mo=1..12

  // fromYm..toYm(포함) 월 키 배열
  function monthRange(fromYm, toYm) {
    var f = fromYm.split('-').map(Number);
    var t = toYm.split('-').map(Number);
    var cy = f[0], cm = f[1], out = [];
    while (cy < t[0] || (cy === t[0] && cm <= t[1])) {
      out.push(ymKey(cy, cm));
      cm += 1; if (cm > 12) { cm = 1; cy += 1; }
    }
    return out;
  }

  // 한 달치 단가제 invoices 전량 조회 (1000행 캡 우회: .range 페이지네이션)
  async function fetchUnitInvoicesForMonth(factoryId, mStart, mEnd, hotelFilter) {
    var from = 0, all = [];
    for (;;) {
      var q = window.mySupabase.from('invoices').select(INV_SEL)
        .eq('factory_id', factoryId)
        .eq('hotels.contract_type', 'unit')
        .gte('date', mStart).lte('date', mEnd);
      if (hotelFilter && hotelFilter !== 'all') q = q.eq('hotel_id', hotelFilter);
      var res = await q.range(from, from + PAGE - 1);
      if (res.error) { console.warn('[factory-expenses] invoice page error', res.error); break; }
      var data = res.data || [];
      all.push.apply(all, data);
      if (data.length < PAGE) break; // 마지막 페이지
      from += PAGE;
    }
    return all;
  }

  /**
   * 정정 월별 매출 유틸.
   * @param {Object} opts
   *   factoryId  : 공장 범위 (필수)
   *   fromYm     : 'YYYY-MM' 시작월 (포함)
   *   toYm       : 'YYYY-MM' 종료월 (포함)
   *   hotelFilter: 'all' | hotelId (기본 'all')
   * @returns {Promise<{trend:Object, hotelData:Array}>}
   *   trend = { 'YYYY-MM': 매출 }.  원본 로직과 동일하되 차감 제외.
   */
  async function computeMonthlyRevenue(opts) {
    var factoryId = opts.factoryId;
    var fromYm = opts.fromYm;
    var toYm = opts.toYm;
    var hotelFilter = opts.hotelFilter || 'all';

    var keys = monthRange(fromYm, toYm);
    var trend = {};
    keys.forEach(function (k) { trend[k] = 0; });

    var todayStr = getTodayString();
    var curMonthKey = todayStr.substring(0, 7);

    // 1) 단가제 매출 — 월별 병렬 + 페이지네이션
    var monthRows = await Promise.all(keys.map(function (mKey) {
      var parts = mKey.split('-').map(Number);
      var mStart = mKey + '-01';
      var mEnd = (mKey === curMonthKey)
        ? todayStr
        : mKey + '-' + String(lastDay(parts[0], parts[1])).padStart(2, '0');
      return fetchUnitInvoicesForMonth(factoryId, mStart, mEnd, hotelFilter);
    }));

    monthRows.forEach(function (rows) {
      rows.forEach(function (inv) {
        // [정정] 차감 명세서는 매출에서 제외 (원본은 staff_name 미조회로 미발동)
        if (inv.staff_name && inv.staff_name.indexOf(DEDUCT_PREFIX) === 0) return;
        var mKey = inv.date.substring(0, 7);
        if (trend[mKey] !== undefined) trend[mKey] += Number(inv.total_amount || 0);
      });
    });

    // 2) 정액제 매출 — fixed_amount를 생성월 이후 가산 (원본과 동일)
    var hotelQuery = window.mySupabase.from('hotels')
      .select('id, name, contract_type, fixed_amount, created_at')
      .eq('factory_id', factoryId);
    if (hotelFilter !== 'all') hotelQuery = hotelQuery.eq('id', hotelFilter);
    var hotelRes = await hotelQuery;
    var hotelData = hotelRes.data || [];

    hotelData.forEach(function (h) {
      var createdMonth = h.created_at ? h.created_at.substring(0, 7) : '2000-01';
      if (h.contract_type === 'fixed') {
        for (var mk in trend) { if (mk >= createdMonth) trend[mk] += Number(h.fixed_amount || 0); }
      }
      if (hotelFilter !== 'all' && h.id === hotelFilter) {
        for (var mk2 in trend) { if (mk2 < createdMonth) trend[mk2] = 0; }
      }
    });

    return { trend: trend, hotelData: hotelData };
  }

  // ---- 공통: 차감 제외 매출 합계 (1000행 페이지네이션) ----------
  // 증감율 동기간 비교용. consignment 원본과 동일 스코프(.in(hotel_id))에
  // staff_name을 추가 조회해 '관리자(차감)' 행만 제외.
  async function sumInvoicesExcludingDeduction(hotelIds, start, end) {
    var from = 0, total = 0;
    for (;;) {
      var res = await window.mySupabase.from('invoices')
        .select('total_amount, staff_name')
        .in('hotel_id', hotelIds)
        .gte('date', start).lte('date', end)
        .range(from, from + PAGE - 1);
      if (res.error) { console.warn('[factory-expenses] growth page error', res.error); break; }
      var data = res.data || [];
      data.forEach(function (r) {
        if (r.staff_name && r.staff_name.indexOf(DEDUCT_PREFIX) === 0) return; // 차감 제외
        total += Number(r.total_amount || 0);
      });
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return total;
  }

  // ---- 증감율(#adminGrowthRate) 갱신 — consignment:1044 로직 복제 + 차감 제외 ----
  // 동기간 대비: 이번달 1일~오늘 vs 전월 1일~전월 동일자. 항상 '오늘' 기준
  // (차트 선택월/거래처 필터와 독립, 전체 거래처). 원본과 동일하되 차감만 제외.
  async function updateGrowthRateCorrected() {
    var el = document.getElementById('adminGrowthRate');
    if (!el || !currentFactoryId) return;
    try {
      var today = new Date();
      var ty = today.getFullYear(), tm = today.getMonth() + 1, td = today.getDate();
      var todayStr = ty + '-' + String(tm).padStart(2, '0') + '-' + String(td).padStart(2, '0');
      var curMonthStr = ty + '-' + String(tm).padStart(2, '0');

      var prevY = tm === 1 ? ty - 1 : ty;
      var prevM = tm === 1 ? 12 : tm - 1;
      var prevMonthStr = prevY + '-' + String(prevM).padStart(2, '0');
      var prevLastDay = new Date(ty, tm - 1, 0).getDate();
      var prevEnd = prevMonthStr + '-' + String(Math.min(td, prevLastDay)).padStart(2, '0');

      var hres = await window.mySupabase.from('hotels').select('id').eq('factory_id', currentFactoryId);
      var hotelIds = (hres.data || []).map(function (h) { return h.id; });
      if (hotelIds.length === 0) return;

      var pair = await Promise.all([
        sumInvoicesExcludingDeduction(hotelIds, curMonthStr + '-01', todayStr),
        sumInvoicesExcludingDeduction(hotelIds, prevMonthStr + '-01', prevEnd)
      ]);
      var curTotal = pair[0], prevTotal = pair[1];

      var g = 0;
      if (prevTotal > 0) g = ((curTotal - prevTotal) / prevTotal) * 100;
      else if (curTotal > 0) g = 100;

      var absG = Math.abs(g);
      if (absG < 0.05) {
        el.innerHTML = '<span style="color:var(--secondary);">0.0%</span>';
      } else if (g > 0) {
        el.innerHTML = '<span style="color:var(--success);">&#9650; ' + absG.toFixed(1) + '%</span>';
      } else {
        el.innerHTML = '<span style="color:var(--danger);">&#9660; ' + absG.toFixed(1) + '%</span>';
      }
    } catch (e) {
      console.warn('[factory-expenses] 증감율 정정 계산 오류', e);
    }
  }

  // ---- updateTrendChartOnly 오버라이드 — 단일 렌더 -------------
  // _orig 실행 + no-op 덮어쓰기 방식 제거. 정정 trend를 1회만 산출해
  //   (1) 차트 렌더  (2) 증감율 정정 갱신 을 수행.
  // 이 재정의가 consignment 래퍼를 대체하므로 그 안의 증감율(1050~)은
  // 여기서 정정본으로 복제됨. 호출부 4091/577은 이 함수를 부르고,
  // consignment 래퍼(1050 호출 포함)는 참조가 끊겨 더 이상 실행되지 않음.
  window.updateTrendChartOnly = async function () {
    var curMonth = (document.getElementById('adminStatsMonth') && document.getElementById('adminStatsMonth').value)
      || getTodayString().substring(0, 7);
    var ym = curMonth.split('-').map(Number);
    var toYm = ymKey(ym[0], ym[1]);
    var fromDate = new Date(ym[0], ym[1] - 1 - 5, 1); // 최근 6개월 창(원본과 동일)
    var fromYm = ymKey(fromDate.getFullYear(), fromDate.getMonth() + 1);
    var hotelFilter = (document.getElementById('adminTrendHotelFilter') && document.getElementById('adminTrendHotelFilter').value) || 'all';

    // (1) 정정 매출 1회 산출 → 차트 렌더 (범위·정액제·per-hotel 분기 보존)
    var out = await computeMonthlyRevenue({
      factoryId: currentFactoryId, fromYm: fromYm, toYm: toYm, hotelFilter: hotelFilter
    });
    var hotelName = (hotelFilter === 'all')
      ? '전체'
      : (out.hotelData.length ? out.hotelData[0].name : '선택 거래처');
    window.updateRevenueTrendChart(out.trend, hotelName);

    // (2) 증감율 — 정정 매출 기준 동기간 비교로 갱신
    await updateGrowthRateCorrected();
  };

  // ---- 검증 헬퍼 (브라우저 콘솔에서 실행) ------------------------
  // Claude 환경은 Supabase 네트워크 차단 → 실제 숫자는 사용자가 실행.
  // 원본(차감 포함) vs 정정(차감 제외)을 한 달치 단가제 매출로 비교.
  window.factoryExpensesVerify = async function (ym) {
    ym = ym
      || (document.getElementById('adminStatsMonth') && document.getElementById('adminStatsMonth').value)
      || getTodayString().substring(0, 7);
    var parts = ym.split('-').map(Number);
    var mStart = ym + '-01';
    var todayStr = getTodayString();
    var mEnd = (ym === todayStr.substring(0, 7))
      ? todayStr
      : ym + '-' + String(lastDay(parts[0], parts[1])).padStart(2, '0');

    var rows = await fetchUnitInvoicesForMonth(currentFactoryId, mStart, mEnd, 'all');
    var before = 0, after = 0, excluded = 0, exCount = 0;
    rows.forEach(function (r) {
      var amt = Number(r.total_amount || 0);
      before += amt;
      if (r.staff_name && r.staff_name.indexOf(DEDUCT_PREFIX) === 0) { excluded += amt; exCount += 1; }
      else after += amt;
    });
    var result = {
      대상월: ym,
      원본_차감포함: before,
      정정_차감제외: after,
      차감합계: excluded,
      차감건수: exCount,
      단가제행수: rows.length
    };
    console.table(result);
    return result;
  };

  // ---- 전역 노출 (영업이익 계산 재사용용) -----------------------
  window.computeMonthlyRevenue = computeMonthlyRevenue;
})();


/* =============================================================
 * Task 5+6: 지출 관리 UI (고정지출 + 추가지출) — 공장매입 모달 내부
 * -------------------------------------------------------------
 * 데이터: factory_expenses, window.mySupabase 직접. 그룹 = group_name 라벨.
 *   - 고정지출(kind='fixed'): 유효 세트(year_month <= 선택월 중 가장 최근
 *     연월) 표시. 이전 달 것이면 [이 달부터 수정]으로 선택월에 복사 후 편집
 *     (carry-forward). 과거 달 행은 절대 수정/삭제 안 함.
 *   - 추가지출(kind='extra'): carry-forward 없음. 선택월 행만 직접 편집.
 *   - 월 선택은 두 섹션 공유(상단 #fe-ym). 월 전환 시 둘 다 재조회.
 * 과거 달 편집 경고(태스크5 보강): 선택월이 과거일 때 '첫 편집 액션' 1회 confirm,
 *   확인하면 세션 동안 그 달 상단 지속 배너만 표시(필드마다 반복 안 함).
 *   이번달·미래월은 경고 없음. 고정/추가 공유(월 단위 acknowledge).
 * 손익 상세(태스크7)는 여기서 만들지 않음(#fe-section-pnl 자리만).
 * 톤: 기본단가/고정지출(태스크5) 패턴 — admin-table·인라인 편집·저장 후 재조회.
 * ============================================================= */
(function () {
  'use strict';

  var state = {
    ym: null,
    tab: 'fixed',
    fixed: { draftGroups: [], renderGroups: [] },
    extra: { draftGroups: [], renderGroups: [] }
  };
  var ackPastEdit = {}; // { 'YYYY-MM': true } — 세션 동안 과거달 편집 확인 여부(월 공유)

  function curYm() { return getTodayString().substring(0, 7); }
  function selYm() { var el = document.getElementById('fe-ym'); return (el && el.value) || curYm(); }
  function isPast(ym) { return ym < curYm(); } // 'YYYY-MM' 사전식 비교
  function fmtWon(n) { return Number(n || 0).toLocaleString() + '원'; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // 매출 대비 비율. 매출 0/미상이면 '—'.
  function fePct(part, revenue) {
    if (!revenue || revenue <= 0) return '—';
    return (part / revenue * 100).toFixed(1) + '%';
  }
  // 그 달 매출(정정 유틸) — ym별 캐시(지출 편집으론 안 바뀜, open마다 초기화).
  var revCache = {};
  async function feMonthRevenue(ym) {
    if (revCache[ym] != null) return revCache[ym];
    var rev = 0;
    if (typeof window.computeMonthlyRevenue === 'function') {
      var out = await window.computeMonthlyRevenue({
        factoryId: currentFactoryId, fromYm: ym, toYm: ym, hotelFilter: 'all'
      });
      rev = Number((out && out.trend && out.trend[ym]) || 0);
    }
    revCache[ym] = rev;
    return rev;
  }
  // 'YYYY-MM'에 delta개월 더한 'YYYY-MM'
  function feYmAdd(ym, delta) {
    var p = ym.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1 + delta, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  // ym 라벨: refYm과 연도 같으면 'M월', 다르면 'YYYY년 M월'
  function feMonLabel(ym, refYm) {
    var p = ym.split('-');
    return (p[0] === refYm.split('-')[0]) ? (Number(p[1]) + '월') : (p[0] + '년 ' + Number(p[1]) + '월');
  }
  // 편집/월전환 후 재조회: 해당 섹션 + 손익 재계산(지출 변화 즉시 반영)
  function reload(kind) {
    return Promise.all([kind === 'fixed' ? feLoadFixed() : feLoadExtra(), feLoadPnl(), feLoadPnlChart()]);
  }

  // ---- 과거 달 편집 경고 게이트 --------------------------------
  // 진행 가능하면 true. 과거달 첫 편집 시 1회 confirm, 확인하면 세션 기억 + 배너.
  function guardPastEdit(ym) {
    if (!ym || !isPast(ym)) return true;   // 이번달/미래 → 경고 없음
    if (ackPastEdit[ym]) return true;      // 이미 확인함 → 반복 안 함
    var mm = Number(ym.split('-')[1]);
    if (!confirm(mm + '월을 수정하면 그 달 영업이익이 바뀝니다. 계속하시겠습니까?')) return false;
    ackPastEdit[ym] = true;
    updatePastBanner();
    return true;
  }

  function updatePastBanner() {
    var el = document.getElementById('fe-pastedit-banner');
    if (!el) return;
    var ym = selYm();
    if (ym && isPast(ym) && ackPastEdit[ym]) {
      var mm = Number(ym.split('-')[1]);
      el.innerHTML =
        '<div style="background:#fef3c7; border:1px solid #fcd34d; color:#92400e; padding:8px 12px; border-radius:8px; font-size:13px; margin-bottom:12px;">' +
          '지난 달 수정 중 — 이 달(' + mm + '월) 영업이익이 바뀝니다.' +
        '</div>';
    } else {
      el.innerHTML = '';
    }
  }

  // ---- 월 라벨/이동 -------------------------------------------
  function feYmLabel(ym) { var p = ym.split('-'); return p[0] + '년 ' + Number(p[1]) + '월'; }
  function feSyncYmLabel() {
    var l = document.getElementById('fe-ym-label');
    if (l) l.textContent = feYmLabel(selYm());
  }
  function feShiftYm(delta) {
    var p = selYm().split('-').map(Number);
    var d = new Date(p[0], p[1] - 1 + delta, 1);
    var ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    var el = document.getElementById('fe-ym');
    if (el) el.value = ym;
    feSyncYmLabel();
    state.fixed.draftGroups = [];
    state.extra.draftGroups = [];
    updatePastBanner();
    feLoadFixed();
    feLoadExtra();
    feLoadPnl();
    feLoadPnlChart();
  }

  // ---- 탭 전환 (한 번에 한 탭만) ------------------------------
  function feSwitchTab(name) {
    if (['fixed', 'extra', 'pnl'].indexOf(name) === -1) name = 'fixed';
    state.tab = name;
    ['fixed', 'extra', 'pnl'].forEach(function (t) {
      var panel = document.getElementById('fe-tab-' + t);
      var btn = document.getElementById('fe-tabbtn-' + t);
      if (panel) panel.style.display = (t === name) ? 'block' : 'none';
      if (btn) btn.className = 'fe-tab' + (t === name ? ' fe-tab-active' : '');
    });
  }

  // ---- 스캐폴드 (헤더 + 탭 세그먼트 + 패널 3개) ------------------
  function feBuildScaffold() {
    var root = document.getElementById('factoryExpensesRoot');
    if (!root) return;
    if (document.getElementById('fe-ym')) return; // 이미 생성됨

    root.innerHTML =
      // 헤더: 제목 + 월이동(◀ 라벨 ▶) + 닫기
      '<div class="fe-header">' +
        '<span class="fe-title">공장매입</span>' +
        '<div class="fe-monthnav">' +
          '<button type="button" class="fe-navbtn" id="fe-ym-prev" aria-label="이전 달">&#9664;</button>' +
          '<span class="fe-ym-label" id="fe-ym-label"></span>' +
          '<button type="button" class="fe-navbtn" id="fe-ym-next" aria-label="다음 달">&#9654;</button>' +
        '</div>' +
        '<button type="button" class="fe-close" id="fe-close" aria-label="닫기">X</button>' +
        '<input type="hidden" id="fe-ym">' +
      '</div>' +
      // 탭 세그먼트
      '<div class="fe-tabs">' +
        '<button type="button" class="fe-tab" id="fe-tabbtn-fixed">고정지출</button>' +
        '<button type="button" class="fe-tab" id="fe-tabbtn-extra">추가지출</button>' +
        '<button type="button" class="fe-tab" id="fe-tabbtn-pnl">손익</button>' +
      '</div>' +
      '<div class="fe-body">' +
        '<div id="fe-pastedit-banner"></div>' +
        '<div id="fe-tab-fixed" class="fe-panel"><div id="fe-fixed-body"></div></div>' +
        '<div id="fe-tab-extra" class="fe-panel" style="display:none;"><div id="fe-extra-body"></div></div>' +
        '<div id="fe-tab-pnl" class="fe-panel" style="display:none;">' +
          '<div id="fe-pnl-body"></div>' +
          '<canvas id="fe-pnl-chart" style="max-height:260px; width:100%; margin-top:14px;"></canvas>' +
          '<div id="fe-pnl-chart-msg" style="color:#b91c1c; font-size:13px; margin-top:6px;"></div>' +
        '</div>' +
      '</div>';

    var ymEl = document.getElementById('fe-ym');
    ymEl.value = curYm();
    feSyncYmLabel();

    document.getElementById('fe-ym-prev').addEventListener('click', function () { feShiftYm(-1); });
    document.getElementById('fe-ym-next').addEventListener('click', function () { feShiftYm(1); });
    document.getElementById('fe-close').addEventListener('click', function () {
      if (typeof window.closeFactoryExpenses === 'function') window.closeFactoryExpenses();
    });
    document.getElementById('fe-tabbtn-fixed').addEventListener('click', function () { feSwitchTab('fixed'); });
    document.getElementById('fe-tabbtn-extra').addEventListener('click', function () { feSwitchTab('extra'); });
    document.getElementById('fe-tabbtn-pnl').addEventListener('click', function () { feSwitchTab('pnl'); });

    var fb = document.getElementById('fe-fixed-body');
    fb.addEventListener('click', function (e) { feOnClick(e, 'fixed'); });
    fb.addEventListener('change', function (e) { feOnChange(e, 'fixed'); });
    var xb = document.getElementById('fe-extra-body');
    xb.addEventListener('click', function (e) { feOnClick(e, 'extra'); });
    xb.addEventListener('change', function (e) { feOnChange(e, 'extra'); });

    feSwitchTab(state.tab || 'fixed');
  }

  // ---- 고정지출 조회(유효 세트 + carry-forward) ------------------
  async function feLoadFixed() {
    var body = document.getElementById('fe-fixed-body');
    if (!body) return;
    var ym = selYm();
    state.ym = ym;
    body.innerHTML = '<div style="text-align:center; color:#64748b; padding:10px; font-size:13px;">불러오는 중...</div>';

    var res = await window.mySupabase.from('factory_expenses')
      .select('id, year_month, group_name, name, amount, note, sort_order, created_at')
      .eq('factory_id', currentFactoryId).eq('kind', 'fixed')
      .lte('year_month', ym)
      .order('year_month', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (res.error) {
      body.innerHTML = '<div style="color:#b91c1c; padding:10px; font-size:13px;">조회 오류: ' + esc(res.error.message) + '</div>';
      return;
    }

    var rows = res.data || [];
    var effectiveYm = null;
    rows.forEach(function (r) { if (effectiveYm === null || r.year_month > effectiveYm) effectiveYm = r.year_month; });
    var setRows = rows.filter(function (r) { return r.year_month === effectiveYm; });
    var editable = (effectiveYm === null) || (effectiveYm === ym);

    // 상속(미적용) 상태: 선택월에 고정 행이 없고 이전 달 세트를 미리보기 중
    var inherited = !!(effectiveYm && effectiveYm !== ym);

    var bannerHtml = '';
    if (inherited) {
      var srcLabel = feMonLabel(effectiveYm, ym);
      var dstLabel = feMonLabel(ym, effectiveYm);
      bannerHtml =
        '<div class="fe-carry-banner">' +
          '<button type="button" class="fe-carry-btn" data-fe-act="carry">' + srcLabel + ' 데이터를 ' + dstLabel + '에 적용하기</button>' +
          '<div class="fe-carry-note">적용 전까지 손익·그래프에 반영되지 않습니다.</div>' +
        '</div>';
    }

    var revenue = await feMonthRevenue(ym);
    renderSection('fixed', body, setRows, editable, {
      totalLabel: '고정지출 합계',
      bannerHtml: bannerHtml,
      revenue: revenue,
      unapplied: inherited,
      guide: '1. 먼저 그룹을 만드세요',
      emptyMsg: '등록된 고정지출이 없습니다. 위에서 그룹을 추가해 시작하세요.'
    });
  }

  // ---- 추가지출 조회(선택월 행만, carry-forward 없음) ------------
  async function feLoadExtra() {
    var body = document.getElementById('fe-extra-body');
    if (!body) return;
    var ym = selYm();
    state.ym = ym;
    body.innerHTML = '<div style="text-align:center; color:#64748b; padding:10px; font-size:13px;">불러오는 중...</div>';

    var res = await window.mySupabase.from('factory_expenses')
      .select('id, group_name, name, amount, note, sort_order, created_at')
      .eq('factory_id', currentFactoryId).eq('kind', 'extra').eq('year_month', ym)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (res.error) {
      body.innerHTML = '<div style="color:#b91c1c; padding:10px; font-size:13px;">조회 오류: ' + esc(res.error.message) + '</div>';
      return;
    }

    var extraRows = res.data || [];

    // "가져오기" 버튼: 이 달 추가지출이 없고 전월에 추가지출이 있을 때만 노출
    var importHtml = '';
    if (extraRows.length === 0) {
      var prevYm = feYmAdd(ym, -1);
      var prevChk = await window.mySupabase.from('factory_expenses')
        .select('id').eq('factory_id', currentFactoryId).eq('kind', 'extra').eq('year_month', prevYm).limit(1);
      if (!prevChk.error && prevChk.data && prevChk.data.length) {
        var sLabel = feMonLabel(prevYm, ym);
        var dLabel = feMonLabel(ym, prevYm);
        importHtml =
          '<div class="fe-import-row">' +
            '<button type="button" class="fe-carry-btn" data-fe-act="import-extra">' + sLabel + ' 데이터를 ' + dLabel + '에 적용하기</button>' +
          '</div>';
      }
    }

    var revenueX = await feMonthRevenue(ym);
    renderSection('extra', body, extraRows, true, {
      totalLabel: '추가지출 합계',
      bannerHtml: '',
      revenue: revenueX,
      importHtml: importHtml,
      guide: '이 달에만 들어가는 일회성 지출입니다.',
      emptyMsg: '등록된 추가지출이 없습니다. 위에서 그룹을 추가해 시작하세요.'
    });
  }

  // ---- 월별 손익 (매출: 정정 유틸 재사용 / 지출: RPC) ------------
  async function feLoadPnl() {
    var body = document.getElementById('fe-pnl-body');
    if (!body) return;
    var ym = selYm();
    body.innerHTML = '<div style="text-align:center; color:#64748b; padding:10px; font-size:13px;">계산 중...</div>';
    try {
      // 매출 — 정정 매출 유틸(차감 제외·정액제 가산). ym 캐시 재사용.
      var rev = await feMonthRevenue(ym);

      // 지출 — RPC factory_expense_month (테이블 반환 → 배열)
      var rpc = await window.mySupabase.rpc('factory_expense_month', {
        p_factory_id: currentFactoryId, p_year_month: ym
      });
      if (rpc.error) {
        body.innerHTML = '<div style="color:#b91c1c; padding:10px; font-size:13px;">계산 오류: ' + esc(rpc.error.message) + '</div>';
        return;
      }
      var row = (rpc.data && rpc.data[0]) || {};
      var fixedT = Number(row.fixed_total || 0);
      var extraT = Number(row.extra_total || 0);
      var totalExp = (row.total == null) ? (fixedT + extraT) : Number(row.total);

      var profit = rev - totalExp;
      var margin = rev > 0 ? (profit / rev * 100).toFixed(1) + '%' : '—';

      body.innerHTML = renderPnl(rev, fixedT, extraT, totalExp, profit, margin);
    } catch (e) {
      body.innerHTML = '<div style="color:#b91c1c; padding:10px; font-size:13px;">계산 오류: ' + esc(e && e.message ? e.message : String(e)) + '</div>';
    }
  }

  function renderPnl(rev, fixedT, extraT, totalExp, profit, margin) {
    // totalExp는 카드에는 직접 안 쓰지만(고정·추가로 분해) 시그니처 유지.
    var profitColor = profit < 0 ? 'var(--text-danger, var(--danger))'
      : (profit > 0 ? 'var(--text-success, var(--success))' : 'var(--secondary)');
    var label = feYmLabel(selYm());

    function card(lbl, val) {
      return '<div class="fe-card"><div class="fe-card-label">' + lbl + '</div>' +
        '<div class="fe-card-value">' + val + '</div></div>';
    }

    return '' +
      '<div class="fe-profit-wrap">' +
        '<div class="fe-profit-label">' + label + ' 영업이익</div>' +
        '<div class="fe-profit-value" style="color:' + profitColor + ';">' + fmtWon(profit) +
          '<span class="fe-margin-badge">이익률 ' + margin + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="fe-cards">' +
        card('매출', fmtWon(rev)) +
        card('고정지출', fmtWon(fixedT)) +
        card('추가지출', fmtWon(extraT)) +
      '</div>';
  }

  // ---- 상세 막대그래프 (최근 12개월, 매출/지출/영업이익) ----------
  var pnlChart = null; // Chart.js 인스턴스 ref (재렌더 전 destroy)

  // 선택월로 끝나는 최근 12개월 키 배열 ['YYYY-MM' x12]
  function last12(ym) {
    var p = ym.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1 - 11, 1); // 11개월 전
    var keys = [];
    for (var i = 0; i < 12; i++) {
      keys.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
      d.setMonth(d.getMonth() + 1);
    }
    return keys;
  }

  async function feLoadPnlChart() {
    var canvas = document.getElementById('fe-pnl-chart');
    var msg = document.getElementById('fe-pnl-chart-msg');
    if (!canvas) return;
    if (msg) msg.textContent = '';

    if (typeof Chart === 'undefined') {
      if (msg) msg.textContent = '차트 오류: Chart.js 미로드';
      return;
    }

    var ym = selYm();
    try {
      var keys = last12(ym);
      var fromYm = keys[0];

      // 매출 12개월 (정정 유틸)
      var rev = {};
      keys.forEach(function (k) { rev[k] = 0; });
      if (typeof window.computeMonthlyRevenue === 'function') {
        var out = await window.computeMonthlyRevenue({
          factoryId: currentFactoryId, fromYm: fromYm, toYm: ym, hotelFilter: 'all'
        });
        if (out && out.trend) keys.forEach(function (k) { rev[k] = Number(out.trend[k] || 0); });
      }

      // 지출 12개월 (RPC series — total은 0이니 fixed+extra로 합산)
      var exp = {};
      keys.forEach(function (k) { exp[k] = 0; });
      var rpc = await window.mySupabase.rpc('factory_expense_series', {
        p_factory_id: currentFactoryId, p_from: fromYm, p_to: ym
      });
      if (rpc.error) {
        if (pnlChart) { pnlChart.destroy(); pnlChart = null; }
        if (msg) msg.textContent = '차트 오류: ' + rpc.error.message;
        return;
      }
      (rpc.data || []).forEach(function (r) {
        if (exp[r.year_month] !== undefined) {
          exp[r.year_month] = Number(r.fixed_total || 0) + Number(r.extra_total || 0);
        }
      });

      var revArr = keys.map(function (k) { return rev[k]; });
      var expArr = keys.map(function (k) { return exp[k]; });
      var profitArr = keys.map(function (k) { return rev[k] - exp[k]; });

      // 인스턴스 관리: 재렌더 전 반드시 파기 (canvas already in use 방지)
      if (pnlChart) { pnlChart.destroy(); pnlChart = null; }

      pnlChart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: keys,
          datasets: [
            { label: '매출', data: revArr, backgroundColor: '#005b9f' },
            { label: '지출', data: expArr, backgroundColor: '#f59e0b' },
            { label: '영업이익', data: profitArr, backgroundColor: '#10b981' }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: true, position: 'bottom' },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  return ctx.dataset.label + ': ' + Number(ctx.parsed.y || 0).toLocaleString() + '원';
                }
              }
            }
          },
          scales: {
            y: { ticks: { callback: function (v) { return Number(v).toLocaleString(); } } }
          }
        }
      });
    } catch (e) {
      if (pnlChart) { pnlChart.destroy(); pnlChart = null; }
      if (msg) msg.textContent = '차트 오류: ' + (e && e.message ? e.message : String(e));
    }
  }

  // ---- 공통 렌더 (kind별 그룹→항목 + 소계/합계 + 편집 컨트롤) -----
  function renderSection(kind, body, setRows, editable, opts) {
    var order = [], map = {};
    setRows.forEach(function (r) {
      if (!map[r.group_name]) { map[r.group_name] = []; order.push(r.group_name); }
      map[r.group_name].push(r);
    });
    if (editable) {
      state[kind].draftGroups.forEach(function (g) { if (!map[g]) { map[g] = []; order.push(g); } });
    }
    state[kind].renderGroups = order.slice();

    var html = opts.bannerHtml || '';

    var grand = setRows.reduce(function (s, r) { return s + Number(r.amount || 0); }, 0);
    var revenue = Number(opts.revenue || 0);

    // (a) 그룹 추가 — 첫 동작, 상단(유일 액센트 채움 버튼). 안내는 탭별.
    if (editable) {
      html += '<div class="fe-addbox">' +
        '<div class="fe-guide">' + esc(opts.guide || '1. 먼저 그룹을 만드세요') + '</div>' +
        '<div class="fe-addrow">' +
          '<input id="fe-new-group-' + kind + '" class="fe-input fe-grow" placeholder="그룹 이름 (예: 인건비, 임대료, 공과금, 기타)">' +
          '<button type="button" class="fe-btn-accent" data-fe-act="add-group">그룹 추가</button>' +
        '</div>' +
      '</div>';
    }

    // 가져오기 버튼(추가지출 탭 전용) — 그룹 추가 박스 근처
    if (opts.importHtml) html += opts.importHtml;

    // (b) 합계 줄: 왼쪽 "매출 N원 기준", 오른쪽 "합계 N원 · 매출의 XX%"(비율 액센트)
    html += '<div class="fe-total">' +
      '<span class="fe-total-left">매출 ' + fmtWon(revenue) + ' 기준</span>' +
      '<span class="fe-total-right">' + opts.totalLabel + ' <b>' + fmtWon(grand) + '</b>' +
        (opts.unapplied ? ' <span class="fe-unapplied">(미적용)</span>' : '') +
        ' <span class="fe-pct-accent">· 매출의 ' + fePct(grand, revenue) + '</span>' +
      '</span>' +
    '</div>';

    // (c) 그룹 목록
    if (order.length === 0) {
      html += '<div class="fe-empty">' + opts.emptyMsg + '</div>';
    }

    order.forEach(function (g, gi) {
      var items = map[g];
      var sub = items.reduce(function (s, r) { return s + Number(r.amount || 0); }, 0);

      html += '<div class="fe-groupbox' + (opts.unapplied ? ' fe-muted' : '') + '">';
      html += '<div class="fe-grp-head">' +
        '<span class="fe-grp-left"><span class="fe-grp-title">' + esc(g) + '</span>' +
          (editable ? '<button type="button" class="fe-additem-link" data-fe-act="toggle-additem" data-group-index="' + gi + '">+ 항목 추가</button>' : '') +
        '</span>' +
        '<span class="fe-grp-sub">' + fmtWon(sub) +
          ' <span class="fe-pct-danger">매출의 ' + fePct(sub, revenue) + '</span>' +
        '</span>' +
      '</div>';

      if (items.length === 0) {
        html += '<div class="fe-grp-empty">항목을 추가하세요</div>';
      }

      items.forEach(function (r) {
        if (editable) {
          html += '<div class="fe-item-row">' +
            '<input class="fe-cell-input" data-fe-act="upd-item" data-id="' + r.id + '" data-field="name" value="' + esc(r.name) + '">' +
            '<input class="fe-cell-input fe-amount" data-fe-act="upd-item" data-id="' + r.id + '" data-field="amount" type="number" value="' + Number(r.amount || 0) + '">' +
            '<input class="fe-cell-input" data-fe-act="upd-item" data-id="' + r.id + '" data-field="note" value="' + esc(r.note) + '" placeholder="비고">' +
            '<button type="button" class="fe-del" data-fe-act="del-item" data-id="' + r.id + '" aria-label="삭제">&#215;</button>' +
          '</div>';
        } else {
          html += '<div class="fe-item-row">' +
            '<span class="fe-item-name">' + esc(r.name) + '</span>' +
            '<span class="fe-amount">' + fmtWon(r.amount) + '</span>' +
            '<span class="fe-item-note">' + esc(r.note) + '</span>' +
            '<span></span>' +
          '</div>';
        }
      });

      if (editable) {
        // 상시 노출 X — "+ 항목 추가" 링크로 토글되는 입력 줄(저장 시 닫힘)
        html += '<div class="fe-additem" data-fe-additem="' + gi + '" style="display:none;">' +
          '<input class="fe-input fe-ai-name" placeholder="항목 이름">' +
          '<input class="fe-input fe-amount fe-ai-amount" type="number" placeholder="금액">' +
          '<input class="fe-input fe-ai-note" placeholder="비고(선택)">' +
          '<button type="button" class="fe-btn-quiet" data-fe-act="add-item" data-group-index="' + gi + '">저장</button>' +
        '</div>';
      }

      html += '</div>';
    });

    body.innerHTML = html;
  }

  // ---- 이벤트 위임 (kind는 어느 섹션 body에서 발생했는지로 구분) ---
  async function feOnClick(e, kind) {
    var el = e.target.closest('[data-fe-act]');
    if (!el) return;
    var act = el.getAttribute('data-fe-act');
    var ym = state.ym;

    if (act === 'carry') { // 고정지출 전용
      if (!guardPastEdit(ym)) return;
      await feCarryForward();
      return;
    }

    if (act === 'import-extra') { // 추가지출: 전월 데이터를 선택월로 복사
      if (!guardPastEdit(ym)) return;
      await feImportExtra();
      return;
    }

    if (act === 'add-group') {
      if (!guardPastEdit(ym)) return;
      var inp = document.getElementById('fe-new-group-' + kind);
      var name = ((inp && inp.value) || '').trim();
      if (!name) { alert('그룹 이름을 입력하세요.'); return; }
      if (state[kind].renderGroups.indexOf(name) !== -1) { alert('이미 있는 그룹입니다.'); return; }
      state[kind].draftGroups.push(name);
      await reload(kind);
      return;
    }

    if (act === 'toggle-additem') { // 입력 줄 열기/닫기 (편집 아님 → 경고 없음)
      var box = el.closest('.fe-groupbox');
      if (!box) return;
      var row = box.querySelector('[data-fe-additem]');
      if (!row) return;
      var opening = (row.style.display === 'none' || !row.style.display);
      row.style.display = opening ? 'grid' : 'none';
      if (opening) { var nm = row.querySelector('.fe-ai-name'); if (nm) nm.focus(); }
      return;
    }

    if (act === 'add-item') {
      if (!guardPastEdit(ym)) return;
      var gi = Number(el.getAttribute('data-group-index'));
      var groupName = state[kind].renderGroups[gi];
      var cont = el.closest('[data-fe-additem]');
      if (!cont || groupName == null) return;
      await feAddItem(kind, ym, groupName,
        cont.querySelector('.fe-ai-name').value,
        cont.querySelector('.fe-ai-amount').value,
        cont.querySelector('.fe-ai-note').value);
      return;
    }

    if (act === 'del-item') {
      if (!guardPastEdit(ym)) return;
      await feDeleteItem(kind, el.getAttribute('data-id'));
      return;
    }
  }

  async function feOnChange(e, kind) {
    var el = e.target.closest('[data-fe-act="upd-item"]');
    if (!el) return;
    if (!guardPastEdit(state.ym)) { await reload(kind); return; } // 취소 시 입력 원복
    await feUpdateItem(kind, el.getAttribute('data-id'), el.getAttribute('data-field'), el.value);
  }

  // ---- 편집 연산 (선택월 year_month 행에만 적용) ------------------
  async function feNextOrder(kind, ym) {
    var r = await window.mySupabase.from('factory_expenses')
      .select('sort_order')
      .eq('factory_id', currentFactoryId).eq('kind', kind).eq('year_month', ym)
      .order('sort_order', { ascending: false }).limit(1).maybeSingle();
    if (r.error) return 1;
    return r.data ? (Number(r.data.sort_order) || 0) + 1 : 1;
  }

  async function feAddItem(kind, ym, groupName, name, amount, note) {
    name = (name || '').trim();
    if (!name) { alert('항목 이름을 입력하세요.'); return; }
    var ord = await feNextOrder(kind, ym);
    var res = await window.mySupabase.from('factory_expenses').insert([{
      factory_id: currentFactoryId,
      year_month: ym,
      kind: kind,
      group_name: groupName,
      name: name,
      amount: Number(amount) || 0,
      note: (note || '').trim() || null,
      sort_order: ord
    }]);
    if (res.error) { alert('추가 실패: ' + res.error.message); return; }
    await reload(kind);
  }

  async function feUpdateItem(kind, id, field, value) {
    var patch = {};
    if (field === 'amount') patch.amount = Number(value) || 0;
    else if (field === 'note') patch.note = (value || '').trim() || null;
    else {
      var nm = (value || '').trim();
      if (!nm) { alert('항목 이름은 비울 수 없습니다.'); await reload(kind); return; }
      patch.name = nm;
    }
    var res = await window.mySupabase.from('factory_expenses').update(patch).eq('id', id);
    if (res.error) { alert('수정 실패: ' + res.error.message); await reload(kind); return; }
    if (field === 'amount') await reload(kind); // 합계 반영(이름/비고는 포커스 유지)
  }

  async function feDeleteItem(kind, id) {
    if (!confirm('해당 항목을 삭제하시겠습니까?')) return;
    var res = await window.mySupabase.from('factory_expenses').delete().eq('id', id);
    if (res.error) { alert('삭제 실패: ' + res.error.message); return; }
    await reload(kind);
  }

  // ---- carry-forward (고정지출 전용): 이전 달 유효 세트를 선택월로 복사 ----
  async function feCarryForward() {
    var ym = state.ym;

    var chk = await window.mySupabase.from('factory_expenses')
      .select('id').eq('factory_id', currentFactoryId).eq('kind', 'fixed').eq('year_month', ym).limit(1);
    if (chk.error) { alert('확인 실패: ' + chk.error.message); return; }
    if (chk.data && chk.data.length) { await feLoadFixed(); return; } // 이미 있으면 복사 금지

    var src = await window.mySupabase.from('factory_expenses')
      .select('group_name, name, amount, note, sort_order, year_month')
      .eq('factory_id', currentFactoryId).eq('kind', 'fixed').lt('year_month', ym)
      .order('year_month', { ascending: false })
      .order('sort_order', { ascending: true });
    if (src.error) { alert('원본 조회 실패: ' + src.error.message); return; }

    var rows = src.data || [];
    if (!rows.length) { await feLoadFixed(); return; }
    var eYm = rows[0].year_month;
    var payload = rows.filter(function (r) { return r.year_month === eYm; }).map(function (r) {
      return {
        factory_id: currentFactoryId,
        year_month: ym,            // 선택월로 복사 (원본 행은 건드리지 않음)
        kind: 'fixed',
        group_name: r.group_name,
        name: r.name,
        amount: r.amount,
        note: r.note,
        sort_order: r.sort_order
      };
    });

    var ins = await window.mySupabase.from('factory_expenses').insert(payload);
    if (ins.error) { alert('복사 실패: ' + ins.error.message); return; }
    await reload('fixed'); // 선택월 세트 → 편집 가능 + 손익 반영
  }

  // ---- 추가지출 가져오기: 전월(선택월-1)의 extra 행을 선택월로 복사 ----
  async function feImportExtra() {
    var ym = state.ym;
    var prevYm = feYmAdd(ym, -1);

    // 이미 이 달 extra가 있으면 중복 방지
    var chk = await window.mySupabase.from('factory_expenses')
      .select('id').eq('factory_id', currentFactoryId).eq('kind', 'extra').eq('year_month', ym).limit(1);
    if (chk.error) { alert('확인 실패: ' + chk.error.message); return; }
    if (chk.data && chk.data.length) { await reload('extra'); return; }

    var src = await window.mySupabase.from('factory_expenses')
      .select('group_name, name, amount, note, sort_order')
      .eq('factory_id', currentFactoryId).eq('kind', 'extra').eq('year_month', prevYm)
      .order('sort_order', { ascending: true });
    if (src.error) { alert('원본 조회 실패: ' + src.error.message); return; }

    var rows = src.data || [];
    if (!rows.length) { await reload('extra'); return; }
    var payload = rows.map(function (r) {
      return {
        factory_id: currentFactoryId,
        year_month: ym,            // 선택월로 복사 (전월 원본은 건드리지 않음)
        kind: 'extra',
        group_name: r.group_name,
        name: r.name,
        amount: r.amount,
        note: r.note,
        sort_order: r.sort_order
      };
    });

    var ins = await window.mySupabase.from('factory_expenses').insert(payload);
    if (ins.error) { alert('복사 실패: ' + ins.error.message); return; }
    await reload('extra'); // 추가지출 + 손익 + 그래프 반영
  }

  // ---- 대시보드 카드: 전월 영업이익 (거래처/직원 카드 대체) --------
  // 전월 = 오늘 기준 지난달 'YYYY-MM'
  function prevMonthYm() {
    var t = new Date();
    var d = new Date(t.getFullYear(), t.getMonth() - 1, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  // 대상 카드 찾기: 이미 변환됐으면 그 카드, 아니면 #adminSummaryCount의 카드
  function findProfitCard() {
    var done = document.getElementById('fe-prevprofit-card');
    if (done) return done;
    var v = document.getElementById('adminSummaryCount');
    return v ? v.closest('.super-card') : null;
  }

  async function feRenderProfitCard() {
    var card = findProfitCard();
    if (!card) return; // 어드민 대시보드 카드 DOM 없음(다른 화면 등)
    var prevYm = prevMonthYm();

    // 최초 1회: 거래처/직원 카드를 전월 영업이익 카드로 교체 (중복 가드)
    if (card.id !== 'fe-prevprofit-card') {
      card.id = 'fe-prevprofit-card';
      card.style.cursor = 'pointer';
      card.style.borderLeftColor = 'var(--success)';
      card.innerHTML =
        '<div class="super-card-title">전월 영업이익</div>' +
        '<div style="font-size:10px;color:var(--secondary);margin-top:-2px;margin-bottom:4px;">지출 반영</div>' +
        '<div class="super-card-value" id="fe-prevProfitValue">계산 중...</div>' +
        '<div style="font-size:12px;margin-top:4px;" id="fe-prevProfitMargin"></div>';
      // 클릭 시 공장매입 모달을 전월·손익 탭으로 오픈 (targetYm로 로드 전 세팅)
      card.onclick = function () { window.openFactoryExpenses(prevMonthYm(), 'pnl'); };
    }

    var valEl = document.getElementById('fe-prevProfitValue');
    var marEl = document.getElementById('fe-prevProfitMargin');
    try {
      // 매출 (정정 유틸)
      var rev = 0;
      if (typeof window.computeMonthlyRevenue === 'function') {
        var out = await window.computeMonthlyRevenue({
          factoryId: currentFactoryId, fromYm: prevYm, toYm: prevYm, hotelFilter: 'all'
        });
        rev = Number((out && out.trend && out.trend[prevYm]) || 0);
      }
      // 지출 (RPC)
      var rpc = await window.mySupabase.rpc('factory_expense_month', {
        p_factory_id: currentFactoryId, p_year_month: prevYm
      });
      if (rpc.error) {
        if (valEl) valEl.innerText = '계산 오류';
        if (marEl) marEl.innerHTML = '<span style="color:var(--danger);">' + esc(rpc.error.message) + '</span>';
        return;
      }
      var row = (rpc.data && rpc.data[0]) || {};
      var totalExp = (row.total == null) ? (Number(row.fixed_total || 0) + Number(row.extra_total || 0)) : Number(row.total);
      var profit = rev - totalExp;
      var margin = rev > 0 ? (profit / rev * 100).toFixed(1) + '%' : '—';
      var color = profit < 0 ? 'var(--danger)' : (profit > 0 ? 'var(--success)' : 'var(--secondary)');
      if (valEl) { valEl.innerText = fmtWon(profit); valEl.style.color = color; }
      if (marEl) marEl.innerHTML = '<span style="color:' + color + ';">이익률 ' + margin + '</span>';
    } catch (e) {
      if (valEl) valEl.innerText = '계산 오류';
      if (marEl) marEl.innerHTML = '<span style="color:var(--danger);">' + esc(e && e.message ? e.message : String(e)) + '</span>';
    }
  }

  // ---- 모달 열기 시 초기화 (기존 open 래핑) ----------------------
  var _openFE = window.openFactoryExpenses;
  window.openFactoryExpenses = async function (targetYm, targetTab) {
    // (1) 모달 표시 + #factoryExpensesRoot 생성 (동기)
    if (typeof _openFE === 'function') _openFE();

    // (2) 스캐폴드는 동기로 즉시 주입 → 첫 클릭에도 최소 UI(헤더·탭·패널)가
    //     바로 보임. 이미 있으면 재주입 안 함(멱등). 데이터 로드는 아래서 async로.
    feBuildScaffold();

    // (3) #fe-ym 값 보장: targetYm 있으면 그 달, 없고 비어있으면 이번달.
    //     (카드 경로가 targetYm로 전월을 넘겨 로드 전에 세팅 → 재조회 race 없음)
    var ymEl = document.getElementById('fe-ym');
    if (ymEl) {
      if (targetYm) ymEl.value = targetYm;
      else if (!ymEl.value) ymEl.value = curYm();
    }
    feSyncYmLabel();

    // (4) 탭 세팅 (카드 경로는 'pnl', 메뉴는 기본 'fixed')
    feSwitchTab(targetTab || 'fixed');

    state.fixed.draftGroups = [];
    state.extra.draftGroups = [];
    revCache = {}; // 매출 캐시 초기화(열 때마다 신선)
    updatePastBanner();

    // (5) 열 때마다 항상 전 섹션 로드 (첫 클릭이든 N번째든 항상 채워짐)
    await feLoadFixed();
    await feLoadExtra();
    await feLoadPnl();
    await feLoadPnlChart();
  };

  // ---- 대시보드 렌더 래핑: 전월 영업이익 카드 주입/갱신 ----------
  // 원본 loadAdminDashboard 실행(3 매출카드 세팅) 후 카드4를 교체/갱신.
  // 뷰 복귀·탭 전환 등 재렌더 때마다 유지(중복 주입 가드 있음).
  var _origLoadDash = window.loadAdminDashboard;
  window.loadAdminDashboard = async function () {
    if (typeof _origLoadDash === 'function') await _origLoadDash.apply(this, arguments);
    await feRenderProfitCard();
  };
})();
