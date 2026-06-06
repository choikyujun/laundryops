// ============================================================
// outbound-compare.js — 출고·명세서 대조 + 명세서 확인(확정)
// 신규 기능: 2026-06-05
// 적용 대상: contract_type !== 'fixed' (단가제+특수거래처)
// 특수거래처: category_name 섹션별 그룹핑
// ============================================================
(function () {
    // 현재 호텔 상태 캐시
    let _hId = null, _fId = null, _startDate = null, _tolerancePct = 5, _isSpecial = false;

    // KST(UTC+9) 기준 오늘 날짜 (YYYY-MM-DD)
    function _todayKST() {
        return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    }

    // Lucide 스프라이트 아이콘 헬퍼
    const ico = (name, lg) => `<svg class="icon${lg ? ' icon-lg' : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

    // ── 진입점: loadHotelDashboard 끝에서 호출 ──────────────
    window.loadOutboundSection = async function (hData) {
        const section = document.getElementById('outboundCompareSection');
        if (!section) return;

        // 정액제는 대조 섹션 미표시
        if (!hData.use_outbound_input || hData.contract_type === 'fixed') {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        _hId = hData.id;
        _fId = hData.factory_id;
        _startDate = hData.outbound_start_date || null;
        _tolerancePct = hData.outbound_tolerance_pct != null ? hData.outbound_tolerance_pct : 5;
        _isSpecial = hData.contract_type === 'special' || hData.hotel_type === 'special';

        await _render();
    };

    // ── 렌더링 ─────────────────────────────────────────────
    async function _render() {
        if (!_hId) return; // loadOutboundSection을 거치지 않은 직접 호출 방어
        const section = document.getElementById('outboundCompareSection');
        if (!section) return;
        section.innerHTML = '<div style="padding:24px;text-align:center;color:#6b7280;">대조 데이터 로딩 중...</div>';

        const monthInput = document.getElementById('hotelInvoiceMonth');
        const month = (monthInput && monthInput.value) ? monthInput.value : new Date().toISOString().slice(0, 7);
        const [y, m] = month.split('-').map(Number);
        const monthStart = month + '-01';
        const lastDay = new Date(y, m, 0).getDate();
        const monthEnd = month + '-' + String(lastDay).padStart(2, '0');
        const today = _todayKST();

        // 1. 명세서 (outbound_start_date 이후, 차감 제외)
        const { data: rawInvs } = await window.mySupabase
            .from('invoices')
            .select('id, date, confirmed_at, confirmed_by')
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

        // 3. 출고 목록
        const { data: rawObs } = await window.mySupabase
            .from('hotel_outbounds')
            .select('id, date')
            .eq('hotel_id', _hId)
            .gte('date', monthStart)
            .lte('date', monthEnd)
            .order('date', { ascending: true });
        const outbounds = rawObs || [];

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

        // 6. N번째 출고 ↔ N번째 명세서 매칭 (순서 기반)
        const maxLen = Math.max(outbounds.length, invoices.length);
        const pairs = [];
        for (let i = 0; i < maxLen; i++) {
            pairs.push({ ob: outbounds[i] || null, inv: invoices[i] || null });
        }

        // 7. 월 누계 집계 (대조 완료 건만: ob + inv 둘 다 있는 건)
        const monthlySummary = {}; // name → { ob: N, inv: N }
        itemNames.forEach(n => { monthlySummary[n] = { ob: 0, inv: 0 }; });
        let pendingObCount = 0;
        pairs.forEach(({ ob, inv }) => {
            if (ob && inv) {
                Object.entries(obItemMap[ob.id] || {}).forEach(([n, q]) => {
                    if (!monthlySummary[n]) monthlySummary[n] = { ob: 0, inv: 0 };
                    monthlySummary[n].ob += q;
                });
                Object.entries(invItemMap[inv.id] || {}).forEach(([n, q]) => {
                    if (!monthlySummary[n]) monthlySummary[n] = { ob: 0, inv: 0 };
                    monthlySummary[n].inv += q;
                });
            } else if (ob && !inv) {
                pendingObCount++;
            }
        });
        const completedCount = pairs.filter(({ ob, inv }) => ob && inv).length;

        section.innerHTML = _buildHTML(month, today, pairs, monthlySummary, invItemMap, obItemMap, priceItems, pendingObCount, completedCount);
    }

    // ── HTML 조립 ───────────────────────────────────────────
    function _buildHTML(month, today, pairs, monthlySummary, invItemMap, obItemMap, priceItems, pendingObCount, completedCount) {
        const itemNames = priceItems.map(p => p.name);

        // ── 월 누계 대조 테이블 ─────────────
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

        // ── 일자별 내역 ──────────────────────
        let dailyRows = '';
        const _dow = ['일','월','화','수','목','금','토'];
        const fmtD = d => { const [y,m,day] = d.split('-').map(Number); return `${y}.${String(m).padStart(2,'0')}.${String(day).padStart(2,'0')} (${_dow[new Date(y,m-1,day).getDay()]})`; };
        const dash = '<span style="color:#9ca3af;">—</span>';

        pairs.forEach(({ ob, inv }, idx) => {
            const rowId = 'obdetail_' + idx;
            const obDate = ob ? ob.date : null;
            const invDate = inv ? inv.date : null;

            // 판정 (양쪽 모두 있을 때만)
            let verdictHtml = dash;
            if (ob && inv) {
                const obItems = obItemMap[ob.id] || {};
                const invItems = invItemMap[inv.id] || {};
                const allN = [...new Set([...Object.keys(obItems), ...Object.keys(invItems)])];
                const hasIssue = allN.some(n => !_diffCalc(obItems[n] || 0, invItems[n] || 0).isOk);
                verdictHtml = hasIssue
                    ? '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">확인 필요</span>'
                    : '<span style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">정상</span>';
            }

            // 세탁 대기 행(ob만 있음): 행 전체 muted
            const isPending = ob && !inv;

            // 확인 칸 (확인 상태 + 관리 통합)
            let confirmCellHtml;
            if (!ob && (!invDate || invDate === today)) {
                const inputDate = invDate || today;
                confirmCellHtml = `<button onclick="event.stopPropagation();window.openOutboundInputModal('${inputDate}')" style="background:#ede9fe;color:#5b21b6;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;font-weight:600;">${ico('plus')} 출고 입력</button>`;
            } else {
                confirmCellHtml = _confirmCell(inv, today);
            }

            const detailHtml = _buildDetailTable(ob, inv, obItemMap, invItemMap, priceItems);

            // 일자 셀: 출고일 기준 M/D (요일), 부가 상태 같은 줄
            let dateCellHtml;
            if (obDate) {
                dateCellHtml = `<span style="font-size:12px;">${fmtD(obDate)}</span>`
                    + (!inv ? `<span style="font-size:11px;color:#9ca3af;"> · 세탁 대기</span>` : '');
            } else if (invDate) {
                dateCellHtml = `<span style="font-size:11px;color:#ef4444;">출고 미입력</span><span style="font-size:12px;color:#6b7280;"> · ${fmtD(invDate)}</span>`;
            } else {
                dateCellHtml = dash;
            }

            // 출고/명세서 ✓ 여부 칸
            const obCheckHtml = ob ? `<svg class="icon" aria-hidden="true" style="color:#059669;"><use href="#i-check"/></svg>` : dash;
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

        // 오늘 출고 입력/수정 버튼 (당월만, KST 오전 5시~자정 활성)
        const todayObEntry = pairs.find(({ ob }) => ob && ob.date === today);
        const todayHasOb = !!todayObEntry;
        const isCurrentMonth = today.startsWith(month);
        // KST 시각 판정: 0~4시 비활성, 5~23시 활성
        const _kstHour = new Date(Date.now() + 9 * 3600000).getUTCHours();
        const isInputTime = _kstHour >= 5;
        let todayBtnHtml = '';
        if (isCurrentMonth) {
            if (!isInputTime) {
                // 자정~오전 5시 비활성
                todayBtnHtml = `<div style="margin-bottom:12px;display:flex;align-items:center;flex-wrap:wrap;gap:8px;">
                <button disabled style="background:#e5e7eb;color:#9ca3af;border:none;border-radius:8px;padding:8px 18px;font-size:13px;cursor:not-allowed;font-weight:700;opacity:0.6;">
                    ${ico(todayHasOb ? 'pencil' : 'plus')} 오늘 출고 ${todayHasOb ? '수정' : '입력'} (${today})
                </button>
                <span style="display:inline-flex;align-items:center;gap:4px;background:#fee2e2;color:#991b1b;border-radius:20px;padding:4px 10px;font-size:11px;font-weight:600;">${ico('clock')} 현재는 입력 가능 시간이 아닙니다 (오전 5시부터 가능)</span>
            </div>`;
            } else if (todayHasOb) {
                const obId = todayObEntry.ob.id;
                todayBtnHtml = `<div style="margin-bottom:12px;display:flex;align-items:center;flex-wrap:wrap;gap:8px;">
                <button onclick="window.openOutboundInputModal('${today}', '${obId}')" style="background:#059669;color:white;border:none;border-radius:8px;padding:8px 18px;font-size:13px;cursor:pointer;font-weight:700;">
                    ${ico('pencil')} 오늘 출고 수정 (${today})
                </button>
                <span style="display:inline-flex;align-items:center;gap:4px;background:#fef3c7;color:#92400e;border-radius:20px;padding:4px 10px;font-size:11px;font-weight:600;">${ico('clock')} 출고 입력은 오전 5시부터 자정까지 가능합니다.</span>
            </div>`;
            } else {
                todayBtnHtml = `<div style="margin-bottom:12px;display:flex;align-items:center;flex-wrap:wrap;gap:8px;">
                <button onclick="window.openOutboundInputModal('${today}')" style="background:var(--primary,#3b82f6);color:white;border:none;border-radius:8px;padding:8px 18px;font-size:13px;cursor:pointer;font-weight:700;">
                    ${ico('plus')} 오늘 출고 입력 (${today})
                </button>
                <span style="display:inline-flex;align-items:center;gap:4px;background:#fef3c7;color:#92400e;border-radius:20px;padding:4px 10px;font-size:11px;font-weight:600;">${ico('clock')} 출고 입력은 오전 5시부터 자정까지 가능합니다.</span>
            </div>`;
            }
        }

        return `
        <div class="chart-container" style="margin-top:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
                <div style="font-weight:700;font-size:15px;">${ico('arrow-right-left', true)} 출고·명세서 대조</div>
                <span style="font-size:11px;color:#6b7280;">허용 오차 ±${_tolerancePct}% | 기능 시작일: ${_startDate || '-'}</span>
            </div>
            ${todayBtnHtml}

            <div style="font-weight:600;font-size:13px;margin-bottom:8px;color:var(--primary,#3b82f6);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                ${ico('bar-chart-2')} ${month.slice(5)}월 누계 대조 <span style="font-weight:400;font-size:11px;color:#6b7280;">(메인 판정 기준)</span>
                ${pendingObCount > 0 ? `<span style="background:#e0e7ff;color:#3730a3;border-radius:10px;padding:2px 8px;font-size:11px;font-weight:500;">세탁 대기 ${pendingObCount}건 (명세서 발행 전, 대조 제외)</span>` : ''}
            </div>
            ${completedCount === 0
                ? `<div style="background:#f1f5f9;border-radius:8px;padding:16px 20px;font-size:12px;color:#6b7280;margin-bottom:20px;text-align:center;">아직 대조할 명세서가 없습니다. 세탁이 완료되면 표시됩니다.</div>`
                : `<div class="table-scroll-wrap" style="margin-bottom:20px;">
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
            </div>`}

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
            </div>
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
    function _buildDetailTable(ob, inv, obItemMap, invItemMap, priceItems) {
        const obItems = ob ? (obItemMap[ob.id] || {}) : {};
        const invItems = inv ? (invItemMap[inv.id] || {}) : {};
        const itemNames = priceItems.map(p => p.name);
        const allNames = [...new Set([...itemNames, ...Object.keys(obItems), ...Object.keys(invItems)])];
        if (allNames.length === 0) {
            return '<div style="padding:12px;text-align:center;color:#9ca3af;font-size:12px;">품목 데이터 없음</div>';
        }

        const detailDash = '<span style="color:#9ca3af;">—</span>';
        const buildRows = (names) => names.map(name => {
            if (!ob) {
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
