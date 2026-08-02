// 인쇄 2페이지 넘침 수정 — printReport 오버라이드
// 원인: app_v38.js:2607 printReport의 <style>에 @page가 없어 브라우저 기본 여백 +
//       body padding:20px 로 리포트가 2페이지로 밀림 (형제 인쇄 함수 1470/4413/4924/5312/5761 은 모두 @page 지정).
// app_v38.js 직접 수정 대신, 마지막 할당이 이기는 window.printReport 를 동일 로직 + 수정 스타일로 재정의.
// 원본 함수는 elementId 와 전역 document/window 만 사용(비공개 상태 의존 없음)하므로 안전하게 대체 가능.
(function () {
  window.printReport = function (elementId) {
    const el = document.getElementById(elementId);
    if (!el) { alert('인쇄할 내용을 찾을 수 없습니다.'); return; }

    // 요소 복제
    const clone = el.cloneNode(true);

    // 인쇄 시 불필요한 요소 제거. 원본 셀렉터(.no-print/.btn-send/.btn-neutral)에 더해
    // button 전체를 제거한다 — 발송 팝업 버튼(월말차감/발송/인쇄, app_v38.js:7317)과
    // email-send 주입 파일저장 버튼(#downloadReportBtn)은 클래스가 없어 원본 셀렉터로는
    // 안 걸리고 인쇄에 딸려 들어가 2페이지로 밀림. 리포트 본문은 표/div뿐이라 button 제거는 안전.
    const toRemove = clone.querySelectorAll('.no-print, .btn-send, .btn-neutral, button');
    toRemove.forEach(node => node.remove());

    // 인쇄 창 생성
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) { alert('팝업 차단을 해제해주세요.'); return; }

    printWindow.document.write(`
    <html>
    <head>
        <title>인쇄</title>
        <style>
            /* 형제 인쇄 함수(5761) 패턴: A4 세로, 좁은 여백 */
            @page { size: A4 portrait; margin: 8mm; }
            body { font-family: 'Malgun Gothic', sans-serif; padding: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; page-break-inside: avoid; }
            tr { page-break-inside: avoid; }
            th { background: #f1f5f9; border: 1px solid #cbd5e1; text-align: center; font-weight: 700; }
            td { border: 1px solid #cbd5e1; text-align: center; }
            .total-row { font-weight: bold; background: #eee; }
            /* 사장님 요청에 따른 디자인 조정 */
            th:nth-child(2), td:nth-child(2),
            th:nth-child(3), td:nth-child(3),
            th:nth-child(4), td:nth-child(4) { text-align: right; }
            th:nth-child(1), td:nth-child(1) { text-align: left; }
        </style>
    </head>
    <body>
        ${clone.innerHTML}
    </body>
    </html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };
})();
