// ============================================================
// outbound-qty.js — 출고수량 표시 (명세서 작성 화면)
// 기준 문서: 01-prd-출고수량.md / 02-architecture-출고수량.md
// 신규: 2026-09-11
//
// [태스크 1] 표 가로 스크롤 + 품목 열 고정 (클래스 부여)
// [태스크 3] 출고수량 열 구조 추가 — 값은 비우고(—) 구조만. 값 채우기는 태스크 4.
//
// app_v38.js 직접 수정 금지 원칙에 따라 window.* 오버라이드로만 구현.
// makeRow 는 openInvoiceModal 내부 지역 const(app_v38.js:3184)라 캡처가
// 불가능하므로, 바깥 함수를 감싸고 렌더 완료 후 DOM 을 손본다.
// ============================================================
(function () {

    var COL_CLASS = 'ob-qty-col';  // 출고수량 열 셀 표식 (제거·재삽입용)
    var COL_INDEX = 3;             // 단가(2) 오른쪽, 수량(3) 왼쪽
    var BASE_COLS = 5;             // 품목/단위/단가/수량/금액
    var DASH = '—';           // — (값 없음)

    // 현재 거래처 정보 캐시 (태스크 4·5에서 tolerance·start_date 재사용)
    var _hotel = { id: null, data: null };

    // 비동기 렌더가 겹칠 때 오래된 결과가 최신 화면을 덮어쓰지 않도록
    var _token = 0;

    // ── 표 찾기 ──────────────────────────────────────────
    // index.html:840 의 정적 마크업. tbody 내용만 교체되고 table 자체는 유지된다.
    function _getInvTable() {
        var tbody = document.getElementById('staffInvoiceBody');
        return tbody ? tbody.closest('table') : null;
    }

    // colspan 셀 하나뿐인 행 = 카테고리 헤더(app_v38.js:3209) 또는
    // 안내 행("품목 불러오는 중" 3165 / "등록된 품목이 없습니다" 3180)
    function _isFullWidthRow(tr) {
        return tr.children.length === 1 && tr.children[0].hasAttribute('colspan');
    }

    // ── [태스크 1] 가로 스크롤·품목 열 고정 클래스 ────────
    function _applyScrollClasses(table) {
        if (!table) return;
        table.classList.add('inv-scroll');
        // 전체 폭 행은 sticky 대상에서 뺀다 (걸면 스크롤 시 잘못 따라붙음)
        table.querySelectorAll('tbody > tr').forEach(function (tr) {
            tr.classList.toggle('cat-header', _isFullWidthRow(tr));
        });
    }

    // ── [태스크 3] 출고수량 열 제거 (원래 5열 상태로) ─────
    function _clearColumn(table) {
        if (!table) return;
        table.querySelectorAll('.' + COL_CLASS).forEach(function (cell) {
            cell.parentNode.removeChild(cell);
        });
        table.querySelectorAll('tbody > tr > [colspan]').forEach(function (cell) {
            cell.setAttribute('colspan', String(BASE_COLS));
        });
    }

    // ── [태스크 3] 출고수량 열 삽입 ───────────────────────
    function _injectColumn(table) {
        if (!table) return;

        // thead — 정적 마크업이라 거래처를 바꿔도 남는다. 중복 삽입 방지.
        var headRow = table.tHead && table.tHead.rows[0];
        if (headRow && !headRow.querySelector('.' + COL_CLASS)) {
            var th = document.createElement('th');
            th.className = COL_CLASS;
            th.textContent = '출고수량';
            headRow.insertBefore(th, headRow.cells[COL_INDEX] || null);
        }

        // tbody
        table.querySelectorAll('tbody > tr').forEach(function (tr) {
            // 전체 폭 행은 셀을 넣지 않고 colspan 만 5 → 6
            if (_isFullWidthRow(tr)) {
                tr.children[0].setAttribute('colspan', String(BASE_COLS + 1));
                return;
            }
            if (tr.querySelector('.' + COL_CLASS)) return;   // 이미 삽입됨
            if (tr.cells.length < BASE_COLS) return;         // 예상 밖 행은 건드리지 않음

            // 읽기 전용 표시 셀. .inv-qty 클래스 금지 —
            // 저장 품목 수집(app_v38.js:1034)과 Enter 이동(1172)이 그 클래스를 순회한다.
            var td = document.createElement('td');
            td.className = COL_CLASS;
            td.textContent = DASH;                 // [태스크 4] 에서 실제 값으로 교체
            td.style.textAlign = 'center';
            td.style.color = '#9ca3af';
            tr.insertBefore(td, tr.cells[COL_INDEX] || null);
        });
    }

    // ── 거래처 정보 조회 (출고 입력 사용 여부) ────────────
    function _loadHotel(hotelId) {
        if (!hotelId) { _hotel = { id: null, data: null }; return Promise.resolve(null); }
        if (_hotel.id === hotelId && _hotel.data) return Promise.resolve(_hotel.data);

        return window.mySupabase
            .from('hotels')
            .select('id, use_outbound_input, outbound_tolerance_pct, outbound_start_date, contract_type, hotel_type')
            .eq('id', hotelId)
            .maybeSingle()
            .then(function (res) {
                if (res.error) {
                    // 조회 실패 시 열을 띄우지 않는다 (기존 화면과 동일하게 보이는 쪽이 안전)
                    console.error('[outbound-qty] 거래처 조회 실패:', res.error);
                    _hotel = { id: hotelId, data: null };
                    return null;
                }
                _hotel = { id: hotelId, data: res.data || null };
                return _hotel.data;
            });
    }

    // ── 렌더 후 적용 ──────────────────────────────────────
    function _applyAll() {
        var table = _getInvTable();
        if (!table) return Promise.resolve();

        var myToken = ++_token;
        var sel = document.getElementById('staffHotelSelect');
        var hotelId = sel ? sel.value : '';

        return _loadHotel(hotelId).then(function (hData) {
            if (myToken !== _token) return;            // 더 최근 렌더가 있었다면 폐기
            var table2 = _getInvTable();
            if (!table2) return;

            _clearColumn(table2);
            // 표시 조건: use_outbound_input === true 인 거래처만
            if (hData && hData.use_outbound_input === true) _injectColumn(table2);
            _applyScrollClasses(table2);
        });
    }

    // ── 오버라이드 설치 ───────────────────────────────────
    function _patch() {
        // 1) openInvoiceModal — 품목 표를 다시 그리는 유일한 진입점
        if (typeof window.openInvoiceModal === 'function' && !window.openInvoiceModal._obQtyPatched) {
            var _origOpen = window.openInvoiceModal;
            window.openInvoiceModal = async function () {
                var result = await _origOpen.apply(this, arguments);
                try { await _applyAll(); } catch (e) { console.error('[outbound-qty] 열 적용 실패:', e); }
                return result;
            };
            window.openInvoiceModal._obQtyPatched = true;
        }

        // 2) calcTotal — 원본 가드가 cells.length < 5 상수라 열이 늘면 흔들린다.
        //    상수를 6으로 바꾸면 열 미표시 거래처(5칸)가 전부 걸러져 합계가 0원이 되므로,
        //    원래 의도인 "품목 행만 처리"를 클래스 유무로 판정한다. 계산식은 원본 그대로.
        if (typeof window.calcTotal === 'function' && !window.calcTotal._obQtyPatched) {
            window.calcTotal = function () {
                var rows = document.querySelectorAll('#staffInvoiceBody tr');
                var total = 0;
                rows.forEach(function (row) {
                    var priceCell = row.querySelector('.item-price');
                    var qtyInput = row.querySelector('.qty-input');
                    var amountCell = row.querySelector('.item-amount');
                    if (!priceCell || !qtyInput || !amountCell) return;   // 품목 행이 아님

                    var price = Number(priceCell.innerText.replace(/[^0-9-]/g, '')) || 0;
                    var qty = Number(qtyInput.value);
                    var amt = price * qty;
                    total += amt;
                    amountCell.innerText = amt.toLocaleString() + '원';
                });
                var totalEl = document.getElementById('invoiceTotalAmount');
                if (totalEl) totalEl.innerText = total.toLocaleString() + '원';
            };
            window.calcTotal._obQtyPatched = true;
        }

        // 정적 마크업 표에 미리 부여 (첫 렌더 전에도 규칙이 적용되도록)
        _applyScrollClasses(_getInvTable());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _patch);
    } else {
        _patch();
    }

    // 태스크 4·5에서 재사용
    window._obQtyInternals = {
        COL_CLASS: COL_CLASS,
        COL_INDEX: COL_INDEX,
        getTable: _getInvTable,
        getHotel: function () { return _hotel.data; },
        applyAll: _applyAll
    };

})();
