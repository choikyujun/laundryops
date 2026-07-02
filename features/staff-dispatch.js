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

  // 발행목록: 거래처명 검색 있으면 날짜 무시 + 그 거래처 전체 기간 / 없으면 날짜(빈값=오늘)
  const _origLSIL = window.loadStaffInvoiceList;
  window.loadStaffInvoiceList = async function () {
    const hEl = document.getElementById('staffSearchHotel');
    const term = hEl ? hEl.value.trim() : '';

    if (!term) {
      const dEl = document.getElementById('staffSearchDate');
      if (dEl && !dEl.value.trim() && typeof getTodayString === 'function') dEl.value = getTodayString();
      return typeof _origLSIL === 'function' ? _origLSIL.apply(this, arguments) : undefined;
    }

    const tbody = document.getElementById('staffRecentInvoiceList');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">검색 중...</td></tr>';
    const factoryId = localStorage.getItem('currentFactoryId') || localStorage.getItem('adminAccessFactoryId');
    try {
      const { data: hotelRows } = await window.mySupabase
        .from('hotels').select('id').eq('factory_id', factoryId).ilike('name', `%${term}%`);
      const ids = (hotelRows || []).map(h => h.id);
      if (!ids.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:gray;">'${term}' 거래처를 찾을 수 없습니다.</td></tr>`;
        if (typeof renderStaffInvoicePaging === 'function') renderStaffInvoicePaging(0);
        return;
      }
      const { data, error } = await window.mySupabase
        .from('invoices')
        .select(`id, date, total_amount, is_sent, staff_name, hotels ( name )`)
        .eq('factory_id', factoryId)
        .in('hotel_id', ids)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error || !data) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger);">오류: ${error ? error.message : '알 수 없는 오류'}</td></tr>`;
        if (typeof renderStaffInvoicePaging === 'function') renderStaffInvoicePaging(0);
        return;
      }
      const filtered = data.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)')));
      if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:gray;">'${term}' 발행 내역이 없습니다.</td></tr>`;
        if (typeof renderStaffInvoicePaging === 'function') renderStaffInvoicePaging(0);
        return;
      }
      _staffInvoiceAllData = filtered;
      _staffInvoicePage = 1;
      if (typeof window.renderStaffInvoicePage === 'function') window.renderStaffInvoicePage();
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger);">검색 오류: ${e.message}</td></tr>`;
    }
  };

  // 현장직원 진입: 검색칸 초기화 + 발송 리스트 대상 채우기 (발행목록 오늘 default 는 위 래퍼가 처리)
  const _origLSD = window.loadStaffDashboard;
  window.loadStaffDashboard = async function () {
    const hEl = document.getElementById('staffSearchHotel'); if (hEl) hEl.value = '';
    if (typeof _origLSD === 'function') await _origLSD.apply(this, arguments);
    window.populateStaffDispatchTarget();
  };
})();
