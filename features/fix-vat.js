// 발송내역 목록 총금액 표시 버그 교정
// app_v38.js line 555: totalWithTax = rawAmount * 1.1 → total_amount에 다시 10% 추가
// total_amount는 이미 "공급가 + 부가세" 합계이므로 그대로 표시해야 함
(function () {

  function fixRow(tr) {
    if (tr._vatFixed) return;
    var cells = tr.querySelectorAll('td');
    if (cells.length < 3) return;

    var amountCell = cells[2]; // 3번째 열 = 총금액
    var text = amountCell.textContent.replace(/[,원\s]/g, '');
    var displayed = parseInt(text, 10);
    if (isNaN(displayed) || displayed === 0) return;

    // 표시된 값 = total_amount * 1.1 → 올바른 값 = displayed / 1.1
    var correct = Math.round(displayed / 1.1);
    amountCell.textContent = correct.toLocaleString() + '원';
    tr._vatFixed = true;
  }

  function observe() {
    var tbody = document.getElementById('adminSentList');
    if (!tbody) return;

    // 이미 렌더링된 행 교정
    tbody.querySelectorAll('tr').forEach(fixRow);

    // 이후 추가되는 행도 교정
    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) {
            if (node.tagName === 'TR') fixRow(node);
            else node.querySelectorAll && node.querySelectorAll('tr').forEach(fixRow);
          }
        });
      });
    }).observe(tbody, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observe);
  } else {
    observe();
  }
})();
