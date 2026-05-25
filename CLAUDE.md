# CLAUDE.md - LaundryOPS v38 프로젝트 문서

---

## 📁 폴더 구조

```
laundryops/
├── app_v38.js          ← 절대 건드리지 않음
├── index.html
├── style.css
├── billing_logic.js    요금제 로직
├── preview_images.js   로그인 갤러리 이미지 (base64, 607KB)
├── features/           새 기능 추가 시 여기에 (2026-04-28~)
│   ├── kakao-alimtalk.js
│   └── ...
├── dist/               배포 빌드 (변경 시 반드시 동기화)
├── backup/             버전별 백업 (v27~v38)
├── supabase/           Supabase 설정
├── supabase-functions/ Edge Functions
├── analysis/
│   └── analysis.js    공휴일 색상 등 분석 유틸
├── archive/            구버전 HTML
└── old/                임시 스크립트 보관
```

---

## 🌐 서비스 정보

| 항목 | 내용 |
|------|------|
| 라이브 URL | https://www.laundryops.co.kr |
| Vercel URL | https://laundry-ops.vercel.app |
| GitHub | https://github.com/choikyujin/laundryops |
| 배포 방식 | GitHub main 브랜치 push → Vercel 자동 배포 (1~2분) |
| 브랜드 | CEGO 씨고 세탁고수 |

---

## 🗄️ Supabase 설정

- **Project URL:** https://tphagookafjldzvxaxui.supabase.co
- **API Key:** sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq

### 핵심 테이블

| 테이블 | 용도 |
|--------|------|
| `factories` | 세탁공장 정보 |
| `hotels` | 거래처(호텔 등) 정보 |
| `invoices` | 일일 명세서 |
| `invoice_items` | 명세서 세부 품목 |
| `staff` | 현장직원 계정 |
| `factory_default_prices` | 공장 기본 단가 |
| `hotel_categories` | 거래처 카테고리 |
| `hotel_item_prices` | 거래처별 품목 단가 |
| `sent_logs` | 월정산 발송 내역 |
| `platform_settings` | 플랫폼 전역 설정 |

---

## 🏗️ 기능 고도화 규칙 (2026-04-28 확정)

> ⚠️ **app_v38.js는 절대 건드리지 않는다**  
> ⚠️ **임의 리팩토링 절대 금지 — 요청된 부분만 수정**

- 새 기능은 무조건 `features/` 폴더에 별도 파일로 생성
- `index.html`에 `<script>` 태그만 추가
- 롤백 시 `<script>` 태그 주석 처리로 즉시 원복 가능

---

## 🏗️ 아키텍처 핵심 규칙 — SQL-First 원칙

### ✅ 올바른 패턴
```js
window.mySupabase.from('테이블명').select/insert/update/delete
```

### ❌ 절대 금지 패턴 (레거시)
```js
platformData.factories[...]   // 레거시 JSON 블롭
f.hotels[hId]                 // 레거시 참조
f.history / f.staffAccounts   // 레거시 참조
saveData()                    // 레거시 로컬 저장
fetchFromSupabase()           // 레거시 전체 fetch
syncToSupabase()              // 레거시 전체 sync
```

> 레거시 코드 발견 시 즉시 DB 쿼리 방식으로 교체

---

## 👥 사용자 역할 (4종류)

```
슈퍼어드민 (플랫폼 마스터)
  └── 결제 승인, 공장 등록/수정, 전체 통계

어드민 (세탁공장 대표)
  └── 거래처 관리, 직원 관리, 월정산 발송

현장직원
  └── 일일 명세서 발행

거래처 파트너
  └── 발행된 명세서 열람, 정산 확인
```

---

## 💬 알림 시스템

### 카카오 알림톡 (솔라피)

| 템플릿 | ID |
|--------|-----|
| 가입 승인 환영 | `KA01TP260422154605730z7MOIK5LmLV` |
| 결제 승인 완료 | `KA01TP260422160154259RL62rYHexoE` |
| 월정산 명세서 수신 | `KA01TP260422162254081G5IKK06soKf` |

- 채널 ID: `@laundryops`
- pfId: `KA01PF260422153127223YPBcJKYZEJU`
- Edge Function: `send-kakao`

### SMS (솔라피) — 백업용
- 단가: 18원/건 (VAT 미포함)
- Edge Function: `send-sms`

---

## 📊 요금제 정책

| 플랜 | 내용 |
|------|------|
| 무료체험 | 5개월 (신규 가입 시 자동 부여) |
| 구독 | 결제 후 관리자 승인 시 활성화 |
| 기간 옵션 | 1개월 / 3개월(5%↓) / 6개월(10%↓) / 12개월(20%↓) |

---

## 🚀 배포 절차

```bash
# 1. dist/ 폴더 동기화 (필수)
cp style.css dist/
# 변경된 features/ 파일도 dist/ 복사

# 2. 버전 태그 갱신 (캐시 우회)
# index.html 내 스크립트 태그:
# app_v38.js?v=YYYYMMDD_XX 형식으로 수정

# 3. Git push → Vercel 자동 배포
git add .
git commit -m "v38: 변경 내용 요약"
git push origin main
```

---

## 🚨 주의사항

- 월말 날짜 계산: `new Date(y, m, 0).getDate()` 패턴 사용
- 차감 명세서: `staff_name = '관리자(차감)_<sent_log_id>'` 태그로 구분
- 현장직원/어드민 리스트에서 차감 명세서 숨김 처리 유지
- `sent_logs.is_confirmed` 컬럼: 수신완료/확인완료 상태 관리
- `hotel_item_prices` sort_order 기준 정렬 유지

---

## 📖 세탁공장 대표님 사용 매뉴얼 (v01)

### ✅ 초기 세팅 순서

1. **[⚙️ 기본단가설정] 버튼 클릭** — 품목과 가격 입력 후 '추가'
2. **[🤝 거래처 및 단가 설정] 탭** — [+ 신규 거래처 등록]으로 거래처 정보 입력
3. **[👕 현장직원 및 발행 현황] 탭** — [+ 신규 직원 등록]으로 직원 ID/비밀번호 생성

### 📨 월정산 명세표 전달하기

1. **[📊 매출 및 경영 지표] 탭** 선택
2. 상단 달력에서 정산할 **월** 선택
3. 필터에서 **거래처** 선택
4. **[발송]** 버튼 클릭 → 거래처 담당자가 [📜 정산 리포트 수신함]에서 확인

---

## 📝 Pending Features (재검토 필요)

1. **Windows Default Price Loading**: `window.openPriceSetting`에서 `h.items` 비어있을 때 `f.defaultItems`에서 로드
2. **Default Price UX**: `window.saveDefaultPrice`에서 항목 추가 후 `nameEl.focus()` 호출
3. **Login Enter Key**: 로그인 입력창에 `onkeydown="if(event.key==='Enter') login()"` 추가
