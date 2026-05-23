// 부가세 중복 계산 수정
// 품목 단가는 이미 VAT 포함 금액이므로 10% 추가 계산 제거
//
// 올바른 계산:
//   rawTotal   = sum(단가 × 수량)        ← 이미 VAT 포함된 최종 금액
//   공급가     = rawTotal / 1.1          ← 부가세 제외 금액
//   부가세     = rawTotal - 공급가
//   총합계     = rawTotal                ← DB 저장 및 표시
(function () {

  // 1. confirmSendInvoice 패치 — DB 저장 시 rawTotal을 total_amount로 저장
  //    (app_v38.js는 totalAmount = supplyPrice * 1.1로 전달하므로 supplyPrice로 교체)
  function patchConfirmSendInvoice() {
    if (!window.confirmSendInvoice || window._vatPatched_confirm) return;
    var _orig = window.confirmSendInvoice;
    window.confirmSendInvoice = async function (sDate, eDate, hotelId, totalAmount, supplyPrice, vat) {
      // supplyPrice = price×qty 합계 = 이미 VAT 포함된 실제 금액
      // totalAmount = supplyPrice * 1.1 (잘못된 값)
      var rawTotal = supplyPrice;
      var correctSupply = Math.round(rawTotal / 1.1);
      var correctVat = rawTotal - correctSupply;
      return _orig.call(this, sDate, eDate, hotelId, rawTotal, correctSupply, correctVat);
    };
    window._vatPatched_confirm = true;
  }

  // 2. 내역 확인 팝업 DOM 수정
  //    app_v38.js가 렌더링한 "공급가: ₩ X + VAT: ₩ Y" / "총합계: ₩ Z" 를 교정
  //    X = rawTotal (이미 VAT 포함), Z = X * 1.1 (잘못됨)
  //    → 공급가 = X/1.1, 부가세 = X - X/1.1, 총합계 = X
  function fixSummaryDisplay(area) {
    area.querySelectorAll('span').forEach(function (span) {
      if (span.children.length > 0) return;
      var text = span.textContent;
      var m = text.match(/공급가[액]?:\s*₩\s*([\d,]+)\s*\+\s*VAT:\s*₩\s*([\d,]+)/);
      if (!m) return;

      var rawTotal = parseInt(m[1].replace(/,/g, ''), 10); // X = 실제 합계
      var correctSupply = Math.round(rawTotal / 1.1);
      var correctVat = rawTotal - correctSupply;

      // "공급가 + VAT" 줄 교정
      span.textContent = '공급가액: ₩ ' + correctSupply.toLocaleString()
        + ' + 부가세(10%): ₩ ' + correctVat.toLocaleString();

      // 같은 부모의 "총합계" span 교정
      var parent = span.parentElement;
      if (parent) {
        parent.querySelectorAll('span').forEach(function (s) {
          if (s === span) return;
          if (s.textContent.indexOf('총합계') !== -1) {
            s.textContent = '총합계: ₩ ' + rawTotal.toLocaleString();
          }
        });
      }
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(tryPatch, 100); });
  } else {
    setTimeout(tryPatch, 100);
  }
})();
