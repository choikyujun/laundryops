# STATUS — 출고수량 표시 (명세서 작성 화면)

> CEgo개발팀 핸드오프 매니페스트. 모든 에이전트/스킬은 작업 전에 이 파일을 먼저 읽는다.
> 대상 제품: LaundryOps v38

## 현재 단계
**개발 진행 중.** 태스크 0·1·2·3 완료. 다음: 태스크 4(미대조 출고 조회 + 합계 표시).

## 단계 게이트
| 단계 | 상태 | 메모 |
|------|------|------|
| 기획 (planner) | 승인 | 2026-09-11. `01-prd-출고수량.md` |
| 설계 (architect) | 승인 | 2026-09-11. `02-architecture-출고수량.md` |
| 디자인 (designer) | 생략 | 기존 v38 UI 패턴 재활용(대조 화면 색 규칙·표 구조). 열 1개 추가라 별도 스펙 불필요 |
| 개발 (dev) | 진행 중 | 태스크 0·1·2·3 완료. features/outbound-qty.js. app_v38.js 무변경 확인 |
| 검증 (qa) | 대기 중 | 태스크 1 배포 후 안드로이드 실기기 확인 — 사장님 확인 대기 |
| 배포준비 | 대기 | dist/ 불필요(루트 서빙) |
| 마케팅 | 해당 없음 | 내부 기능 |

## 결정 로그

| 날짜 | 결정 | 이유 | 단계 |
|------|------|------|------|
| 2026-09-11 | 위치 = 명세서 작성 화면, 단가 열 오른쪽 "출고수량" 열 | 사장님 지정. 작성 시점에 차이를 보게 함 | 기획 |
| 2026-09-11 | 보여줄 값 = 미대조 출고 **전부의 합계** (1건 아님) | 휴무 다음날은 이틀치 출고가 명세서 1장에 묶임 | 기획 |
| 2026-09-11 | 날짜·요일을 보지 않음. 휴무일 설정 없음 | 공장마다 휴무일이 다름. 소진 기준이면 설정 불필요 | 기획 |
| 2026-09-11 | 표 위에 출고 날짜 목록 표시 | 어긋남을 직원이 그 자리에서 알아챔 | 기획 |
| 2026-09-11 | 차이는 색만, 저장 차단 없음 | 불량 제외·재세탁 등 정당한 차이가 있음 | 기획 |
| 2026-09-11 | 자동 입력(클릭 시 채움) 제외 | 직원이 실제 센 숫자를 넣어야 검증이 성립 | 기획 |
| 2026-09-11 | 인쇄물 미반영 | 대조용 숫자, 거래처에 보낼 값 아님 | 기획 |
| 2026-09-11 | 단가 셀 2층 대신 **열 추가 + 가로 스크롤** | 사장님 지정. 폰에서 스크롤로 해결 | 기획 |
| 2026-09-11 | 품목 열 sticky 고정 (엑셀 방식) | 스크롤 시 어느 품목인지 유지 | 기획 |
| 2026-09-11 | 소진 기록 = `hotel_outbounds.invoice_id` 컬럼 | 별도 테이블보다 단순. 출고 1건은 명세서 1건에만 묶임 | 설계 |
| 2026-09-11 | `on delete set null` | 명세서 삭제 시 되돌림을 DB가 자동 처리 | 설계 |
| 2026-09-11 | 대조 짝짓기 = 월 내 순번 → `invoice_id` | 기존 순번 매칭은 휴무마다 한 칸씩 밀림(월 4~5칸) | 설계 |
| 2026-09-11 | 마이그레이션·기준일 처리 없음 | 기존 출고 데이터 0건 확인 | 설계 |
| 2026-09-11 | CSS 전용 클래스 `inv-scroll` | 같은 `.admin-table`을 쓰는 다른 표 보호 | 설계 |
| 2026-09-11 | 태스크 1(CSS) 후 중단·실기기 확인 | CSS가 이 앱에서 가장 조용히 깨지는 영역 | 설계 |
| 2026-09-11 | `makeRow` 후킹 → `openInvoiceModal` 래핑 + 렌더 후 DOM 후처리 | `makeRow`는 `openInvoiceModal` 내부 지역 `const`(app_v38.js:3184)라 `window`에 없어 캡처 불가. 전체 재구현은 리팩토링 금지 원칙 위반 | 개발 |
| 2026-09-11 | CSS에 `display` 계열 4줄 추가 (설계 문서 보강) | 설계안은 `table-layout`/`width`만 덮어 `display:block`/`display:table`이 살아남음 → 스크롤 미발생 | 개발 |
| 2026-09-11 | `.inv-scroll`에 `overflow:visible` 명시 | 모바일 블록의 `.admin-table{overflow-x:auto}`를 해제해 스크롤 주체를 `.table-scroll-wrap` 하나로 고정 | 개발 |
| 2026-09-11 | 저장 성공 판정 = `#invoiceFormArea` 숨김 여부, `invoice.id`는 `(factory_id, hotel_id, date)` 재조회 | `invoiceId`가 함수 지역 `let`이라 반환·노출 없음. 실패 경로는 전부 early return이라 폼이 남음 | 개발 |
| 2026-09-11 | `(factory_id, hotel_id, date)`는 유일 키 — 재조회 안전 | 사장님 확정. 같은 날 같은 거래처 명세서 2장 불가, 수정 화면으로 진입 | 사장님 |
| 2026-09-11 | 소진은 "이미 그 명세서에 묶인 출고가 있으면 건너뜀". 소진 실패는 에러 아님 | 사장님 확정. 미소진 출고는 다음 명세서에 합산되어 직원이 그 자리에서 알아챔 | 사장님 |
| 2026-09-11 | `calcTotal` 가드를 `cells.length < 6` 상수가 아니라 **클래스 유무**(`.item-price`/`.qty-input`/`.item-amount`)로 판정 | 상수 6으로 바꾸면 출고 미사용 거래처(5칸)의 품목 행이 전부 걸러져 **합계가 0원**이 된다. 원본 의도인 "품목 행만 처리"를 그대로 살림 | 개발 |
| 2026-09-11 | 출고수량 셀 표식 클래스 = `ob-qty-col` | thead 는 정적 마크업이라 거래처를 바꿔도 남는다. 매 렌더마다 제거 후 재삽입해야 잔존·중복이 없음 | 개발 |

