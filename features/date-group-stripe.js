// 어드민 거래명세서 목록: 날짜 그룹 단위 줄무늬 + 호버 강조
// renderAdminInvoicePage (app_v38.js) 를 오버라이드해 클래스만 추가하며, 데이터 로직은 불변.
(function () {
  function getDateKey(cellText) {
    var s = cellText.trim();
    // YYYY-MM-DD 형식이면 앞 10자, MM-DD HH:mm 형식이면 앞 5자
    return /^\d{4}-/.test(s) ? s.slice(0, 10) : s.slice(0, 5);
  }

  function applyDateGroups() {
    var tbody = document.getElementById('adminRecentInvoiceList');
    if (!tbody) return;
    var prevKey = null;
    var groupIdx = 0;
    tbody.querySelectorAll('tr').forEach(function (tr) {
      var cells = tr.querySelectorAll('td');
      if (!cells.length) return;
      var key = getDateKey(cells[0].textContent);
      if (key !== prevKey) {
        if (prevKey !== null) groupIdx = 1 - groupIdx;
        prevKey = key;
      }
      tr.classList.remove('date-group-0', 'date-group-1');
      tr.classList.add('date-group-' + groupIdx);
    });
  }

  function patch() {
    if (typeof window.renderAdminInvoicePage !== 'function') return;
    if (window.renderAdminInvoicePage._dateGroupPatched) return;
    var _orig = window.renderAdminInvoicePage;
    window.renderAdminInvoicePage = function () {
      _orig.apply(this, arguments);
      applyDateGroups();
    };
    window.renderAdminInvoicePage._dateGroupPatched = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patch);
  } else {
    patch();
  }
})();
