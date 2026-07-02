(function () {
  window.toggleStaffRoleFields = function () {
    const role = (document.getElementById('st_role') || {}).value || 'field';
    const isDriver = role === 'driver';
    const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
    show('grp_st_loginId', !isDriver);
    show('grp_st_loginPw', !isDriver);
    show('grp_st_phone', isDriver);
  };

  window.openStaffModal = async function () {
    ['st_name', 'st_loginId', 'st_loginPw', 'st_phone'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.value = ''; el.style.borderColor = 'var(--border)'; }
      const err = document.getElementById('err_' + id);
      if (err) err.style.display = 'none';
    });
    const roleSel = document.getElementById('st_role');
    if (roleSel) roleSel.value = 'field';
    window.toggleStaffRoleFields();
    openModal('staffModal');
  };

  window.saveNewStaff = async function () {
    const role = (document.getElementById('st_role') || {}).value || 'field';
    const nameInput = document.getElementById('st_name');
    const name = (nameInput.value || '').trim();

    try {
      const { data: f } = await window.mySupabase.from('factories').select('plan').eq('id', currentFactoryId).single();
      if (typeof window.checkStaffLimit === 'function' && !await window.checkStaffLimit(f)) return;
    } catch (e) {}

    const showErr = (id, on, msg) => {
      const err = document.getElementById('err_' + id);
      const input = document.getElementById(id);
      if (input) input.style.borderColor = on ? 'var(--danger)' : 'var(--border)';
      if (err) { if (msg) err.innerText = msg; err.style.display = on ? 'block' : 'none'; }
    };

    let ok = true;
    if (!name) { showErr('st_name', true); ok = false; } else showErr('st_name', false);

    let payload;
    if (role === 'driver') {
      const phone = (document.getElementById('st_phone').value || '').trim();
      if (!phone) { showErr('st_phone', true, '전화번호를 입력해주세요.'); ok = false; } else showErr('st_phone', false);
      if (!ok) return;
      payload = { action: 'create_staff', name, role: 'driver', phone };
    } else {
      const lId = (document.getElementById('st_loginId').value || '').trim();
      const lPw = (document.getElementById('st_loginPw').value || '').trim();
      if (!lId) { showErr('st_loginId', true, 'ID를 입력해주세요.'); ok = false; } else showErr('st_loginId', false);
      if (!lPw) { showErr('st_loginPw', true); ok = false; } else showErr('st_loginPw', false);
      if (!ok) return;
      const { data: exist } = await window.mySupabase.from('staff').select('id').eq('factory_id', currentFactoryId).eq('login_id', lId).maybeSingle();
      if (exist) { showErr('st_loginId', true, '이미 존재하는 ID입니다.'); return; }
      payload = { action: 'create_staff', name, login_id: lId, password: lPw, role: 'field' };
    }

    const { error } = await window.callAccountAdmin(payload);
    if (error) { alert('등록 실패: ' + error.message); return; }
    closeModal('staffModal');
    if (typeof window.loadAdminStaffList === 'function') window.loadAdminStaffList();
    alert(role === 'driver' ? '배송기사 등록이 완료되었습니다.' : '직원 등록이 완료되었습니다.');
  };

  const _origLoadStaff = window.loadAdminStaffList;
  window.loadAdminStaffList = async function () {
    if (typeof _origLoadStaff === 'function') await _origLoadStaff.apply(this, arguments);
    try {
      const tbody = document.getElementById('adminStaffList');
      if (!tbody || typeof currentFactoryId === 'undefined' || !currentFactoryId) return;
      const { data: list } = await window.mySupabase.from('staff').select('*').eq('factory_id', currentFactoryId).order('created_at', { ascending: false });
      if (!list || list.length === 0) return;
      tbody.innerHTML = list.map(s => {
        const isDriver = s.role === 'driver';
        const badge = isDriver
          ? '<span style="font-size:11px;font-weight:600;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:20px;padding:2px 8px;">배송기사</span>'
          : '<span style="font-size:11px;font-weight:600;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:20px;padding:2px 8px;">현장직원</span>';
        const mid = isDriver
          ? `<span style="font-size:13px;">${s.phone || '-'}</span>`
          : `<span style="font-size:13px;">${s.login_id || '-'}<br><small style="color:var(--secondary)">PW: ****</small></span>`;
        return `<tr><td><strong>${s.name}</strong><br>${badge}</td><td>${mid}</td><td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteStaff('${s.id}')">삭제</button></td></tr>`;
      }).join('');
    } catch (e) { console.warn('[staff-role] 목록 보강 실패', e); }
  };
})();