## 알려진 결함 (이 작업으로 함께 해소)

**기존 대조 로직이 휴무마다 밀린다.** `outbound-compare.js:113-118`이 월 내 순번으로만 짝을 맺어, 출고 2건 : 명세서 1건이 되는 휴무 주부터 한 칸씩 어긋난다. 한 달이면 4~5칸. `invoice-compare.js:67-69`도 동일.

## 태스크 2 실행 결과 (2026-09-11, 사장님 Supabase 에디터)
- `invoices.id` / `hotel_outbounds.id` **둘 다 text** → A안 적용
- `invoices_pkey` 존재, FK 정상 생성 (`ON DELETE SET NULL` 확인)
- RLS: `hob_rw`(factory/staff) + `hob_hotel` 둘 다 `cmd=ALL`, `rls_enabled=true` → **현장직원 소진 처리 가능**
- `hotel_outbounds.invoice_id` text nullable + `idx_hotel_outbounds_unclaimed` 생성 완료
- 기존 출고 5건(테스트 데이터) 삭제 → **현재 0건**, 마이그레이션 불필요 확정

### 새로 확인된 제약 — 설계 반영 필요
**`hotel_outbounds`에 `UNIQUE(hotel_id, date)` 가 있다.** 거래처별 하루 출고 1건, 같은 날 두 번 입력 불가.
- 태스크 4: "미대조 출고 전부 합산"은 **서로 다른 날짜의 출고 N건**을 모으는 것이 된다(같은 날 중복 없음). 날짜 목록 표시가 자연스럽게 중복 없이 나온다
- 태스크 6: 소진 대상이 날짜별 1건씩이라 `update ... where hotel_id=? and invoice_id is null` 한 번으로 처리 가능
- 출고 입력 모달의 "수정 모드"(`existingObId`)가 이 제약 때문에 존재하는 것으로 보임 — 신규 INSERT 재시도 시 UNIQUE 위반

## 태스크 0 확인 결과 (2026-09-11)
- [x] `invoices.id` = **text** (`'inv_' + Date.now()` app_v38.js:1100, 7479). FK `invoice_id text` 확정
- [x] `hotel_outbounds` 컬럼 — 리포에 DDL 없음. 코드 확인분: `id`(text), `hotel_id`, `factory_id`, `date`. **추가 컬럼 유무는 태스크 2 SQL로 확인**
- [x] 저장 성공 판정 = 공통 종착 app_v38.js:1119-1128(`#invoiceFormArea` 숨김). `invoiceId`는 지역 `let`(1067)이라 **직접 확보 불가** → 재조회 우회
- [x] 명세서 삭제 경로 **4곳** (app_v38.js:661, 1114, 1388, 7504) — `on delete set null`이 전부 커버, 되돌림 로직 불필요
- [x] `.chart-container` = `#invoiceFormArea` 자신(index.html:835). **sticky는 안 깨짐** (스크롤 컨테이너 `.table-scroll-wrap`이 그 안쪽). 진짜 장애물은 style.css:34-35의 `display` 규칙
- [x] RLS update 권한 **있음** — `hob_rw ... for all`, `role in ('factory','staff') and factory_id = jwt_factory()` (laundryops_auth_rls.sql:131). Supabase Auth 실사용 확인(app_v38.js:2972). **라이브 DB 적용 여부는 태스크 2에서 확인**

## 코드 기준점 (사전 조사 2026-09-11)
- 품목 행 렌더: `app_v38.js:3184-3200` `makeRow()`
- 표 마크업: `index.html:840-842` (`품목/단위/단가/수량/금액` 5열)
- `calcTotal()` 가드: `app_v38.js:3223` `cells.length < 5`
- `colspan 5`: `app_v38.js:3165, 3180, 3209`
- Enter 이동: `app_v38.js:1172` `handleQtyKeydown()` — `.inv-qty` 순회
- 모바일 CSS: `style.css:31, :103` 두 블록 / `.chart-container` `overflow:hidden` `:122`
- 출고 테이블: `hotel_outbounds`(id, hotel_id, factory_id, date), `hotel_outbound_items`(outbound_id, item_name, qty)
- 허용 오차: `hotels.outbound_tolerance_pct` (기본 5)

## 산출물
- [x] `01-prd-출고수량.md` — 기획
- [x] `02-architecture-출고수량.md` — 설계(스키마·CSS·태스크·킥오프)
- [ ] 디자인 — 생략(기존 UI 재활용)
- [x] `features/outbound-qty.js` — 태스크 1(클래스 부여) + 태스크 3(출고수량 열 구조). 태스크 4~6에서 확장
- [x] `style.css` — `.admin-table.inv-scroll` 블록 추가 (style.css:190~)
- [x] `index.html` — 스크립트 태그 추가, `style.css?v=20260911_1` 캐시 갱신
