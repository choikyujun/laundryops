# STATUS — 출고 대조 화면 재배치 + 월 누계 인쇄

> CEgo개발팀 핸드오프 매니페스트. 모든 에이전트/스킬은 작업 전에 이 파일을 먼저 읽는다.
> 대상 제품: LaundryOps v38

## 현재 단계
**개발 진행 중.** 태스크 0(사전 확인)·1(함수 분리 + 재배치) 완료. 다음: 태스크 2(월 합계 버튼).

## 단계 게이트
| 단계 | 상태 | 메모 |
|------|------|------|
| 기획 (planner) | 승인 | 2026-09-11. `01-prd-출고합계인쇄.md` |
| 설계 (architect) | 승인 | 2026-09-11. `02-architecture-출고합계인쇄.md` |
| 디자인 (designer) | 생략 | 기존 모달·대조 화면 패턴 재활용 |
| 개발 (dev) | 진행 중 | 태스크 0·1 완료. features/outbound-compare.js 만 수정. app_v38.js 무변경 확인 |
| 검증 (qa) | 대기 | 안드로이드 실기기 + 인쇄 미리보기 확인 |
| 배포준비 | 대기 | dist/ 불필요(루트 서빙) |
| 마케팅 | 해당 없음 | 내부 기능 |

## 태스크 0 확인 결과 (2026-09-11)
- `window.printReport` 는 4곳에서 정의되고 `print-fix.js:7` 이 최종 승자(로드 순서 1523 > 1504). 구조: `getElementById` → `cloneNode` → `.no-print/.btn-send/.btn-neutral/button` 제거 → `window.open` → `<style>`+`innerHTML` → 500ms 후 `print()`/`close()`
- 인쇄 CSS 의존 선택자: `th/td:nth-child(1)` 좌측, `(2)(3)(4)` 우측. 5열 대조표의 판정 열(5)은 규칙 밖. `print-color-adjust` 없음 → 배지 배경색 인쇄 안 됨
- 기존 `printReport` 호출처 4곳: `app_v38.js:255`, `:274`, `:7792`, `consignment-hotel.js:1106`
- 모달 패턴: `_initModal` IIFE 로 `.modal-overlay`+`.modal-content` 동적 생성 (`outbound-compare.js:800`, `invoice-compare.js:155`). 열고닫기 `openModal`/`closeModal`(`app_v38.js:226`)
- ◀▶ 버튼 선례: `app_v38.js:614-641` 페이징 (`padding:6px 12px;border-radius:6px;border:1px solid #cbd5e1`, disabled 시 `opacity:0.4`)
- 월 변수: `_render()` 지역 `const month` 뿐. **모듈 월 변수 없음** → 상태 격리에 유리
- 버튼 행: `display:flex;flex-wrap:wrap;gap:8px` 래퍼가 세 갈래에 중복. 같은 행 추가 가능하나 `isCurrentMonth` 안에 있음

### 기존 상태 (이번 범위 밖, 참고)
`index.html` 에 중복 ID: `hotelView` 2개(771, 890), `hotelInvoiceMonth` 2개(798, 946).
`showView` 가 `getElementById` 를 쓰므로 **첫 번째만 활성** — 890행 이하 블록은 표시되지 않는 죽은 마크업.
`outboundCompareSection`(816)은 1개이고 살아있는 첫 번째 `hotelView` 안에 있어 우리 코드는 영향 없음.

## 선행 작업
이 기능은 **출고수량 기능(`STATUS-출고수량.md`)의 태스크 7 이후**를 전제로 한다. 누계 계산이 `invoice_id` 기준으로 정리된 상태에서만 숫자가 맞는다.

## 결정 로그

