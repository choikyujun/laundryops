// features/revenue-top-align.js
// 금액 열을 오른쪽 정렬 + 등폭(monospace/tabular) 숫자로 보정해 자릿수를 세로로 맞춘다.
// app_v38.js는 수정 금지 → 렌더는 app_v38.js가 하고, 여기서 CSS 규칙만 주입.
// CSS 규칙 주입 방식이므로 페이징/재렌더/지연 렌더 시에도 자동 적용된다.
// 대상:
//  1) 매출 TOP: #adminTopRankingArea 테이블 마지막 열(이번 달 매출).
//  2) 거래명세서 목록: #adminRecentInvoiceList 3번째 열(총 금액). 6열 중 3열, span 없음.
// 순위·거래처명·일자·계약·상태·관리 등 다른 열과 헤더는 미변경.
(function () {
  var STYLE_ID = 'revenue-top-align-style';
  if (document.getElementById(STYLE_ID)) return;

  // 금액은 해당 셀에 직접 텍스트("2,700,000원")로 들어감(span 래핑 없음).
  // 앱 기본 폰트에 tabular figures가 없어 tabular-nums만으로는 무시될 수 있으므로
  // monospace 폰트 스택으로 숫자 등폭을 보장한다. "원"은 폴백되지만 정렬은 숫자 폭이 결정.
  var css =
    '#adminTopRankingArea table td:last-child,' +
    '#adminRecentInvoiceList td:nth-child(3) {' +
    '  text-align: right;' +
    '  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;' +
    '  font-variant-numeric: tabular-nums;' +
    '  font-feature-settings: "tnum" 1;' +
    '}';

  var style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;

  function inject() {
    if (document.getElementById(STYLE_ID)) return;
    (document.head || document.documentElement).appendChild(style);
  }

  if (document.head) {
    inject();
  } else {
    document.addEventListener('DOMContentLoaded', inject);
  }
})();
