(function () {
  // 발송 리스트 대상(거래처/그룹) + 요일 드롭다운 채우기 (자기 공장 전체 범위)
  window.populateStaffDispatchTarget = async function () {
    const tgt = document.getElementById('st-dispatch-target');
    if (!tgt) return;
    const factoryId = localStorage.getItem('currentFactoryId') || localStorage.getItem('adminAccessFactoryId');
    const dowSel = document.getElementById('st-dispatch-dow');
    if (dowSel && !dowSel.options.length) {
      const DOW = ['일','월','화','수','목','금','토'];
      const today = new Date().getDay();
      dowSel.innerHTML = [1,2,3,4,5,6,0].map(d => `<option value="${d}"${d === today ? ' selected' : ''}>${DOW[d]}요일</option>`).join('');
    }
    try {
      const [{ data: hotels }, { data: groups }] = await Promise.all([
        window.mySupabase.from('hotels').select('id, name').eq('factory_id', factoryId).or('status.is.null,status.neq.inactive').order('name'),
        window.mySupabase.from('delivery_groups').select('id, name').eq('factory_id', factoryId).order('name'),
      ]);
      const hs = hotels || [], gs = groups || [];
      const cur = tgt.value;
      tgt.innerHTML = '<option value="">거래처 / 그룹 선택</option>' +
        '<optgroup label="거래처">' + hs.map(h => `<option value="hotel:${h.id}">${h.name}</option>`).join('') + '</optgroup>' +
        (gs.length ? '<optgroup label="그룹">' + gs.map(g => `<option value="group:${g.id}">${g.name} (그룹)</option>`).join('') + '</optgroup>' : '');
      tgt.value = cur;
    } catch (e) { console.warn('[staff-dispatch] 대상 로드 실패', e); }
  };

  // 현장직원 진입: (1) 발행목록 default=오늘  (2) 발송 리스트 대상 채우기
  const _origLSD = window.loadStaffDashboard;
  window.loadStaffDashboard = async function () {
    if (typeof _origLSD === 'function') await _origLSD.apply(this, arguments);
    const el = document.getElementById('staffSearchDate');
    if (el && typeof getTodayString === 'function') {
      el.value = getTodayString();
      if (window.loadStaffInvoiceList) window.loadStaffInvoiceList();
    }
    window.populateStaffDispatchTarget();
  };
})();
