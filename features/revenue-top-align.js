// features/revenue-top-align.js
// 매출 TOP 목록(어드민 대시보드)의 금액 열을 오른쪽 정렬 + 등폭 숫자(tabular-nums)로.
// app_v38.js는 수정 금지 → 렌더는 app_v38.js가 하고, 여기서 CSS만 주입해 자릿수 세로 정렬을 보정.
// 대상: #adminTopRankingArea 테이블의 마지막 열(이번 달 매출). 순위·거래처명 열, 헤더는 미변경.
(function () {
  var STYLE_ID = 'revenue-top-align-style';
  if (document.getElementById(STYLE_ID)) return;

  // 금액은 마지막 td에 직접 텍스트("2,700,000원")로 들어감(span 래핑 없음).
  // 앱 기본 폰트에 tabular figures가 없어 tabular-nums가 무시될 수 있으므로
  // monospace 폰트 스택으로 숫자 등폭을 보장한다. "원"은 폴백되지만 정렬은 숫자 폭이 결정.
  var css =
    '#adminTopRankingArea table td:last-child {' +
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
