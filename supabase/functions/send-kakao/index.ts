// Supabase Edge Function: send-kakao
// 카카오 알림톡 발송 (솔라피 API)
// pfId: KA01PF260422153127223YPBcJKYZEJU

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SOLAPI_API_KEY = Deno.env.get("SOLAPI_API_KEY")!;       // NCSTYI3KU6TCNIJI
const SOLAPI_API_SECRET = Deno.env.get("SOLAPI_API_SECRET")!; // UP8BDGHQHMXG9XST8QHDI6URYK0NHJMP
const SENDER_PHONE = Deno.env.get("SENDER_PHONE") ?? "01051041648";

const KAKAO_PF_ID = "KA01PF260422153127223YPBcJKYZEJU";

// 템플릿 ID 목록
const TEMPLATES: Record<string, string> = {
  join:    "KA01TP260422154605730z7MOIK5LmLV",  // 가입 승인
  payment: "KA01TP260422160154259RL62rYHexoE",  // 결제 승인 완료
  billing: "KA01TP260422162254081G5IKK06soKf",  // 월정산 명세서 수신
};

// HMAC-SHA256 서명 생성
async function makeSignature(apiKey: string, apiSecret: string): Promise<{ date: string; signature: string; salt: string }> {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, "");
  const msg = date + salt;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  const signature = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { date, signature, salt };
}

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    // type: "join" | "payment" | "billing"
    const { type, to, factoryName, expiryDate, hotelName, startDate, endDate } = await req.json();

    if (!type || !to || !factoryName) {
      return new Response(JSON.stringify({ error: "type, to, factoryName 필수" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const templateId = TEMPLATES[type];
    if (!templateId) {
      return new Response(JSON.stringify({ error: `알 수 없는 type: ${type}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 타입별 필수값 검증
    if (type === "payment" && !expiryDate) {
      return new Response(JSON.stringify({ error: "payment 타입은 expiryDate 필수" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (type === "billing" && (!hotelName || !startDate || !endDate)) {
      return new Response(JSON.stringify({ error: "billing 타입은 hotelName, startDate, endDate 필수" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 템플릿별 변수 구성
    const variables: Record<string, string> = {
      "#{세탁공장이름}": factoryName,
    };
    if (type === "payment") {
      variables["#{만료일}"] = expiryDate;
    }
    if (type === "billing") {
      variables["#{호텔이름}"] = hotelName;
      variables["#{조회시작일}"] = startDate;
      variables["#{조회종료일}"] = endDate;
    }

    // 대체 SMS 문구 (알림톡 실패 시 발송될 내용 - 변수 치환된 완성 문자열)
    let smsText = "";
    if (type === "join") {
      smsText = `[LaundryOPS] ${factoryName} 가입이 승인되었습니다. 로그인하여 서비스를 이용해 주세요.`;
    } else if (type === "payment") {
      smsText = `[LaundryOPS] ${factoryName} 결제가 승인되었습니다. 이용 만료일: ${expiryDate}`;
    } else if (type === "billing") {
      smsText = `[LaundryOPS] ${factoryName} - ${hotelName} ${startDate}~${endDate} 월정산 명세서가 발송되었습니다.`;
    }

    // 전화번호 정리 (하이픈 제거)
    const toClean = to.replace(/-/g, "");

    const { date, signature, salt } = await makeSignature(SOLAPI_API_KEY, SOLAPI_API_SECRET);

    const body = {
      message: {
        to: toClean,
        from: SENDER_PHONE,
        text: smsText,  // 대체 SMS 내용 (알림톡 실패 시 사용)
        kakaoOptions: {
          pfId: KAKAO_PF_ID,
          templateId,
          disableSms: false,  // 알림톡 실패 시 SMS 자동 대체발송
          variables,
          // 버튼 URL이 동적이라면 아래 버튼 섹션 추가
          // buttons: [{ buttonType: "WL", buttonName: "로그인페이지 이동", linkMo: "https://...", linkPc: "https://..." }]
        },
      },
    };

    const res = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
      },
      body: JSON.stringify(body),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("솔라피 오류:", result);
      return new Response(JSON.stringify({ error: "알림톡 발송 실패", detail: result }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
