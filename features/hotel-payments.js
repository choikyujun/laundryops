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
    const MONO = 'font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace; font-variant-numeric: tabular-nums;';

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
                    .eq('factory_id', currentFactoryId).order('name', { ascending: true }),
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

                const hasUnit = r.members.some(h => h.contract_type !== 'fixed');
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

                if (!period) {
                    row.state = 'no-cycle';           // 주기 미설정 → 청구액 빈칸
                    rows.push(row);
                    return;
                }

                // 집계 시점: 단가제 포함 행은 오늘>종료일이어야 집계. 정액제만 있으면 항상.
                const collectible = hasUnit ? (today > period.end) : true;
                if (!collectible) {
                    row.state = 'pending';            // 종료일 이후 집계 → 지금은 빈칸
                    rows.push(row);
                    return;
                }

                // 공급가 합: 단가제=기간 명세서 합(invoices), 정액제=fixed_amount(ym>=created월)
                row._fixedSupply = 0;
                r.members.forEach(h => {
                    if (h.contract_type === 'fixed') {
                        const createdMonth = h.created_at ? String(h.created_at).substring(0, 7) : '2000-01';
                        row._fixedSupply += (ym >= createdMonth) ? Number(h.fixed_amount || 0) : 0;
                    } else {
                        windowByHotel[h.id] = { start: period.start, end: period.end };
                    }
                });
                row._unitHotelIds = r.members.filter(h => h.contract_type !== 'fixed').map(h => h.id);
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

            // 5) 행 청구액 확정: supplySum = 정액분 + 단가분, 청구액 = supplySum + floor(×0.1)
            rows.forEach(row => {
                if (row.state !== 'ok') return;
                let supplySum = row._fixedSupply || 0;
                (row._unitHotelIds || []).forEach(hid => { supplySum += Number(supplyByHotel[hid] || 0); });
                row.billed = supplySum + Math.floor(supplySum * 0.1);
            });

            // 6) 정렬: sort_order(태스크 7 드래그) 우선, 없으면 이름 가나다순(거래처 탭 기준)
            rows.sort((a, b) => {
                if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
                return String(a.name).localeCompare(String(b.name), 'ko');
            });

            if (seq !== _reqSeq) return;
            renderRows(rows, paidByHotel, paidByCompany);

        } catch (e) {
            if (seq !== _reqSeq) return;
            console.warn('[hotel-payments] 조회 오류', e);
            tbody.innerHTML = `<tr><td colspan="${COLSPAN}" style="text-align:center; padding:20px; color:var(--danger,#dc2626);">조회 오류: ${esc(e.message || e)}</td></tr>`;
            setSummary(0, 0, 0);
        }
    }

    // ── 라벨(거래처 셀) ──
    const TAG = {
        direct: 'background:var(--surface,#f1f5f9); color:var(--secondary,#64748b);',
        unassigned: 'background:#fef3c7; color:#92400e;'
    };
    function labelCell(row) {
        if (row.labelKind === 'company') {
            return `<strong>위탁·${esc(row.name)}</strong>`;
        }
        if (row.labelKind === 'unassigned') {
            return `<strong>${esc(row.name)}</strong> <span style="display:inline-block; font-size:11px; padding:1px 5px; border-radius:4px; ${TAG.unassigned}">위탁사 미지정</span>`;
        }
        return `<strong>${esc(row.name)}</strong> <span style="display:inline-block; font-size:11px; padding:1px 5px; border-radius:4px; ${TAG.direct}">직영</span>`;
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

        const moneyTd = 'text-align:right; ' + MONO;
        const muted = 'color:var(--secondary,#94a3b8);';
        let sumBilled = 0, sumPaid = 0, sumUnpaid = 0;
        let html = '';

        rows.forEach(row => {
            const payInfo = row.payerType === 'company' ? paidByCompany[row.payerId] : paidByHotel[row.payerId];
            const paid = payInfo ? Number(payInfo.amount || 0) : 0;

            // 시작일·종료일 = 일자 select(1~31). 값 변경 즉시 저장 후 재계산.
            const key = row.payerType + '-' + row.payerId;
            const periodText = (row.startDate && row.endDate) ? (mmdd(row.startDate) + ' ~ ' + mmdd(row.endDate)) : '';
            const startCell = `<td style="text-align:center;">${daySelect('hp-start', key, row.startDay, row.payerType, row.payerId)}</td>`;
            const endCell = `<td style="text-align:center;">${daySelect('hp-end', key, row.endDay, row.payerType, row.payerId)}` +
                (periodText ? `<div style="font-size:10px; ${muted} margin-top:3px; ${MONO}">${periodText}</div>` : '') + `</td>`;

            // 미확정 행(주기 미설정 / 집계 전): 청구액 빈칸, 요약 제외. 입금액은 있으면 보존 표시.
            if (row.state !== 'ok') {
                const billedText = row.state === 'no-cycle' ? '기간 미설정' : '집계 전';
                html += `<tr>
                    <td style="text-align:center; ${muted}"></td>
                    <td style="text-align:left; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${labelCell(row)}</td>
                    ${startCell}
                    ${endCell}
                    <td style="${moneyTd} ${muted}">${billedText}</td>
                    <td style="${moneyTd} ${muted}">${payInfo ? won(paid) : '-'}</td>
                    <td style="${moneyTd} ${muted}">-</td>
                    <td style="text-align:center; ${muted}">-</td>
                </tr>`;
                return;
            }

            const billed = Number(row.billed || 0);
            const unpaid = Math.max(billed - paid, 0);

            // 요약은 목록 합계와 일치: 입금완료 = min(paid,billed), 미수금 = max(billed-paid,0)
            sumBilled += billed;
            sumPaid += Math.min(paid, billed);
            sumUnpaid += unpaid;

            let rowStyle = '';
            let paidCell, unpaidCell, doneCell;
            if (!payInfo || paid <= 0) {
                paidCell = `<td style="${moneyTd} ${muted}">-</td>`;
                unpaidCell = `<td style="${moneyTd} color:var(--danger,#dc2626);">${won(unpaid)}</td>`;
                doneCell = `<td style="text-align:center; color:var(--secondary,#cbd5e1);">-</td>`;
            } else if (paid < billed) {
                rowStyle = ' style="background:var(--bg-danger,#fef2f2);"';
                paidCell = `<td style="${moneyTd}">${won(paid)}</td>`;
                unpaidCell = `<td style="${moneyTd} color:var(--danger,#dc2626); font-weight:700;">${won(unpaid)}</td>`;
                doneCell = `<td style="text-align:center; color:var(--secondary,#cbd5e1);">-</td>`;
            } else {
                paidCell = `<td style="${moneyTd} color:var(--success,#16a34a);">${won(paid)}</td>`;
                unpaidCell = `<td style="${moneyTd} ${muted}">0원</td>`;
                doneCell = `<td style="text-align:center; color:var(--success,#16a34a);"><svg class="icon" aria-hidden="true"><use href="#i-check-circle"/></svg></td>`;
            }

            html += `<tr${rowStyle}>
                <td style="text-align:center; color:var(--secondary,#cbd5e1);"></td>
                <td style="text-align:left; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${labelCell(row)}</td>
                ${startCell}
                ${endCell}
                <td style="${moneyTd}">${won(billed)}</td>
                ${paidCell}
                ${unpaidCell}
                ${doneCell}
            </tr>`;
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
        return `<select id="${prefix}-${key}" data-key="${esc(key)}" data-ptype="${esc(payerType)}" data-pid="${esc(payerId)}"`
            + ` onchange="window._hpSetCycle(this)" title="지정한 일자는 모든 달에 적용됩니다"`
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
        const cardValue = 'font-size:24px; font-weight:500; ' + MONO;

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
                    <table class="admin-table" style="min-width:720px; table-layout:fixed;">
                        <thead>
                            <tr>
                                <th style="width:5%;"></th>
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
        setYm(getYm()); // 기본 이번 달 + 라벨 동기화
        refreshData();
    };
})();
