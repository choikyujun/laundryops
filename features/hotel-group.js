(function () {
  // 모달 열 때: 수정이면 기존 group_name 채우고, 신규면 비움
  const _origOpenHotelModal = window.openHotelModal;
  window.openHotelModal = async function (hId = null) {
    if (typeof _origOpenHotelModal === 'function') await _origOpenHotelModal.apply(this, arguments);
    const gEl = document.getElementById('h_group_name');
    if (!gEl) return;
    if (hId) {
      try {
        const { data: h } = await window.mySupabase.from('hotels').select('group_name').eq('id', hId).maybeSingle();
        gEl.value = (h && h.group_name) ? h.group_name : '';
      } catch (e) { gEl.value = ''; }
    } else {
      gEl.value = '';
    }
  };

  // 저장 시: create_hotel/update_hotel 에만 group_name 주입 (다른 액션은 그대로 통과)
  const _origCallAccountAdmin = window.callAccountAdmin;
  window.callAccountAdmin = async function (payload) {
    if (payload && (payload.action === 'create_hotel' || payload.action === 'update_hotel')) {
      const gEl = document.getElementById('h_group_name');
      if (gEl) {
        payload.fields = payload.fields || {};
        payload.fields.group_name = (gEl.value || '').trim() || null;
      }
    }
    return await _origCallAccountAdmin.apply(this, arguments);
  };
})();
