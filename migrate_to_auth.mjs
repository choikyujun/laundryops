// migrate_to_auth.mjs
// LaundryOps: 기존 평문 로그인 계정(factories/staff/hotels/platform_settings)을
// Supabase Auth 유저로 옮긴다. 로컬에서만 실행. secret key는 절대 커밋/브라우저 노출 금지.
//
// 실행:
//   npm i @supabase/supabase-js
//   export SUPABASE_URL='https://tphagookafjldzvxaxui.supabase.co'
//   export SUPABASE_SECRET_KEY='sb_secret_...'        # sb_publishable_ 아님! secret 키
//   node migrate_to_auth.mjs            # 1) 먼저 점검(dry run) — 아무것도 안 만듦
//   node migrate_to_auth.mjs --apply    # 2) 문제 다 해결한 뒤 실제 생성

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  console.error('환경변수 SUPABASE_URL, SUPABASE_SECRET_KEY 가 필요합니다.');
  process.exit(1);
}

const admin = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DRY_RUN = !process.argv.includes('--apply');

// 합성 이메일 로컬파트로 쓸 수 있는 ID인지 (공백/한글/@ 등 불가)
const localpartOk = (s) => typeof s === 'string' && /^[a-zA-Z0-9._%+-]+$/.test(s);
// 이미 정상 이메일 형태인지 (admin_id/login_id가 실제 이메일인 경우)
const emailOk = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const problems = [];
const plan = []; // { email, password, app_metadata, source }

function add(source, id, pw, domain, meta) {
  if (!id) { problems.push(`${source}: 로그인ID가 비어 있음`); return; }
  let email;
  if (emailOk(id)) {
    email = id;                   // 이미 이메일이면 그대로 사용
  } else if (localpartOk(id)) {
    email = `${id}@${domain}`;    // 아니면 역할 도메인 붙여 합성
  } else {
    problems.push(`${source}: 로그인ID가 이메일로 못 씀 → '${id}' (영문/숫자/._%+- 또는 정상 이메일만)`);
    return;
  }
  if (!pw) { problems.push(`${source}: 비밀번호가 비어 있음 (id=${id})`); return; }
  plan.push({ email, password: pw, app_metadata: meta, source });
}

async function load() {
  const [f, s, h, ps] = await Promise.all([
    admin.from('factories').select('id, admin_id, admin_pw'),
    admin.from('staff').select('id, factory_id, login_id, login_pw'),
    admin.from('hotels').select('id, factory_id, login_id, login_pw'),
    admin.from('platform_settings').select('id, admin_id, admin_pw'),
  ]);
  for (const r of [f, s, h, ps]) if (r.error) throw r.error;

  for (const x of f.data)
    add(`factory:${x.id}`, x.admin_id, x.admin_pw, 'factory.laundryops.app',
        { role: 'factory', factory_id: x.id });

  for (const x of s.data)
    add(`staff:${x.id}`, x.login_id, x.login_pw, 'staff.laundryops.app',
        { role: 'staff', factory_id: x.factory_id, staff_id: x.id });

  for (const x of h.data)
    add(`hotel:${x.id}`, x.login_id, x.login_pw, 'hotel.laundryops.app',
        { role: 'hotel', hotel_id: x.id, factory_id: x.factory_id });

  for (const x of ps.data)
    add(`super:${x.id}`, x.admin_id, x.admin_pw, 'admin.laundryops.app',
        { role: 'superadmin' });
}

function dupCheck() {
  const seen = new Map();
  for (const p of plan) {
    if (seen.has(p.email)) problems.push(`이메일 충돌: ${p.email} (${seen.get(p.email)} ↔ ${p.source})`);
    else seen.set(p.email, p.source);
  }
}

async function apply() {
  let ok = 0, fail = 0;
  for (const p of plan) {
    const { error } = await admin.auth.admin.createUser({
      email: p.email,
      password: p.password,
      email_confirm: true,           // 이메일 인증 없이 바로 로그인 가능
      app_metadata: p.app_metadata,  // RLS 기준이 되는 클레임 (클라가 못 고침)
    });
    if (error) { fail++; console.error(`  실패  ${p.source} (${p.email}): ${error.message}`); }
    else ok++;
  }
  console.log(`\n생성 결과 — 성공 ${ok}, 실패 ${fail}`);
  console.log('(이미 있는 이메일이면 실패로 찍힙니다. 재실행 시 정상.)');
}

await load();
dupCheck();

console.log(`대상 계정: ${plan.length}건`);
const byRole = plan.reduce((m, p) => (m[p.app_metadata.role] = (m[p.app_metadata.role] || 0) + 1, m), {});
console.log('역할별:', byRole);

if (problems.length) {
  console.log(`\n[문제 ${problems.length}건 — 먼저 해결하세요]`);
  problems.forEach((x) => console.log('  - ' + x));
}

if (DRY_RUN) {
  console.log('\nDRY RUN 입니다. 실제 생성: node migrate_to_auth.mjs --apply');
} else {
  if (problems.length) {
    console.log('\n문제를 먼저 해결한 뒤 다시 실행하세요. 중단합니다.');
    process.exit(1);
  }
  await apply();
}
