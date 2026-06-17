-- =============================================================
-- LaundryOps RLS 설정
-- 전제: Supabase Auth 이전 완료 + 새 로그인(signInWithPassword) 배포 완료.
--       그 전에 실행하면 전 사용자 로그인 마비됨. 순서 반드시 지킬 것.
-- 역할(app_metadata.role): superadmin / factory / staff / hotel
-- 한 트랜잭션으로 적용. 중간에 실패하면 전체 롤백됨.
-- =============================================================

begin;

-- ---------- 헬퍼: JWT의 app_metadata에서 역할/소속 꺼내기 ----------
create or replace function public.jwt_role() returns text
  language sql stable as $$ select auth.jwt()->'app_metadata'->>'role' $$;
create or replace function public.jwt_factory() returns text
  language sql stable as $$ select auth.jwt()->'app_metadata'->>'factory_id' $$;
create or replace function public.jwt_hotel() returns text
  language sql stable as $$ select auth.jwt()->'app_metadata'->>'hotel_id' $$;

-- =============================================================
-- 1) factories  (id = 공장 식별자)
-- =============================================================
alter table public.factories enable row level security;
drop policy if exists factories_read  on public.factories;
drop policy if exists factories_super on public.factories;
drop policy if exists factories_update on public.factories;
-- 읽기: 슈퍼 전체 / 그 외엔 자기 소속 공장 1건
create policy factories_read on public.factories for select to authenticated
  using ( (select public.jwt_role())='superadmin' or id = (select public.jwt_factory()) );
-- 쓰기(생성/삭제 포함): 슈퍼만
create policy factories_super on public.factories for all to authenticated
  using ( (select public.jwt_role())='superadmin' )
  with check ( (select public.jwt_role())='superadmin' );
-- 공장 본인은 자기 레코드 수정만
create policy factories_update on public.factories for update to authenticated
  using ( (select public.jwt_role())='factory' and id = (select public.jwt_factory()) )
  with check ( (select public.jwt_role())='factory' and id = (select public.jwt_factory()) );

-- =============================================================
-- 2) factory_default_prices  (factory_id) — 호텔 접근 없음
-- =============================================================
alter table public.factory_default_prices enable row level security;
drop policy if exists fdp_rw on public.factory_default_prices;
create policy fdp_rw on public.factory_default_prices for all to authenticated
  using (
    (select public.jwt_role())='superadmin'
    or ((select public.jwt_role()) in ('factory','staff') and factory_id = (select public.jwt_factory()))
  )
  with check (
    (select public.jwt_role())='superadmin'
    or ((select public.jwt_role()) in ('factory','staff') and factory_id = (select public.jwt_factory()))
  );

-- =============================================================
-- 3) staff  (factory_id) — 로그인 계정 테이블
-- =============================================================
alter table public.staff enable row level security;
drop policy if exists staff_super on public.staff;
drop policy if exists staff_factory on public.staff;
drop policy if exists staff_self on public.staff;
create policy staff_super on public.staff for all to authenticated
  using ( (select public.jwt_role())='superadmin' )
  with check ( (select public.jwt_role())='superadmin' );
-- 공장은 자기 공장 스태프 관리(전체)
create policy staff_factory on public.staff for all to authenticated
  using ( (select public.jwt_role())='factory' and factory_id = (select public.jwt_factory()) )
  with check ( (select public.jwt_role())='factory' and factory_id = (select public.jwt_factory()) );
-- 스태프 본인은 자기 공장 스태프 목록 읽기만
create policy staff_self on public.staff for select to authenticated
  using ( (select public.jwt_role())='staff' and factory_id = (select public.jwt_factory()) );

-- =============================================================
-- 4) hotels  (id = hotel_id, factory_id)
-- =============================================================
alter table public.hotels enable row level security;
drop policy if exists hotels_factory on public.hotels;
drop policy if exists hotels_self on public.hotels;
create policy hotels_factory on public.hotels for all to authenticated
  using (
    (select public.jwt_role())='superadmin'
    or ((select public.jwt_role()) in ('factory','staff') and factory_id = (select public.jwt_factory()))
  )
  with check (
    (select public.jwt_role())='superadmin'
    or ((select public.jwt_role()) in ('factory','staff') and factory_id = (select public.jwt_factory()))
  );
-- 호텔 본인은 자기 레코드 읽기만
create policy hotels_self on public.hotels for select to authenticated
  using ( (select public.jwt_role())='hotel' and id = (select public.jwt_hotel()) );

-- =============================================================
-- 공통: hotel_id 보유 테이블용 표현식
--   슈퍼 전체 / 공장·스태프=자기 공장 / 호텔=자기 호텔
-- =============================================================