| 날짜 | 결정 | 이유 | 단계 |
|------|------|------|------|
| 2026-09-11 | 일자별 내역을 출고 입력 버튼 바로 아래로 이동 | 매일 보는 화면이 먼저 와야 함 | 기획 |
| 2026-09-11 | 월 누계 대조표는 섹션에서 빼고 팝업으로 | 월 단위 확인은 상시 필요하지 않음 | 기획 |
| 2026-09-11 | 버튼 위치 = 출고 입력 버튼과 같은 행 오른쪽 끝 | 사장님 지정 | 기획 |
| 2026-09-11 | 버튼 이름 = `M월 합계` (현재 월 동적) | 어느 달 합계인지 바로 보임 | 기획 |
| 2026-09-11 | 팝업에서 월 선택 가능 | 지난달 확인·인쇄 수요 | 기획 |
| 2026-09-11 | **팝업 월 변경 시 뒤 화면은 불변** | 팝업은 임시 확인 작업. 닫았을 때 맥락이 끊기면 안 됨 | 기획 |
| 2026-09-11 | 인쇄는 월 누계만, 일자별 제외 | 세탁공장과 월 단위로 맞추는 용도 | 기획 |
| 2026-09-11 | 신규 파일 없이 `outbound-compare.js` 안에서 | 같은 섹션의 일. 쪼개면 상태 공유가 번거로움 | 설계 |
| 2026-09-11 | `_buildSummaryHTML(ym)`이 월을 인자로 받음 | 팝업이 다른 월을 그려야 함 | 설계 |
| 2026-09-11 | 팝업 월은 전용 변수, 섹션 월과 분리 | 공유하면 뒤 화면·버튼 이름이 따라 바뀜 | 설계 |
| 2026-09-11 | 누계 계산은 출고수량 태스크 7 로직 재사용 | 두 벌 관리 시 숫자가 어긋남 | 설계 |
| 2026-09-11 | 신규 SQL 없음 | 기존 조회에 월 인자만 바꿔 재사용 | 설계 |
| 2026-09-11 | 인쇄는 **별도 경로**, `window.printReport` 미변경 | 기존 인쇄 CSS가 `th:nth-child(2),(3),(4)` 로 열 위치에 의존해 5열 대조표와 어긋남. `print-color-adjust` 도 없어 판정 배지 색이 인쇄에서 사라짐(PRD 3-4 위반). 기존 호출처 4곳 보호 | 태스크 0 |
| 2026-09-11 | 팝업은 기존 `_initModal` 동적 생성 패턴 재사용, `index.html` 은 캐시 태그만 | 새로 발명 금지 원칙. 또한 `index.html` 에 `hotelView`·`hotelInvoiceMonth` 중복 ID 가 있어(각 2개, 첫 번째만 활성) 마크업 추가를 피하는 편이 안전 | 태스크 0 |
| 2026-09-11 | 조회+누계 계산을 `_loadMonthData(ym)` 로 분리 | `_render()` 본문에 인라인이라 팝업이 다른 월을 못 그림. 계산이 한 곳뿐이어야 섹션·팝업 숫자가 어긋나지 않음 | 태스크 1 |
| 2026-09-11 | 모듈에 월 상태를 두지 않고 `_sectionMonth()` 로 매번 DOM 에서 읽음 | 팝업 전용 월과 섞일 구조 자체를 없앰. `_loadMonthData` 는 인자만 보고 모듈 월을 일절 읽지 않음 | 태스크 1 |
| 2026-09-11 | 버튼 행을 `_buildButtonRow()` 로 분리하고 `isCurrentMonth` 밖으로 | 지난 달을 보고 있으면 행이 통째로 사라져 월 합계 버튼도 같이 없어짐 | 사장님 |
| 2026-09-11 | 안내 배지를 버튼 다음 줄로 분리 | 폰 360px 에서 버튼(180px)+배지(220px)가 이미 두 줄. 합계 버튼을 더하면 세 줄이 됨 | 사장님 |

## 미해결 (태스크 0에서 코드 확인)
- [ ] `print-fix.js`의 `printReport()` 오버라이드 구조, 인쇄 CSS 의존 선택자
- [ ] 대조표에 기존 인쇄 경로 재사용 가능 여부 → 재사용 vs 별도 경로 결정
- [ ] 앱 내 기존 모달 패턴 (재사용 대상)
- [ ] `_buildHTML()` 현재 구조와 월 변수명
- [ ] "오늘 출고 입력" 버튼 행 마크업 — 같은 행에 버튼 추가 가능한지

## 코드 기준점
- 대조 섹션: `#outboundCompareSection`, `app_v38.js:2379` `loadOutboundSection(hData)` 호출
- 표시 조건: `_isOutboundEnabled(hData)` = `use_outbound_input && contract_type !== 'fixed'`
- 판정식: `window._obCompareUtils.diffCalc(obQty, invQty, tolerancePct)`
- 색 규칙: 정상 `#065f46` / 확인 필요 `#991b1b` / 양수 `#059669` / 음수 `#dc2626` / 없음 `#9ca3af`
- 인쇄: `printReport()` → `print-fix.js`가 오버라이드. CSS가 `th:nth-child(2),(3),(4)` 열 위치 의존

## 산출물
- [x] `01-prd-출고합계인쇄.md` — 기획
- [x] `02-architecture-출고합계인쇄.md` — 설계
- [ ] 디자인 — 생략(기존 패턴 재활용)
- [ ] `features/outbound-compare.js` 수정 — 코드 (Claude Code)
