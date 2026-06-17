// supabase/functions/account-admin/index.ts
//
// LaundryOps 계정 관리 (Supabase Auth + 테이블 행을 함께 처리).
// 브라우저는 publishable 키로 호출할 수 없는 Auth 계정 생성/수정/삭제를 여기서 service_role로 수행.
//
// 배포: supabase functions deploy account-admin --no-verify-jwt
//   (forgot_password 는 로그인 전 호출이라 함수 내부에서 직접 권한을 검사함)
//
// 호출(앱): await window.mySupabase.functions.invoke('account-admin', { body: { action, ... } })
//
// 원칙: 신규/변경 계정의 비밀번호는 Auth 에만 저장. 테이블 평문 컬럼에는 쓰지 않음.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DOMAIN: Record<string, string> = {
  factory: "factory.laundryops.app",
  staff: "staff.laundryops.app",
  hotel: "hotel.laundryops.app",
  superadmin: "admin.laundryops.app",
};
const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const toEmail = (id: string, kind: string) =>
  looksLikeEmail(id) ? id : `${id}@${DOMAIN[kind]}`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

// 호출자 신원/역할 (보호 액션용)
async function getCaller(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const userClient = createClient(URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return null;
  const meta = data.user.app_metadata || {};
  return { id: data.user.id, role: meta.role as string, factoryId: meta.factory_id as string | undefined };
}

// 이메일로 Auth 유저 찾기 (페이지네이션)
async function findUserByEmail(email: string) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email || "").toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

// Auth 계정 생성 + 행 삽입 (행 삽입 실패 시 Auth 계정 롤백)
async function createAccount(kind: string, loginId: string, password: string, appMeta: Record<string, unknown>, table: string, row: Record<string, unknown>) {
  const email = toEmail(loginId, kind);
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, app_metadata: { role: appMeta.role, ...appMeta },
  });
  if (cErr) {
    const msg = /already|exist/i.test(cErr.message) ? "이미 존재하는 ID입니다." : cErr.message;
    return { error: msg };
  }
  const { error: iErr } = await admin.from(table).insert([row]);
  if (iErr) {
    await admin.auth.admin.deleteUser(created.user.id); // 롤백
    return { error: iErr.message };
  }
  return { ok: true, uid: created.user.id, row };
}

async function setPasswordByEmail(email: string, password: string) {
  const u = await findUserByEmail(email);
  if (!u) return { error: "해당 계정을 Auth에서 찾지 못했습니다." };
  const { error } = await admin.auth.admin.updateUserById(u.id, { password });
  if (error) return { error: error.message };
  return { ok: true };
}

