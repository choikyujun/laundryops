// ============================================================
// outbound-qty.js — 출고수량 표시 (명세서 작성 화면)
// 기준 문서: 01-prd-출고수량.md / 02-architecture-출고수량.md
// 신규: 2026-09-11
//
// [태스크 1] 표 가로 스크롤 + 품목 열 고정 — 클래스 부여만 담당.
//   실제 규칙은 style.css 의 .admin-table.inv-scroll 블록.
//   index.html 을 직접 고치지 않고 여기서 클래스를 붙인다.
//
// app_v38.js 직접 수정 금지 원칙에 따라 window.* 오버라이드로만 구현.
// ============================================================
(function () {

    // 명세서 작성 표 (#staffInvoiceBody 를 품은 <table>)
    // index.html:840 의 정적 마크업. tbody 내용만 교체되고 table 자체는 유지된다.
    function _getInvTable() {
        var tbody = document.getElementById('staffInvoiceBody');
        return tbody ? tbody.closest('table') : null;
    }

    // 표에 inv-scroll, 카테고리 헤더 행에 cat-header 부여
    function _applyScrollClasses() {
        var table = _getInvTable();
        if (!table) return;

        table.classList.add('inv-scroll');

        // colspan 셀 하나뿐인 행 = 특수거래처 카테고리 헤더(app_v38.js:3209)
        // 또는 안내 행("품목 불러오는 중" 3165 / "등록된 품목이 없습니다" 3180).
        // 전체 폭을 차지하므로 sticky 대상에서 뺀다.
        table.querySelectorAll('tbody > tr').forEach(function (tr) {
            var cells = tr.children;
            var isFullWidth = cells.length === 1 && cells[0].hasAttribute('colspan');
            tr.classList.toggle('cat-header', isFullWidth);
        });
    }

    // openInvoiceModal 이 tbody 를 다시 그리므로 매 렌더 후 재적용.
    // makeRow 는 openInvoiceModal 내부 지역 const 라 직접 후킹이 불가능해
    // 바깥 함수를 감싸고 렌더 완료 후 DOM 을 손본다.
    function _patch() {
        if (typeof window.openInvoiceModal !== 'function') return;
        if (window.openInvoiceModal._invScrollPatched) return;

        var _orig = window.openInvoiceModal;
        window.openInvoiceModal = async function () {
            var result = await _orig.apply(this, arguments);
            _applyScrollClasses();
            return result;
        };
        window.openInvoiceModal._invScrollPatched = true;

        // 정적 마크업 표에 미리 부여 (첫 렌더 전에도 규칙이 적용되도록)
        _applyScrollClasses();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _patch);
    } else {
        _patch();
    }

})();
