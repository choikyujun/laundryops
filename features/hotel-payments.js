// features/hotel-payments.js
// 월정산 관리 > 입금확인(수금 관리) 탭.
// 기준: 01-prd-입금확인.md, 02-architecture-입금확인.md(2026-07-16 전면 개정), 03-design-입금확인.md.
//
// 청구 기간 = 거래처(입금주체)별 시작일~종료일 "일자" 주기. sent_logs 미사용, 발송/미발송 구분 없음.
// 청구액 = 기간 내 invoices.total_amount 합(차감 음수 포함) + Math.floor(합×0.1). 정액제는 fixed_amount.
// 월 귀속 = 종료일 기준. 단가제 행은 종료일이 지나야(오늘>종료일) 집계, 정액제는 항상 표시.
//
// 로드 순서: features/item-name-update.js 뒤(index.html) — initDragSort 재사용(태스크 7).
(function () {
    'use strict';

    const PANEL_ID = 'tab_adminCollect';
    const YM_ID = 'hp-ym';          // 월 단일 출처(YYYY-MM)
    const COLSPAN = 8;

    // ── 날짜 유틸 ─────────────────────────────────────────
    function pad(n) { return String(n).padStart(2, '0'); }

    function todayYm() {
        const d = new Date();
        return d.getFullYear() + '-' + pad(d.getMonth() + 1);
    }
    function todayStr() {
        const d = new Date();
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    // 'YYYY-MM' + delta개월 → 'YYYY-MM'
    function shiftYm(ym, delta) {
        const parts = String(ym).split('-').map(Number);
        const d = new Date(parts[0], (parts[1] - 1) + delta, 1);
        return d.getFullYear() + '-' + pad(d.getMonth() + 1);
    }
    function ymLabel(ym) {
        const parts = String(ym).split('-').map(Number);
        return parts[0] + '년 ' + parts[1] + '월';
    }

    // 그 달(y, m1to12)의 day를 말일로 clamp
    function clampDay(y, m, day) {
        const last = new Date(y, m, 0).getDate(); // m=7 → 7월 말일
        return Math.min(day, last);
    }

    // ym + (start_day/end_day) → { start:'YYYY-MM-DD', end:'YYYY-MM-DD' } | null
    // 종료일 = ym의 end_day(clamp). 시작일 = start_day<=end_day ? ym의 start_day : (ym 전달)의 start_day.
    function periodFor(ym, startDay, endDay) {
        if (startDay == null || endDay == null) return null;
        const [y, m] = String(ym).split('-').map(Number);
        const endD = clampDay(y, m, endDay);
        const end = y + '-' + pad(m) + '-' + pad(endD);

        let sy = y, sm = m;
        if (startDay > endDay) {          // 전달로
            sy = (m === 1) ? y - 1 : y;
            sm = (m === 1) ? 12 : m - 1;
        }
        const startD = clampDay(sy, sm, startDay);
        const start = sy + '-' + pad(sm) + '-' + pad(startD);
        return { start: start, end: end };
    }

    function getYm() {
        const el = document.getElementById(YM_ID);
        return (el && el.value) ? el.value : todayYm();
    }
    function setYm(ym) {
        const el = document.getElementById(YM_ID);
        if (el) el.value = ym;
        const lbl = document.getElementById('hp-ym-label');
        if (lbl) lbl.textContent = ymLabel(ym);
    }

    // 금액 등폭(자릿수 세로 정렬) — revenue-top-align.js와 동일 접근.
    // 금액 등폭은 인라인 style로 넣지 않는다 — 폰트 스택의 "SF Mono" 큰따옴표가
    // style="..." 속성을 조기 종료시켜 스타일 전체가 깨진다. 대신 <style> 규칙 주입(ensureMoneyStyle).
    const STYLE_ID = 'hp-money-style';
    function ensureMoneyStyle() {
        if (document.getElementById(STYLE_ID)) return; // 1회 가드
        const stack = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
        const css =
            // 표 금액 열(청구액=5, 입금액=6, 미수금=7) + 입금액 input: 우측정렬 + 등폭
            '#hp-list td:nth-child(5),' +
            '#hp-list td:nth-child(6),' +
            '#hp-list td:nth-child(7),' +
            '#hp-list td:nth-child(6) input {' +
            '  text-align: right !important;' +
            '  font-family: ' + stack + ' !important;' +
            '  font-variant-numeric: tabular-nums !important;' +
            '}' +
            // 요약 3카드 값: 등폭(정렬은 카드 레이아웃 유지)
            '#hp-sum-billed, #hp-sum-paid, #hp-sum-unpaid {' +
            '  font-family: ' + stack + ' !important;' +
            '  font-variant-numeric: tabular-nums !important;' +
            '}' +
            // ── 폰(≤768px): 시작일·종료일 열을 제거해 거래처 열에 폭을 몰아준다. ──
            // 이유: table-layout:fixed라 거래처 열이 22%로 못박혀(720px 기준 ~158px) 이름이
            //   화살표·미수·배지 같은 shrink 불가 요소에 밀려 0으로 눌렸음. 폰은 미수·입금 확인 용도라
            //   주기 select 두 열은 감춰도 무방(데스크톱에서 설정).
            // 열 6개로 줄었으니 min-width도 720 → 500으로 낮춰 가로 스크롤을 줄인다.
            // nth-child는 display:none 형제도 세므로 원래 열 번호(3·4 숨김, 5~8 유지)를 그대로 쓴다.
            // #hp-table로 스코프 — 앱의 다른 .admin-table엔 영향 없음.
            '@media (max-width: 768px) {' +
            '  #hp-table { min-width: 500px !important; }' +
            '  #hp-table th:nth-child(3), #hp-table td:nth-child(3),' +
            '  #hp-table th:nth-child(4), #hp-table td:nth-child(4) { display: none !important; }' +
            // 폭은 th·td 양쪽에 동일 적용해야 한다: 폰에서 style.css가 tr을 display:table+
            //   table-layout:fixed로 만들어 각 행이 독립 테이블이 됨 → td 폭이 없으면 본문은
            //   균등 분할되어 th(%) 헤더와 어긋난다. 열별로 th·td 같은 %를 준다.
            '  #hp-table th:nth-child(1), #hp-table td:nth-child(1) { width: 8% !important; }' +
            '  #hp-table th:nth-child(2), #hp-table td:nth-child(2) { width: 36% !important; }' +
            '  #hp-table th:nth-child(5), #hp-table td:nth-child(5) { width: 16% !important; }' +
            '  #hp-table th:nth-child(6), #hp-table td:nth-child(6) { width: 16% !important; }' +
            '  #hp-table th:nth-child(7), #hp-table td:nth-child(7) { width: 16% !important; }' +
            '  #hp-table th:nth-child(8), #hp-table td:nth-child(8) { width: 8% !important; }' +
            // 기간 숨김 + 이름 우선(남는 폭을 이름이 차지, 배지·미수는 그다음).
            '  #hp-list .hp-period { display: none !important; }' +
            '  #hp-list .hp-name { flex: 1 1 auto !important; min-width: 0 !important; }' +
            // 요약 3카드 값: 폰에서 24px → 12px(50%). 값에 인라인 font-size:24px가 있어 !important 필요.
            //   nowrap로 좁은 3열 grid에서 줄바꿈 방지. 라벨(청구 총액 등)은 미변경.
            '  #hp-sum-billed, #hp-sum-paid, #hp-sum-unpaid {' +
            '    font-size: 12px !important; white-space: nowrap !important;' +
            '  }' +
            '}';
        const el = document.createElement('style');
        el.id = STYLE_ID;
        el.textContent = css;
        document.head.appendChild(el);
    }

    function won(n) { return Number(n || 0).toLocaleString() + '원'; }
    function mmdd(dateStr) {
        if (!dateStr) return '-';
        const p = String(dateStr).substring(0, 10).split('-');
        return p.length === 3 ? (p[1] + '-' + p[2]) : String(dateStr);
    }
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // 최신 요청만 렌더(월 화살표 연타 race 방지)
    let _reqSeq = 0;
    // 위탁사 행 펼침 상태(companyId) — 렌더/월 이동 사이 유지
    const _expanded = new Set();
    // 마지막 렌더 데이터 캐시(펼치기 토글 시 재조회 없이 재렌더)
    let _lastRender = null;

    // ── invoices 기간 합계: 공장 전체를 [minStart,maxEnd] 한 번에 페이지네이션 조회 후
    //    호텔별 개별 창(window)으로 필터. 호텔 수와 무관하게 쿼리 P회(1000행 페이지). ──
    async function fetchSupplyByHotel(windowByHotel, minStart, maxEnd, seq) {
        const supply = {};
        const PAGE = 1000;
        let from = 0;
        for (;;) {
            const res = await window.mySupabase.from('invoices')
                .select('hotel_id, date, total_amount')
                .eq('factory_id', currentFactoryId)
                .gte('date', minStart).lte('date', maxEnd)
                .range(from, from + PAGE - 1);
            if (res.error) throw res.error;
            const data = res.data || [];
            data.forEach(inv => {
                const w = windowByHotel[inv.hotel_id];
                if (!w) return;
                const d = String(inv.date).substring(0, 10);
                if (d >= w.start && d <= w.end) {
                    // 차감 행(음수 total_amount)도 그대로 더함 — 자동 공제. 제외·abs 금지.
                    supply[inv.hotel_id] = (supply[inv.hotel_id] || 0) + Number(inv.total_amount || 0);
                }
            });
            if (data.length < PAGE) break;
            from += PAGE;
            if (seq !== _reqSeq) break; // 더 최신 요청 → 중단
        }
        return supply;
    }

    // ── 데이터 결합 → 표 + 요약 렌더 ──
    async function refreshData() {
        const panel = document.getElementById(PANEL_ID);
        if (!panel || panel.dataset.hpReady !== '1') return;
        const tbody = document.getElementById('hp-list');
        if (!tbody) return;

        const ym = getYm();
        const today = todayStr();
        const seq = ++_reqSeq;

        tbody.innerHTML = `<tr><td colspan="${COLSPAN}" style="text-align:center; padding:20px; color:var(--secondary,#64748b);">불러오는 중...</td></tr>`;

        try {
            if (!currentFactoryId) throw new Error('공장 정보 없음');

            // 1) 거래처 + 위탁사 + 입금주체(주기/순서) + 입금 (병렬 4쿼리)
            const [hotelsRes, companiesRes, payersRes, payRes] = await Promise.all([
                window.mySupabase.from('hotels')
                    .select('id, name, is_consignment, consignment_company_id, contract_type, fixed_amount, created_at')
                    .eq('factory_id', currentFactoryId)
                    .neq('status', 'inactive')   // 운영중지(거래종료) 제외 — 기존 명세서 화면(app_v38.js:3089)과 동일
                    .order('name', { ascending: true }),
                window.mySupabase.from('consignment_companies')
                    .select('id, name')
                    .eq('factory_id', currentFactoryId),
                window.mySupabase.from('payment_payers')
                    .select('hotel_id, company_id, sort_order, start_day, end_day')
                    .eq('factory_id', currentFactoryId),
                window.mySupabase.from('hotel_payments')
                    .select('hotel_id, company_id, paid_amount, paid_at')
                    .eq('factory_id', currentFactoryId)
                    .eq('year_month', ym)
            ]);
            for (const r of [hotelsRes, companiesRes, payersRes, payRes]) {
                if (r.error) throw r.error;
            }
            if (seq !== _reqSeq) return;

            const hotels = hotelsRes.data || [];
            const companyName = {};
            (companiesRes.data || []).forEach(c => { companyName[c.id] = c.name; });

            // 입금주체(payer) 설정 맵: hotel_id / company_id 키
            const payerByHotel = {};
            const payerByCompany = {};
            (payersRes.data || []).forEach(p => {
                if (p.hotel_id) payerByHotel[p.hotel_id] = p;
                else if (p.company_id) payerByCompany[p.company_id] = p;
            });

            // 입금 매칭 맵
            const paidByHotel = {};
            const paidByCompany = {};
            (payRes.data || []).forEach(p => {
                if (p.hotel_id) paidByHotel[p.hotel_id] = { amount: Number(p.paid_amount || 0), at: p.paid_at };
                else if (p.company_id) paidByCompany[p.company_id] = { amount: Number(p.paid_amount || 0), at: p.paid_at };
            });

            // 2) 행(입금주체) 구성: 직영 호텔 / 위탁 미지정 호텔 / 위탁사(그룹)
            //    각 행에 소속 호텔 + payer 설정(주기·순서)을 붙인다.
            const rowMap = new Map(); // key: 'h:'+id | 'c:'+id
            function ensureRow(payerType, payerId, payer) {
                const key = (payerType === 'company' ? 'c:' : 'h:') + payerId;
                let r = rowMap.get(key);
                if (!r) {
                    r = { payerType, payerId, payer: payer || null, members: [] };
                    rowMap.set(key, r);
                }
                return r;
            }

            hotels.forEach(h => {
                if (h.is_consignment && h.consignment_company_id) {
                    const cid = h.consignment_company_id;
                    const r = ensureRow('company', cid, payerByCompany[cid]);
                    r.members.push(h);
                } else {
                    const r = ensureRow('hotel', h.id, payerByHotel[h.id]);
                    r.members.push(h);
                    r.labelKind = h.is_consignment ? 'unassigned' : 'direct';
                }
            });

            // 3) 각 행의 기간·집계상태·창(window) 산출
            const windowByHotel = {}; // 단가제·집계대상 호텔만 → invoices 조회에 사용
            const rows = [];
            rowMap.forEach(r => {
                const payer = r.payer;
                const startDay = payer ? payer.start_day : null;
                const endDay = payer ? payer.end_day : null;
                const period = periodFor(ym, startDay, endDay);

                const name = r.payerType === 'company'
                    ? (companyName[r.payerId] || '(이름 없는 위탁사)')
                    : (r.members[0] ? r.members[0].name : '');

                const row = {
                    payerType: r.payerType,
                    payerId: r.payerId,
                    name: name,
                    labelKind: r.payerType === 'company' ? 'company' : (r.labelKind || 'direct'),
                    sortOrder: payer && payer.sort_order != null ? payer.sort_order : Infinity,
                    startDay: startDay,   // 원시 일자(select 값)
                    endDay: endDay,
                    startDate: period ? period.start : null,
                    endDate: period ? period.end : null,
                    billed: null,
                    state: 'ok'
                };
                row._members = r.members; // 자식 행(펼치기) 렌더용 — 상태와 무관하게 보관

                if (!period) {
                    row.state = 'no-cycle';           // 주기 미설정 → 청구액 빈칸
                    rows.push(row);
                    return;
                }

                // 집계 시점(계약 유형 무관 단일 규칙): 오늘 > 종료일이어야 집계.
                // 기간이 끝나지 않았으면 정액제도 아직 청구 대상 아님 → '집계 전'(빈칸).
                if (!(today > period.end)) {
                    row.state = 'pending';            // 종료일 이후 집계 → 지금은 빈칸
                    rows.push(row);
                    return;
                }

                // 단가제 멤버의 기간 창 등록(invoices 조회용). 정액제는 fixed_amount로 별도 처리.
                r.members.forEach(h => {
                    if (h.contract_type !== 'fixed') {
                        windowByHotel[h.id] = { start: period.start, end: period.end };
                    }
                });
                rows.push(row);
            });

            // 4) 단가제 기간 매출 조회(공장 전체 1회, 페이지네이션)
            const unitWindows = Object.keys(windowByHotel);
            let supplyByHotel = {};
            if (unitWindows.length > 0) {
                let minStart = null, maxEnd = null;
                unitWindows.forEach(hid => {
                    const w = windowByHotel[hid];
                    if (minStart === null || w.start < minStart) minStart = w.start;
                    if (maxEnd === null || w.end > maxEnd) maxEnd = w.end;
                });
                supplyByHotel = await fetchSupplyByHotel(windowByHotel, minStart, maxEnd, seq);
                if (seq !== _reqSeq) return;
            }

            // 5) 행 청구액 확정 + 자식(호텔별) 청구액.
            //    행 청구액 = supplySum + floor(×0.1)  (VAT 합계 기준 1회)
            //    자식 청구액 = 호텔 supply + floor(supply×0.1)  (호텔별 개별 floor)
            //    → 자식 합이 행 청구액과 1~N원 어긋날 수 있음(참고용).
            rows.forEach(row => {
                if (row.state !== 'ok') return;
                let supplySum = 0;
                const children = [];
                (row._members || []).forEach(h => {
                    let s;
                    if (h.contract_type === 'fixed') {
                        const createdMonth = h.created_at ? String(h.created_at).substring(0, 7) : '2000-01';
                        s = (ym >= createdMonth) ? Number(h.fixed_amount || 0) : 0;
                    } else {
                        s = Number(supplyByHotel[h.id] || 0);
                    }
                    supplySum += s;
                    children.push({ name: h.name, billed: s + Math.floor(s * 0.1) });
                });
                row.billed = supplySum + Math.floor(supplySum * 0.1);
                row.children = children;
            });

            // 6) 정렬: sort_order(태스크 7 드래그) 우선, 없으면 이름 가나다순(거래처 탭 기준)
            rows.sort((a, b) => {
                if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
                return String(a.name).localeCompare(String(b.name), 'ko');
            });

            if (seq !== _reqSeq) return;
            _lastRender = { rows: rows, paidByHotel: paidByHotel, paidByCompany: paidByCompany };
            renderRows(rows, paidByHotel, paidByCompany);

        } catch (e) {
            if (seq !== _reqSeq) return;
            console.warn('[hotel-payments] 조회 오류', e);
            tbody.innerHTML = `<tr><td colspan="${COLSPAN}" style="text-align:center; padding:20px; color:var(--danger,#dc2626);">조회 오류: ${esc(e.message || e)}</td></tr>`;
            setSummary(0, 0, 0);
        }
    }

    // ── 라벨(거래처 셀) 배지 ──
    // 직영=옅은 회색+text-secondary, 위탁=옅은 액센트+text-accent, 미지정=경고(기존).
    // --surface-1/--bg-accent/--text-accent/--radius는 style.css에 미정의라 폴백값 필수
    // (특히 --surface는 #fff라 배지가 흰색으로 안 보였음).
    const BADGE_BASE = 'display:inline-block; font-size:11px; padding:1px 5px; border-radius:var(--radius,6px); white-space:nowrap;';
    const TAG = {
        direct: 'background:var(--surface-1,#f1f5f9); color:var(--secondary,#64748b);',
        company: 'background:var(--bg-accent,#e0f4fc); color:var(--text-accent,#0077b3);',
        unassigned: 'background:#fef3c7; color:#92400e;'
    };
    function labelCell(row) {
        if (row.labelKind === 'company') {
            return `<span style="${BADGE_BASE} ${TAG.company}">위탁·${esc(row.name)}</span>`;
        }
        if (row.labelKind === 'unassigned') {
            return `<strong>${esc(row.name)}</strong> <span style="${BADGE_BASE} ${TAG.unassigned}">위탁사 미지정</span>`;
        }
        return `<strong>${esc(row.name)}</strong> <span style="${BADGE_BASE} ${TAG.direct}">직영</span>`;
    }

    function setSummary(billed, paid, unpaid) {
        const b = document.getElementById('hp-sum-billed');
        const p = document.getElementById('hp-sum-paid');
        const u = document.getElementById('hp-sum-unpaid');
        if (b) b.textContent = won(billed);
        if (p) p.textContent = won(paid);
        if (u) u.textContent = won(unpaid);
    }

    function renderRows(rows, paidByHotel, paidByCompany) {
        const tbody = document.getElementById('hp-list');
        if (!tbody) return;

        if (rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${COLSPAN}" style="text-align:center; padding:20px; color:var(--secondary,#64748b);">청구 대상 거래처가 없습니다.</td></tr>`;
            setSummary(0, 0, 0);
            return;
        }

        const moneyTd = 'text-align:right;'; // 등폭 폰트는 ensureMoneyStyle의 <style> 규칙이 담당
        const muted = 'color:var(--secondary,#94a3b8);';
        // 드래그 순서(initDragSort 재사용). 노출 안 됐으면 핸들 숨김 + draggable 미부여.
        const dragOk = typeof window.initDragSort === 'function';
        const HANDLE = window.DRAG_HANDLE_STYLE || 'cursor:grab; padding:4px 10px; color:#94a3b8; font-size:16px; user-select:none;';
        let sumBilled = 0, sumPaid = 0, sumUnpaid = 0;
        let html = '';

        rows.forEach(row => {
            const isCompany = row.payerType === 'company';
            const expanded = isCompany && _expanded.has(row.payerId);
            const payInfo = isCompany ? paidByCompany[row.payerId] : paidByHotel[row.payerId];
            const paid = payInfo ? Number(payInfo.amount || 0) : 0;
            // 미수 행 = 집계된(ok) 행 중 미수금 > 0 (미입금·부분입금 모두). 강조 대상.
            const isUnpaidRow = row.state === 'ok' && (Number(row.billed || 0) - paid) > 0;

            // 시작일·종료일 = 일자 select(1~31). 값 변경 즉시 저장 후 재계산.
            const key = row.payerType + '-' + row.payerId;
            const periodText = (row.startDate && row.endDate) ? (mmdd(row.startDate) + ' ~ ' + mmdd(row.endDate)) : '';

            // 거래처 셀: [화살표(위탁사만)] 이름·라벨(ellipsis) [N곳] [기간]
            // 직영/미지정 행은 펼침 화살표가 없으므로 빈 자리표시자 없이 이름을 왼쪽 끝에 붙인다(왼쪽 정렬).
            const chevron = isCompany
                ? `<span style="flex-shrink:0; width:14px; text-align:center; color:var(--secondary,#94a3b8); font-size:11px;">${expanded ? '&#9662;' : '&#9656;'}</span>`
                : '';
            const countText = isCompany
                ? `<span style="flex-shrink:0; font-size:11px; ${muted}">${(row._members || []).length}곳</span>`
                : '';
            const misuLabel = isUnpaidRow
                ? `<span style="flex-shrink:0; font-weight:700; font-size:11px; color:var(--danger,#dc2626);">미수</span>`
                : '';
            const nameCell = `<td style="text-align:left;"><div style="display:flex; align-items:center; gap:6px; min-width:0;">`
                + chevron
                + misuLabel
                + `<span class="hp-name" style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${labelCell(row)}</span>`
                + countText
                // 기간 텍스트는 좁은 화면(≤768px)에서 숨김(ensureMoneyStyle media query) — 이름 폭 확보.
                + (periodText ? `<span class="hp-period" style="flex-shrink:0; margin-left:auto; font-size:11px; ${muted}">${periodText}</span>` : '')
                + `</div></td>`;
            const startCell = `<td style="text-align:center;">${daySelect('hp-start', key, row.startDay, row.payerType, row.payerId)}</td>`;
            const endCell = `<td style="text-align:center;">${daySelect('hp-end', key, row.endDay, row.payerType, row.payerId)}</td>`;

            // 배경: 미수 행(미입금·부분입금)은 danger 우선, 아니면 위탁사만 옅은 surface-1.
            let bg = isUnpaidRow ? 'var(--bg-danger,#fef2f2)' : (isCompany ? 'var(--surface-1,#f8fafc)' : '');
            const clickAttr = isCompany ? ` onclick="window._hpToggleCompany('${esc(row.payerId)}')"` : '';

            let bodyCells;
            if (row.state !== 'ok') {
                // 미확정 행: 청구액 빈칸, 요약 제외. 입금 입력 불가(체크박스 disabled). 기존 입금액은 보존 표시.
                const billedText = row.state === 'no-cycle' ? '기간 미설정' : '집계 전';
                bodyCells = `<td style="${moneyTd} ${muted}">${billedText}</td>`
                    + `<td style="${moneyTd} ${muted}">${payInfo ? won(paid) : '-'}</td>`
                    + `<td style="${moneyTd} ${muted}">-</td>`
                    + `<td style="text-align:center;"><input type="checkbox" disabled title="청구액 집계 후 가능" style="width:16px; height:16px;"></td>`;
            } else {
                const billed = Number(row.billed || 0);
                const unpaid = Math.max(billed - paid, 0);
                sumBilled += billed;
                sumPaid += Math.min(paid, billed);
                sumUnpaid += unpaid;

                const completed = paid > 0 && paid >= billed;   // 미수금 0 이하 → 완료
                const partial = paid > 0 && paid < billed;
                // 배경(danger)은 isUnpaidRow에서 이미 처리(미입금·부분입금 공통).

                const pAttr = `data-ptype="${esc(row.payerType)}" data-pid="${esc(row.payerId)}"`;
                const paidInput = `<input type="text" inputmode="numeric" value="${paid > 0 ? paid.toLocaleString() : ''}" placeholder="0" ${pAttr}`
                    + ` onclick="event.stopPropagation()" onchange="window._hpSavePaid(this)"`
                    + ` style="width:100%; height:28px; text-align:right; border:1px solid var(--border,#cbd5e1); border-radius:6px; padding:0 6px; box-sizing:border-box; font-size:12px;${completed ? ' color:var(--success,#16a34a);' : ''}">`;
                const unpaidCell = completed
                    ? `<td style="${moneyTd} ${muted}">0원</td>`
                    : `<td style="${moneyTd} color:var(--danger,#dc2626);${partial ? ' font-weight:700;' : ''}">${won(unpaid)}</td>`;
                const doneCb = `<input type="checkbox" ${completed ? 'checked' : ''} ${pAttr} data-billed="${billed}"`
                    + ` onclick="event.stopPropagation()" onchange="window._hpToggleDone(this)"`
                    + ` style="width:16px; height:16px; cursor:pointer; accent-color:var(--primary,#2563eb);">`;
                bodyCells = `<td style="${moneyTd}">${won(billed)}</td>`
                    + `<td>${paidInput}</td>`
                    + unpaidCell
                    + `<td style="text-align:center;">${doneCb}</td>`;
            }

            const trStyle = (bg ? 'background:' + bg + ';' : '') + (isCompany ? 'cursor:pointer;' : '');
            // 드래그 핸들(≡) + 행 draggable/data-item-id. 자식(호텔) 행은 대상 아님.
            const handleCell = dragOk
                ? `<td style="text-align:center;"><span onclick="event.stopPropagation()" style="${HANDLE}" title="드래그하여 순서 변경">&#8801;</span></td>`
                : `<td></td>`;
            const dragAttr = dragOk ? ` draggable="true" data-item-id="${esc(row.payerType)}:${esc(row.payerId)}"` : '';
            html += `<tr${trStyle ? ` style="${trStyle}"` : ''}${clickAttr}${dragAttr}>
                ${handleCell}
                ${nameCell}
                ${startCell}
                ${endCell}
                ${bodyCells}
            </tr>`;

            // 자식(소속 호텔) 행 — 위탁사 행 펼침 시. 청구액만 참고 표시, 나머지 열 비움.
            if (isCompany && expanded) {
                // 미확정 행은 row.children이 없음 → 멤버 이름만, 청구액 빈칸.
                const kids = row.children || (row._members || []).map(h => ({ name: h.name, billed: null }));
                kids.forEach(kid => {
                    const amt = kid.billed == null ? '' : won(kid.billed);
                    html += `<tr style="background:var(--surface-1,#fbfcfe);">
                        <td></td>
                        <td style="text-align:left;"><span style="padding-left:28px; ${muted}">${esc(kid.name)}</span></td>
                        <td></td>
                        <td></td>
                        <td style="${moneyTd} ${muted}">${amt}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>`;
                });
            }
        });

        tbody.innerHTML = html;
        setSummary(sumBilled, sumPaid, sumUnpaid);
    }

    // ── 청구주기(일자) select + 저장 ─────────────────────
    // 일자만 저장 → 모든 달에 자동 적용(월별 구분 없음). title로 그 취지를 안내.
    function daySelect(prefix, key, value, payerType, payerId) {
        let opts = '<option value="">선택</option>';
        for (let d = 1; d <= 31; d++) {
            opts += `<option value="${d}"${Number(value) === d ? ' selected' : ''}>${d}</option>`;
        }
        // onclick stopPropagation: 위탁사 행의 select 조작이 행 펼치기 토글을 일으키지 않게.
        return `<select id="${prefix}-${key}" data-key="${esc(key)}" data-ptype="${esc(payerType)}" data-pid="${esc(payerId)}"`
            + ` onclick="event.stopPropagation()" onchange="window._hpSetCycle(this)" title="지정한 일자는 모든 달에 적용됩니다"`
            + ` style="padding:4px 6px; border:1px solid var(--border,#cbd5e1); border-radius:6px; font-size:12px; background:#fff;">${opts}</select>`;
    }

    // payment_payers 저장: 부분 유니크(hotel_id / company_id)라 onConflict upsert 대신
    // select → update-or-insert. 유니크 위반(동시 삽입) 시 재조회 후 update. sort_order 보존.
    async function saveCycle(payerType, payerId, sd, ed) {
        let q = window.mySupabase.from('payment_payers').select('id').eq('factory_id', currentFactoryId);
        q = (payerType === 'company') ? q.eq('company_id', payerId) : q.eq('hotel_id', payerId);
        const { data: existing, error: selErr } = await q.maybeSingle();
        if (selErr) throw selErr;

        if (existing) {
            const { error } = await window.mySupabase.from('payment_payers')
                .update({ start_day: sd, end_day: ed }).eq('id', existing.id);
            if (error) throw error;
            return;
        }

        const payload = { factory_id: currentFactoryId, start_day: sd, end_day: ed, sort_order: 0 };
        if (payerType === 'company') payload.company_id = payerId; else payload.hotel_id = payerId;
        const { error: insErr } = await window.mySupabase.from('payment_payers').insert([payload]);
        if (insErr) {
            // 유니크 위반 등 → 재조회 후 update
            let rq = window.mySupabase.from('payment_payers').select('id').eq('factory_id', currentFactoryId);
            rq = (payerType === 'company') ? rq.eq('company_id', payerId) : rq.eq('hotel_id', payerId);
            const { data: again } = await rq.maybeSingle();
            if (again) {
                const { error } = await window.mySupabase.from('payment_payers')
                    .update({ start_day: sd, end_day: ed }).eq('id', again.id);
                if (error) throw error;
            } else {
                throw insErr;
            }
        }
    }

    // select change 핸들러: 같은 행의 두 select 값을 함께 저장(부분 지정 허용).
    window._hpSetCycle = async function (sel) {
        const key = sel.dataset.key;
        const ptype = sel.dataset.ptype;
        const pid = sel.dataset.pid;
        const startSel = document.getElementById('hp-start-' + key);
        const endSel = document.getElementById('hp-end-' + key);
        // 값은 이벤트 시점에 동기 캡처(이후 refresh로 DOM이 교체돼도 안전)
        const sd = (startSel && startSel.value) ? Number(startSel.value) : null;
        const ed = (endSel && endSel.value) ? Number(endSel.value) : null;
        if (startSel) startSel.disabled = true;
        if (endSel) endSel.disabled = true;
        try {
            await saveCycle(ptype, pid, sd, ed);
            await refreshData(); // 그 행 재계산(기간·청구액·미수금) + 요약 3카드 갱신
        } catch (e) {
            console.warn('[hotel-payments] 청구주기 저장 실패', e);
            alert('청구주기 저장 실패: ' + (e.message || e));
            if (startSel) startSel.disabled = false;
            if (endSel) endSel.disabled = false;
        }
    };

    // ── 입금 CRUD (hotel_payments) ───────────────────────
    // 부분 유니크(hotel_id / company_id + year_month)라 onConflict upsert 대신
    // select → update-or-insert. 유니크 위반 시 재조회 후 update. year_month = 현재 ym(종료일 기준).
    async function savePayment(payerType, payerId, amount, paidAt) {
        const ym = getYm();
        let q = window.mySupabase.from('hotel_payments').select('id')
            .eq('factory_id', currentFactoryId).eq('year_month', ym);
        q = (payerType === 'company') ? q.eq('company_id', payerId) : q.eq('hotel_id', payerId);
        const { data: existing, error: selErr } = await q.maybeSingle();
        if (selErr) throw selErr;

        if (existing) {
            const { error } = await window.mySupabase.from('hotel_payments')
                .update({ paid_amount: amount, paid_at: paidAt }).eq('id', existing.id);
            if (error) throw error;
            return;
        }

        const payload = { factory_id: currentFactoryId, year_month: ym, paid_amount: amount, paid_at: paidAt };
        if (payerType === 'company') payload.company_id = payerId; else payload.hotel_id = payerId;
        const { error: insErr } = await window.mySupabase.from('hotel_payments').insert([payload]);
        if (insErr) {
            let rq = window.mySupabase.from('hotel_payments').select('id')
                .eq('factory_id', currentFactoryId).eq('year_month', ym);
            rq = (payerType === 'company') ? rq.eq('company_id', payerId) : rq.eq('hotel_id', payerId);
            const { data: again } = await rq.maybeSingle();
            if (again) {
                const { error } = await window.mySupabase.from('hotel_payments')
                    .update({ paid_amount: amount, paid_at: paidAt }).eq('id', again.id);
                if (error) throw error;
            } else {
                throw insErr;
            }
        }
    }

    function paidMap(payerType) {
        if (!_lastRender) return null;
        return payerType === 'company' ? _lastRender.paidByCompany : _lastRender.paidByHotel;
    }
    function rerenderFromCache() {
        if (_lastRender) renderRows(_lastRender.rows, _lastRender.paidByHotel, _lastRender.paidByCompany);
    }

    // 입금액 인라인 수정: 숫자만 파싱, 빈값/0 → 0(미입금). 저장 후 캐시 갱신 + 재렌더(요약 포함).
    window._hpSavePaid = async function (inp) {
        const ptype = inp.dataset.ptype, pid = inp.dataset.pid;
        const raw = String(inp.value).replace(/[^0-9]/g, '');
        const amount = raw ? Number(raw) : 0;
        const map = paidMap(ptype) || {};
        const existingAt = map[pid] ? map[pid].at : null;
        const paidAt = amount > 0 ? (existingAt || todayStr()) : null; // 금액 있으면 기존 날짜 유지, 없으면 오늘

        inp.disabled = true;
        try {
            await savePayment(ptype, pid, amount, paidAt);
            if (paidMap(ptype)) paidMap(ptype)[pid] = { amount: amount, at: paidAt };
            rerenderFromCache(); // 그 행 미수금·상태 + 요약 3카드 갱신(DB 재조회 없음)
        } catch (e) {
            console.warn('[hotel-payments] 입금액 저장 실패', e);
            alert('입금액 저장 실패: ' + (e.message || e));
            rerenderFromCache(); // 캐시는 미변경 → 이전 값으로 원복
        }
    };

    // 완료 체크: 체크 → 청구액만큼 입금 + 오늘 날짜, 해제 → 0 + 날짜 제거.
    window._hpToggleDone = async function (cb) {
        const ptype = cb.dataset.ptype, pid = cb.dataset.pid;
        const billed = Number(cb.dataset.billed || 0);
        const checked = cb.checked;
        const amount = checked ? billed : 0;
        const paidAt = checked ? todayStr() : null;

        cb.disabled = true;
        try {
            await savePayment(ptype, pid, amount, paidAt);
            if (paidMap(ptype)) paidMap(ptype)[pid] = { amount: amount, at: paidAt };
            rerenderFromCache();
        } catch (e) {
            console.warn('[hotel-payments] 완료 처리 저장 실패', e);
            alert('완료 처리 저장 실패: ' + (e.message || e));
            rerenderFromCache(); // 원복
        }
    };

    // 위탁사 행 펼치기/접기 — 재조회 없이 캐시로 재렌더(상태는 _expanded에 유지).
    window._hpToggleCompany = function (companyId) {
        if (_expanded.has(companyId)) _expanded.delete(companyId);
        else _expanded.add(companyId);
        if (_lastRender) renderRows(_lastRender.rows, _lastRender.paidByHotel, _lastRender.paidByCompany);
        else refreshData();
    };

    // ── 드래그 순서(payment_payers.sort_order) ────────────
    // initDragSort(item-name-update.js) 재사용. tbody는 persistent → 1회만 연결.
    let _dragInited = false;
    function initDrag() {
        if (_dragInited) return;
        if (typeof window.initDragSort !== 'function') return; // 노출 안 됐으면 스킵
        const tbody = document.getElementById('hp-list');
        if (!tbody) return;
        window.initDragSort(tbody, saveOrder);
        _dragInited = true;
    }

    // 'hotel:h_123' / 'company:uuid' → { payerType, payerId }
    function parseItemId(itemId) {
        const i = String(itemId).indexOf(':');
        return { payerType: itemId.substring(0, i), payerId: itemId.substring(i + 1) };
    }

    // 캐시 행 순서를 orderedIds에 맞게 재배열(즉시 반영용). 누락분은 뒤에 append.
    function reorderCache(orderedIds) {
        if (!_lastRender) return;
        const map = {};
        _lastRender.rows.forEach(r => { map[r.payerType + ':' + r.payerId] = r; });
        const next = [];
        orderedIds.forEach(id => { if (map[id]) next.push(map[id]); });
        _lastRender.rows.forEach(r => {
            if (orderedIds.indexOf(r.payerType + ':' + r.payerId) < 0) next.push(r);
        });
        _lastRender.rows = next;
    }

    // payment_payers.sort_order만 갱신(start_day/end_day 보존). select→update-or-insert.
    async function savePayerSort(payerType, payerId, sortOrder) {
        let q = window.mySupabase.from('payment_payers').select('id').eq('factory_id', currentFactoryId);
        q = (payerType === 'company') ? q.eq('company_id', payerId) : q.eq('hotel_id', payerId);
        const { data: existing, error: selErr } = await q.maybeSingle();
        if (selErr) throw selErr;
        if (existing) {
            const { error } = await window.mySupabase.from('payment_payers')
                .update({ sort_order: sortOrder }).eq('id', existing.id);
            if (error) throw error;
            return;
        }
        const payload = { factory_id: currentFactoryId, sort_order: sortOrder };
        if (payerType === 'company') payload.company_id = payerId; else payload.hotel_id = payerId;
        const { error: insErr } = await window.mySupabase.from('payment_payers').insert([payload]);
        if (insErr) {
            let rq = window.mySupabase.from('payment_payers').select('id').eq('factory_id', currentFactoryId);
            rq = (payerType === 'company') ? rq.eq('company_id', payerId) : rq.eq('hotel_id', payerId);
            const { data: again } = await rq.maybeSingle();
            if (again) {
                const { error } = await window.mySupabase.from('payment_payers')
                    .update({ sort_order: sortOrder }).eq('id', again.id);
                if (error) throw error;
            } else {
                throw insErr;
            }
        }
    }

    // drop 후 호출: 0-based 전체 재번호. 낙관적 즉시 반영 + 실패 시 alert(기존은 실패 무시였음).
    async function saveOrder(orderedIds) {
        reorderCache(orderedIds);   // 캐시 순서 갱신
        rerenderFromCache();        // 자식 행까지 올바른 순서로 즉시 재렌더
        try {
            await Promise.all(orderedIds.map((id, i) => {
                const p = parseItemId(id);
                return savePayerSort(p.payerType, p.payerId, i);
            }));
        } catch (e) {
            console.warn('[hotel-payments] 순서 저장 실패', e);
            alert('순서 저장 실패: ' + (e.message || e));
            refreshData(); // 실제 DB 순서로 재동기화
        }
    }

    function goMonth(delta) {
        setYm(shiftYm(getYm(), delta));
        refreshData();
    }
    window._hpGoMonth = goMonth;

    // ── 스캐폴드 1회 주입 ────────────────────────────────
    function ensureScaffold() {
        const panel = document.getElementById(PANEL_ID);
        if (!panel) return false;
        if (panel.dataset.hpReady === '1') return true; // 멱등 가드

        const cardStyle = 'flex:1; min-width:0; background:var(--surface,#fff); border:1px solid var(--border,#e2e8f0); border-radius:var(--radius,12px); padding:14px 16px;';
        const cardTitle = 'font-size:13px; color:var(--secondary,#64748b); margin-bottom:6px;';
        const cardValue = 'font-size:24px; font-weight:500;'; // 등폭은 ensureMoneyStyle의 <style> 규칙(#hp-sum-*)

        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin:14px 0 12px;">
                <h3 style="margin:0; font-size:15px;"><svg class="icon" aria-hidden="true"><use href="#i-banknote"/></svg> 입금확인</h3>
                <div style="display:flex; align-items:center; gap:8px; background:var(--surface,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:8px; padding:4px 6px;">
                    <button type="button" onclick="window._hpGoMonth(-1)" style="border:none; background:none; cursor:pointer; font-size:15px; padding:2px 8px; color:#334155;" aria-label="이전 달">&#9664;</button>
                    <span id="hp-ym-label" style="font-size:14px; font-weight:700; min-width:96px; text-align:center;"></span>
                    <button type="button" onclick="window._hpGoMonth(1)" style="border:none; background:none; cursor:pointer; font-size:15px; padding:2px 8px; color:#334155;" aria-label="다음 달">&#9654;</button>
                    <input type="hidden" id="${YM_ID}">
                </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-bottom:14px;">
                <div style="${cardStyle}">
                    <div style="${cardTitle}">청구 총액</div>
                    <div id="hp-sum-billed" style="${cardValue}">0원</div>
                </div>
                <div style="${cardStyle}">
                    <div style="${cardTitle}">입금 완료</div>
                    <div id="hp-sum-paid" style="${cardValue} color:var(--success,#16a34a);">0원</div>
                </div>
                <div style="${cardStyle} background:var(--bg-danger,#fef2f2); border-color:var(--danger,#fca5a5);">
                    <div style="${cardTitle} color:var(--danger,#dc2626);">미수금</div>
                    <div id="hp-sum-unpaid" style="${cardValue} color:var(--danger,#dc2626);">0원</div>
                </div>
            </div>

            <div class="chart-container">
                <div class="table-scroll-wrap">
                    <table id="hp-table" class="admin-table" style="min-width:720px; table-layout:fixed;">
                        <thead>
                            <tr>
                                <th style="width:5%; text-align:center;">순서</th>
                                <th style="width:22%; text-align:left;">거래처</th>
                                <th style="width:11%; text-align:center;">시작일</th>
                                <th style="width:11%; text-align:center;">종료일</th>
                                <th style="width:15%; text-align:right;">청구액</th>
                                <th style="width:14%; text-align:right;">입금액</th>
                                <th style="width:14%; text-align:right;">미수금</th>
                                <th style="width:8%; text-align:center;">완료</th>
                            </tr>
                        </thead>
                        <tbody id="hp-list">
                            <tr><td colspan="${COLSPAN}" style="text-align:center; padding:20px; color:var(--secondary,#64748b);">준비 중입니다.</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>`;

        panel.dataset.hpReady = '1';
        return true;
    }

    // ── 진입점: 탭 클릭 시 호출(index.html onclick) ──
    window.loadHotelPayments = function () {
        if (!ensureScaffold()) return;
        ensureMoneyStyle(); // 금액 등폭 <style> 1회 주입
        initDrag(); // persistent tbody에 DnD 1회 연결
        setYm(getYm()); // 기본 이번 달 + 라벨 동기화
        refreshData();
    };
})();
