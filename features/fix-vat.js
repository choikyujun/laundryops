// 부가세 중복 계산 수정
// 품목 단가는 이미 VAT 포함 금액이므로 10% 추가 계산하지 않음
(function () {

  // 1. confirmSendInvoice 패치 — DB 저장 시 supplyPrice(= 실제 합계)를 total_amount로 저장
  function patchConfirmSendInvoice() {
    if (!window.confirmSendInvoice || window._vatPatched_confirm) return;
    var _orig = window.confirmSendInvoice;
    window.confirmSendInvoice = async function (sDate, eDate, hotelId, totalAmount, supplyPrice, vat) {
      // supplyPrice = price×qty 합계 = 이미 VAT 포함된 실제 금액
      // totalAmount = supplyPrice * 1.1 (잘못된 값) → supplyPrice로 교체
      return _orig.call(this, sDate, eDate, hotelId, supplyPrice, supplyPrice, 0);
    };
    window._vatPatched_confirm = true;
  }

  // 2. 내역 확인 팝업 DOM 수정 — "공급가 + VAT" 표시 → "총합계 (부가세 포함)"으로 교체
  function fixSummaryDisplay(area) {
    // "공급가: ₩ X + VAT: ₩ Y" 패턴 찾기
    area.querySelectorAll('span').forEach(function (span) {
      if (span.children.length > 0) return;
      var text = span.textContent;
      var m = text.match(/공급가[액]?:\s*₩\s*([\d,]+)\s*\+\s*VAT:\s*₩\s*([\d,]+)/);
      if (!m) return;

      var supplyPrice = parseInt(m[1].replace(/,/g, ''), 10);

      // 이 span이 속한 요약 div에서 "총합계" span도 같이 수정
      var parent = span.parentElement;
      if (parent) {
        parent.querySelectorAll('span').forEach(function (s) {
          if (s === span) return;
          if (s.textContent.indexOf('총합계') !== -1) {
            s.textContent = '총합계: ₩ ' + supplyPrice.toLocaleString();
          }
        });
      }

      // 공급가+VAT 줄은 작게 보조 표시로만 남김
      span.style.display = 'none';
    });
  }

  // 3. viewSentDetail 패치 — 렌더링 후 DOM 교정
  function patchViewSentDetail() {
    if (!window.viewSentDetail || window._vatPatched_view) return;
    var _orig = window.viewSentDetail;
    window.viewSentDetail = async function () {
      await _orig.apply(this, arguments);
      var area = document.getElementById('sendInvoiceArea');
      if (area) fixSummaryDisplay(area);
    };
    window._vatPatched_view = true;
  }

  function tryPatch() {
    patchConfirmSendInvoice();
    patchViewSentDetail();
  }

  // app_v38.js가 모두 로드된 후 패치 (defer 처리)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(tryPatch, 100); });
  } else {
    setTimeout(tryPatch, 100);
  }
})();
