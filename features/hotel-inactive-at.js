// 정액제 운영중지 반영 (B안) — 운영중지 전환 시점(inactive_at) 기록
// 원인: 정액제(fixed) 거래처가 운영중지돼도 fixed_amount가 매월 계속 가산됨.
//       중지 "시점" 컬럼이 없어 "중지월부터 제외"가 불가능했음.
// 조치: hotels.inactive_at(date) 컬럼을 두고, status 전환 시 기록.
//       가산 가드는 features/factory-expenses.js computeMonthlyRevenue 에서 처리.
// app_v38.js 직접 수정 금지 원칙에 따라 window.toggleHotelStatus 를 오버라이드.
// 원본(app_v38.js:1820)은 Edge Function이 아닌 직접 hotels.update 경로라 allowlist 제약 없음.
(function () {
  window.toggleHotelStatus = async function (hId, newStatus) {
    const label = newStatus === 'inactive' ? '거래종료' : '운영중';
    if (!confirm(`이 거래처를 "${label}" 상태로 변경하시겠습니까?`)) return;

    // inactive 전환 → 오늘 날짜 기록(이번달부터 정액 제외). active 복귀 → null(다시 가산).
    const today = (typeof getTodayString === 'function')
      ? getTodayString()
      : new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const payload = {
      status: newStatus,
      inactive_at: newStatus === 'inactive' ? today : null,
    };

    const { error } = await window.mySupabase.from('hotels').update(payload).eq('id', hId);
    if (error) { alert('상태 변경 실패: ' + error.message); return; }
    if (typeof window.loadAdminHotelList === 'function') window.loadAdminHotelList();
  };
})();