async function deleteByEmail(email: string) {
  const u = await findUserByEmail(email);
  if (u) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) return { error: error.message };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const action = body?.action;
  if (!action) return json({ error: "action 필요" }, 400);

  try {
    // ---------- 로그인 전 호출 (익명) ----------
    // 비밀번호 찾기: 공장 admin_id + 등록된 전화 일치 시 임시비번 발급 (SMS는 앱에서)
    if (action === "forgot_password") {
      const { admin_id, phone } = body;
      if (!admin_id || !phone) return json({ error: "admin_id, phone 필요" }, 400);
      const { data: f } = await admin.from("factories").select("id, admin_id, phone, name").eq("admin_id", admin_id).maybeSingle();
      if (!f) return json({ error: "일치하는 계정을 찾을 수 없습니다." }, 404);
      if ((f.phone || "").replace(/-/g, "").trim() !== String(phone).replace(/-/g, "").trim())
        return json({ error: "아이디와 휴대폰 번호가 일치하지 않습니다." }, 403);
      const tempPw = String(Math.floor(100000 + Math.random() * 900000));
      const r = await setPasswordByEmail(toEmail(f.admin_id, "factory"), tempPw);
      if (r.error) return json({ error: r.error }, 500);
      return json({ ok: true, tempPw, name: f.name, phone: f.phone });
    }

    // ---------- 이하 보호 액션 ----------
    const caller = await getCaller(req);
    if (!caller) return json({ error: "인증 필요" }, 401);
    const isSuper = caller.role === "superadmin";
    const isFactory = caller.role === "factory";

    switch (action) {
      // ===== 슈퍼: 공장 가입 승인 =====
      case "approve_factory": {
        if (!isSuper) return json({ error: "권한 없음" }, 403);
        const { pending_id } = body;
        const { data: p } = await admin.from("pending_factories").select("*").eq("id", pending_id).maybeSingle();
        if (!p) return json({ error: "신청 데이터를 찾을 수 없습니다." }, 404);
        const fId = "f_" + Date.now();
        const expiry = new Date(p.date || new Date()); expiry.setMonth(expiry.getMonth() + 5);
        const res = await createAccount("factory", p.admin_id, p.admin_pw, { role: "factory", factory_id: fId }, "factories", {
          id: fId, name: p.name, admin_id: p.admin_id, ceo: (p.name || "") + " 대표",
          phone: p.phone, address: p.address, status: "operating", created_at: p.date,
          sub_status: "trial", plan: "무료요금제", plan_expiry: expiry.toISOString().split("T")[0],
        });
        if (res.error) return json({ error: res.error }, 400);
        await admin.from("pending_factories").delete().eq("id", pending_id);
        return json({ ok: true, factory_id: fId, phone: p.phone, name: p.name });
      }

      // ===== 슈퍼: 공장 직접 생성 =====
      case "create_factory": {
        if (!isSuper) return json({ error: "권한 없음" }, 403);
        const { admin_id, password, fields = {} } = body;
        if (!admin_id || !password) return json({ error: "admin_id, password 필요" }, 400);
        const fId = "f_" + Date.now();
        const allow = ["name", "ceo", "phone", "biz_no", "address", "plan", "plan_expiry", "sub_status", "status", "memo", "bank_info"];
        const row: Record<string, unknown> = { id: fId, admin_id, status: "operating" };
        for (const k of allow) if (k in fields) row[k] = fields[k];
        const res = await createAccount("factory", admin_id, password, { role: "factory", factory_id: fId }, "factories", row);
        if (res.error) return json({ error: res.error }, 400);
        return json({ ok: true, factory_id: fId });
      }

      // ===== 공장 수정 (슈퍼=전체 / 공장=본인 공장만, 요금·상태 제외) =====
      case "update_factory": {
        const { factory_id, fields = {}, new_admin_id, new_password } = body;
        if (!isSuper) {
          if (!isFactory || factory_id !== caller.factoryId) return json({ error: "권한 없음" }, 403);
        }
        const { data: cur } = await admin.from("factories").select("id, admin_id").eq("id", factory_id).maybeSingle();
        if (!cur) return json({ error: "공장을 찾을 수 없습니다." }, 404);
        const u = await findUserByEmail(toEmail(cur.admin_id, "factory"));
        if (u) {
          const upd: Record<string, unknown> = {};
          if (new_admin_id) upd.email = toEmail(new_admin_id, "factory");
          if (new_password) upd.password = new_password;
          if (Object.keys(upd).length) {
            const { error } = await admin.auth.admin.updateUserById(u.id, upd);
            if (error) return json({ error: error.message }, 400);
          }
        }
        // 공장 본인은 설명 필드 + 본인 자격만 (요금제/상태/만료일은 슈퍼만)
        const allow = isSuper
          ? ["name", "ceo", "phone", "biz_no", "address", "plan", "plan_expiry", "sub_status", "status", "memo", "bank_info"]
          : ["name", "ceo", "phone", "biz_no", "address", "memo", "bank_info"];
        const row: Record<string, unknown> = {};
        for (const k of allow) if (k in fields) row[k] = fields[k];
        if (new_admin_id) row.admin_id = new_admin_id;
        if (Object.keys(row).length) await admin.from("factories").update(row).eq("id", factory_id);
        return json({ ok: true });
      }

      // ===== 슈퍼: 공장 삭제 =====
      case "delete_factory": {
        if (!isSuper) return json({ error: "권한 없음" }, 403);
        const { factory_id } = body;
        const { data: cur } = await admin.from("factories").select("admin_id").eq("id", factory_id).maybeSingle();
        if (cur) await deleteByEmail(toEmail(cur.admin_id, "factory"));
        await admin.from("factories").delete().eq("id", factory_id);
        return json({ ok: true });
      }

      // ===== 공장: 스태프 생성 =====
      case "create_staff": {
        if (!isFactory) return json({ error: "권한 없음" }, 403);
        const { name, login_id, password } = body;
        if (!name || !login_id || !password) return json({ error: "name, login_id, password 필요" }, 400);
        const sId = "st_" + Date.now();
        const res = await createAccount("staff", login_id, password,
          { role: "staff", factory_id: caller.factoryId, staff_id: sId },
          "staff", { id: sId, factory_id: caller.factoryId, name, login_id });
        if (res.error) return json({ error: res.error }, 400);
        return json({ ok: true, staff_id: sId });
      }

      // ===== 공장: 스태프 수정/비번변경 =====
      case "update_staff": {
        if (!isFactory) return json({ error: "권한 없음" }, 403);
        const { staff_id, name, new_login_id, new_password } = body;
        const { data: s } = await admin.from("staff").select("id, factory_id, login_id").eq("id", staff_id).maybeSingle();
        if (!s || s.factory_id !== caller.factoryId) return json({ error: "권한 없음" }, 403);
        const u = await findUserByEmail(toEmail(s.login_id, "staff"));
        if (u) {
          const upd: Record<string, unknown> = {};
          if (new_login_id) upd.email = toEmail(new_login_id, "staff");
          if (new_password) upd.password = new_password;
          if (Object.keys(upd).length) { const { error } = await admin.auth.admin.updateUserById(u.id, upd); if (error) return json({ error: error.message }, 400); }
        }
        const row: Record<string, unknown> = {};
        if (name) row.name = name;
        if (new_login_id) row.login_id = new_login_id;
        if (Object.keys(row).length) await admin.from("staff").update(row).eq("id", staff_id);
        return json({ ok: true });
      }

      // ===== 공장: 스태프 삭제 =====
      case "delete_staff": {
        if (!isFactory) return json({ error: "권한 없음" }, 403);
        const { staff_id } = body;
        const { data: s } = await admin.from("staff").select("factory_id, login_id").eq("id", staff_id).maybeSingle();
        if (!s || s.factory_id !== caller.factoryId) return json({ error: "권한 없음" }, 403);
        await deleteByEmail(toEmail(s.login_id, "staff"));
        await admin.from("staff").delete().eq("id", staff_id);
        return json({ ok: true });
      }

      // ===== 공장: 호텔 생성 =====
      case "create_hotel": {
        if (!isFactory) return json({ error: "권한 없음" }, 403);
        const { login_id, password, fields = {} } = body;
        if (!login_id || !password) return json({ error: "login_id, password 필요" }, 400);
        const hId = "h_" + Date.now();
        const allow = ["name", "ceo", "phone", "biz_no", "address", "contract_type", "fixed_amount", "hotel_type", "status", "use_outbound_input", "outbound_tolerance_pct", "outbound_start_date"];
        const row: Record<string, unknown> = { id: hId, factory_id: caller.factoryId, login_id };
        for (const k of allow) if (k in fields) row[k] = fields[k];
        const res = await createAccount("hotel", login_id, password,
          { role: "hotel", hotel_id: hId, factory_id: caller.factoryId }, "hotels", row);
        if (res.error) return json({ error: res.error }, 400);
        return json({ ok: true, hotel_id: hId });
      }

      // ===== 공장: 호텔 수정/비번변경 =====
      case "update_hotel": {
        if (!isFactory) return json({ error: "권한 없음" }, 403);
        const { hotel_id, fields = {}, new_login_id, new_password } = body;
        const { data: h } = await admin.from("hotels").select("id, factory_id, login_id").eq("id", hotel_id).maybeSingle();
        if (!h || h.factory_id !== caller.factoryId) return json({ error: "권한 없음" }, 403);
        const u = await findUserByEmail(toEmail(h.login_id, "hotel"));
        if (u) {
          const upd: Record<string, unknown> = {};
          if (new_login_id) upd.email = toEmail(new_login_id, "hotel");
          if (new_password) upd.password = new_password;
          if (Object.keys(upd).length) { const { error } = await admin.auth.admin.updateUserById(u.id, upd); if (error) return json({ error: error.message }, 400); }
        }
        const allow = ["name", "ceo", "phone", "biz_no", "address", "contract_type", "fixed_amount", "hotel_type", "status", "use_outbound_input", "outbound_tolerance_pct", "outbound_start_date"];
        const row: Record<string, unknown> = {};
        for (const k of allow) if (k in fields) row[k] = fields[k];
        if (new_login_id) row.login_id = new_login_id;
        if (Object.keys(row).length) await admin.from("hotels").update(row).eq("id", hotel_id);
        return json({ ok: true });
      }

      // ===== 공장: 호텔 삭제 =====
      case "delete_hotel": {
        if (!isFactory) return json({ error: "권한 없음" }, 403);
        const { hotel_id } = body;
        const { data: h } = await admin.from("hotels").select("factory_id, login_id").eq("id", hotel_id).maybeSingle();
        if (!h || h.factory_id !== caller.factoryId) return json({ error: "권한 없음" }, 403);
        await deleteByEmail(toEmail(h.login_id, "hotel"));
        await admin.from("hotels").delete().eq("id", hotel_id);
        return json({ ok: true });
      }

      // ===== 슈퍼: 임의 계정 비번 재설정 =====
      case "reset_password": {
        if (!isSuper) return json({ error: "권한 없음" }, 403);
        const { kind, account_id, new_password } = body; // kind: factory|staff|hotel
        const tableMap: Record<string, [string, string]> = {
          factory: ["factories", "admin_id"], staff: ["staff", "login_id"], hotel: ["hotels", "login_id"],
        };
        const m = tableMap[kind];
        if (!m || !new_password) return json({ error: "kind, account_id, new_password 필요" }, 400);
        const { data: row } = await admin.from(m[0]).select(`${m[1]}`).eq("id", account_id).maybeSingle();
        if (!row) return json({ error: "계정을 찾을 수 없습니다." }, 404);
        const r = await setPasswordByEmail(toEmail((row as any)[m[1]], kind), new_password);
        return r.error ? json({ error: r.error }, 400) : json({ ok: true });
      }

      // ===== 슈퍼: 본인 계정 변경 =====
      case "update_superadmin": {
        if (!isSuper) return json({ error: "권한 없음" }, 403);
        const { new_admin_id, new_password, admin_phone } = body;
        const { data: ps } = await admin.from("platform_settings").select("admin_id").eq("id", "master_config").maybeSingle();
        const oldId = ps?.admin_id || "admin";
        const u = await findUserByEmail(toEmail(oldId, "superadmin"));
        if (u) {
          const upd: Record<string, unknown> = {};
          if (new_admin_id) upd.email = toEmail(new_admin_id, "superadmin");
          if (new_password) upd.password = new_password;
          if (Object.keys(upd).length) { const { error } = await admin.auth.admin.updateUserById(u.id, upd); if (error) return json({ error: error.message }, 400); }
        }
        const row: Record<string, unknown> = { id: "master_config" };
        if (new_admin_id) row.admin_id = new_admin_id;
        if (admin_phone !== undefined) row.admin_phone = admin_phone;
        await admin.from("platform_settings").upsert(row);
        return json({ ok: true });
      }

      default:
        return json({ error: "알 수 없는 action: " + action }, 400);
    }
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
});
