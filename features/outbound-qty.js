// ============================================================
// outbound-qty.js — 출고수량 표시 (명세서 작성 화면)
// 기준 문서: 01-prd-출고수량.md / 02-architecture-출고수량.md
// 신규: 2026-09-11
//
// [태스크 1] 표 가로 스크롤 + 품목 열 고정 (클래스 부여)
// [태스크 3] 출고수량 열 구조 추가
// [태스크 4] 미대조 출고 조회 + 품목별 합계 표시 + 출고 날짜 줄 + 단가 미등록 품목 줄
// [태스크 5] 입력 수량과 출고수량의 차이 표시 (색만, 저장 차단 없음)
//
// app_v38.js 직접 수정 금지 원칙에 따라 window.* 오버라이드로만 구현.
// makeRow 는 openInvoiceModal 내부 지역 const(app_v38.js:3184)라 캡처가
// 불가능하므로, 바깥 함수를 감싸고 렌더 완료 후 DOM 을 손본다.
// ============================================================
(function () {

    var COL_CLASS = 'ob-qty-col';  // 출고수량 열 셀 표식 (제거·재삽입용)
    var COL_INDEX = 3;             // 단가(2) 오른쪽, 수량(3) 왼쪽
    var BASE_COLS = 5;             // 품목/단위/단가/수량/금액
    var DASH = '—';           // — (출고 데이터 자체가 없음)
    var DATE_LINE_ID = 'obQtyDateLine';
    var UNPRICED_LINE_ID = 'obQtyUnpricedLine';
    var DIFF_COLOR = '#dc2626';    // 기존 대조 화면의 "확인 필요" 색

    // 현재 거래처 정보 캐시 (태스크 5에서 tolerance 재사용)
    var _hotel = { id: null, data: null };

    // 직전 조회 결과 (태스크 5에서 차이 판정에 재사용)
    var _lastOutbound = null;

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

    // 출고 대조 사용 거래처 판정 — outbound-compare.js 가 단일 출처.
    // 여기서 같은 판정을 다시 쓰지 않는다(두 벌 관리 금지).
    // 모듈이 없으면 열을 띄우지 않는다(기존 화면과 동일하게 보이는 쪽이 안전).
    function _isEnabled(hData) {
        var utils = window._obCompareUtils;
        if (!utils || typeof utils.isOutboundEnabled !== 'function') {
            console.error('[outbound-qty] _obCompareUtils.isOutboundEnabled 없음 — 출고수량 열을 표시하지 않습니다.');
            return false;
        }
        return utils.isOutboundEnabled(hData);
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
            td.textContent = DASH;
            td.style.textAlign = 'center';
            td.style.color = '#9ca3af';
            tr.insertBefore(td, tr.cells[COL_INDEX] || null);
        });
    }

    // ── 거래처 정보 조회 ─────────────────────────────────
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

    // ── [태스크 4] 출고 조회 + 품목별 합계 ────────────────
    // 신규 모드: 아직 명세서가 붙지 않은 출고 전부 (invoice_id is null)
    // 수정 모드: 그 명세서에 묶인 출고 (invoice_id = 해당 명세서 id)
    //
    // 공장 휴무·명절이면 출고 N건이 명세서 1장에 묶이므로 "다음 1건"이 아니라
    // 미대조 출고 전부를 합산한다. 날짜·요일은 보지 않는다.
    async function _loadOutbound(hData, dateStr) {
        var empty = { count: 0, dates: [], totals: {}, mode: 'new' };
        if (!hData || !hData.id) return empty;

        // 수정 모드 판정 — openInvoiceModal(app_v38.js:3136)의 판정과 동일한 조건.
        // 화면의 "수정 모드" 배지와 어긋나지 않도록 일부러 같은 키를 쓴다.
        var invoiceId = null;
        if (dateStr) {
            var invRes = await window.mySupabase
                .from('invoices').select('id')
                .eq('hotel_id', hData.id)
                .eq('date', dateStr)
                .maybeSingle();
            if (invRes.error) {
                console.error('[outbound-qty] 명세서 조회 실패:', invRes.error);
                return empty;
            }
            invoiceId = invRes.data ? invRes.data.id : null;
        }

        var q = window.mySupabase
            .from('hotel_outbounds').select('id, date')
            .eq('hotel_id', hData.id);

        if (invoiceId) {
            // 수정 모드: 이미 이 명세서에 묶인 출고. 추가 소진 없음.
            // 기능 시작일 필터는 걸지 않는다 — 이미 묶인 건은 그 자체가 대응 관계다.
            q = q.eq('invoice_id', invoiceId);
        } else {
            // 신규 모드: 미대조 출고 전부
            q = q.is('invoice_id', null);
            // 기능 ON 이전 출고를 거른다 (기존 대조 로직과 동일 규칙)
            if (hData.outbound_start_date) q = q.gte('date', hData.outbound_start_date);
        }

        var obRes = await q.order('date', { ascending: true });
        if (obRes.error) {
            console.error('[outbound-qty] 출고 조회 실패:', obRes.error);
            return empty;
        }

        var obs = obRes.data || [];
        var result = {
            count: obs.length,
            // hotel_outbounds 에 UNIQUE(hotel_id, date) 가 있어 날짜는 중복되지 않는다
            dates: obs.map(function (o) { return o.date; }),
            totals: {},
            mode: invoiceId ? 'edit' : 'new'
        };
        if (obs.length === 0) return result;

        // 품목 합계 — item_name(이름 문자열) 기준. 기존 대조 로직과 동일한 매칭.
        var itRes = await window.mySupabase
            .from('hotel_outbound_items')
            .select('outbound_id, item_name, qty')
            .in('outbound_id', obs.map(function (o) { return o.id; }));
        if (itRes.error) {
            console.error('[outbound-qty] 출고 품목 조회 실패:', itRes.error);
            return empty;
        }
        (itRes.data || []).forEach(function (it) {
            var n = it.item_name;
            result.totals[n] = (result.totals[n] || 0) + Number(it.qty || 0);
        });

        return result;
    }

    // ── [태스크 4] 값 채우기 ──────────────────────────────
    // 출고 자체가 없으면 전부 —.
    // 출고는 있는데 그 품목이 없으면 0 (호텔이 그 품목은 안 내보냄 — 기존 대조 화면과 동일).
    function _fillColumn(table, info) {
        if (!table) return;
        var hasData = !!(info && info.count > 0);

        table.querySelectorAll('tbody > tr').forEach(function (tr) {
            var cell = tr.querySelector('.' + COL_CLASS);
            if (!cell) return;   // 전체 폭 행

            if (!hasData) {
                cell.textContent = DASH;
                cell.style.color = '#9ca3af';
                cell.removeAttribute('data-ob-qty');
                return;
            }

            var name = tr.cells[0] ? tr.cells[0].textContent.trim() : '';
            var qty = Object.prototype.hasOwnProperty.call(info.totals, name) ? info.totals[name] : 0;
            cell.textContent = Number(qty).toLocaleString();
            cell.style.color = '';
            cell.setAttribute('data-ob-qty', String(qty));
        });

        _applyDiffHighlight();   // [태스크 5] 값이 채워졌으니 즉시 판정
    }

    // ── [태스크 4] 출고 날짜 줄 ───────────────────────────
    // 예: "호텔 출고 10/14 · 10/15"  — 어느 날짜들의 합인지 직원이 그 자리에서 확인
    function _fmtMD(dateStr) {
        var p = String(dateStr).split('-');
        if (p.length < 3) return dateStr;
        return Number(p[1]) + '/' + Number(p[2]);
    }

    // 거래처 이름(#invoiceHotelName) 오른쪽에 붙인다.
    // 주의: app_v38.js:3161 이 innerText 로 이름을 덮어쓰므로 그때 span 이 날아간다.
    // _applyAll 이 렌더 이후에 돌기 때문에 매번 다시 붙는다.
    function _renderDateLine(info) {
        var host = document.getElementById('invoiceHotelName');
        var line = document.getElementById(DATE_LINE_ID);

        // 미대조 출고 0건이면 제거
        if (!host || !info || info.count === 0) {
            if (line) line.parentNode.removeChild(line);
            return;
        }

        if (!line || line.parentNode !== host) {
            if (line) line.parentNode.removeChild(line);
            line = document.createElement('span');
            line.id = DATE_LINE_ID;
            line.style.cssText = 'font-size:12px;font-weight:400;color:#64748b;margin-left:10px;white-space:nowrap;';
            host.appendChild(line);
        }
        line.textContent = '출고 ' + info.dates.map(_fmtMD).join(' · ');
    }

    function _removeDateLine() {
        var line = document.getElementById(DATE_LINE_ID);
        if (line) line.parentNode.removeChild(line);
    }

    // ── [태스크 4] 단가 미등록 품목 줄 ────────────────────
    // 호텔이 내보냈는데 단가표(hotel_item_prices)에 없는 품목 = 청구가 안 되는 상황.
    // 표 안에 행으로 넣지 않는다 — 단가가 없어 금액 계산이 안 되고,
    // 행을 넣으면 저장 품목 수집(app_v38.js:1034)과 calcTotal 에 섞인다.
    // 날짜 줄과 같이 표 밖에 두어 기존 로직에 영향을 주지 않는다.
    function _tableItemNames(table) {
        var names = {};
        table.querySelectorAll('tbody > tr').forEach(function (tr) {
            if (_isFullWidthRow(tr) || !tr.cells.length) return;
            names[tr.cells[0].textContent.trim()] = true;
        });
        return names;
    }

    function _renderUnpricedLine(table, info) {
        var area = document.getElementById('invoiceFormArea');
        var line = document.getElementById(UNPRICED_LINE_ID);

        var extras = [];
        if (table && info && info.count > 0) {
            var known = _tableItemNames(table);
            Object.keys(info.totals).forEach(function (n) {
                var q = Number(info.totals[n]) || 0;
                // 단위는 붙이지 않는다 — 단가표에 없는 품목이라 단위를 알 방법이 없고,
                // hotel_outbound_items 에도 단위 컬럼이 없다. 지어내지 않는다.
                if (!known[n] && q !== 0) extras.push(n + ' ' + q.toLocaleString());
            });
        }

        if (!area || extras.length === 0) {
            if (line) line.parentNode.removeChild(line);
            return;
        }

        if (!line) {
            line = document.createElement('div');
            line.id = UNPRICED_LINE_ID;
            line.style.cssText = 'font-size:12px;color:#92400e;margin-top:6px;';
            var wrap = area.querySelector('.table-scroll-wrap');
            if (wrap) wrap.parentNode.insertBefore(line, wrap.nextSibling);
            else area.appendChild(line);
        }
        line.textContent = '단가 미등록 품목: ' + extras.join(', ');
    }

    function _removeUnpricedLine() {
        var line = document.getElementById(UNPRICED_LINE_ID);
        if (line) line.parentNode.removeChild(line);
    }

    // ── [태스크 5] 차이 표시 ──────────────────────────────
    // 판정식은 outbound-compare.js 의 _diffCalc 가 단일 출처 (중복 구현 금지).
    // 색만 바꾼다 — 경고 팝업·toast 없음, 저장도 막지 않는다.
    function _resetQtyStyle(input) {
        input.style.color = '';
        input.style.borderColor = '';
    }

    function _markQtyDiff(input) {
        input.style.color = DIFF_COLOR;
        input.style.borderColor = DIFF_COLOR;
    }

    function _applyDiffHighlight() {
        var table = _getInvTable();
        if (!table) return;

        var tol = 5;
        if (_hotel.data && _hotel.data.outbound_tolerance_pct != null) {
            tol = _hotel.data.outbound_tolerance_pct;
        }
        var utils = window._obCompareUtils;
        var canJudge = !!(utils && typeof utils.diffCalc === 'function');

        table.querySelectorAll('tbody > tr').forEach(function (tr) {
            var input = tr.querySelector('.qty-input');
            if (!input) return;

            // 출고수량이 —(미대조 출고 없음)이면 판정하지 않는다.
            // 값이 채워진 셀만 data-ob-qty 를 갖는다.
            var obCell = tr.querySelector('.' + COL_CLASS);
            if (!canJudge || !obCell || !obCell.hasAttribute('data-ob-qty')) {
                _resetQtyStyle(input);
                return;
            }

            // 입력 중인 빈 칸·부호만 있는 상태는 판정 보류 (포커스만으로 빨개지지 않게)
            var raw = String(input.value).trim();
            if (raw === '' || raw === '-') { _resetQtyStyle(input); return; }

            var invQty = Number(raw);
            if (!isFinite(invQty)) { _resetQtyStyle(input); return; }

            var obQty = Number(obCell.getAttribute('data-ob-qty')) || 0;
            var r = utils.diffCalc(obQty, invQty, tol);
            if (r.isOk) _resetQtyStyle(input); else _markQtyDiff(input);
        });
    }

    // ── 렌더 후 적용 ──────────────────────────────────────
    async function _applyAll() {
        var table = _getInvTable();
        if (!table) return;

        var myToken = ++_token;
        var sel = document.getElementById('staffHotelSelect');
        var dateEl = document.getElementById('invoiceDate');
        var hotelId = sel ? sel.value : '';
        var dateStr = dateEl ? dateEl.value : '';

        var hData = await _loadHotel(hotelId);
        if (myToken !== _token) return;            // 더 최근 렌더가 있었다면 폐기

        table = _getInvTable();
        if (!table) return;

        _clearColumn(table);
        var enabled = _isEnabled(hData);
        if (enabled) _injectColumn(table);
        _applyScrollClasses(table);

        if (!enabled) { _lastOutbound = null; _removeDateLine(); _removeUnpricedLine(); return; }

        // 값 채우기 — 조회 중에는 — 가 그대로 보인다(레이아웃 흔들림 없음)
        var info;
        try {
            info = await _loadOutbound(hData, dateStr);
        } catch (e) {
            console.error('[outbound-qty] 출고 조회 중 오류:', e);
            info = { count: 0, dates: [], totals: {}, mode: 'new' };
        }
        if (myToken !== _token) return;

        table = _getInvTable();
        if (!table) return;

        _lastOutbound = info;
        _fillColumn(table, info);
        _renderDateLine(info);
        _renderUnpricedLine(table, info);
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

                // [태스크 5] 수량 입력은 oninput="calcTotal()" 로 들어온다.
                // 여기에 얹으면 키 입력마다 즉시 갱신되고 별도 리스너가 필요 없다.
                _applyDiffHighlight();
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

    // 태스크 5·6 에서 재사용
    window._obQtyInternals = {
        COL_CLASS: COL_CLASS,
        COL_INDEX: COL_INDEX,
        getTable: _getInvTable,
        getHotel: function () { return _hotel.data; },
        getOutbound: function () { return _lastOutbound; },
        loadOutbound: _loadOutbound,
        applyDiffHighlight: _applyDiffHighlight,
        applyAll: _applyAll
    };

})();
