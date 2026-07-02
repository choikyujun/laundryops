(function () {
  // ── [작업1] 목록 '일자' 열을 발행일(inv.date)로 표시 ──
  const _origRender = window.renderAdminInvoicePage;
  window.renderAdminInvoicePage = function () {
    if (typeof _origRender === 'function') _origRender.apply(this, arguments);
    try {
      const tbody = document.getElementById('adminRecentInvoiceList');
      if (!tbody || typeof _adminInvoiceAllData === 'undefined') return;
      const start = (_adminInvoicePage - 1) * ADMIN_INVOICE_PAGE_SIZE;
      const pageData = _adminInvoiceAllData.slice(start, start + ADMIN_INVOICE_PAGE_SIZE);
      tbody.querySelectorAll('tr').forEach((tr, i) => {
        if (pageData[i] && tr.cells[0]) tr.cells[0].textContent = pageData[i].date; // 발행일
      });
    } catch (e) { console.warn('[invoice-view-ux] 발행일 패치 오류', e); }
  };

  // ── [작업3] 거래명세서 보기 팝업 마우스 드래그 이동 ──
  function setupDrag() {
    const modal = document.getElementById('invoiceDetailModal');
    if (!modal) return;
    const content = modal.querySelector('.modal-content');
    if (!content || content._dragReady) return;
    content._dragReady = true;
    content.style.cursor = 'move';
    let on = false, sx = 0, sy = 0, ox = 0, oy = 0;
    const start = (x, y, t) => { if (t && t.closest('button,input,select,textarea,a')) return; on = true; sx = x; sy = y; };
    const move  = (x, y) => { if (on) content.style.transform = `translate(${ox + (x - sx)}px, ${oy + (y - sy)}px)`; };
    const end   = () => { if (!on) return; on = false; const m = /translate\(([-0-9.]+)px,\s*([-0-9.]+)px\)/.exec(content.style.transform); if (m) { ox = parseFloat(m[1]); oy = parseFloat(m[2]); } };
    content.addEventListener('mousedown', e => start(e.clientX, e.clientY, e.target));
    window.addEventListener('mousemove', e => move(e.clientX, e.clientY));
    window.addEventListener('mouseup', end);
    content.addEventListener('touchstart', e => { const t = e.touches[0]; start(t.clientX, t.clientY, e.target); }, { passive: true });
    window.addEventListener('touchmove', e => { const t = e.touches[0]; move(t.clientX, t.clientY); }, { passive: true });
    window.addEventListener('touchend', end);
    content._resetPos = () => { content.style.transform = ''; ox = 0; oy = 0; };
  }
  const _origOpen = window.openModal;
  window.openModal = function (id) {
    if (typeof _origOpen === 'function') _origOpen.apply(this, arguments);
    if (id === 'invoiceDetailModal') { setupDrag(); const c = document.querySelector('#invoiceDetailModal .modal-content'); if (c && c._resetPos) c._resetPos(); }
  };
  document.addEventListener('DOMContentLoaded', setupDrag);
})();
