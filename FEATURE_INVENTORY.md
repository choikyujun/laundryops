# LaundryOps 기능 인벤토리 (FEATURE INVENTORY)

> **목적** — 신규 제품(렌탈회사용 멀티테넌트 SaaS)의 재사용 명세서를 위한 기초 자료.
> LaundryOps(CEGO 쎄고 세탁고수)의 전체 로직을 테이블·역할·화면·비즈니스 규칙 단위로 정리한다.
> **작성 방식** — 코드베이스 6개 구간 병렬 분석 결과를 통합. 각 기능은 ▸무엇을 하는가 / ▸규칙·예외 / ▸관련 테이블 형식.
>
> **분석 대상 파일**
> - `app_v38.js` (8,226줄, 모놀리식 vanilla-JS SPA 코어)
> - `index.html` (1,554줄, 화면/모달 구조)
> - `features/*.js` (13개 애드온 모듈 — 코어를 override/wrap)
> - `supabase/functions/{send-kakao,account-admin}/index.ts` (Edge Functions, Deno)
> - `billing_logic.js`, `analysis/analysis.js`, `middleware.js`, `laundryops_auth_rls.sql`
>
> **아키텍처 요약** — 순수 클라이언트 SPA + Supabase(Auth·DB·RPC·Edge). 모든 DB 접근은 `window.mySupabase.from(...)`. 계정 CRUD 등 민감 작업만 `account-admin` Edge Function(service_role) 경유. 인증은 **합성 이메일(synthetic email) + JWT `app_metadata.role`** 방식. RLS로 테넌트(공장) 격리.

---

