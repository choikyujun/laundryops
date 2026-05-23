// 월정산 발송 팝업: 품목명에 "." 포함 시 <br>로 줄바꿈하여 표 정돈
(function () {
  function applyDotBreak(root) {
    // sendInvoiceArea 내 <th>, <td> 텍스트에서 "." → "<br>" 치환
    // innerHTML이 순수 텍스트인 셀만 처리 (버튼/복합 HTML 셀 제외)
    root.querySelectorAll('th, td').forEach(function (cell) {
      if (cell.children.length > 0) return; // 자식 엘리먼트 있으면 패스
      var text = cell.textContent;
      if (text.indexOf('.') === -1) return;
      cell.innerHTML = text.split('.').join('.<br>');
    });
  }

  function observe() {
    var area = document.getElementById('sendInvoiceArea');
    if (!area) return;
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.addedNodes.length > 0) applyDotBreak(area);
      });
    });
    observer.observe(area, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observe);
  } else {
    observe();
  }
})();
