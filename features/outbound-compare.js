// ============================================================
// outbound-compare.js — 출고·명세서 대조 + 명세서 확인(확정)
// 신규 기능: 2026-06-05
// 적용 대상: contract_type !== 'fixed' (단가제+특수거래처)
// 짝짓기: hotel_outbounds.invoice_id 기준 (2026-09-11, 월 내 순번 매칭 폐기)
// 특수거래처: category_name 섹션별 그룹핑
// ============================================================
(function () {
    // 현재 호텔 상태 캐시
    let _hId = null, _fId = null, _startDate = null, _tolerancePct = 5, _isSpecial = false;
    let _hName = '';

    // 월 누계 팝업 전용 월 (YYYY-MM). 섹션 월(#hotelInvoiceMonth)과 절대 공유하지 않는다.
    // 공유하면 팝업에서 월을 바꿀 때 뒤 화면과 버튼 이름이 따라 바뀐다(PRD 3-3 위반).
    // 열 때 섹션 월로 초기화하고, 닫으면 버린다.
    let _popupMonth = null;
    let _popupToken = 0;

    // KST(UTC+9) 기준 오늘 날짜 (YYYY-MM-DD)
    function _todayKST() {
        return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    }

    // Lucide 스프라이트 아이콘 헬퍼
    const ico = (name, lg) => `<svg class="icon${lg ? ' icon-lg' : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

    // ── 출고 대조 기능 사용 거래처 판정 — 이 판정의 단일 출처 ──
    // 정액제(fixed)는 수량이 금액에 영향을 주지 않아 대조 의미가 없다.
    // outbound-qty.js 등 다른 기능은 window._obCompareUtils.isOutboundEnabled 로 재사용한다.
    // 판정을 두 벌로 관리하지 말 것.
    function _isOutboundEnabled(hData) {
        return !!(hData && hData.use_outbound_input && hData.contract_type !== 'fixed');
    }

    // ── 진입점: loadHotelDashboard 끝에서 호출 ──────────────
    window.loadOutboundSection = async function (hData) {
        const section = document.getElementById('outboundCompareSection');
        if (!section) return;

        // 정액제는 대조 섹션 미표시 (_isOutboundEnabled 가 단일 판정)
        if (!_isOutboundEnabled(hData)) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        _hId = hData.id;
        _fId = hData.factory_id;
        _hName = hData.name || '';
        _startDate = hData.outbound_start_date || null;
        _tolerancePct = hData.outbound_tolerance_pct != null ? hData.outbound_tolerance_pct : 5;
        _isSpecial = hData.contract_type === 'special' || hData.hotel_type === 'special';

        await _render();
    };

    // 출고 N건의 품목 합계 — 한 명세서에 묶인 출고를 하나로 본다
    function _sumObItems(obs, obItemMap) {
        const sum = {};
        (obs || []).forEach(o => {
            Object.entries(obItemMap[o.id] || {}).forEach(([n, q]) => {
                sum[n] = (sum[n] || 0) + q;
            });
        });
        return sum;
    }

    // 섹션이 보고 있는 월 (YYYY-MM). #hotelInvoiceMonth 를 매번 새로 읽는다.
    // 모듈에 월 상태를 두지 않는다 — 팝업 전용 월과 섞이지 않게 하기 위함.
    function _sectionMonth() {
        const monthInput = document.getElementById('hotelInvoiceMonth');
        return (monthInput && monthInput.value) ? monthInput.value : new Date().toISOString().slice(0, 10).slice(0, 7);
    }

    // ── 월 데이터 조회 + 짝짓기 + 누계 ─────────────────────
    // 월(YYYY-MM)을 인자로 받는다. 섹션과 팝업이 서로 다른 월로 호출해도 안전하도록
    // 이 함수는 모듈의 월 상태를 일절 읽지 않는다.
    async function _loadMonthData(ym) {
        const month = ym;
        const [y, m] = month.split('-').map(Number);
        const monthStart = month + '-01';
        const lastDay = new Date(y, m, 0).getDate();
        const monthEnd = month + '-' + String(lastDay).padStart(2, '0');
        const today = _todayKST();

        // 1. 명세서 (outbound_start_date 이후, 차감 제외)
        const { data: rawInvs } = await window.mySupabase
            .from('invoices')
            .select('id, date, staff_name, confirmed_at, confirmed_by')
            .eq('hotel_id', _hId)
            .gte('date', monthStart)
            .lte('date', monthEnd)
            .order('date', { ascending: true });

        const invoices = (rawInvs || []).filter(inv => {
            if (inv.staff_name && inv.staff_name.startsWith('관리자(차감)')) return false;
            if (_startDate && inv.date < _startDate) return false;
            return true;
        });

        // 2. 명세서 품목
        const invItemMap = {}; // invoice_id → { name → qty }
        if (invoices.length > 0) {
            const { data: iItems } = await window.mySupabase
                .from('invoice_items')
                .select('invoice_id, name, qty')
                .in('invoice_id', invoices.map(i => i.id));
            (iItems || []).forEach(it => {
                if (!invItemMap[it.invoice_id]) invItemMap[it.invoice_id] = {};
                invItemMap[it.invoice_id][it.name] = (invItemMap[it.invoice_id][it.name] || 0) + Number(it.qty || 0);
            });
        }

        // 3. 출고 목록 — invoice_id 기준. 두 갈래로 나눠 가져온다.
        //  (a) 이번 달 명세서에 묶인 출고: 날짜 범위를 걸지 않는다.
        //      월말 출고가 다음 달 1일 명세서에 묶이는 경우를 날짜로 자르면 품목이 누락돼
        //      멀쩡한 건이 "확인 필요"로 뜬다. 명세서 기준으로만 모은다.
        //      (outbound-qty.js 의 수정 모드 조회와 같은 조건 — 작성 화면과 숫자가 일치해야 한다)
        //  (b) 아직 명세서가 붙지 않은 출고: 이번 달분만, 기능 시작일 이후. → "세탁 대기"
        let boundObs = [];
        if (invoices.length > 0) {
            const { data: rawBound } = await window.mySupabase
                .from('hotel_outbounds')
                .select('id, date, invoice_id')
                .eq('hotel_id', _hId)
                .in('invoice_id', invoices.map(i => i.id))
                .order('date', { ascending: true });
            boundObs = rawBound || [];
        }

        let pendingQ = window.mySupabase
            .from('hotel_outbounds')
            .select('id, date, invoice_id')
            .eq('hotel_id', _hId)
            .is('invoice_id', null)
            .gte('date', monthStart)
            .lte('date', monthEnd);
        if (_startDate) pendingQ = pendingQ.gte('date', _startDate);
        const { data: rawPending } = await pendingQ.order('date', { ascending: true });
        const pendingObs = rawPending || [];

        const outbounds = boundObs.concat(pendingObs);

        // 4. 출고 품목
        const obItemMap = {}; // outbound_id → { name → qty }
        if (outbounds.length > 0) {
            const { data: oItems } = await window.mySupabase
                .from('hotel_outbound_items')
                .select('outbound_id, item_name, qty')
                .in('outbound_id', outbounds.map(o => o.id));
            (oItems || []).forEach(it => {
                if (!obItemMap[it.outbound_id]) obItemMap[it.outbound_id] = {};
                obItemMap[it.outbound_id][it.item_name] = (obItemMap[it.outbound_id][it.item_name] || 0) + Number(it.qty || 0);
            });
        }

        // 5. 단가표 품목 (sort_order 순, category_name 포함)
        const { data: priceRows } = await window.mySupabase
            .from('hotel_item_prices')
            .select('name, unit, category_name')
            .eq('hotel_id', _hId)
            .eq('price_type', _isSpecial ? 'special' : 'general')
            .order('sort_order', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: true });
        const priceItems = priceRows || [];
        const itemNames = priceItems.map(p => p.name);

        // 6. 짝짓기 — hotel_outbounds.invoice_id 기준 (월 내 순번 매칭 폐기)
        //    순번 매칭은 휴무 주에 출고 2건 : 명세서 1건이 되면서 그 주부터 한 칸씩 밀렸다.
        //    이제 한 명세서에 출고 N건이 묶이는 것이 그대로 표현된다. 날짜 비교는 하지 않는다.
        const obsByInv = {};
        boundObs.forEach(o => {
            if (!obsByInv[o.invoice_id]) obsByInv[o.invoice_id] = [];
            obsByInv[o.invoice_id].push(o);
        });
        Object.keys(obsByInv).forEach(k => obsByInv[k].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)));

        const pairs = [];
        // 명세서 1건 = 행 1개. 묶인 출고가 없으면 "출고 미입력".
        invoices.forEach(inv => pairs.push({ obs: obsByInv[inv.id] || [], inv, sortKey: inv.date }));
        // 아직 명세서가 붙지 않은 출고 = "세탁 대기" 행
        pendingObs.forEach(ob => pairs.push({ obs: [ob], inv: null, sortKey: ob.date }));
        // 최신 날짜가 위로 (내림차순). 관리자 명세서 목록(app_v38.js:4739 date desc)과 같은 방향.
        // 2차 기준: 같은 날짜면 세탁 대기(명세서 없음)를 위에 둔다 — 목록 맨 위가
        // "아직 처리되지 않은 것"이 되도록. 명세서 유무는 2진값이고, 같은 날짜에
        // 명세서 2건·출고 2건은 각각 유니크 제약으로 생길 수 없어 이 두 단계로
        // 순서가 완전히 결정된다(정렬 안정성에 기대지 않는다).
        pairs.sort((a, b) => {
            if (a.sortKey !== b.sortKey) return a.sortKey < b.sortKey ? 1 : -1;
            return (a.inv ? 1 : 0) - (b.inv ? 1 : 0);
        });

        // 7. 월 누계 집계
        //    대조 완료 = "출고가 묶인 명세서". 그 명세서의 품목과 묶인 출고 전부를 더한다.
        //    세탁 대기(명세서 없음)와 출고 미입력(묶인 출고 없음)은 양쪽 모두 제외한다 —
        //    한쪽만 더하면 월 누계가 기울어 판정이 무의미해진다.
        //    (기존 "ob·inv 둘 다 있는 쌍만" 규칙과 같은 취지. 단위가 쌍 → 명세서로 바뀐 것)
        const monthlySummary = {}; // name → { ob: N, inv: N }
        itemNames.forEach(n => { monthlySummary[n] = { ob: 0, inv: 0 }; });
        let pendingObCount = 0;
        pairs.forEach(({ obs, inv }) => {
            if (inv && obs.length > 0) {
                Object.entries(_sumObItems(obs, obItemMap)).forEach(([n, q]) => {
                    if (!monthlySummary[n]) monthlySummary[n] = { ob: 0, inv: 0 };
                    monthlySummary[n].ob += q;
                });
                Object.entries(invItemMap[inv.id] || {}).forEach(([n, q]) => {
                    if (!monthlySummary[n]) monthlySummary[n] = { ob: 0, inv: 0 };
                    monthlySummary[n].inv += q;
                });
            } else if (!inv) {
                pendingObCount++;
            }
        });
        const completedCount = pairs.filter(({ obs, inv }) => inv && obs.length > 0).length;

        return { month, pairs, monthlySummary, invItemMap, obItemMap, priceItems, pendingObCount, completedCount };
    }

    // ── 렌더링 ─────────────────────────────────────────────
    // 섹션에는 일자별 내역만 남긴다. 월 누계는 팝업(태스크 3)으로 이동.
    async function _render() {
        if (!_hId) return; // loadOutboundSection을 거치지 않은 직접 호출 방어
        const section = document.getElementById('outboundCompareSection');
        if (!section) return;
        section.innerHTML = '<div style="padding:24px;text-align:center;color:#6b7280;">대조 데이터 로딩 중...</div>';

        const today = _todayKST();
        const data = await _loadMonthData(_sectionMonth());
        section.innerHTML = _buildHTML(data, today);
    }

    // ── 월 누계 대조표 HTML ─────────────────────────────────
    // 임의의 월을 그릴 수 있다. 팝업(태스크 3)이 이 함수를 월만 바꿔 호출한다.
    // 누계 계산은 _loadMonthData 하나뿐이라 섹션·팝업이 두 벌이 될 일이 없다.
    async function _buildSummaryHTML(ym) {
        const data = await _loadMonthData(ym);
        return _summaryHTML(data);
    }

    // data → 월 누계 표 HTML (동기). _loadMonthData 결과를 그대로 받는다.
    function _summaryHTML(data) {
        const { monthlySummary, priceItems, pendingObCount, completedCount } = data;
        const itemNames = priceItems.map(p => p.name);

        // 특수거래처: 카테고리별 그룹핑
        let monthlyRows = '';
        if (_isSpecial) {
            const grouped = {}, catOrder = [];
            priceItems.forEach(item => {
                const cat = item.category_name || '기타';
                if (!grouped[cat]) { grouped[cat] = []; catOrder.push(cat); }
                grouped[cat].push(item.name);
            });
            catOrder.forEach(cat => {
                monthlyRows += `<tr style="background:#f1f5f9;"><td colspan="5" style="font-weight:700;padding:5px 8px;font-size:12px;color:#475569;">${cat}</td></tr>`;
                grouped[cat].forEach(name => { monthlyRows += _monthlyRow(name, monthlySummary); });
            });
        } else {
            itemNames.forEach(name => { monthlyRows += _monthlyRow(name, monthlySummary); });
        }
        // 단가표에 없는 품목(명세서에만 있는 경우) 추가
        const extraNames = Object.keys(monthlySummary).filter(n => !itemNames.includes(n));
        extraNames.forEach(name => { monthlyRows += _monthlyRow(name, monthlySummary); });
        if (!monthlyRows) monthlyRows = `<tr><td colspan="5" style="text-align:center;color:gray;padding:16px;">이번 달 데이터 없음</td></tr>`;

        return `
        <div style="font-weight:600;font-size:13px;margin-bottom:8px;color:var(--primary,#3b82f6);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="ob-sum-label">${ico('bar-chart-2')} ${Number(data.month.slice(5, 7))}월 누계 대조</span>
            ${pendingObCount > 0 ? `<span style="background:#e0e7ff;color:#3730a3;border-radius:10px;padding:2px 8px;font-size:11px;font-weight:500;">세탁 대기 ${pendingObCount}건 (명세서 발행 전, 대조 제외)</span>` : ''}
        </div>
        ${completedCount === 0
            ? `<div style="background:#f1f5f9;border-radius:8px;padding:16px 20px;font-size:12px;color:#6b7280;text-align:center;">아직 대조할 명세서가 없습니다. 세탁이 완료되면 표시됩니다.</div>`
            : `<div class="table-scroll-wrap">
            <table class="admin-table" style="min-width:360px;">
                <thead><tr>
                    <th>품목</th>
                    <th style="text-align:right;white-space:nowrap;">거래처 출고</th>
                    <th style="text-align:right;white-space:nowrap;">공장 명세서</th>
                    <th style="text-align:right;">차이</th>
                    <th style="text-align:center;">판정</th>
                </tr></thead>
                <tbody>${monthlyRows}</tbody>
            </table>
        </div>`}`;
    }

    // ── 일자별 내역 HTML ────────────────────────────────────
    // data: _loadMonthData 결과. 섹션이 쓰는 본문.
    function _buildDailyHTML(data, today) {
        const { pairs, invItemMap, obItemMap, priceItems } = data;

        let dailyRows = '';
        const _dow = ['일','월','화','수','목','금','토'];
        const fmtD = d => { const [y,m,day] = d.split('-').map(Number); return `${y}.${String(m).padStart(2,'0')}.${String(day).padStart(2,'0')} (${_dow[new Date(y,m-1,day).getDay()]})`; };
        const dash = '<span style="color:#9ca3af;">—</span>';

        const fmtMD = d => { const p = String(d).split('-'); return p.length < 3 ? d : Number(p[1]) + '/' + Number(p[2]); };

        pairs.forEach(({ obs, inv }, idx) => {
            const rowId = 'obdetail_' + idx;
            const hasOb = obs.length > 0;
            const invDate = inv ? inv.date : null;

            // 판정 (명세서 + 묶인 출고가 모두 있을 때만)
            let verdictHtml = dash;
            if (hasOb && inv) {
                const obItems = _sumObItems(obs, obItemMap);
                const invItems = invItemMap[inv.id] || {};
                const allN = [...new Set([...Object.keys(obItems), ...Object.keys(invItems)])];
                const hasIssue = allN.some(n => !_diffCalc(obItems[n] || 0, invItems[n] || 0).isOk);
                verdictHtml = hasIssue
                    ? '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">확인 필요</span>'
                    : '<span style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">정상</span>';
            }

            // 세탁 대기 행(출고만 있고 명세서 없음): 행 전체 muted
            const isPending = hasOb && !inv;

            // 확인 칸 (확인 상태 + 관리 통합)
            let confirmCellHtml;
            if (!hasOb && (!invDate || invDate === today)) {
                const inputDate = invDate || today;
                confirmCellHtml = `<button onclick="event.stopPropagation();window.openOutboundInputModal('${inputDate}')" style="background:#ede9fe;color:#5b21b6;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;font-weight:600;">${ico('plus')} 출고 입력</button>`;
            } else {
                confirmCellHtml = _confirmCell(inv, today);
            }

            const detailHtml = _buildDetailTable(obs, inv, obItemMap, invItemMap, priceItems);

            // 일자 셀
            //  - 명세서 있음: 명세서 일자가 기준. 묶인 출고일은 작은 글씨로 함께 (여러 날일 수 있다)
            //  - 명세서 없음: 출고일 + "세탁 대기"
            let dateCellHtml;
            if (inv) {
                dateCellHtml = `<span style="font-size:12px;">${fmtD(invDate)}</span>`;
                if (hasOb) {
                    dateCellHtml += `<br><span style="font-size:11px;color:#6b7280;">출고 ${obs.map(o => fmtMD(o.date)).join(' · ')}</span>`;
                } else {
                    dateCellHtml += `<br><span style="font-size:11px;color:#ef4444;">출고 미입력</span>`;
                }
            } else if (hasOb) {
                dateCellHtml = `<span style="font-size:12px;">${fmtD(obs[0].date)}</span>`
                    + `<span style="font-size:11px;color:#9ca3af;"> · 세탁 대기</span>`;
            } else {
                dateCellHtml = dash;
            }

            // 출고/명세서 ✓ 여부 칸 (출고가 여러 건이면 건수 표기)
            const obCheckHtml = hasOb
                ? `<svg class="icon" aria-hidden="true" style="color:#059669;"><use href="#i-check"/></svg>`
                  + (obs.length > 1 ? `<span style="font-size:10px;color:#6b7280;"> ${obs.length}건</span>` : '')
                : dash;
            const invCheckHtml = inv ? `<svg class="icon" aria-hidden="true" style="color:#3b82f6;"><use href="#i-check"/></svg>` : dash;

            dailyRows += `
            <tr style="cursor:pointer;${isPending ? 'opacity:0.5;' : ''}" onclick="window._toggleObDetail('${rowId}')">
                <td style="font-size:12px;padding:6px 8px;white-space:nowrap;">${dateCellHtml}</td>
                <td style="text-align:center;">${obCheckHtml}</td>
                <td style="text-align:center;">${invCheckHtml}</td>
                <td style="text-align:center;">${verdictHtml}</td>
                <td style="text-align:center;">${confirmCellHtml}</td>
            </tr>
            <tr id="${rowId}" style="display:none;">
                <td colspan="5" style="padding:0;background:#f8fafc;">${detailHtml}</td>
            </tr>`;
        });

        return `
        <div style="font-weight:600;font-size:13px;margin-bottom:8px;color:var(--primary,#3b82f6);">
            ${ico('clipboard-list')} 일자별 내역 <span style="font-weight:400;font-size:11px;color:#6b7280;">(행 클릭 시 품목별 펼침)</span>
        </div>
        <div class="table-scroll-wrap">
            <table class="admin-table" style="min-width:500px;">
                <thead><tr>
                    <th>일자</th>
                    <th style="text-align:center;white-space:nowrap;">거래처 출고</th>
                    <th style="text-align:center;white-space:nowrap;">공장 명세서</th>
                    <th style="text-align:center;">판정</th>
                    <th style="text-align:center;">확인</th>
                </tr></thead>
                <tbody>${dailyRows || '<tr><td colspan="5" style="text-align:center;color:gray;padding:20px;">이번 달 대조 데이터 없음</td></tr>'}</tbody>
            </table>
        </div>`;
    }

    // ── 버튼 행 ─────────────────────────────────────────────
    // 버튼 행 자체는 월과 무관하게 항상 렌더한다 — 지난 달을 보고 있어도
    // 월 합계 버튼(태스크 2)이 보여야 하기 때문. 오늘 출고 버튼만 당월 조건을 탄다.
    // 안내 배지는 다음 줄로 내린다 — 폰 좁은 폭에서 버튼이 배지에 밀려 줄바꿈되지 않도록.
    function _buildButtonRow(data, today) {
        const { pairs, month } = data;

        // 오늘 출고 입력/수정 버튼 (당월만, KST 오전 5시~자정 활성)
        const todayOb = (function () {
            for (const p of pairs) {
                const hit = (p.obs || []).find(o => o.date === today);
                if (hit) return hit;
            }
            return null;
        })();
        const todayHasOb = !!todayOb;
        const isCurrentMonth = today.startsWith(month);
        // KST 시각 판정: 0~4시 비활성, 5~23시 활성
        const _kstHour = new Date(Date.now() + 9 * 3600000).getUTCHours();
        const isInputTime = _kstHour >= 5;

        // 날짜는 M/D 로 줄인다 — 전체 날짜(2026-09-11)면 버튼이 210px 이 되어
        // 320px 폰에서 합계 버튼과 합쳐 314px, 행(266px)을 48px 넘겨 밖으로 삐져나온다.
        // 같은 파일의 출고 날짜 표기(fmtMD)와 같은 형식이라 일관적이다.
        const _p = today.split('-');
        const todayMD = _p.length === 3 ? Number(_p[1]) + '/' + Number(_p[2]) : today;

        let btnHtml = '', noticeHtml = '';
        if (isCurrentMonth) {
            if (!isInputTime) {
                // 자정~오전 5시 비활성
                btnHtml = `<button disabled style="background:#e5e7eb;color:#9ca3af;border:none;border-radius:8px;padding:8px 14px;font-size:13px;cursor:not-allowed;font-weight:700;opacity:0.6;white-space:nowrap;">
                    ${ico(todayHasOb ? 'pencil' : 'plus')} 오늘 출고 ${todayHasOb ? '수정' : '입력'} (${todayMD})
                </button>`;
                noticeHtml = `<span style="display:inline-flex;align-items:center;gap:4px;background:#fee2e2;color:#991b1b;border-radius:20px;padding:4px 10px;font-size:11px;font-weight:600;">${ico('clock')} 현재는 입력 가능 시간이 아닙니다 (오전 5시부터 가능)</span>`;
            } else if (todayHasOb) {
                btnHtml = `<button onclick="window.openOutboundInputModal('${today}', '${todayOb.id}')" style="background:#059669;color:white;border:none;border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer;font-weight:700;white-space:nowrap;">
                    ${ico('pencil')} 오늘 출고 수정 (${todayMD})
                </button>`;
                noticeHtml = `<span style="display:inline-flex;align-items:center;gap:4px;background:#fef3c7;color:#92400e;border-radius:20px;padding:4px 10px;font-size:11px;font-weight:600;">${ico('clock')} 출고 입력은 오전 5시부터 자정까지 가능합니다.</span>`;
            } else {
                btnHtml = `<button onclick="window.openOutboundInputModal('${today}')" style="background:var(--primary,#3b82f6);color:white;border:none;border-radius:8px;padding:8px 14px;font-size:13px;cursor:pointer;font-weight:700;white-space:nowrap;">
                    ${ico('plus')} 오늘 출고 입력 (${todayMD})
                </button>`;
                noticeHtml = `<span style="display:inline-flex;align-items:center;gap:4px;background:#fef3c7;color:#92400e;border-radius:20px;padding:4px 10px;font-size:11px;font-weight:600;">${ico('clock')} 출고 입력은 오전 5시부터 자정까지 가능합니다.</span>`;
            }
        }

        // 월 합계 버튼 — 섹션의 현재 월 기준. 지난 달을 보고 있어도 항상 보인다.
        // margin-left:auto 로 행 오른쪽 끝에 붙인다(버튼이 하나뿐이어도 오른쪽 정렬).
        // 아이콘 없이 라벨만 — 320px 에서 "오늘 출고 수정 (9/11)" 과 한 행에 들어가야 한다.
        const sumBtnHtml = `<button onclick="window.openObSummaryModal()" style="margin-left:auto;background:#fff;color:#334155;border:1px solid #cbd5e1;border-radius:8px;padding:8px 12px;font-size:13px;cursor:pointer;font-weight:700;white-space:nowrap;">${Number(month.slice(5, 7))}월 합계</button>`;

        // 버튼 행은 월과 무관하게 항상 렌더한다(합계 버튼이 있으므로).
        const rowHtml = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:${noticeHtml ? '6px' : '12px'};">${btnHtml}${sumBtnHtml}</div>`;
        const noticeRowHtml = noticeHtml ? `<div style="margin-bottom:12px;">${noticeHtml}</div>` : '';
        return rowHtml + noticeRowHtml;
    }

    // ── 섹션 전체 조립 ──────────────────────────────────────
    // 순서: 헤더 → 버튼 행 → 일자별 내역. 월 누계는 팝업으로 이동했다.
    function _buildHTML(data, today) {
        return `
        <div class="chart-container" style="margin-top:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
                <div style="font-weight:700;font-size:15px;">${ico('arrow-right-left', true)} 출고·명세서 대조</div>
                <span style="font-size:11px;color:#6b7280;">허용 오차 ±${_tolerancePct}% | 기능 시작일: ${_startDate || '-'}</span>
            </div>
            ${_buildButtonRow(data, today)}
            ${_buildDailyHTML(data, today)}
        </div>`;
    }

    // ── 월 누계 행 ─────────────────────────────────────────
    function _monthlyRow(name, monthlySummary) {
        const s = monthlySummary[name] || { ob: 0, inv: 0 };
        const diff = s.inv - s.ob;
        const { diffHtml, statusHtml } = _diffDisplay(s.ob, s.inv, diff);
        return `<tr>
            <td>${name}</td>
            <td style="text-align:right;">${s.ob.toLocaleString()}</td>
            <td style="text-align:right;">${s.inv.toLocaleString()}</td>
            <td style="text-align:right;">${diffHtml}</td>
            <td style="text-align:center;">${statusHtml}</td>
        </tr>`;
    }

    // ── 일자별 품목 펼침 테이블 ────────────────────────────
    // obs: 이 명세서에 묶인 출고 목록(배열). 단일 객체·null 도 받아 준다.
    function _buildDetailTable(obs, inv, obItemMap, invItemMap, priceItems) {
        const obList = !obs ? [] : (Array.isArray(obs) ? obs : [obs]);
        const hasOb = obList.length > 0;
        const obItems = hasOb ? _sumObItems(obList, obItemMap) : {};
        const invItems = inv ? (invItemMap[inv.id] || {}) : {};
        const itemNames = priceItems.map(p => p.name);
        const allNames = [...new Set([...itemNames, ...Object.keys(obItems), ...Object.keys(invItems)])];
        if (allNames.length === 0) {
            return '<div style="padding:12px;text-align:center;color:#9ca3af;font-size:12px;">품목 데이터 없음</div>';
        }

        const detailDash = '<span style="color:#9ca3af;">—</span>';
        const buildRows = (names) => names.map(name => {
            if (!hasOb) {
                // 출고 미입력: 출고 칸 —, 명세서 숫자, 차이/판정 —
                const iq = invItems[name] || 0;
                return `<tr>
                    <td style="padding:5px 8px;">${name}</td>
                    <td style="text-align:right;padding:5px 8px;">${detailDash}</td>
                    <td style="text-align:right;padding:5px 8px;">${iq}</td>
                    <td style="text-align:right;padding:5px 8px;">${detailDash}</td>
                    <td style="text-align:center;padding:5px 8px;">${detailDash}</td>
                </tr>`;
            }
            if (!inv) {
                // 세탁 대기: 출고 숫자, 명세서 칸 —, 차이/판정 —
                const oq = obItems[name] || 0;
                return `<tr>
                    <td style="padding:5px 8px;">${name}</td>
                    <td style="text-align:right;padding:5px 8px;">${oq}</td>
                    <td style="text-align:right;padding:5px 8px;color:#9ca3af;">세탁 대기</td>
                    <td style="text-align:right;padding:5px 8px;">${detailDash}</td>
                    <td style="text-align:center;padding:5px 8px;">${detailDash}</td>
                </tr>`;
            }
            // 대조 완료: 양쪽 다 있음
            const oq = obItems[name] || 0;
            const iq = invItems[name] || 0;
            const diff = iq - oq;
            const { diffHtml, statusHtml } = _diffDisplay(oq, iq, diff);
            return `<tr>
                <td style="padding:5px 8px;">${name}</td>
                <td style="text-align:right;padding:5px 8px;">${oq}</td>
                <td style="text-align:right;padding:5px 8px;">${iq}</td>
                <td style="text-align:right;padding:5px 8px;">${diffHtml}</td>
                <td style="text-align:center;padding:5px 8px;">${statusHtml}</td>
            </tr>`;
        }).join('');

        let bodyHtml = '';
        if (_isSpecial) {
            const grouped = {}, catOrder = [];
            priceItems.forEach(item => {
                const cat = item.category_name || '기타';
                if (!grouped[cat]) { grouped[cat] = []; catOrder.push(cat); }
                if (allNames.includes(item.name)) grouped[cat].push(item.name);
            });
            // 단가표에 없는 품목
            const extra = allNames.filter(n => !priceItems.some(p => p.name === n));
            if (extra.length) { grouped['기타(미등록)'] = extra; catOrder.push('기타(미등록)'); }

            catOrder.forEach(cat => {
                if (!grouped[cat] || grouped[cat].length === 0) return;
                bodyHtml += `<tr style="background:#e8f0fe;"><td colspan="5" style="font-weight:700;padding:4px 8px;font-size:11px;color:#3730a3;">${cat}</td></tr>`;
                bodyHtml += buildRows(grouped[cat]);
            });
        } else {
            bodyHtml = buildRows(allNames);
        }

        return `<div style="padding:8px 16px 12px;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead><tr style="background:#f1f5f9;">
                    <th style="text-align:center;padding:5px 8px;">품목</th>
                    <th style="text-align:right;padding:5px 8px;white-space:nowrap;">거래처 출고</th>
                    <th style="text-align:right;padding:5px 8px;white-space:nowrap;">공장 명세서</th>
                    <th style="text-align:right;padding:5px 8px;">차이</th>
                    <th style="text-align:center;padding:5px 8px;">판정</th>
                </tr></thead>
                <tbody>${bodyHtml}</tbody>
            </table>
        </div>`;
    }

    // ── 차이 계산 ────────────────────────────────────────────
    function _diffCalc(obQty, invQty) {
        const diff = invQty - obQty;
        let isOk;
        if (obQty === 0) {
            isOk = diff === 0;
        } else {
            isOk = Math.abs(diff / obQty * 100) <= _tolerancePct;
        }
        return { diff, isOk };
    }

    function _diffDisplay(obQty, invQty, diff) {
        const sign = diff >= 0 ? '+' : '';
        const color = diff === 0 ? 'inherit' : (diff > 0 ? '#059669' : '#dc2626');
        let diffHtml, statusHtml;

        if (obQty === 0) {
            // 출고 0: % 생략, 부호+수량만
            diffHtml = `<span style="color:${color};">${sign}${diff}</span>`;
            const isOk = diff === 0;
            statusHtml = isOk
                ? '<span style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:10px;font-size:11px;">정상</span>'
                : '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">확인 필요</span>';
        } else {
            const pct = (diff / obQty * 100).toFixed(1);
            diffHtml = `<span style="color:${color};">${sign}${diff} (${pct}%)</span>`;
            const isOk = Math.abs(diff / obQty * 100) <= _tolerancePct;
            statusHtml = isOk
                ? '<span style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:10px;font-size:11px;">정상</span>'
                : '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">확인 필요</span>';
        }
        return { diffHtml, statusHtml };
    }

    // ── 확인 상태 계산 ────────────────────────────────────────
    function _confirmStatus(inv, today) {
        if (!inv) return { badgeHtml: '<span style="color:#9ca3af;">—</span>', showConfirmBtn: false };

        if (inv.confirmed_at) {
            const kst = new Date(new Date(inv.confirmed_at).getTime() + 9 * 3600000);
            const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(kst.getUTCDate()).padStart(2, '0');
            const hh = String(kst.getUTCHours()).padStart(2, '0');
            const mn = String(kst.getUTCMinutes()).padStart(2, '0');
            return {
                badgeHtml: `<span style="background:#d1fae5;color:#065f46;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:600;white-space:nowrap;">확인 완료 ${mm}.${dd} ${hh}:${mn}</span>`,
                showConfirmBtn: false
            };
        }

        const invDateObj = new Date(inv.date + 'T00:00:00');
        const deadlineObj = new Date(invDateObj);
        deadlineObj.setDate(deadlineObj.getDate() + 3);
        const todayObj = new Date(today + 'T00:00:00');

        if (todayObj >= deadlineObj) {
            const dm = String(deadlineObj.getMonth() + 1).padStart(2, '0');
            const dday = String(deadlineObj.getDate()).padStart(2, '0');
            return {
                badgeHtml: `<span style="background:#e5e7eb;color:#6b7280;padding:2px 7px;border-radius:10px;font-size:11px;white-space:nowrap;">자동 확정 ${dm}.${dday} 00:00</span>`,
                showConfirmBtn: false
            };
        }

        const diffDays = Math.ceil((deadlineObj - todayObj) / 86400000);
        return {
            badgeHtml: `<span style="background:#fef3c7;color:#92400e;padding:2px 7px;border-radius:10px;font-size:11px;white-space:nowrap;">확인 대기 D-${diffDays}</span>`,
            showConfirmBtn: true
        };
    }

    // ── 확인 칸 통합 HTML (목록 행 전용) ──────────────────────
    function _confirmCell(inv, today) {
        if (!inv) return '<span style="color:#9ca3af;">—</span>';

        if (inv.confirmed_at) {
            const kst = new Date(new Date(inv.confirmed_at).getTime() + 9 * 3600000);
            const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(kst.getUTCDate()).padStart(2, '0');
            const hh = String(kst.getUTCHours()).padStart(2, '0');
            const mn = String(kst.getUTCMinutes()).padStart(2, '0');
            return `<span style="font-size:11px;color:#065f46;font-weight:600;white-space:nowrap;">확인 완료 ${mm}.${dd} ${hh}:${mn}</span>`;
        }

        const invDateObj = new Date(inv.date + 'T00:00:00');
        const deadlineObj = new Date(invDateObj);
        deadlineObj.setDate(deadlineObj.getDate() + 3);
        const todayObj = new Date(today + 'T00:00:00');

        if (todayObj >= deadlineObj) {
            const dm = String(deadlineObj.getMonth() + 1).padStart(2, '0');
            const dday = String(deadlineObj.getDate()).padStart(2, '0');
            return `<span style="font-size:11px;color:#6b7280;white-space:nowrap;">자동 확정 ${dm}.${dday} 00:00</span>`;
        }

        const diffDays = Math.ceil((deadlineObj - todayObj) / 86400000);
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
            <button onclick="event.stopPropagation();window.confirmInvoice('${inv.id}')" style="background:var(--primary,#3b82f6);color:white;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;font-weight:600;">${ico('check')} 확인</button>
            <span style="font-size:10px;color:#92400e;white-space:nowrap;">D-${diffDays} 후 자동 확정</span>
        </div>`;
    }

    // ── 펼침/접힘 토글 ─────────────────────────────────────
    window._toggleObDetail = function (rowId) {
        const row = document.getElementById(rowId);
        if (!row) return;
        row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
    };

    // ── 출고 수량 입력 키보드 제어 (명세서 입력칸과 동일) ──
    window.handleObQtyKeydown = function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const allInputs = Array.from(document.querySelectorAll('.ob-qty-input'));
            const idx = allInputs.indexOf(e.target);
            if (allInputs[idx + 1]) {
                allInputs[idx + 1].focus();
                setTimeout(function () { allInputs[idx + 1].select(); }, 10);
            } else {
                const saveBtn = document.querySelector('#outboundInputModal .btn-ob-save');
                if (saveBtn) saveBtn.focus();
            }
        }
    };

    // ── 출고 입력/수정 모달 열기 ─────────────────────────
    // existingObId: 수정 모드일 때 기존 hotel_outbounds.id
    window.openOutboundInputModal = async function (date, existingObId) {
        const today = _todayKST();
        if (date < today) {
            alert('자정이 지나 마감되었습니다. 수정이 불가합니다.');
            return;
        }

        const { data: priceItems } = await window.mySupabase
            .from('hotel_item_prices')
            .select('name, unit, category_name')
            .eq('hotel_id', _hId)
            .eq('price_type', _isSpecial ? 'special' : 'general')
            .order('sort_order', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: true });

        // 수정 모드: 기존 수량 사전 로드
        const existingQtyMap = {};
        if (existingObId) {
            const { data: existingItems } = await window.mySupabase
                .from('hotel_outbound_items')
                .select('item_name, qty')
                .eq('outbound_id', existingObId);
            (existingItems || []).forEach(it => { existingQtyMap[it.item_name] = Number(it.qty) || 0; });
        }

        const isEditMode = !!existingObId;
        const titleEl = document.getElementById('outboundInputTitle');
        if (titleEl) titleEl.innerHTML = isEditMode
            ? `${ico('pencil')} 출고 수량 수정`
            : `${ico('package')} 출고 수량 입력`;

        const dateEl = document.getElementById('outboundInputDate');
        if (dateEl) dateEl.innerText = '출고일: ' + date;

        // 품목별 input 생성 (수정 모드 시 기존 수량 채움)
        const buildInput = (item) => {
            const val = existingQtyMap[item.name] !== undefined ? existingQtyMap[item.name] : 0;
            return `<input type="number" class="ob-qty-input" data-name="${item.name.replace(/"/g, '&quot;')}"
                value="${val}" min="0" style="width:70px;padding:4px;text-align:center;border:1px solid #cbd5e1;border-radius:4px;"
                onkeydown="window.handleObQtyKeydown(event)"
                onfocus="if(this.value==='0'){this.value='';}else{var t=this;setTimeout(function(){t.select();},10);}"
                onblur="if(this.value==='')this.value='0';">`;
        };

        const tbody = document.getElementById('outboundInputBody');
        if (tbody) {
            if (_isSpecial && priceItems && priceItems.length > 0) {
                const grouped = {}, catOrder = [];
                priceItems.forEach(item => {
                    const cat = item.category_name || '기타';
                    if (!grouped[cat]) { grouped[cat] = []; catOrder.push(cat); }
                    grouped[cat].push(item);
                });
                let html = '';
                catOrder.forEach(cat => {
                    html += `<tr style="background:#f1f5f9;"><td colspan="3" style="font-weight:700;padding:5px 8px;font-size:12px;">${cat}</td></tr>`;
                    grouped[cat].forEach(item => {
                        html += `<tr>
                            <td style="padding:5px 8px;">${item.name}</td>
                            <td style="padding:5px 8px;">${item.unit || '개'}</td>
                            <td style="padding:5px 8px;">${buildInput(item)}</td>
                        </tr>`;
                    });
                });
                tbody.innerHTML = html;
            } else {
                tbody.innerHTML = (priceItems || []).map(item => `
                    <tr>
                        <td style="padding:5px 8px;">${item.name}</td>
                        <td style="padding:5px 8px;">${item.unit || '개'}</td>
                        <td style="padding:5px 8px;">${buildInput(item)}</td>
                    </tr>`).join('');
            }
        }

        const modal = document.getElementById('outboundInputModal');
        if (modal) {
            modal.dataset.date = date;
            modal.dataset.existingObId = existingObId || '';
        }
        openModal('outboundInputModal');
    };

    // ── 출고 저장 (신규 INSERT / 당일 수정 UPDATE) ────────
    window.saveOutboundInput = async function () {
        const modal = document.getElementById('outboundInputModal');
        const date = modal && modal.dataset.date;
        const existingObId = modal && modal.dataset.existingObId;
        if (!date || !_hId || !_fId) return;

        // 자정 마감 재확인 (탭을 열어둔 채 자정 넘길 때 대비)
        if (date < _todayKST()) {
            alert('자정이 지나 마감되었습니다. 수정이 불가합니다.');
            return;
        }

        const inputs = modal.querySelectorAll('.ob-qty-input');
        const items = [];
        inputs.forEach(inp => {
            const qty = parseInt(inp.value, 10) || 0;
            if (qty > 0) items.push({ item_name: inp.dataset.name, qty });
        });

        if (items.length === 0) {
            alert('수량을 1개 이상 입력해주세요.');
            return;
        }

        if (existingObId) {
            // 수정 모드: 기존 품목 삭제 후 재입력
            const { error: delErr } = await window.mySupabase
                .from('hotel_outbound_items')
                .delete()
                .eq('outbound_id', existingObId);
            if (delErr) { alert('수정 실패: ' + delErr.message); return; }

            const { error: itemErr } = await window.mySupabase
                .from('hotel_outbound_items')
                .insert(items.map(it => ({ outbound_id: existingObId, item_name: it.item_name, qty: it.qty })));
            if (itemErr) { alert('품목 저장 실패: ' + itemErr.message); return; }
        } else {
            // 신규 입력
            const obId = 'ob_' + Date.now();
            const { error: obErr } = await window.mySupabase
                .from('hotel_outbounds')
                .insert([{ id: obId, hotel_id: _hId, factory_id: _fId, date }]);
            if (obErr) { alert('저장 실패: ' + obErr.message); return; }

            const { error: itemErr } = await window.mySupabase
                .from('hotel_outbound_items')
                .insert(items.map(it => ({ outbound_id: obId, item_name: it.item_name, qty: it.qty })));
            if (itemErr) { alert('품목 저장 실패: ' + itemErr.message); return; }
        }

        closeModal('outboundInputModal');
        await _render();
    };

    // ── 명세서 확인 ──────────────────────────────────────
    window.confirmInvoice = async function (invoiceId) {
        if (!currentHotelId) { alert('로그인 정보를 확인할 수 없습니다.'); return; }

        const { error } = await window.mySupabase
            .from('invoices')
            .update({
                confirmed_at: new Date().toISOString(),
                confirmed_by: currentHotelId
            })
            .eq('id', invoiceId);

        if (error) { alert('확인 처리 실패: ' + error.message); return; }
        await _render();
    };

    // ── admin 비교 기능을 위한 공유 유틸 노출 ────────────────
    // invoice-compare.js에서 재사용. 중복 구현 금지.
    window._obCompareUtils = {
        confirmStatus: _confirmStatus,
        // 출고 대조 사용 거래처 판정 — outbound-qty.js 가 재사용한다
        isOutboundEnabled: _isOutboundEnabled,
        // 허용 오차 판정 — 판정식의 단일 출처. outbound-qty.js 가 재사용한다.
        // _tolerancePct 를 임시 세팅 후 동기 호출하므로 안전(buildDetailTable 과 동일 패턴).
        diffCalc: function (obQty, invQty, tolerancePct) {
            const savedTol = _tolerancePct;
            _tolerancePct = tolerancePct != null ? tolerancePct : 5;
            const r = _diffCalc(obQty, invQty);
            _tolerancePct = savedTol;
            return r;
        },
        // tolerancePct·isSpecial을 임시 세팅 후 동기 호출하므로 안전
        buildDetailTable: function (ob, inv, obItemMap, invItemMap, priceItems, tolerancePct, isSpecial) {
            const savedTol = _tolerancePct, savedSpec = _isSpecial;
            _tolerancePct = tolerancePct != null ? tolerancePct : 5;
            _isSpecial = !!isSpecial;
            const html = _buildDetailTable(ob, inv, obItemMap, invItemMap, priceItems);
            _tolerancePct = savedTol;
            _isSpecial = savedSpec;
            return html;
        }
    };

    // ── 월 누계 팝업 ────────────────────────────────────────
    // YYYY-MM 에 delta 개월을 더한다
    function _shiftYm(ym, delta) {
        const [y, m] = ym.split('-').map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }

    // 미래 월 차단 기준: KST 오늘의 월.
    // 출고는 당일만 입력 가능하고(소급·미래 입력 경로 없음) 명세서도 미래 발행이 없으므로
    // 다음 달 이후는 구조적으로 항상 비어 있다. 빈 표를 보여주는 대신 ▶ 를 비활성한다.
    function _currentYm() {
        return _todayKST().slice(0, 7);
    }

    window.openObSummaryModal = async function () {
        if (!document.getElementById('obSummaryModal')) return;
        _popupMonth = _sectionMonth();          // 열 때마다 섹션 월로 초기화
        openModal('obSummaryModal');
        await _renderSummaryModal();
    };

    // 월 이동. 섹션은 건드리지 않는다.
    window.obSummaryShiftMonth = async function (delta) {
        if (!_popupMonth) return;
        const next = _shiftYm(_popupMonth, delta);
        if (delta > 0 && next > _currentYm()) return;   // 미래 월 차단
        _popupMonth = next;
        await _renderSummaryModal();
    };

    window.closeObSummaryModal = function () {
        closeModal('obSummaryModal');
        _popupMonth = null;                     // 닫으면 버린다
    };

    async function _renderSummaryModal() {
        const ym = _popupMonth;
        const titleEl = document.getElementById('obSummaryTitle');
        const navEl = document.getElementById('obSummaryNav');
        const bodyEl = document.getElementById('obSummaryBody');
        if (!titleEl || !navEl || !bodyEl) return;

        const [y, m] = ym.split('-').map(Number);
        titleEl.textContent = `${_hName ? _hName + ' · ' : ''}${y}년 ${m}월 누계`;

        // ◀ ▶ — app_v38.js:614 페이징 버튼 스타일 재사용
        const navBtn = (disabled) => `padding:6px 12px;border-radius:6px;border:1px solid #cbd5e1;cursor:${disabled ? 'not-allowed' : 'pointer'};font-size:13px;background:white;color:#334155;opacity:${disabled ? '0.4' : '1'};`;
        const nextDisabled = _shiftYm(ym, 1) > _currentYm();
        navEl.innerHTML = `
            <button onclick="window.obSummaryShiftMonth(-1)" style="${navBtn(false)}">◀</button>
            <span style="font-size:13px;font-weight:700;color:#334155;min-width:76px;text-align:center;">${ym}</span>
            <button onclick="window.obSummaryShiftMonth(1)" ${nextDisabled ? 'disabled' : ''} style="${navBtn(nextDisabled)}">▶</button>
            <button onclick="window.printObSummary()" style="margin-left:auto;background:var(--primary,#3b82f6);color:white;border:none;border-radius:8px;padding:7px 14px;font-size:13px;cursor:pointer;font-weight:700;white-space:nowrap;">${ico('printer')} 인쇄</button>`;

        // 조회가 비동기라 로딩 표시가 필요하다
        bodyEl.innerHTML = '<div style="padding:24px;text-align:center;color:#6b7280;font-size:13px;">불러오는 중...</div>';

        const myToken = ++_popupToken;
        let html;
        try {
            const data = await _loadMonthData(ym);
            html = _summaryHTML(data);
        } catch (e) {
            console.error('[outbound-compare] 월 누계 조회 실패:', e);
            html = '<div style="padding:20px;text-align:center;color:#991b1b;font-size:13px;">데이터를 불러오지 못했습니다.</div>';
        }
        if (myToken !== _popupToken) return;     // 더 최근 이동이 있었다면 폐기
        if (_popupMonth !== ym) return;          // 그 사이 월이 바뀌었으면 폐기
        bodyEl.innerHTML = html;
    }

    // ── 월 누계 인쇄 ────────────────────────────────────────
    // 전용 경로다. window.printReport 는 건드리지 않는다 —
    // 그쪽 인쇄 CSS 는 th:nth-child(2)(3)(4) 로 열 위치에 묶여 있고 기존 호출처가 4곳이다.
    // 창 열기·@page·500ms 후 print/close 라는 print-fix.js 의 검증된 뼈대만 따른다.
    window.printObSummary = function () {
        const ym = _popupMonth;                       // 인쇄 시점의 팝업 월
        const bodyEl = document.getElementById('obSummaryBody');
        if (!ym || !bodyEl) return;

        // window.open 은 클릭 핸들러에서 동기로 불러야 팝업 차단에 걸리지 않는다.
        // 그래서 재조회하지 않고 화면에 그려진 것을 그대로 복제한다.
        const clone = bodyEl.cloneNode(true);
        clone.querySelectorAll('button, .no-print').forEach(n => n.remove());
        // 스프라이트 아이콘(<use href="#i-...">)은 인쇄 창에 원본이 없어 빈 칸으로 남는다
        clone.querySelectorAll('svg').forEach(n => n.remove());

        const [y, m] = ym.split('-').map(Number);
        const printedAt = _todayKST();

        const win = window.open('', '_blank', 'width=800,height=600');
        if (!win) { alert('팝업 차단을 해제해주세요.'); return; }

        win.document.write(`
        <html>
        <head>
            <title>${_hName || '거래처'} ${y}년 ${m}월 출고 누계</title>
            <style>
                @page { size: A4 portrait; margin: 8mm; }

                /* 판정 배지 배경색이 인쇄에 나와야 정상/확인 필요가 구분된다.
                   이게 빠지면 브라우저가 배경을 생략해 이 인쇄물의 의미가 사라진다.
                   구형 대응으로 -webkit- 접두사도 함께 둔다. */
                * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }

                body { font-family: 'Malgun Gothic', sans-serif; padding: 0; margin: 0; color: #0f172a; }

                .ob-print-head { border-bottom: 2px solid #334155; padding-bottom: 6px; margin-bottom: 10px; }
                .ob-print-title { font-size: 16px; font-weight: 700; }
                .ob-print-meta { font-size: 11px; color: #475569; margin-top: 4px; }

                /* 팝업 안의 "N월 누계 대조" 제목은 머리말과 겹치므로 숨긴다.
                   같은 줄의 "세탁 대기 N건" 배지는 남는다. */
                .ob-sum-label { display: none; }

                table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                th, td { border: 1px solid #cbd5e1; padding: 5px 8px; font-size: 12px; }
                th { background: #f1f5f9; font-weight: 700; }

                /* 5열 정렬 — 품목 좌, 출고·명세서·차이 우, 판정 중앙 */
                th:nth-child(1), td:nth-child(1) { text-align: left; }
                th:nth-child(2), td:nth-child(2),
                th:nth-child(3), td:nth-child(3),
                th:nth-child(4), td:nth-child(4) { text-align: right; }
                th:nth-child(5), td:nth-child(5) { text-align: center; }

                /* 특수거래처 카테고리 그룹 행 (colspan) — 전체 폭이므로 좌측 고정 */
                td[colspan] { text-align: left !important; font-weight: 700; background: #f1f5f9 !important; }

                /* A4 를 넘치면 2페이지로 이어지고, 머리 행이 각 페이지에 반복된다 */
                thead { display: table-header-group; }
                tr { page-break-inside: avoid; }
            </style>
        </head>
        <body>
            <div class="ob-print-head">
                <div class="ob-print-title">${_hName || '거래처'} · ${y}년 ${m}월 출고 누계</div>
                <div class="ob-print-meta">출력일: ${printedAt} &nbsp;|&nbsp; 허용 오차 ±${_tolerancePct}%${_startDate ? ' &nbsp;|&nbsp; 기능 시작일: ' + _startDate : ''}</div>
            </div>
            ${clone.innerHTML}
        </body>
        </html>`);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 500);
    };

    // 내부 함수 노출 (테스트·후속 태스크용). outbound-qty.js 의 _obQtyInternals 와 동일한 방식.
    window._obCompareInternals = {
        loadMonthData: _loadMonthData,
        buildSummaryHTML: _buildSummaryHTML,
        buildDailyHTML: _buildDailyHTML,
        buildButtonRow: _buildButtonRow,
        sectionMonth: _sectionMonth,
        popupMonth: function () { return _popupMonth; },
        shiftYm: _shiftYm,
        currentYm: _currentYm
    };

    // ── 월 누계 팝업 DOM 초기화 (body에 한 번만 추가) ─────
    (function _initSummaryModal() {
        if (document.getElementById('obSummaryModal')) return;
        const modal = document.createElement('div');
        modal.id = 'obSummaryModal';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display:none;align-items:center;justify-content:center;z-index:1002;';
        modal.innerHTML = `
        <div class="modal-content" style="width:560px;max-width:95vw;padding:24px;border-radius:12px;position:relative;max-height:88vh;overflow-y:auto;">
            <button onclick="window.closeObSummaryModal()" style="position:absolute;right:14px;top:14px;border:none;background:none;font-size:22px;cursor:pointer;color:#6b7280;">×</button>
            <h3 id="obSummaryTitle" style="margin:0 0 14px 0;font-size:15px;font-weight:700;padding-right:28px;color:var(--primary,#3b82f6);"></h3>
            <div id="obSummaryNav" style="display:flex;align-items:center;gap:6px;margin-bottom:14px;flex-wrap:wrap;"></div>
            <div id="obSummaryBody"></div>
        </div>`;
        document.body.appendChild(modal);
    })();

    // ── 출고 입력 모달 DOM 초기화 (body에 한 번만 추가) ───
    (function _initModal() {
        if (document.getElementById('outboundInputModal')) return;
        const modal = document.createElement('div');
        modal.id = 'outboundInputModal';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display:none;align-items:center;justify-content:center;z-index:1002;';
        modal.innerHTML = `
        <div class="modal-content" style="width:480px;max-width:95vw;padding:24px;border-radius:12px;position:relative;max-height:88vh;overflow-y:auto;">
            <button onclick="closeModal('outboundInputModal')" style="position:absolute;right:14px;top:14px;border:none;background:none;font-size:22px;cursor:pointer;color:#6b7280;">×</button>
            <h3 id="outboundInputTitle" style="margin:0 0 4px 0;font-size:16px;display:flex;align-items:center;gap:6px;"><svg class="icon icon-lg" aria-hidden="true"><use href="#i-package"/></svg> 출고 수량 입력</h3>
            <div id="outboundInputDate" style="font-size:12px;color:#6b7280;margin-bottom:6px;"></div>
            <div style="background:#fef3c7;color:#92400e;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:500;margin-bottom:12px;display:flex;align-items:center;gap:5px;"><svg class="icon" aria-hidden="true"><use href="#i-clock"/></svg> 오늘 출고분은 자정(24:00)까지 입력할 수 있습니다. 자정 이후에는 입력이 불가합니다.</div>
            <div class="table-scroll-wrap">
                <table class="admin-table" style="min-width:280px;">
                    <thead><tr><th>품목</th><th>단위</th><th>출고 수량</th></tr></thead>
                    <tbody id="outboundInputBody"></tbody>
                </table>
            </div>
            <button onclick="window.saveOutboundInput()" class="btn-ob-save" style="background:var(--primary,#3b82f6);color:white;border:none;border-radius:8px;padding:12px;width:100%;font-size:14px;cursor:pointer;font-weight:700;margin-top:16px;">저장</button>
        </div>`;
        document.body.appendChild(modal);
    })();

})();
