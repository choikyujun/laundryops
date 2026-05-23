// 발송내역 내역 확인 팝업 — "이메일 발송" 버튼 주입
// 리포트를 HTML 파일로 다운로드 + 이메일 앱 실행
(function () {

  function getReportMeta() {
    var printArea = document.getElementById('send-report-print-area');
    if (!printArea) return { title: '세탁 거래명세서', period: '' };

    var h2 = printArea.querySelector('h2');
    var title = h2 ? h2.textContent.trim() : '세탁 거래명세서';

    // "조회 기간: YYYY-MM-DD ~ YYYY-MM-DD" 텍스트 추출
    var period = '';
    printArea.querySelectorAll('div').forEach(function (el) {
      if (el.children.length === 0 && el.textContent.indexOf('조회 기간') !== -1) {
        period = el.textContent.trim();
      }
    });

    return { title: title, period: period };
  }

  function downloadReportHtml() {
    var printArea = document.getElementById('send-report-print-area');
    if (!printArea) { alert('리포트 내용을 찾을 수 없습니다.'); return null; }

    var meta = getReportMeta();

    var html = '<!DOCTYPE html>\n<html lang="ko">\n<head>\n'
      + '<meta charset="UTF-8">\n'
      + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
      + '<title>' + meta.title + '</title>\n'
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
    var fileName = meta.title.replace(/[\/\\:*?"<>|]/g, '_') + '.html';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);

    return { fileName: fileName, meta: meta };
  }

  function showToast(msg) {
    var toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText = [
      'position:fixed', 'bottom:32px', 'left:50%', 'transform:translateX(-50%)',
      'background:#1e293b', 'color:#fff', 'padding:13px 28px',
      'border-radius:10px', 'font-size:14px', 'font-weight:600',
      'z-index:99999', 'box-shadow:0 4px 16px rgba(0,0,0,0.3)',
      'white-space:nowrap', 'pointer-events:none'
    ].join(';');
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 4500);
  }

  function onEmailClick() {
    var result = downloadReportHtml();
    if (!result) return;

    var subject = encodeURIComponent(result.meta.title);
    var body = encodeURIComponent(
      '안녕하세요,\n\n월정산 리포트를 첨부 파일로 보내드립니다.\n'
      + (result.meta.period ? result.meta.period + '\n' : '')
      + '\n다운로드된 파일(' + result.fileName + ')을 이메일에 첨부해주세요.\n\n감사합니다.'
    );

    // 이메일 앱 실행 (300ms 뒤 — 다운로드 트리거 후 열기)
    setTimeout(function () {
      window.open('mailto:?subject=' + subject + '&body=' + body, '_blank');
    }, 300);

    showToast('📥 파일 다운로드 완료 — 이메일에 첨부 후 발송해주세요');
  }

  function injectButton(area) {
    if (area.querySelector('#emailSendBtn')) return;

    var printBtn = area.querySelector('button[onclick*="printReport"]');
    if (!printBtn) return;

    var btn = document.createElement('button');
    btn.id = 'emailSendBtn';
    btn.textContent = '📧 이메일 발송';
    btn.style.cssText = 'padding:10px 20px; cursor:pointer; font-size:14px; font-weight:700; background:#3b82f6; color:white; border:none; border-radius:8px;';
    btn.onclick = onEmailClick;

    printBtn.parentNode.insertBefore(btn, printBtn);
  }

  function observe() {
    var area = document.getElementById('sendInvoiceArea');
    if (!area) return;

    var observer = new MutationObserver(function () {
      injectButton(area);
    });
    observer.observe(area, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observe);
  } else {
    observe();
  }
})();
