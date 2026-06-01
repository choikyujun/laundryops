// 발송내역 내역 확인 팝업 — 리포트 HTML 파일 다운로드 버튼 주입
(function () {

  function getReportTitle() {
    var printArea = document.getElementById('send-report-print-area');
    if (!printArea) return '세탁 거래명세서';
    var h2 = printArea.querySelector('h2');
    return h2 ? h2.textContent.trim() : '세탁 거래명세서';
  }

  function downloadReportHtml() {
    var printArea = document.getElementById('send-report-print-area');
    if (!printArea) { alert('리포트 내용을 찾을 수 없습니다.'); return; }

    var title = getReportTitle();
    var html = '<!DOCTYPE html>\n<html lang="ko">\n<head>\n'
      + '<meta charset="UTF-8">\n'
      + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
      + '<title>' + title + '</title>\n'
      + '<style>\n'
      + '  body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; padding: 20px; color: #0f172a; }\n'
      + '  table { border-collapse: collapse; width: 100%; }\n'
      + '  th, td { border: 1px solid #cbd5e1; padding: 4px 6px; font-size: 12px; }\n'
      + '  th { background: #f8fafc; font-weight: 700; }\n'
      + '  h2 { font-size: 16px; }\n'
      + '</style>\n'
      + '</head>\n<body>\n'
      + printArea.innerHTML
      + '\n</body>\n</html>';

    var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var area = document.getElementById('sendInvoiceArea');
    var hName = (area && area.dataset.hotelName) ? area.dataset.hotelName : title;
    var sDate = (area && area.dataset.periodStart) || '';
    var eDate = (area && area.dataset.periodEnd) || '';
    var safeHotel = hName.replace(/[\/\\:*?"<>|]/g, '_');
    var nameParts = [safeHotel, sDate, eDate].filter(Boolean);
    a.download = nameParts.join('_') + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function injectButton(area) {
    if (area.querySelector('#downloadReportBtn')) return;

    var printBtn = area.querySelector('button[onclick*="printReport"]');
    if (!printBtn) return;

    var btn = document.createElement('button');
    btn.id = 'downloadReportBtn';
    btn.textContent = '💾 파일 저장';
    btn.style.cssText = 'padding:10px 20px; cursor:pointer; font-size:14px; font-weight:700; background:#3b82f6; color:white; border:none; border-radius:8px;';
    btn.onclick = downloadReportHtml;

    printBtn.parentNode.insertBefore(btn, printBtn);
  }

  function observe() {
    var area = document.getElementById('sendInvoiceArea');
    if (!area) return;
    new MutationObserver(function () { injectButton(area); })
      .observe(area, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observe);
  } else {
    observe();
  }
})();
