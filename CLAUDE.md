# CLAUDE.md - LaundryOPS v38 프로젝트 문서

## 📁 폴더 구조
```
laundryops/
├── app_v38.js          메인 JS (건드리지 않음)
├── index.html
├── style.css
├── billing_logic.js    요금제 로직
├── preview_images.js   로그인 갤러리 이미지
├── features/           새 기능 추가 시 여기에 (2026-04-28~)
├── dist/               배포 빌드
├── backup/             버전별 백업
├── supabase/           Supabase 설정
├── supabase-functions/ Edge Functions
├── archive/            구버전 HTML
└── old/                임시 스크립트 보관
```

---

## 🌐 Supabase 설정

- **Project URL:** https://tphagookafjldzvxaxui.supabase.co
- **API Key:** sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq
- **주요 테이블:** `factories`, `hotels`, `invoices`, `staff`

### Supabase 초기 설정 가이드
1. [Supabase 홈페이지](https://supabase.com/)에서 프로젝트 생성
   - 프로젝트명: `laundry-ops`
   - 'Project Settings' → 'API' 탭에서 **Project URL**과 **API Key** 확인
2. **DB 테이블 구조**
   - `factories` (공장 테이블)
   - `hotels` (거래처 테이블 - 공장 ID 참조)
   - `invoices` (거래명세서 - 공장/호텔 ID 참조)
   - `staff` (현장직원 - 공장 ID 참조)

---

## 📝 Pending Features (v21 계획 → v38에서 재검토)

1. **Windows Default Price Loading**: `window.openPriceSetting`에서 `h.items`가 비어 있을 때 `f.defaultItems`에서 로드되도록 수정
2. **Default Price UX**: `window.saveDefaultPrice`에서 항목 추가 후 `nameEl.focus()` 호출로 UX 개선
3. **Login Enter Key**: 로그인 입력창에 `onkeydown="if(event.key==='Enter') login()"` 추가

---



## 📖 세탁공장 대표님 사용 매뉴얼 (v01)

### ✅ 초기 세팅 순서

1. **[⚙️ 기본단가설정] 버튼 클릭**
   - 공장 화면 우측 상단. 세탁 품목(와이셔츠, 이불 등)과 가격 입력 후 '추가'
2. **[🤝 거래처 및 단가 설정] 탭 클릭**
   - **[+ 신규 거래처 등록]** 버튼으로 호텔/병원 정보 입력
3. **[👕 현장직원 및 발행 현황] 탭 클릭**
   - **[+ 신규 직원 등록]** 버튼으로 직원 ID/비밀번호 생성

### 📨 월정산 명세표 전달하기

1. **[📊 매출 및 경영 지표] 탭** 선택
2. 상단 달력에서 정산할 **월** 선택
3. 필터에서 **거래처** 선택
4. **[발송]** 버튼 클릭 → 거래처 담당자가 로그인 후 [📜 정산 리포트 수신함]에서 확인



---


## 🏗️ 기능 고도화 규칙 (2026-04-28 확정)

- **app_v38.js는 절대 건드리지 않는다**
- 새 기능은 무조건 별도 폴더/파일로 생성한다
- 예: `features/kakao-alimtalk.js`, `features/new-report.js`
- `index.html`에 해당 파일 `<script>` 태그만 추가
- 롤백 시 `<script>` 태그 주석 처리로 즉시 원복 가능

```
laundryops/
├── app_v38.js          ← 건드리지 않음
├── index.html
├── style.css
└── features/           ← 새 기능은 여기에
    ├── kakao-alimtalk.js
    └── ...
```

---

## 사용자 역할 (4종류)

1. 플랫폼 관리자  → 전체 공장 승인·관리
2. 세탁공장 대표  → 거래처 등록, 직원등록, 정산 발송
3. 현장직원       → 명세서 입력만 가능
4. 거래처 파트너  → 명세서 수신·확인만 가능