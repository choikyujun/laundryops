// features/consignment-company.js
// 거래처 편집 모달: 거래형태 '위탁' 선택 시에만 "위탁사(렌탈회사)" 지정 UI 노출.
// 데이터: consignment_companies(공장별) + hotels.consignment_company_id.
//
// 저장 경로 주의: 활성 saveNewHotel(app_v38.js:6118)은 Edge Function account-admin을
// 거치는데, 그 함수는 hotel 필드를 화이트리스트로 거른다(allow 목록에 consignment_company_id
// 없음). 따라서 fields 주입은 무시됨 → 저장 성공을 확인한 뒤 window.mySupabase로 별도 update.
// 신규 거래처는 create_hotel 응답의 data.hotel_id로, 수정은 editingHotelIdForInfo로 대상 식별.
//
// 로드 순서: consignment-hotel.js 뒤에 로드(그 파일이 openHotelModal/saveNewHotel/callAccountAdmin을
// 이미 래핑하므로, 이 파일이 다시 그 위를 래핑한다).
(function () {
    'use strict';

    const BOX_ID = 'cc-company-box';
    const SELECT_ID = 'cc-company-select';
    const NEW_ROW_ID = 'cc-company-new-row';
    const NEW_NAME_ID = 'cc-company-new-name';
    const ADD_BTN_ID = 'cc-company-add-btn';
    const NEW_OPT = '__new__';

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function isConsignmentChecked() {
        const r = document.querySelector('input[name="h_consignment"]:checked');
        return !!(r && r.value === 'true');
    }

    function toggleBox() {
        const box = document.getElementById(BOX_ID);
        if (box) box.style.display = isConsignmentChecked() ? '' : 'none';
    }

    function showNewRow() {
        const r = document.getElementById(NEW_ROW_ID);
        if (r) r.style.display = 'flex';
        const n = document.getElementById(NEW_NAME_ID);
        if (n) { n.value = ''; n.focus(); }
    }
    function hideNewRow() {
        const r = document.getElementById(NEW_ROW_ID);
        if (r) r.style.display = 'none';
    }

    // 공장의 위탁사 목록을 select에 채우고 selectedId를 선택 상태로.
    async function loadCompanies(selectedId) {
        const sel = document.getElementById(SELECT_ID);
        if (!sel) return;

        let companies = [];
        if (currentFactoryId) {
            const { data, error } = await window.mySupabase
                .from('consignment_companies')
                .select('id, name')
                .eq('factory_id', currentFactoryId)
                .order('name', { ascending: true });
            if (error) console.warn('[consignment-company] 목록 조회 실패', error);
            companies = data || [];
        }

        const opts = ['<option value="">— 선택 안 함 —</option>']
            .concat(companies.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`))
            .concat([`<option value="${NEW_OPT}">+ 새 위탁사 추가</option>`]);
        sel.innerHTML = opts.join('');

        sel.value = selectedId || '';
        // 저장돼 있던 회사가 삭제된 경우 등 복원 실패 → 빈 값으로
        if (sel.value !== (selectedId || '')) sel.value = '';
        hideNewRow();
    }

    // 새 위탁사 추가. 이미 있는 이름(unique)이면 새로 만들지 않고 기존 것을 선택.
    async function addCompany() {
        const nameEl = document.getElementById(NEW_NAME_ID);
        const sel = document.getElementById(SELECT_ID);
        if (!nameEl || !sel) return;
        if (!currentFactoryId) { alert('공장 정보를 찾을 수 없습니다.'); return; }

        const name = nameEl.value.trim();
        if (!name) { alert('위탁사 이름을 입력해주세요.'); nameEl.focus(); return; }

        // 기존 이름이면 그대로 선택
        const { data: existing } = await window.mySupabase
            .from('consignment_companies')
            .select('id')
            .eq('factory_id', currentFactoryId)
            .eq('name', name)
            .maybeSingle();

        let targetId = existing ? existing.id : null;

        if (!targetId) {
            const { data: ins, error } = await window.mySupabase
                .from('consignment_companies')
                .insert([{ factory_id: currentFactoryId, name: name }])
                .select('id')
                .single();
            if (error) {
                // unique 위반(동시 생성 등) → 재조회해 기존 것 선택
                const { data: again } = await window.mySupabase
                    .from('consignment_companies')
                    .select('id')
                    .eq('factory_id', currentFactoryId)
                    .eq('name', name)
                    .maybeSingle();
                if (again) {
                    targetId = again.id;
                } else {
                    alert('위탁사 추가 실패: ' + (error.message || '오류'));
                    return;
                }
            } else {
                targetId = ins.id;
            }
        }

        await loadCompanies(targetId);
    }

    // 위탁사 박스를 거래형태 라디오 바로 아래에 1회 주입. 성공 시 true.
    function ensureUI() {
        if (document.getElementById(BOX_ID)) return true; // 중복 주입 가드
        const radio = document.querySelector('input[name="h_consignment"]');
        if (!radio) return false;
        const anchor = radio.closest('.form-group');
        if (!anchor || !anchor.parentNode) return false;

        const box = document.createElement('div');
        box.id = BOX_ID;
        box.className = 'form-group';
        box.style.cssText = 'grid-column: span 2; display:none; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px 14px;';
        box.innerHTML = `
            <label style="font-weight:700; font-size:13px; color:#1e3a8a;">위탁사(렌탈회사)</label>
            <div style="font-size:11px; color:#64748b; margin:2px 0 8px;">입금이 이 위탁사 단위로 묶입니다.</div>
            <select id="${SELECT_ID}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:14px; background:#fff;"></select>
            <div id="${NEW_ROW_ID}" style="display:none; margin-top:8px; gap:6px;">
                <input id="${NEW_NAME_ID}" type="text" placeholder="위탁사 이름" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:14px;">
                <button type="button" id="${ADD_BTN_ID}" class="btn" style="padding:8px 16px; background:var(--primary); color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; white-space:nowrap;">추가</button>
            </div>`;
        anchor.after(box);

        // 이벤트 바인딩(주입 시 1회)
        document.querySelectorAll('input[name="h_consignment"]').forEach(r => {
            r.addEventListener('change', toggleBox);
        });
        const sel = document.getElementById(SELECT_ID);
        sel.addEventListener('change', function () {
            if (this.value === NEW_OPT) showNewRow(); else hideNewRow();
        });
        document.getElementById(ADD_BTN_ID).addEventListener('click', addCompany);
        document.getElementById(NEW_NAME_ID).addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); addCompany(); }
        });
        return true;
    }

    // ── openHotelModal 오버라이드: UI 주입 + 현재 값 로드 ──
    const _origOpen = window.openHotelModal;
    window.openHotelModal = async function (hId) {
        if (_origOpen) await _origOpen(hId); // consignment-hotel.js 포함(위탁 라디오 세팅)
        if (!ensureUI()) return;

        let companyId = '';
        if (hId) {
            const { data: h } = await window.mySupabase
                .from('hotels')
                .select('consignment_company_id')
                .eq('id', hId)
                .maybeSingle();
            companyId = (h && h.consignment_company_id) || '';
        }
        await loadCompanies(companyId);
        toggleBox();
    };

    // ── saveNewHotel 오버라이드: 저장 성공 후 consignment_company_id 별도 반영 ──
    const _origSave = window.saveNewHotel;
    window.saveNewHotel = async function () {
        const isC = isConsignmentChecked();
        const sel = document.getElementById(SELECT_ID);
        const rawVal = sel ? sel.value : '';
        // 위탁이고 실제 회사가 선택됐을 때만 값. 직영이거나 '새 위탁사 추가' 미확정이면 null.
        const companyId = (isC && rawVal && rawVal !== NEW_OPT) ? rawVal : null;
        const editId = window.editingHotelIdForInfo || null;

        let saveOk = false;
        let createdId = null;

        // callAccountAdmin을 잠깐 감싸 저장 성공/신규 hotel_id를 캡처.
        // (consignment-hotel.js 래퍼가 이 함수를 _origCaa로 잡아 is_consignment를 주입하고,
        //  최종적으로 여기 래퍼가 실제 함수를 호출하므로 실제 응답을 관찰할 수 있다.)
        const _realCaa = window.callAccountAdmin;
        window.callAccountAdmin = async function (payload) {
            const res = await _realCaa(payload);
            if ((payload.action === 'create_hotel' || payload.action === 'update_hotel')
                && res && !res.error && res.data) {
                saveOk = true;
                if (res.data.hotel_id) createdId = res.data.hotel_id;
            }
            return res;
        };

        try {
            if (_origSave) await _origSave(); // consignment 래퍼 → 원본 저장
        } finally {
            window.callAccountAdmin = _realCaa;
        }

        const targetId = editId || createdId;
        if (!saveOk || !targetId) return; // 저장 실패/대상 ID 불명 → 위탁사 반영 생략

        const { error } = await window.mySupabase
            .from('hotels')
            .update({ consignment_company_id: companyId })
            .eq('id', targetId);
        if (error) {
            console.warn('[consignment-company] 위탁사 저장 실패', error);
            alert('위탁사 저장 실패: ' + (error.message || '오류'));
        }
    };
})();