-- 5) hotel_categories (factory_id, hotel_id)
alter table public.hotel_categories enable row level security;
drop policy if exists hcat_rw on public.hotel_categories;
drop policy if exists hcat_hotel on public.hotel_categories;
create policy hcat_rw on public.hotel_categories for all to authenticated
  using (
    (select public.jwt_role())='superadmin'
    or ((select public.jwt_role()) in ('factory','staff') and factory_id = (select public.jwt_factory()))
  )
  with check (
    (select public.jwt_role())='superadmin'
    or ((select public.jwt_role()) in ('factory','staff') and factory_id = (select public.jwt_factory()))
  );
create policy hcat_hotel on public.hotel_categories for select to authenticated
  using ( (select public.jwt_role())='hotel' and hotel_id = (select public.jwt_hotel()) );

-- 6) hotel_item_prices (factory_id, hotel_id)
alter table public.hotel_item_prices enable row level security;
drop policy if exists hip_rw on public.hotel_item_prices;
drop policy if exists hip_hotel on public.hotel_item_prices;
create policy hip_rw on public.hotel_item_prices for all to authenticated
  using (
    (select public.jwt_role())='superadmin'
    or ((select public.jwt_role()) in ('factory','staff') and factory_id = (select public.jwt_factory()))
  )
  with check (
    (select public.jwt_role())='superadmin'
    or ((select public.jwt_role()) in ('factory','staff') and factory_id = (select public.jwt_factory()))
  );
create policy hip_hotel on public.hotel_item_prices for select to authenticated
  using ( (select public.jwt_role())='hotel' and hotel_id = (select public.jwt_hotel()) );

-- 7) hotel_outbounds (factory_id, hotel_id) — 호텔이 직접 입력 가능(rw)
alter table public.hotel_outbounds enable row level security;
drop policy if exists hob_rw on public.hotel_outbounds;
drop policy if exists hob_hotel on public.hotel_outbounds;
create policy hob_rw on public.hotel_outbounds for all to authenticated
  using (
    (select public.jwt_role())='superadmin'
    or ((select public.jwt_role()) in ('factory','staff') and factory_id = (select public.jwt_factory()))
  )
  with check (
    (select public.jwt_role())='superadmin'
    or ((select public.jwt_role()) in ('factory','staff') and factory_id = (select public.jwt_factory()))
  );
create policy hob_hotel on public.hotel_outbounds for all to authenticated
  using ( (select public.jwt_role())='hotel' and hotel_id = (select public.jwt_hotel()) )
  with check ( (select public.jwt_role())='hotel' and hotel_id = (select public.jwt_hotel()) );

-- 8) hotel_outbound_items (outbound_id → hotel_outbounds) : 부모 RLS로 위임
alter table public.hotel_outbound_items enable row level security;
drop policy if exists hobi_rw on public.hotel_outbound_items;
create policy hobi_rw on public.hotel_outbound_items for all to authenticated
  using ( outbound_id in (select id from public.hotel_outbounds) )
  with check ( outbound_id in (select id from public.hotel_outbounds) );

-- 9) invoices (factory_id, hotel_id) — 호텔은 읽기 + 확인(update)
alter table public.invoices enable row level security;
drop policy if exists inv_rw on public.invoices;
drop policy if exists inv_hotel_read on public.invoices;
drop policy if exists inv_hotel_confirm on public.invoices;
create policy inv_rw on public.invoices for all to authenticated
  using (
    (select public.jwt_role())='superadmin'
    or ((select public.jwt_role()) in ('factory','staff') and factory_id = (select public.jwt_factory()))
  )
  with check (
    (select public.jwt_role())='superadmin'
    or ((select public.jwt_role()) in ('factory','staff') and factory_id = (select public.jwt_factory()))
  );
create policy inv_hotel_read on public.invoices for select to authenticated
  using ( (select public.jwt_role())='hotel' and hotel_id = (select public.jwt_hotel()) );
create policy inv_hotel_confirm on public.invoices for update to authenticated
  using ( (select public.jwt_role())='hotel' and hotel_id = (select public.jwt_hotel()) )
  with check ( (select public.jwt_role())='hotel' and hotel_id = (select public.jwt_hotel()) );

-- 10) invoice_items (invoice_id → invoices) : 부모 RLS로 위임
alter table public.invoice_items enable row level security;
drop policy if exists invit_rw on public.invoice_items;
create policy invit_rw on public.invoice_items for all to authenticated
  using ( invoice_id in (select id from public.invoices) )
  with check ( invoice_id in (select id from public.invoices) );

-- 11) sent_logs (factory_id, hotel_id) — 호텔 읽기 + 확인(update)
alter table public.sent_logs enable row level security;
drop policy if exists slog_rw on public.sent_logs;
drop policy if exists slog_hotel_read on public.sent_logs;
drop policy if exists slog_hotel_confirm on public.sent_logs;
create policy slog_rw on public.sent_logs for all to authenticated
  using (
    (select public.jwt_role())='superadmin'
    or ((select public.jwt_role()) in ('factory','staff') and factory_id = (select public.jwt_factory()))
  )
  with check (
    (select public.jwt_role())='superadmin'
    or ((select public.jwt_role()) in ('factory','staff') and factory_id = (select public.jwt_factory()))
  );
