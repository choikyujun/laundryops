// ============================================================
// invoice-compare.js — 거래명세서 목록 [비교] 기능
// 세탁공장 대표 화면: 명세서 1건 ↔ 그 명세서에 묶인 출고 N건 대조 모달 (invoice_id 기준)
// 대조 표·판정·확인상태는 outbound-compare.js window._obCompareUtils 재사용
// ============================================================
(function () {

    function _todayKST() {
        return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    }

    window.openObCompareModal = async function (invId, hotelId, invDate) {
        const modal = document.getElementById('invObCompareModal');
        if (!modal) { console.error('invObCompareModal 없음'); return; }

        const body = document.getElementById('invObCompareBody');
        if (body) body.innerHTML = '<div style="text-align:center;padding:24px;color:#6b7280;">로딩 중...</div>';
        const titleEl = document.getElementById('invObCompareTitle');
        if (titleEl) titleEl.textContent = '비교 로딩 중...';
        openModal('invObCompareModal');

        try {
            // 1. 거래처 정보 (tolerance·startDate·isSpecial)
            const { data: hData } = await window.mySupabase
                .from('hotels')
                .select('id, name, contract_type, hotel_type, use_outbound_input, outbound_tolerance_pct, outbound_start_date')
                .eq('id', hotelId)
                .single();
            if (!hData) {
                if (body) body.innerHTML = '<div style="color:red;padding:16px;">거래처 정보를 찾을 수 없습니다.</div>';
                return;
            }

            const tolerancePct = hData.outbound_tolerance_pct != null ? hData.outbound_tolerance_pct : 5;
            const isSpecial = hData.contract_type === 'special' || hData.hotel_type === 'special';
            const startDate = hData.outbound_start_date || null;

            // 2. 대상 명세서 (outbound-compare.js와 동일 필터)
            //    월 내 순번 매칭을 폐기했으므로 그 달 전체를 끌어올 필요가 없다.
            const { data: targetInv } = await window.mySupabase
                .from('invoices')
                .select('id, date, staff_name, confirmed_at, confirmed_by')
                .eq('id', invId)
                .maybeSingle();

            if (!targetInv) {
                if (body) body.innerHTML = '<div style="color:red;padding:16px;">명세서를 찾을 수 없습니다.</div>';
                return;
            }
            if (targetInv.staff_name && targetInv.staff_name.startsWith('관리자(차감)')) {
                if (titleEl) titleEl.textContent = `${hData.name}  ·  ${invDate} 명세서 비교`;
                if (body) body.innerHTML = '<div style="background:#f1f5f9;border-radius:8px;padding:16px;font-size:12px;color:#6b7280;">월말 차감 명세서는 출고 대조 대상이 아닙니다.</div>';
                return;
            }
            if (startDate && targetInv.date < startDate) {
                if (titleEl) titleEl.textContent = `${hData.name}  ·  ${invDate} 명세서 비교`;
                if (body) body.innerHTML = `<div style="background:#f1f5f9;border-radius:8px;padding:16px;font-size:12px;color:#6b7280;">출고 입력 기능 시작일(${startDate}) 이전 명세서라 대조 대상이 아닙니다.</div>`;
                return;
            }

            // 3. 이 명세서에 묶인 출고 — invoice_id 기준. 날짜 범위를 걸지 않는다.
            //    (outbound-compare.js / outbound-qty.js 와 같은 조건. 세 화면의 숫자가 일치해야 한다)
            const { data: rawObs } = await window.mySupabase
                .from('hotel_outbounds')
                .select('id, date, invoice_id')
                .eq('invoice_id', invId)
                .order('date', { ascending: true });
            const matchedObs = rawObs || [];

            // 4. 명세서 품목
            const invItemMap = {};
            {
                const { data: iItems } = await window.mySupabase
                    .from('invoice_items')
                    .select('invoice_id, name, qty')
                    .eq('invoice_id', invId);
                (iItems || []).forEach(it => {
                    if (!invItemMap[invId]) invItemMap[invId] = {};
                    invItemMap[invId][it.name] = (invItemMap[invId][it.name] || 0) + Number(it.qty || 0);
                });
            }

            // 5. 출고 품목
            const obItemMap = {};
            if (matchedObs.length > 0) {
                const { data: oItems } = await window.mySupabase
                    .from('hotel_outbound_items')
                    .select('outbound_id, item_name, qty')
                    .in('outbound_id', matchedObs.map(o => o.id));
                (oItems || []).forEach(it => {
                    if (!obItemMap[it.outbound_id]) obItemMap[it.outbound_id] = {};
                    obItemMap[it.outbound_id][it.item_name] = (obItemMap[it.outbound_id][it.item_name] || 0) + Number(it.qty || 0);
                });
            }

            // 6. 단가표 품목 (sort_order 순)
            const { data: priceRows } = await window.mySupabase
                .from('hotel_item_prices')
                .select('name, unit, category_name')
                .eq('hotel_id', hotelId)
                .eq('price_type', isSpecial ? 'special' : 'general')
                .order('sort_order', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: true });
            const priceItems = priceRows || [];

            // 7. _obCompareUtils 확인 (outbound-compare.js 의존)
            const utils = window._obCompareUtils;
            if (!utils) {
                if (body) body.innerHTML = '<div style="color:red;padding:16px;">비교 모듈 미로드 — 페이지를 새로고침해 주세요.</div>';
                return;
            }

            // 8. 거래처 확인 상태 배지
            const today = _todayKST();
            const { badgeHtml } = utils.confirmStatus(targetInv, today);

            // 9. 대조 표 HTML (outbound-compare.js 로직 재사용)
            const tableHtml = utils.buildDetailTable(matchedObs, targetInv, obItemMap, invItemMap, priceItems, tolerancePct, isSpecial);

            // 10. 모달 제목
            if (titleEl) titleEl.textContent = `${hData.name}  ·  ${invDate} 명세서 비교`;

            // 11. 출고 매칭 상태 안내
            let matchInfoHtml;
            if (matchedObs.length === 0) {
                matchInfoHtml = `<div style="background:#fef3c7;color:#92400e;border-radius:8px;padding:10px 14px;font-size:12px;font-weight:600;margin-bottom:12px;">
                    거래처 출고 미입력 — 이 명세서에 묶인 호텔 출고가 없습니다.
                </div>`;
            } else {
                // 휴무·명절이면 출고 N건이 명세서 1장에 묶인다. 묶인 날짜를 모두 보여준다.
                const obDates = matchedObs.map(o => o.date).join(', ');
                matchInfoHtml = `<div style="font-size:12px;color:#6b7280;margin-bottom:10px;">
                    출고일: <strong>${obDates}</strong>${matchedObs.length > 1 ? ` (${matchedObs.length}건)` : ''}&nbsp;&nbsp;|&nbsp;&nbsp;명세서일: <strong>${invDate}</strong>&nbsp;&nbsp;|&nbsp;&nbsp;허용 오차 ±${tolerancePct}%
                </div>`;
            }

            if (body) {
                body.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
                    <span style="font-size:12px;font-weight:600;color:#475569;">거래처 확인 상태:</span>
                    ${badgeHtml}
                </div>
                ${matchInfoHtml}
                ${tableHtml}`;
            }

        } catch (e) {
            console.error('openObCompareModal 오류:', e);
            const b = document.getElementById('invObCompareBody');
            if (b) b.innerHTML = `<div style="color:red;padding:16px;">오류가 발생했습니다: ${e.message}</div>`;
        }
    };

    // ── 모달 DOM 초기화 (body에 한 번만 추가) ───────────────
    (function _initModal() {
        if (document.getElementById('invObCompareModal')) return;
        const modal = document.createElement('div');
        modal.id = 'invObCompareModal';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display:none;align-items:center;justify-content:center;z-index:1002;';
        modal.innerHTML = `
        <div class="modal-content" style="width:580px;max-width:95vw;padding:24px;border-radius:12px;position:relative;max-height:88vh;overflow-y:auto;">
            <button onclick="closeModal('invObCompareModal')" style="position:absolute;right:14px;top:14px;border:none;background:none;font-size:22px;cursor:pointer;color:#6b7280;">×</button>
            <h3 id="invObCompareTitle" style="margin:0 0 14px 0;font-size:15px;font-weight:700;padding-right:28px;color:var(--primary,#5b21b6);"></h3>
            <div id="invObCompareBody"></div>
        </div>`;
        document.body.appendChild(modal);
    })();

})();
