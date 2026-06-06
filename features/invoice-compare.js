// ============================================================
// invoice-compare.js — 거래명세서 목록 [비교] 기능
// 세탁공장 대표 화면: 명세서 1건 ↔ N번째 매칭 출고 대조 모달
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

            // 2. 월 범위 계산
            const month = invDate.slice(0, 7);
            const [y, m] = month.split('-').map(Number);
            const monthStart = month + '-01';
            const monthEnd = month + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0');

            // 3. 해당 월 전체 명세서 (outbound-compare.js와 동일 필터 — 순번 일치)
            const { data: rawInvs } = await window.mySupabase
                .from('invoices')
                .select('id, date, staff_name, confirmed_at, confirmed_by')
                .eq('hotel_id', hotelId)
                .gte('date', monthStart)
                .lte('date', monthEnd)
                .order('date', { ascending: true });
            const invoices = (rawInvs || []).filter(inv => {
                if (inv.staff_name && inv.staff_name.startsWith('관리자(차감)')) return false;
                if (startDate && inv.date < startDate) return false;
                return true;
            });

            // 4. 대상 명세서의 월 내 순번 → 매칭 출고 찾기
            const invIdx = invoices.findIndex(i => i.id === invId);
            const targetInv = invoices[invIdx] || null;

            // 5. 해당 월 전체 출고 (동일 순서 기반 매칭)
            const { data: rawObs } = await window.mySupabase
                .from('hotel_outbounds')
                .select('id, date')
                .eq('hotel_id', hotelId)
                .gte('date', monthStart)
                .lte('date', monthEnd)
                .order('date', { ascending: true });
            const matchedOb = (rawObs || [])[invIdx] || null;

            // 6. 명세서 품목
            const invItemMap = {};
            if (targetInv) {
                const { data: iItems } = await window.mySupabase
                    .from('invoice_items')
                    .select('invoice_id, name, qty')
                    .eq('invoice_id', invId);
                (iItems || []).forEach(it => {
                    if (!invItemMap[invId]) invItemMap[invId] = {};
                    invItemMap[invId][it.name] = (invItemMap[invId][it.name] || 0) + Number(it.qty || 0);
                });
            }

            // 7. 출고 품목
            const obItemMap = {};
            if (matchedOb) {
                const { data: oItems } = await window.mySupabase
                    .from('hotel_outbound_items')
                    .select('outbound_id, item_name, qty')
                    .eq('outbound_id', matchedOb.id);
                (oItems || []).forEach(it => {
                    if (!obItemMap[it.outbound_id]) obItemMap[it.outbound_id] = {};
                    obItemMap[it.outbound_id][it.item_name] = (obItemMap[it.outbound_id][it.item_name] || 0) + Number(it.qty || 0);
                });
            }

            // 8. 단가표 품목 (sort_order 순)
            const { data: priceRows } = await window.mySupabase
                .from('hotel_item_prices')
                .select('name, unit, category_name')
                .eq('hotel_id', hotelId)
                .eq('price_type', isSpecial ? 'special' : 'general')
                .order('sort_order', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: true });
            const priceItems = priceRows || [];

            // 9. _obCompareUtils 확인 (outbound-compare.js 의존)
            const utils = window._obCompareUtils;
            if (!utils) {
                if (body) body.innerHTML = '<div style="color:red;padding:16px;">비교 모듈 미로드 — 페이지를 새로고침해 주세요.</div>';
                return;
            }

            // 10. 거래처 확인 상태 배지
            const today = _todayKST();
            const { badgeHtml } = utils.confirmStatus(targetInv, today);

            // 11. 대조 표 HTML (outbound-compare.js 로직 재사용)
            const tableHtml = utils.buildDetailTable(matchedOb, targetInv, obItemMap, invItemMap, priceItems, tolerancePct, isSpecial);

            // 12. 모달 제목
            if (titleEl) titleEl.textContent = `${hData.name}  ·  ${invDate} 명세서 비교`;

            // 13. 출고 매칭 상태 안내
            let matchInfoHtml;
            if (!matchedOb) {
                matchInfoHtml = `<div style="background:#fef3c7;color:#92400e;border-radius:8px;padding:10px 14px;font-size:12px;font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                    ⚠ 거래처 출고 미입력 — 이 명세서에 대응하는 호텔 출고가 등록되어 있지 않습니다.
                </div>`;
            } else {
                matchInfoHtml = `<div style="font-size:12px;color:#6b7280;margin-bottom:10px;">
                    출고일: <strong>${matchedOb.date}</strong>&nbsp;&nbsp;|&nbsp;&nbsp;명세서일: <strong>${invDate}</strong>&nbsp;&nbsp;|&nbsp;&nbsp;허용 오차 ±${tolerancePct}%
                    &nbsp;&nbsp;|&nbsp;&nbsp;월 ${invIdx + 1}번째 대응 쌍
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