create policy slog_hotel_read on public.sent_logs for select to authenticated
  using ( (select public.jwt_role())='hotel' and hotel_id = (select public.jwt_hotel()) );
create policy slog_hotel_confirm on public.sent_logs for update to authenticated
  using ( (select public.jwt_role())='hotel' and hotel_id = (select public.jwt_hotel()) )
  with check ( (select public.jwt_role())='hotel' and hotel_id = (select public.jwt_hotel()) );

-- =============================================================
-- 12) approved_payments (factory_id) — 슈퍼 전체, 공장은 자기 것 읽기
-- =============================================================
alter table public.approved_payments enable row level security;
drop policy if exists apay_super on public.approved_payments;
drop policy if exists apay_factory_read on public.approved_payments;
create policy apay_super on public.approved_payments for all to authenticated
  using ( (select public.jwt_role())='superadmin' )
  with check ( (select public.jwt_role())='superadmin' );
create policy apay_factory_read on public.approved_payments for select to authenticated
  using ( (select public.jwt_role())='factory' and factory_id = (select public.jwt_factory()) );

-- =============================================================
-- 13) pending_payments (factory_id) — 슈퍼 전체, 공장은 자기 것 읽기+신청(insert)
-- =============================================================
alter table public.pending_payments enable row level security;
drop policy if exists ppay_super on public.pending_payments;
drop policy if exists ppay_factory_read on public.pending_payments;
drop policy if exists ppay_factory_insert on public.pending_payments;
create policy ppay_super on public.pending_payments for all to authenticated
  using ( (select public.jwt_role())='superadmin' )
  with check ( (select public.jwt_role())='superadmin' );
create policy ppay_factory_read on public.pending_payments for select to authenticated
  using ( (select public.jwt_role())='factory' and factory_id = (select public.jwt_factory()) );
create policy ppay_factory_insert on public.pending_payments for insert to authenticated
  with check ( (select public.jwt_role())='factory' and factory_id = (select public.jwt_factory()) );

-- =============================================================
-- 14) pending_factories — 가입 신청. 익명 INSERT만 허용, 조회/승인은 슈퍼.
-- =============================================================
alter table public.pending_factories enable row level security;
drop policy if exists pf_super on public.pending_factories;
drop policy if exists pf_anon_signup on public.pending_factories;
create policy pf_super on public.pending_factories for all to authenticated
  using ( (select public.jwt_role())='superadmin' )
  with check ( (select public.jwt_role())='superadmin' );
-- 로그인 안 한 방문자의 가입 폼 제출 허용 (읽기는 못 함)
create policy pf_anon_signup on public.pending_factories for insert to anon
  with check ( true );

-- =============================================================
-- 15) platform_settings — 슈퍼만. 전체공지는 RPC로만 노출.
-- =============================================================
alter table public.platform_settings enable row level security;
drop policy if exists psettings_super on public.platform_settings;
create policy psettings_super on public.platform_settings for all to authenticated
  using ( (select public.jwt_role())='superadmin' )
  with check ( (select public.jwt_role())='superadmin' );

-- 전체공지 텍스트만 안전하게 내보내는 함수 (admin_pw/admin_phone 노출 없이)
create or replace function public.get_global_notice() returns text
  language sql stable security definer set search_path = public as
  $$ select global_notice from public.platform_settings limit 1 $$;
grant execute on function public.get_global_notice() to anon, authenticated;

-- =============================================================
-- 16) platform_data_deprecated — 슈퍼만
-- =============================================================
alter table public.platform_data_deprecated enable row level security;
drop policy if exists pdep_super on public.platform_data_deprecated;
create policy pdep_super on public.platform_data_deprecated for all to authenticated
  using ( (select public.jwt_role())='superadmin' )
  with check ( (select public.jwt_role())='superadmin' );

commit;

-- =============================================================
-- 검증: 16개 모두 rowsecurity=true 인지 확인
-- =============================================================
select tablename, rowsecurity
from pg_tables
where schemaname='public'
order by rowsecurity, tablename;

-- =============================================================
-- [PHASE 5 — 모든 사용자가 새 로그인으로 옮겨간 걸 확인한 뒤에만 실행]
-- 평문 비밀번호 컬럼 제거. pending_factories.admin_pw 는 승인 흐름에서 아직 필요하니 남겨둠
-- (승인 시 Auth 계정 생성 후 해당 pending 행을 삭제하는 방식으로 운영).
-- =============================================================
-- alter table public.factories        drop column admin_pw;
-- alter table public.staff             drop column login_pw;
-- alter table public.hotels            drop column login_pw;
-- alter table public.platform_settings drop column admin_pw;