## 목차
1. [DB 스키마](#1-db-스키마)
2. [역할 체계 (권한 매트릭스)](#2-역할-체계-권한-매트릭스)
3. [화면·메뉴 구조](#3-화면메뉴-구조)
4. [핵심 비즈니스 로직](#4-핵심-비즈니스-로직)
5. [요청 목록에 없는데 코드에 존재하는 기능 (누락 방지)](#5-요청-목록에-없는데-코드에-존재하는-기능-누락-방지)
6. [재구축 시 반드시 챙길 핵심 규칙 요약](#6-재구축-시-반드시-챙길-핵심-규칙-요약)
7. [알려진 버그·기술부채 (참고)](#7-알려진-버그기술부채-참고)

---

## 1. DB 스키마

총 **18개 테이블** (RLS 적용 16개 + `delivery_groups` + 레거시). Supabase Postgres. 멀티테넌트 격리 키는 `factory_id`(공장=테넌트), 거래처 격리는 `hotel_id`.

### 1.1 테넌트·계정 계층

| 테이블 | 역할 | 주요 컬럼 | 관계 |
|---|---|---|---|
| **factories** | 세탁공장(테넌트 루트) | `id`(PK, `f_*`), `name`, `admin_id`, `admin_pw`*(deprecated)*, `ceo`, `phone`, `biz_no`, `address`, `bank_info`, `plan`, `plan_expiry`, `sub_status`, `status`, `memo`, `created_at`, `date` | 1:n → hotels, staff, invoices, sent_logs, factory_default_prices, delivery_groups |
| **staff** | 현장직원·배송기사 계정 | `id`, `factory_id`(FK), `name`, `login_id`, `login_pw`*(deprecated)*, `phone`, `role`(`field`/`driver`), `created_at` | n:1 → factories |
| **hotels** | 거래처(호텔·병원·리조트) | `id`(`h_*`), `factory_id`(FK), `name`, `ceo`, `phone`, `address`, `bank_info`, `login_id`, `login_pw`*(dep)*, `contract_type`(`unit`/`fixed`), `fixed_amount`, `hotel_type`(`general`/`special`), `status`(`active`/`inactive`), `is_consignment`(위탁), `use_outbound_input`, `outbound_tolerance_pct`, `outbound_start_date`, `group_id`, `group_name`, `memo`, `kakao`, `created_at` | n:1 → factories, n:1 → delivery_groups(group_id) |
| **delivery_groups** | 배송 그룹(배차 단위) | `id`, `factory_id`(FK), `name`, `created_at` | 1:n → hotels(group_id), 배송기사(staff role=driver) 연결 |

### 1.2 단가 체계

| 테이블 | 역할 | 주요 컬럼 | 관계 |
|---|---|---|---|
| **factory_default_prices** | 공장 기본 단가(신규 거래처 시드) | `id`, `factory_id`(FK), `name`, `price`, `unit`, `sort_order`, `created_at` | n:1 → factories |
| **hotel_categories** | 거래처별 품목 카테고리(특수 거래처용) | `id`, `hotel_id`(FK), `factory_id`, `name`, `price_type`(`general`/`special`), `created_at` | n:1 → hotels |
| **hotel_item_prices** | 거래처별 품목 단가 | `id`, `hotel_id`(FK), `factory_id`, `name`, `price`(공장 단가), `display_price`(위탁 표시 단가), `unit`, `sort_order`, `category_id`, `category_name`, `price_type`(`general`/`special`), `created_at` | n:1 → hotels, n:1 → hotel_categories |

### 1.3 거래·정산

| 테이블 | 역할 | 주요 컬럼 | 관계 |
|---|---|---|---|
| **invoices** | 일일 거래명세서(헤더) | `id`(`inv_*`), `factory_id`, `hotel_id`(FK), `date`, `total_amount`, `is_sent`, `staff_name`, `report_period`, `confirmed_at`, `confirmed_by`, `created_at`, `items`*(레거시 JSONB, 일부 export 경로에서만 사용)* | n:1 → hotels, 1:n → invoice_items |
| **invoice_items** | 명세서 세부 품목 | `id`, `invoice_id`(FK), `name`, `qty`, `price`, `unit` | n:1 → invoices (부모 RLS 위임) |
| **hotel_outbounds** | 거래처 출고 입력(헤더) | `id`(`ob_*`), `hotel_id`(FK), `factory_id`, `date`, `created_at` | 1:n → hotel_outbound_items |
| **hotel_outbound_items** | 출고 세부 품목 | `id`, `outbound_id`(FK), `item_name`, `qty` | n:1 → hotel_outbounds (부모 RLS 위임) |
| **sent_logs** | 월정산 발송 내역(회차 단위) | `id`(=`sent_group_id`), `factory_id`, `hotel_id`(FK), `period`(`"sDate ~ eDate"`), `total_amount`(공급가 기준), `display_total_amount`(위탁 표시 총액), `supply_price`, `vat`, `sent_at`, `is_confirmed`, `created_at` | n:1 → hotels, 차감 invoices와 `staff_name` 태그로 논리 연결 |

### 1.4 결제·플랫폼

| 테이블 | 역할 | 주요 컬럼 | 관계 |
|---|---|---|---|
| **pending_factories** | 가입 신청(승인 대기) | `id`(`req_*`), `name`, `biz_no`, `phone`, `address`, `admin_id`, `admin_pw`, `representative`, `status`, `sub_status`, `plan`, `plan_expiry`, `date` | 승인 시 → factories로 이관 후 삭제 |
| **pending_payments** | 결제 신청(승인 대기) | `id`(`pay_*`), `factory_id`, `factory_name`, `plan`, `months`, `total`, `request_tax_invoice`, `depositor_name`, `date` | 승인 시 → approved_payments로 이관 후 삭제 |
| **approved_payments** | 승인된 결제 이력 | `id`, `factory_id`, `factory_name`, `plan`, `months`, `total`, `request_tax_invoice`, `depositor_name`, `date`, `approved_at`, `new_expiry` | n:1 → factories |
| **platform_settings** | 플랫폼 전역 설정 | `id`(=`'master_config'`), `admin_id`, `admin_phone`, `admin_pw`*(dep)*, `global_notice`, `master_config` | 단일 행 |
| **platform_data_deprecated** | 레거시 JSON 블롭(폐기) | — | 미사용 |

### 1.5 스키마 관계 다이어그램 (텍스트)

```
factories (테넌트)
├─1:n─ staff (role: field=로그인계정 / driver=전화만)
├─1:n─ factory_default_prices (기본 단가 → 신규 hotel에 시드)
├─1:n─ delivery_groups ──1:n── hotels(group_id)
├─1:n─ hotels (거래처)
│        ├─ contract_type: unit(단가제) / fixed(정액제)
│        ├─ hotel_type:    general(일반) / special(특수·카테고리)
│        ├─ is_consignment: 위탁 여부(이중단가)
│        ├─1:n─ hotel_categories (price_type로 general/special 구분)
│        ├─1:n─ hotel_item_prices (price=공장단가, display_price=위탁표시단가)
│        ├─1:n─ hotel_outbounds ──1:n── hotel_outbound_items
│        ├─1:n─ invoices ──1:n── invoice_items
│        └─1:n─ sent_logs (월정산 회차, id=sent_group_id)
├─1:n─ pending_payments → approved_payments
platform_settings (단일행) / pending_factories (가입대기)
```

> **주의 — `contract_type` vs `hotel_type` 혼선**: 특수 거래처 판정이 `contract_type==='special' || hotel_type==='special'` 로 두 컬럼을 OR로 본다. 신규 스키마는 계약방식(단가제/정액제)과 품목유형(일반/특수)을 **명확히 분리**할 것.

---

## 2. 역할 체계 (권한 매트릭스)

**JWT `app_metadata.role`** 4종: `superadmin`, `factory`, `staff`, `hotel`.
로그인 탭(UI role)과 JWT role 매핑 주의 — **공장 대표 탭은 UI role='admin'이지만 JWT role='factory'**.

### 2.1 로그인 도메인 매핑 (합성 이메일)

| UI 탭(role) | 로그인 도메인 | JWT role | 진입 화면 |
|---|---|---|---|
| 슈퍼어드민(superadmin) | `admin.laundryops.app` | `superadmin` | superAdminView |
| 공장대표(admin) | `factory.laundryops.app` | `factory` | adminView |
| 현장직원(staff) | `staff.laundryops.app` | `staff` | staffView |
| 거래처파트너(hotel) | `hotel.laundryops.app` | `hotel` | hotelView |

로그인 시 `id@도메인` 조합으로 `signInWithPassword`. **탭≠계정유형이면 signOut+차단**("이 로그인 유형의 계정이 아닙니다"). 슈퍼어드민 옵션은 **URL 해시 `#superadmin`** 있을 때만 드롭다운 노출(숨김 진입점).

### 2.2 권한 매트릭스 (RLS + 앱 로직)

| 리소스 | superadmin | factory(공장) | staff(직원) | hotel(파트너) |
|---|---|---|---|---|
| factories | 전체 R/W | 자기 공장 R + 본인 수정(요금제/상태 제외) | — | — |
| staff | 전체 | 자기 공장 R/W | 자기 공장 목록 R | — |
| hotels | 전체 | 자기 공장 R/W | 자기 공장 R (단, 운영중만 명세서 대상) | 자기 레코드 R |
| hotel_categories / hotel_item_prices | 전체 | 자기 공장 R/W | 자기 공장 R/W | 자기 것 R |
| hotel_outbounds / _items | 전체 | 자기 공장 R/W | 자기 공장 R/W | **자기 것 R/W (직접 출고 입력)** |
| invoices | 전체 | 자기 공장 R/W | 자기 공장 R/W(발행) | 자기 것 R + **확인(update)** |
| invoice_items | 부모 invoices RLS 위임 | | | |
| sent_logs | 전체 | 자기 공장 R/W | 자기 공장 R | 자기 것 R + **정산확인(update)** |
| approved_payments | 전체 R/W | 자기 것 R | — | — |
| pending_payments | 전체 R/W | 자기 것 R + 신청(insert) | — | — |
| pending_factories | 전체 R/W | — | — | — (익명 insert만 = 가입신청) |
| platform_settings | 전체 R/W | 공지 텍스트만 RPC(`get_global_notice`) | 동일 | 동일 |
| factory_default_prices | 전체 | 자기 공장 R/W | 자기 공장 R/W | — |
| delivery_groups | — | 자기 공장 R/W | (조회) | — |

### 2.3 계정 CRUD 권한 (account-admin Edge Function)

| action | 허용 role | 대상 |
|---|---|---|
| `forgot_password` | 익명(로그인 전) | factories (ID+전화 일치 검증) |
| `approve_factory` / `create_factory` / `delete_factory` / `reset_password` / `update_superadmin` | superadmin | factories / platform_settings |
| `update_factory` | superadmin(전체) / factory(본인, 설명 필드만) | factories |
| `create_staff` / `update_staff` / `delete_staff` | factory(본인 공장) | staff (field=Auth계정 / driver=전화만) |
| `create_hotel` / `update_hotel` / `delete_hotel` | factory(본인 공장) | hotels |

> **비밀번호는 Supabase Auth에만 저장**, 테이블 평문 컬럼(`*_pw`)은 deprecated(마이그레이션 후 삭제 예정). 계정 생성 원자성: Auth 생성 후 행 insert 실패 시 `deleteUser`로 롤백.

---

## 3. 화면·메뉴 구조

`showView(id, title)`로 최상위 뷰 전환, `switchTab(el, tabId)`로 탭 전환, `openModal/closeModal(id)`로 모달.

### 3.1 최상위 뷰

| View | 역할 | 기능 |
|---|---|---|
| **loginView** | 비로그인 | 역할 드롭다운 로그인, 좌/우 마케팅 패널(preview 갤러리·후기·5개월 무료체험), 회원가입 신청·비밀번호 찾기 진입. 모바일은 사이드패널 숨김(≤900px). |
| **superAdminView** | superadmin | 탭 3: 현황 / 계정 / 공지 |
| **adminView** | factory | 구독배너 + 요약카드 4종 + 탭 5(+숨은 요금제 탭). 접이식 "설정 및 관리" 툴바(백업/복구/매뉴얼) |
| **staffView** | staff | 거래명세서 작성 + 발행목록 + 발송 리스트 |
| **hotelView** | hotel | 요약카드 4 + 정산 리포트 수신함 + 입고현황 + 월별 추이/품목 파이 + 출고·명세서 대조 섹션 |

### 3.2 슈퍼어드민 탭

| 탭 | 로더 | 기능 |
|---|---|---|
| 현황(superAdminStats) | `loadSuperAdminDashboard` | 전체 매출/신규공장/총공장 카드, **가입 승인 대기**(pending_factories), **결제 승인 대기**(pending_payments), **결제 승인 내역**(approved_payments, 검색+페이징 10/p), **활성 공장 TOP10**(월선택), **공장 관리**(검색+신규입점+페이징 20/p) |
| 계정(superAdminSettings) | — | 관리자 ID/PW/연락처 설정(`saveAdminCredentials` → account-admin) |
| 공지(superAdminNotice) | — | 전역 공지 배너 textarea(`saveNotice` → platform_settings) |

### 3.3 공장(어드민) 탭

| 탭 | 로더 | 기능 |
|---|---|---|
| 매출지표(adminStats, 기본) | `loadAdminDashboard`+`calculateAdminDashStats` | 요약카드 4(오늘/이번달/올해 YTD/거래처·직원수, 증감%), 6개월 매출 추이 차트, 매출 TOP, **거래명세서 목록**(거래처/기간 필터, 인쇄·월정산 발송, 페이징 50/p) |
| 매출비교(adminAnalysis) | `loadAnalysisTab` → analysis.js | 거래처별 일별 매출·요일별 품목 평균·연도 비교·**발송 리스트(배차 물량 제안)** |
| 거래처(adminHotel) | `renderDeliveryGroups` | 거래처 목록(계약/상태 배지, 정보수정·단가수정·삭제), 신규 등록, **배송 그룹 관리** |
| 직원/발행(adminStaff) | `loadAdminStaffList` | 직원 목록(역할 배지), 신규 등록, 직원 발행 현황(페이징 50/p) |
| 발송내역(adminSent) | `loadAdminSentList` | 월정산 발송 내역(거래처 검색, Excel·내역확인·발송취소, 페이징 50/p) |
| 요금제(adminPayment) | `loadAdminPayment` | *(탭바 버튼 없음, 결제 유도로만 진입)* 라이트 9,900원/엔터프라이즈 29,000원 카드 + 결제 신청 폼 |

### 3.4 현장직원 화면(staffView)
- 거래처+날짜 선택 → 단가표 기반 수량 입력 폼(`openInvoiceModal`) → 저장·인쇄(`saveAndPrintInvoice`)
- 발행목록(`loadStaffInvoiceList`, 날짜/거래처명 검색, 페이징 50/p)
- 발송 리스트(배차 대상·요일 선택, staff-dispatch.js)

### 3.5 거래처 파트너 화면(hotelView) — [4.10 상세]
- 요약카드(월 이용금액/입고횟수/최다품목/계약정보) · 정산 리포트 수신함 · 상세 입고현황 · 월별 추이·품목 파이 · 출고·명세서 대조

### 3.6 모달 (17종)
`registerModal`(가입신청) · `findPwModal`(비번찾기) · `factoryModal`(공장 입점/수정) · `hotelModal`(거래처 등록) · `staffModal`(직원 등록) · `defaultPriceModal`(기본단가) · `simplePriceModal`(일반거래처 단가) · `priceSettingModal`(특수거래처 단가+카테고리) · `deductionModal`(월말 차감) · `invoiceDetailModal`(명세서 상세) · `sendInvoiceModal`(발송 미리보기) · `paymentModal`/`paymentDirectModal`(결제) · `planInfoModal`(요금제 비교) · `manualModal`(사용 매뉴얼) · `backupHelpModal`(백업 가이드) · `outboundInputModal`/`invObCompareModal`(출고 입력·대조, 동적 주입)

### 3.7 스크립트 로드 순서 (override 체이닝 핵심)
```
CDN: chart.js → xlsx → exceljs → supabase-js(window.mySupabase 생성) → driver.css
body: driver.js → billing_logic.js → preview_images.js → app_v38.js(코어)
  → item-name-update → form-guard → dot-linebreak → email-send → fix-vat
  → date-group-stripe → excel-redesign → outbound-compare → invoice-compare
  → consignment-hotel → invoice-view-ux → analysis.js → staff-role → staff-dispatch
```
> **로드 순서 의존성**: `loadSimplePriceList/loadHotelPriceList`는 consignment-hotel이 완전 재정의 → item-name-update가 wrap. `saveNewStaff`는 staff-role 재정의 → form-guard wrap. 신규 제품은 이 monkey-patch 체이닝을 **정식 모듈 구조로 재설계**할 것.

---

## 4. 핵심 비즈니스 로직

### 4.1 일일 명세서 발행 흐름 (현장직원)

**▸무엇을 하는가** — 현장직원이 거래처+날짜를 골라 단가표 기반 수량을 입력하고 명세서를 저장(신규/수정).

**▸규칙·예외**
- **단가표 렌더(`openInvoiceModal`)**: 거래처가 특수(`contract_type==='special' || hotel_type==='special'`)면 `price_type='special'` + `category_name` 그룹 헤더로, 일반이면 `price_type='general'` 평면 렌더. 정렬은 `sort_order`(nullsFirst:false) → `created_at`.
- **수정 모드 자동 판별**: 같은 `hotel_id + date` invoice 존재 시 editMode 배지 + 기존 `invoice_items` 수량 프리필(`savedQtyMap`).
- **저장(`saveAndPrintInvoice`)**:
  - 이중저장 가드(`dataset.saving`), 거래처·날짜 필수.
  - **qty===0은 스킵, 음수(-)는 허용** (반품/차감 라인).
  - `total_amount = Σ price×qty`. 품목 없으면 "수량을 입력해주세요".
  - **신규**: `checkIssuanceLimit()`(요금제 월 발행 상한) 통과 → invoice insert(`id='inv_'+Date.now()`, `is_sent:false`, `staff_name`) → items insert. **items 실패 시 헤더 delete 롤백**(고아 방지).
  - **수정**: 기존 items 백업 → delete → 신규 insert. **insert 실패 시 백업 복원**, 성공 후에만 헤더 `total_amount`/`staff_name` 업데이트.
- 엔터키로 다음 수량칸 이동(`handleQtyKeydown`).

**▸관련 테이블** — `invoices`, `invoice_items`, `hotel_item_prices`, `hotels`

---

### 4.2 월 정산 (sent_logs · sent_group_id · 카카오 알림톡)

**▸무엇을 하는가** — 공장이 거래처의 특정 기간 명세서를 집계해 정산 리포트를 만들고, 발송 시 `sent_logs` 회차 기록 + `invoices.is_sent` 마킹 + 카카오 알림톡을 발송. (핵심 함수: `sendInvoicesToClient` @7210, wrap된 `confirmSendInvoice` @2795)

**▸규칙·예외 (전체 흐름)**
1. **가드**: `checkInvoiceFilters()` 통과, 거래처 ≠ 'all'.
2. **집계**: 기간 내 invoices+items 조회 → 일자×품목 매트릭스(`dailyData`). **`staff_name`이 `관리자(차감)`로 시작하는 명세서는 스킵**(기존 차감 이중계산 방지). `baseSupplyPrice = Σ price×qty`.
3. **차감 반영**: 인메모리 `_currentDeductions`(음수 수량) 적용 → `deductionAmount`(음수). 차감 일자 = 기간 종료일(eDate).
4. **총액**: `supplyPrice = base + deductionAmount`, **`vat = floor(supply × 0.1)`**, `total = supply + vat`.
5. **발송 클릭 시**:
   - `sent_logs` INSERT `{factory_id, hotel_id, period:"sDate ~ eDate", total_amount, sent_at, is_confirmed:false}` → **반환된 `newLog.id`가 `sent_group_id`**.
   - **위탁 거래처면**(consignment-hotel.js): `display_price` 기준 `display_total_amount`도 함께 박제(freeze).
   - **차감 있으면**: 합성 invoice 생성(`id='inv_'+Date.now()+'_'+newLog.id`, `date=eDate`, `total_amount=deductionAmount`, **`staff_name='관리자(차감)_'+newLog.id`**, `is_sent:true`) + items(품목명에 `(차감)` 접미사). **items 실패 시 헤더 delete 롤백.**
   - 기간 내 fetch된 모든 invoices `is_sent=true` 일괄 업데이트(`report_period`도 세팅).
   - `sendKakaoOrMessage()` 호출 → **카카오 알림톡 billing 템플릿** 발송(실패해도 warn만, 흐름 중단 안 함).
6. **발송취소(`deleteSentLog`)**: `staff_name='관리자(차감)_'+logId` invoices의 items·headers 연쇄 삭제 → sent_logs 삭제. (수동 cascade)

**▸관련 테이블** — `sent_logs`, `invoices`(+is_sent/report_period), `invoice_items`, `hotel_item_prices`, `hotel_categories`, `hotels`, `factories(name)`

**카카오 알림톡 (send-kakao Edge Function, 솔라피)**

| type | 용도 | 발송 시점 | 필수 변수 |
|---|---|---|---|
| `join` | 가입 승인 환영 | `approveFactory` 승인 시 | 세탁공장이름 |
| `payment` | 결제 승인 완료 | `approvePayment` 승인 시 | 세탁공장이름, 만료일 |
| `billing` | 월정산 명세서 수신 | 월정산 발송 시 | 세탁공장이름, 호텔이름, 조회시작/종료일 |

- HMAC-SHA256 서명, **알림톡 실패 시 SMS 자동 대체발송**(`disableSms:false`). 전화번호 하이픈 제거.
- 채널 `@laundryops`, pfId `KA01PF260422153127223YPBcJKYZEJU`.

---

### 4.3 단가 체계 (hotel_item_prices · price_type · 위탁 이중단가)

**▸무엇을 하는가** — 거래처별 품목 단가를 유형(일반/특수)과 위탁 여부에 따라 관리.

**▸규칙·예외**
- **`price_type`**: `general`(일반 거래처, '기본' 단일 카테고리) / `special`(특수 거래처, 다중 카테고리). 하나의 hotel_item_prices 테이블을 price_type로 분리.
- **정렬**: `sort_order` ASC(nullsFirst:false) → `created_at`. 드래그로 재정렬(item-name-update.js, `sort_order`를 인덱스로 병렬 UPDATE). NULL sort_order는 저장 시 backfill.
- **위탁(consignment) 이중단가** (consignment-hotel.js):
  - **`price`** = 공장이 실제 수취하는 단가(=직영점 단가) = **정산의 기준**.
  - **`display_price`** = 호텔 파트너에게 보이는 위탁세탁 단가. 미설정이면 `price`로 폴백.
  - **공장(admin) 화면은 항상 `price`**, **호텔 파트너 뷰(`currentHotelId` 존재)만 `display_price`로 환산**. `_getDisplayPriceMap()`이 `{name → display_price ?? price}` 맵 생성.
  - 파트너 대시보드·명세서 상세·정산 상세·수신함·Excel 전부 위탁 시 display_price로 재계산. **admin 화면엔 위탁단가 참고열이 표시되지만 파트너엔 절대 노출 안 함.**
- **품목 추가**: 일반=`addSimpleItem`('기본' 카테고리 자동 생성, price_type='general'), 특수=`addHotelCustomItem`(카테고리 선택 필수, price_type='special', `sort_order=floor(Date.now()/1000)`). 둘 다 upsert onConflict `hotel_id,name`.
- **품목명 변경 cascade**(item-name-update.js): `hotel_item_prices.name` 수정 시 그 호텔의 모든 `invoice_items` 중 old name도 함께 UPDATE.
- **정액제 거래처 단가 수정 시** "정말 수정?" 재확인(매출 무관 경고).

**▸관련 테이블** — `hotel_item_prices`, `hotel_categories`, `factory_default_prices`(시드/폴백), `invoice_items`(cascade)

---

### 4.4 정액제 호텔 (정액 청구 + 수량 입력 병행)

**▸무엇을 하는가** — `contract_type='fixed'` 거래처는 매월 고정액(`fixed_amount`)으로 청구하되, 명세서 수량 입력은 병행(기록용).

**▸규칙·예외**
- 계약방식 선택 시(`toggleFixedAmountField`) 정액 금액 입력 표시. **정액제 선택 시 출고 입력(use_outbound_input) 전면 비활성**(수량 정산이 아니므로).
- **매출 집계에서 정액제 명세서는 제외**(`filterInv`가 `contract_type==='fixed'` 행 배제) → 대신 `fixed_amount`를 **created_at 월 이후 매월** 별도 합산(어드민/슈퍼 대시보드·트렌드 양쪽). **오늘 카드(card1)에는 정액 매출 미포함.**
- 단가 수정·명세서 발행은 가능하나 UI가 "매출에 영향 없음" 경고.

**▸관련 테이블** — `hotels(contract_type, fixed_amount, created_at)`, `invoices`

---

### 4.5 배송기사 (등록 · 관할 호텔 1:n · 3·6·12개월 평균 물량 제안)

**▸무엇을 하는가** — 배송기사를 로그인 없는 staff(role='driver')로 등록하고, 배송 그룹으로 거래처를 묶어 배차하며, 과거 물량 기반 배송 리스트를 생성.

**▸규칙·예외**
- **등록**(staff-role.js `saveNewStaff`): 구분 라디오 field(현장직원, 로그인 O)/driver(배송기사, 로그인 X·전화만). driver는 `create_staff {role:'driver', name, phone}` — Auth 계정 없이 staff 행만.
- **배송 그룹**(analysis.js `renderDeliveryGroups`): `delivery_groups` CRUD, 배송기사 연결(`assignGroupDriver`), 거래처를 그룹에 담기/빼기(`hotels.group_id`). **그룹 1 : 거래처 n**.
- **평균 물량 제안 (핵심 — analysis.js `renderDispatchList`)**: 거래처 또는 **그룹** 선택 + 요일 + **기간(3/6/12개월)** → 해당 요일의 **품목별 평균 발송 수량**(반올림)을 거래처별 표로 산출. 품목 정렬은 `hotel_item_prices.sort_order` 순. 위탁 거래처 "(위탁)" 태그. `printDispatchList()`로 인쇄(품목·수량·확인란·인수자 서명).
- 배차 발송 대상 드롭다운(staff-dispatch.js `populateStaffDispatchTarget`): 거래처+그룹 optgroup, 요일(오늘 기본), 활성 거래처만.

> **주의** — "평균 물량 제안" 로직은 `staff-dispatch.js`가 아니라 **`analysis/analysis.js`의 `renderDispatchList`**에 구현됨. staff-dispatch.js는 드롭다운·발행목록 검색만 담당.

**▸관련 테이블** — `staff(role='driver')`, `delivery_groups`, `hotels(group_id, is_consignment)`, `invoices`, `invoice_items`, `hotel_item_prices`

---

### 4.6 출고·명세서 대조 (±5% 판정 · 확인/3일 자동확정)

**▸무엇을 하는가** — 거래처가 입력한 **출고 수량**(hotel_outbounds)과 공장 발행 **명세서 수량**(invoices)을 대조해 오차를 판정. (outbound-compare.js, invoice-compare.js)

**▸규칙·예외 (정확한 수치)**
- **적용 대상**: `use_outbound_input=true` **AND** `contract_type !== 'fixed'`(정액제 제외).
- **매칭 방식**: 날짜 매칭이 아니라 **N번째 출고 ↔ N번째 명세서 순번 매칭**(`maxLen` 인덱스 페어링). 명세서는 `관리자(차감)` 제외 + `outbound_start_date` 이전 제외 후 date 오름차순.
- **±% 판정(`_diffCalc`)**: `diff = 명세서수량 - 출고수량`.
  - 출고=0: `isOk = (diff===0)` (출고 0인데 명세서 있으면 "확인 필요").
  - 출고>0: `isOk = |diff/출고수량 × 100| ≤ tolerancePct`. **기본 ±5%** (호텔별 `outbound_tolerance_pct`로 커스터마이즈).
  - 페어 품목 중 하나라도 `!isOk`면 해당 일자 "확인 필요".
- **월 누계 집계**: `ob && inv` 둘 다 있는(대조완료) 페어만 합산. `ob && !inv`는 "세탁 대기"(대조 제외).
- **확인/자동확정(`_confirmStatus`)**:
  - `confirmed_at` 있으면 "확인 완료".
  - 미확인 시 **deadline = invoice.date + 3일**. `today ≥ deadline` → **"자동 확정"** 표시(버튼 없음). `today < deadline` → "확인 대기 D-n" + [확인] 버튼.
  - **⚠ 자동확정은 UI 표시일 뿐** — 실제 DB `confirmed_at`을 쓰는 배치/트리거는 코드에 없음. "확인" 버튼만 DB 기록. 신규 제품은 서버 배치/크론으로 실제 확정을 구현할 것.
- **출고 입력(`saveOutboundInput`)**: 당월만, **KST 0~4시 비활성(오전 5시부터)**, 당일 이미 있으면 수정. 과거일(`date < todayKST`) 수정 차단. 수정은 DELETE 후 INSERT(비원자).
- **명세서 확인(`confirmInvoice`)**: 호텔이 `invoices.confirmed_at=now, confirmed_by=currentHotelId` 기록.
- 특수 거래처는 `category_name` 섹션 그룹핑. 공장 대표 화면에서도 명세서 목록의 [비교] 버튼(`openObCompareModal`)으로 동일 대조(로직은 `_obCompareUtils` 공유).

**▸관련 테이블** — `hotel_outbounds`, `hotel_outbound_items`, `invoices(confirmed_at, confirmed_by)`, `invoice_items`, `hotel_item_prices`, `hotels(use_outbound_input, outbound_tolerance_pct, outbound_start_date)`

---

### 4.7 거래처 파트너 화면 기능 전체

**▸무엇을 하는가** — 거래처(호텔) 담당자용 대시보드(`loadHotelDashboard` @2249).

**▸규칙·예외**
- **자기 정보 + 공장 연락처** 별도 조회(FK join 미의존). 계약정보 표시(정액제="정액제 (월 N원)" / 단가제).
- **월 요약**: 조회월 invoices 금액합계·건수·목록. **월말 날짜는 `new Date(y,m,0).getDate()`**로 정확 계산.
- **`관리자(차감)` 명세서는 파트너 화면에서 제외**("투명인간 처리").
- **품목 통계**: 해당월 invoice id로 `invoice_items` `.in()` 조회 → 품목 비중 도넛(최다 품목).
- **6개월 추이**: 독립 쿼리(이중계산 방지) → 막대 차트.
- **정산 리포트 수신함**(`loadHotelReceivedInvoicesList`): sent_logs 목록(sent_at desc, 페이징 10/p), 상태 배지(확인완료/수신완료), [상세]·[Excel] 버튼. 금액은 위탁 시 `display_total_amount`.
- **정산 상세**(`viewSentDetail`, isPartnerView=true): 일자×품목 매트릭스, 위탁 시 display_price 환산, 이 회차 차감(`관리자(차감)_{logId}`)만 포함. **[정산확인] 버튼** → `confirmHotelSettlement`(`sent_logs.is_confirmed=true`, 확인 후 변경 불가).
- **출고·명세서 대조 섹션**: `use_outbound_input && contract_type!=='fixed'`일 때만 표시([4.6]).
- **위탁 거래처면** 카드·입고현황·추이·상세·Excel 전부 display_price로 재계산([4.3]).

**▸관련 테이블** — `hotels`, `factories`, `invoices`, `invoice_items`, `sent_logs`, `hotel_item_prices`, `hotel_categories`, `hotel_outbounds`, `hotel_outbound_items`

---

### 4.8 인증 (Supabase Auth · 합성 이메일)

**▸무엇을 하는가** — 순수 ID 로그인을 합성 이메일로 변환해 Supabase Auth 사용, JWT `app_metadata`로 역할·소속 전달. (`_realLogin` @2930, account-admin Edge)

**▸규칙·예외**
- 로그인: 탭 role별 도메인으로 `id@도메인` 조합 → `signInWithPassword`. 이미 이메일 형태면 그대로.
- **JWT `app_metadata`**: `{role, factory_id?, staff_id?, hotel_id?}`. RLS 헬퍼(`jwt_role/jwt_factory/jwt_hotel`)가 이걸 읽어 테넌트 격리.
- **탭≠계정유형이면 signOut + 차단.**
- 계정 생성/수정/삭제는 전부 `account-admin`(service_role) 경유. **비밀번호는 Auth에만**, 평문 컬럼 미사용.
- **공장 로그인 시 구독상태 자동 재계산**: `plan_expiry` 기준 expired/expiring/active 갱신(단 `trial`은 보존), 변경 시 DB 업데이트. status가 `pending`(승인대기)/`suspended`(미운영)이면 차단. 만료/임박 시 결제 모달 강제 오픈.
- **비밀번호 찾기**: `account-admin forgot_password`(ID+전화 일치 검증) → 6자리 임시비번 → `send-sms`로 문자.
- **슈퍼→공장 대리접속**: `localStorage.adminAccessFactoryId` 세팅(1회용) → 공장 관리자 화면 열람.

**▸관련 테이블** — `factories`, `staff`, `hotels`, `platform_settings`, Supabase Auth

---

### 4.9 결제·구독 (관리자 승인 · 기간별 할인)

**▸무엇을 하는가** — 공장이 결제 신청 → 슈퍼어드민 승인 → 구독 활성화·만료일 연장. (billing_logic.js, `submitPaymentRequest`, `approvePayment` @3930)

**▸규칙·예외**
- **요금제**: 라이트(레벨1, 9,900원/월) / 엔터프라이즈(레벨2, 29,000원/월). **무료요금제=레벨2**(무료체험도 엔터프라이즈 권한).
- **기능 게이트**(레벨2 전용): `UNLIMITED_ISSUANCE`, `STAFF_MANAGEMENT`, `ADVANCED_STATS`, `SPECIAL_HOTEL`(특수 거래처), `DATA_BACKUP`.
- **라이트 제한**: 당월 명세서 **300건**(`checkIssuanceLimit`), 거래처 **10개**(`checkHotelLimit`), 직원 **1명**(`checkStaffLimit`). 초과 시 결제 모달. **모두 `count:'exact',head:true`로 카운트**(행 미fetch).
- **무료체험**: 가입 승인 시 `sub_status:'trial'`, `plan:'무료요금제'`, **만료일 = 승인일 + 5개월**.
- **기간별 할인**(`calculatePaymentTotal`): 1개월=0% / **3개월=5% / 6개월=10% / 12개월=20%**. `subtotal = floor(price×months×(1-할인))`, VAT 옵션 시 `floor(subtotal×1.1)`.
- **결제 신청**(`submitPaymentRequest`): `pending_payments` insert + 관리자에게 SMS(`get_admin_phone` RPC → send-sms).
- **결제 승인**(`approvePayment` — 핵심 기간 계산):
  1. 기준일 = 기존 `plan_expiry`가 미래면 그 날짜(이어붙이기), 없거나 과거면 오늘.
  2. `months`개월 더하되 **말일 보정**(`min(originalDay, 타겟월 말일)` — 1/31+1개월=2/28 방지).
  3. factories 업데이트(`plan`, `sub_status:'active'`, `plan_expiry=newExpiry`).
  4. `approved_payments` insert + `pending_payments` 삭제.
  5. 카카오 payment 알림톡(실패 무시).
- **구독상태 자동 결정**(`saveNewFactory`/로그인): 만료<오늘→expired, 남은일≤15일→expiring, >15일→active(단 명시적 trial 보존).

**▸관련 테이블** — `pending_payments`, `approved_payments`, `factories(plan, sub_status, plan_expiry)`, `platform_settings`

---

### 4.10 매출·경영지표 계산 (calculateAdminDashStats)

**▸무엇을 하는가** — 공장 대시보드 4카드(오늘/이번달/올해 YTD/거래처·직원수) + 매출 TOP + 6개월 추이.

**▸규칙·예외**
- **동기간 대비 증감%**: 오늘=지난달 같은 일자(말일 클램프), 이번달=1일~오늘 vs 전월 동기간, 올해=Jan~현재월 vs 전년 동기간(윤년 클램프).
- **증감 계산**: prev>0이면 `%`, prev=0 & cur>0이면 100%, `|g|<0.05`면 "0.0%".
- **`filterInv` 제외**: `staff_name` `관리자(차감)` 시작(차감) + `contract_type='fixed'`(정액제). 정액 매출은 `fixed_amount`로 별도 월별 합산.
- **1000행 캡 회피**: YTD·트렌드는 **월별 개별 쿼리 Promise.all** 배치. 직원 수는 `count:'exact',head:true`.
- **10분 자동 갱신**(setupAdminAutoRefresh): 어드민+통계탭+foreground+모달 없음일 때만 tick.

**▸관련 테이블** — `invoices`, `hotels`, `staff`(count)

---

## 5. 요청 목록에 없는데 코드에 존재하는 기능 (누락 방지)

> 이 섹션이 본 분석의 핵심 목적. 요청 4번 목록 밖이지만 코드에 실재하는 기능 전부.

### 5.1 계정·플랫폼 운영
- **가입 신청 → 승인 흐름** (`submitRegistration` → `pending_factories` → `approveFactory`): 익명 가입 폼 제출, ID 중복 이중검사(factories.admin_id + pending), 승인 시 Auth 계정+factory 생성+무료체험 5개월 부여, 카카오 join 알림톡.
- **비밀번호 찾기/재설정** (`findAndResetPassword`): ID+전화 검증 → 임시비번 6자리 → SMS.
- **슈퍼→공장 대리접속(impersonation)**: `localStorage.adminAccessFactoryId`(1회용)로 공장 관리자 화면 열람. `initApp` fast-track.
- **전역 공지 배너** (`saveNotice`/`loadGlobalNotice` via `get_global_notice` RPC): 슈퍼가 작성, 전 사용자 상단 배너.
- **슈퍼어드민 계정 설정** (`saveAdminCredentials`): 관리자 ID/PW/전화(`update_superadmin`).
- **숨김 진입점 `#superadmin`** URL 해시로만 슈퍼 로그인 옵션 노출.
- **온보딩 투어**(driver.js `startAdminTour`): 첫 접속 시 5스텝 가이드, `localStorage.tour_completed_{factoryId}` 게이트.

### 5.2 데이터 관리
- **데이터 백업/복구**(`backupFactoryData`/`restoreFactoryData`): 엔터프라이즈 전용, 공장 전체 그래프를 JSON 다운로드/복원(복구는 factories 스칼라 필드만 — hotels/invoices/staff는 미복원).
- **품목명 인라인 편집 + cascade**(item-name-update.js): 단가 품목명 변경 시 invoice_items까지 일괄 갱신.
- **드래그 앤 드롭 품목 정렬**(item-name-update.js): sort_order 재배치.
- **거래처 운영/거래종료 토글**(`toggleHotelStatus`): inactive 거래처는 명세서 화면·발송 대상에서 제외.

### 5.3 명세서·출력
- **명세서 PDF/인쇄**(`exportInvoicesToPDF`): 특수=카테고리 2열 그리드 / 일반=일자×품목 매트릭스. VAT `floor(×0.1)`, 공장 계좌 정보 삽입.
- **정산 Excel 다운로드**(excel-redesign.js `downloadSentLogExcel`): ExcelJS 워크북, CEGO 그린 테마, 위탁 환산·차감·카테고리 처리.
- **발송 리포트 HTML 파일 저장**(email-send.js): 발송 미리보기를 독립 HTML로 Blob 다운로드. *(파일명은 email이지만 실제 이메일 발송 아님)*
- **명세서 상세 스냅샷**(`viewInvoiceDetail`): 단가표 전 품목 나열(수량 0 포함), 공급가만(VAT 없음), 위탁 시 파트너뷰 환산.
- **명세서 목록 UX**: 날짜 그룹 줄무늬(date-group-stripe.js), 발행일 표시·상세 모달 드래그 이동(invoice-view-ux.js), 품목명 마침표 줄바꿈(dot-linebreak.js).

### 5.4 정산·차감
- **월말 차감/클레임 차감**(`openDeductionModal`/`saveDeduction`): 음수 수량 다품목 입력, `_currentDeductions` 인메모리 버퍼, 발송 시에만 합성 invoice(`관리자(차감)_{sentLogId}` 태그)로 영속화.
- **발송내역 이중 VAT 표시 교정**(fix-vat.js): 목록 총금액 역산 보정.
- **정산 회차별 차감 격리**: 상세·Excel에서 `관리자(차감)_{logId}` 정확 매칭으로 다른 회차 차감 배제.

### 5.5 알림·외부 연동
- **SMS 발송**(send-sms Edge, 솔라피/알리고 백업): 가입·결제 신청 시 관리자 통보, 임시비번 발송. 성공 게이트 `statusCode==='2000'`.
- **미들웨어 서브도메인 리다이렉트**(middleware.js): `jinsungc.laundryops.co.kr` → 랜딩 전용.
- **랜딩 페이지**(landing.html): 정적 마케팅(진성크리닝 브랜딩).

### 5.6 매출 분석 탭 (analysis.js, 요청 목록 밖)
- 거래처별 **일별 매출**(다중 거래처 비교, 공휴일 색상), 요일별 **품목 평균 수량**, **월별 연도 비교**, **발송 리스트(배차 물량 제안)**.
- 공휴일 하드코딩(2025·2026), 요일별 색상(공휴일/일요일 빨강, 토요일 파랑).

---

## 6. 재구축 시 반드시 챙길 핵심 규칙 요약

1. **차감(deduction) 이중 컨벤션** — invoice `staff_name='관리자(차감)_{sent_log_id}'` + 품목명 `(차감)`/`(클레임차감)` 접미사. `sent_logs.id` = `sent_group_id` = 그룹핑 키. 목록·대시보드·파트너 화면 전역에서 필터. **신규 제품은 별도 `deductions` 테이블 + FK로 정식화 권장.**
2. **정액제 매출 규칙** — invoices 제외, `fixed_amount`를 created_at 월 이후 매월 합산. 오늘 카드엔 미포함.
3. **위탁 이중단가** — `price`(공장 수취=정산 기준) vs `display_price`(파트너 표시). admin=price, 파트너뷰=display_price. sent_logs에 `display_total_amount` 박제.
4. **price_type(general/special) + category_name** 로 단가표 분리·그룹핑. 특수 판정 `contract_type==='special' || hotel_type==='special'`(신규는 컬럼 분리).
5. **출고 대조 ±5% + 3일 자동확정** — tolerance는 `outbound_tolerance_pct`(기본 5). **자동확정은 현재 UI만, 서버 배치로 실제 확정 구현 필요.**
6. **합성 이메일 인증 + JWT app_metadata** 로 RLS 테넌트 격리. 계정 CRUD는 service_role Edge만.
7. **구독 만료일 이어붙이기 + 말일 보정** 알고리즘(approvePayment). 기간 할인 3/6/12개월=5/10/20%.
8. **요금제 게이트** — 라이트 300건/10거래처/1직원, 엔터프라이즈 무제한. count RPC 사용.
9. **VAT = floor(supply×0.1)** 전역 정률. 목록 표시만 별도 보정(fix-vat).
10. **1000행 PostgREST 캡** — 월별 분할 쿼리 + count RPC로 회피(단 코드 다수 위치에서 미준수 — 신규는 서버 집계/RPC 원칙).
11. **원자성 패턴** — invoice/차감 저장 시 헤더-아이템 롤백 가드. (출고 수정 DELETE+INSERT는 비원자 → 개선 필요)
12. **월말 날짜** `new Date(y,m,0).getDate()`, 시간 표시 **KST(+9h)** 수동 보정.

---

## 7. 알려진 버그·기술부채 (참고)

> 신규 제품에서 **재현하지 말아야 할** 항목.

| 항목 | 위치 | 내용 |
|---|---|---|
| 죽은 코드 다수 | app_v38.js | `login_OLD`/`platformData`(레거시 인메모리 인증), `OLD_*` 함수, `exportInvoicesToPDF` 3중 정의(최종 5212만 유효), `sendInvoicesToClient` 구버전 등 ~1000줄 |
| 이모지 하드룰 위반 | excel-redesign.js:532(💳), email-send.js:56(💾), app_v38 일부 | 사용자 노출 위치에 이모지 |
| hotelView id 중복 | index.html 758·877 | 동일 id div 2개(모바일 버전 죽은 마크업 가능성) |
| 슈퍼 공장 페이징 미완성 | app_v38.js:3763 | `renderSuperFactoryPaging` prev 버튼만, next/숫자 없음 |
| 1000행 캡 미준수 | loadSuperAdminDashboard, loadAdminRecentInvoices, loadAdminStaffList, loadStaffInvoiceList, loadHotelReceivedInvoicesList, analysis.js 등 | `.limit()` 없는 전량 fetch → 데이터 증가 시 누락 |
| 출고 수정 비원자 | outbound-compare.js `saveOutboundInput` | DELETE 후 INSERT 실패 시 데이터 유실 |
| 자동확정 미구현 | outbound-compare.js | 3일 자동확정이 UI 표시뿐, DB 배치 없음 |
| 하드코딩 시크릿 | send-kakao/index.ts 주석 | 솔라피 API 키 평문 노출 |
| send-kakao JWT 미검증 | send-kakao Edge | 누구나 알림톡 트리거 가능(비용/스팸) |
| 공휴일 하드코딩 | analysis.js | 2026까지만, 2027+ 색상 오류 |
| 함수 중복 정의 | `printReport`, `handleAdminFilterChange` 등 | 동일 이름 2회(뒤가 유효) |
| `window.window.LOGIN_HINTS` 오타 | app_v38.js:2897 | idpw 힌트 undefined 위험 |

---

*생성: LaundryOps 코드베이스 전체 병렬 분석(6개 구간). 라인 참조는 `app_v38.js` 기준.*
