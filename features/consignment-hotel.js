// 위탁 호텔 이중 단가 — 묶음 1+: 거래처 위탁 토글 + 단가 2칸 + 비번검증 + 순서컬럼 + 이름한줄
// override: openHotelModal, saveNewHotel, openPriceSetting,
//           loadSimplePriceList, addSimpleItem,
//           loadHotelPriceList, addHotelCustomItem, updateHotelItemPrice
(function () {
    'use strict';

    // ── UI 헬퍼: 단가 입력 폼 위탁/직영 전환 ─────────────────────────
    function _applyConsignmentPriceUI(isC) {
        // simplePriceModal 입력 폼
        const sdpg = document.getElementById('simp_display_price_group');
        const spLabel = document.getElementById('simp_price_label');
        const spInput = document.getElementById('simp_price');
        if (sdpg) sdpg.style.display = isC ? '' : 'none';
        if (spLabel) spLabel.textContent = isC ? '우리 단가' : '단가';
        if (spInput) spInput.style.width = isC ? '76px' : '100px';

        // priceSettingModal 입력 폼 (특수거래처)
        const hdpg = document.getElementById('hp_display_price_group');
        const hpLabel = document.getElementById('hp_price_label');
        const hpInput = document.getElementById('hp_price');
        if (hdpg) hdpg.style.display = isC ? '' : 'none';
        if (hpLabel) hpLabel.textContent = isC ? '우리 단가' : '단가';
        if (hpInput) hpInput.style.width = isC ? '76px' : '100px';
    }

    // ── openHotelModal: is_consignment 라디오 세팅 ───────────────────
    const _origOpenHotelModal = window.openHotelModal;
    window.openHotelModal = async function (hId) {
        await _origOpenHotelModal(hId);
        let isC = false;
        if (hId) {
            const { data: h } = await window.mySupabase
                .from('hotels').select('is_consignment').eq('id', hId).single();
            isC = !!(h && h.is_consignment);
        }
        const r = document.querySelector(`input[name="h_consignment"][value="${isC}"]`);
        if (r) r.checked = true;
    };

    // ── saveNewHotel: 비번 6자 검증 + callAccountAdmin 일시 래핑으로 is_consignment 주입 ──
    const _origSaveNewHotel = window.saveNewHotel;
    window.saveNewHotel = async function () {
        const pwVal = (document.getElementById('h_loginPw')?.value || '').trim();
        const isEdit = !!window.editingHotelIdForInfo;
        if (!isEdit && pwVal.length < 6) {
            alert('비밀번호는 6자 이상이어야 합니다.');
            return;
        }
        if (isEdit && pwVal.length > 0 && pwVal.length < 6) {
            alert('비밀번호는 6자 이상이어야 합니다.');
            return;
        }

        const _origCaa = window.callAccountAdmin;
        window.callAccountAdmin = async function (payload) {
            if (payload.action === 'create_hotel' || payload.action === 'update_hotel') {
                const isC = document.querySelector('input[name="h_consignment"]:checked')?.value === 'true';
                payload.fields = payload.fields || {};
                payload.fields.is_consignment = isC;
            }
            return _origCaa(payload);
        };
        try {
            await _origSaveNewHotel();
        } finally {
            window.callAccountAdmin = _origCaa;
        }
    };

    // ── openPriceSetting: editingHotelIsConsignment 세팅 ─────────────
    const _origOpenPriceSetting = window.openPriceSetting;
    window.openPriceSetting = async function (hId) {
        const { data: h } = await window.mySupabase
            .from('hotels').select('is_consignment').eq('id', hId).single();
        window.editingHotelIsConsignment = !!(h && h.is_consignment);
        await _origOpenPriceSetting(hId);
        _applyConsignmentPriceUI(window.editingHotelIsConsignment);
    };

    // ── loadSimplePriceList override (일반거래처) ────────────────────
    window.loadSimplePriceList = async function () {
        const hId = window.editingHotelIdForPrice;
        const isC = !!window.editingHotelIsConsignment;

        const { data: items, error } = await window.mySupabase
            .from('hotel_item_prices')
            .select('id, name, price, display_price, unit, sort_order, created_at')
            .eq('hotel_id', hId)
            .eq('price_type', 'general')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });

        const tbody = document.getElementById('simplePriceList');
        if (!tbody) return;

        const thead = tbody.closest('table').querySelector('thead tr');
        if (thead) {
            thead.innerHTML = isC
                ? '<th style="width:28px; text-align:center;">순서</th><th>품목</th><th>우리 단가</th><th>호텔 단가</th><th>단위</th><th>관리</th>'
                : '<th style="width:28px; text-align:center;">순서</th><th>품목</th><th>단가</th><th>단위</th><th>관리</th>';
        }

        tbody.innerHTML = '';
        if (!items || items.length === 0) {
            const cols = isC ? 6 : 5;
            tbody.innerHTML = `<tr><td colspan="${cols}" style="text-align:center; padding:20px;">등록된 품목이 없습니다.</td></tr>`;
            return;
        }

        tbody.innerHTML = items.map((it, idx) => {
            const pw = isC ? '76px' : '100px';
            const dpVal = it.display_price != null ? it.display_price : '';
            const dpCell = isC
                ? `<td><input type="number" value="${dpVal}" placeholder="미설정" onchange="updateHotelItemPrice('${it.id}', this.value, 'display_price')" style="width:76px; padding:4px;">원</td>`
                : '';
            return `<tr>
                <td style="text-align:center; color:#94a3b8; font-size:12px;">${idx + 1}</td>
                <td style="white-space:nowrap !important;"><strong>${it.name}</strong></td>
                <td><input type="number" value="${it.price}" onchange="updateHotelItemPrice('${it.id}', this.value, 'price')" style="width:${pw}; padding:4px;">원</td>
                ${dpCell}
                <td>${it.unit}</td>
                <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteSimpleItem('${it.id}')">삭제</button></td>
            </tr>`;
        }).join('');
    };

    // ── addSimpleItem override ────────────────────────────────────────
    window.addSimpleItem = async function () {
        const hId = window.editingHotelIdForPrice;
        const isC = !!window.editingHotelIsConsignment;
        const name = document.getElementById('simp_name').value.trim();
        const price = Number(document.getElementById('simp_price').value) || 0;
        const unit = document.getElementById('simp_unit').value.trim() || '개';
        const dpEl = document.getElementById('simp_display_price');
        const displayPrice = (isC && dpEl && dpEl.value.trim() !== '')
            ? (Number(dpEl.value) || null) : null;

        if (!name) { alert('품목명을 입력해주세요.'); return; }

        let { data: cat } = await window.mySupabase
            .from('hotel_categories').select('*').eq('hotel_id', hId).eq('name', '기본').maybeSingle();
        if (!cat) {
            const { data: newCat } = await window.mySupabase
                .from('hotel_categories')
                .insert([{ factory_id: currentFactoryId, hotel_id: hId, name: '기본', price_type: 'general' }])
                .select().single();
            cat = newCat;
        }

        const { data: allItems } = await window.mySupabase
            .from('hotel_item_prices')
            .select('id, sort_order')
            .eq('hotel_id', hId).eq('price_type', 'general')
            .order('sort_order', { ascending: false });

        let maxS = 0;
        if (allItems) {
            allItems.forEach(it => {
                if (it.sort_order != null && it.sort_order > maxS) maxS = it.sort_order;
            });
            for (const it of allItems) {
                if (it.sort_order == null) {
                    maxS++;
                    await window.mySupabase.from('hotel_item_prices').update({ sort_order: maxS }).eq('id', it.id);
                }
            }
        }

        const finalPayload = {
            factory_id: currentFactoryId,
            hotel_id: hId,
            name: String(name),
            price: Number(price),
            unit: String(unit),
            category_id: cat ? String(cat.id) : null,
            category_name: (cat && cat.name) ? String(cat.name) : '기본',
            sort_order: maxS + 1,
            price_type: 'general'
        };
        if (isC) finalPayload.display_price = displayPrice;

        const { error } = await window.mySupabase
            .from('hotel_item_prices').upsert([finalPayload], { onConflict: 'hotel_id,name' });
        if (error) { alert('품목 추가 실패: ' + error.message); return; }

        document.getElementById('simp_name').value = '';
        document.getElementById('simp_price').value = '0';
        if (dpEl) dpEl.value = '';
        document.getElementById('simp_name').focus();
        await window.loadSimplePriceList();
    };

    // ── updateHotelItemPrice: display_price 지원 추가 ────────────────
    const _origUpdateHotelItemPrice = window.updateHotelItemPrice;
    window.updateHotelItemPrice = async function (id, newValue, field) {
        if (field === 'display_price') {
            const dp = (newValue === '' || newValue == null) ? null : (Number(newValue) || null);
            const { error } = await window.mySupabase
                .from('hotel_item_prices').update({ display_price: dp }).eq('id', id);
            if (error) alert('호텔 단가 수정 실패: ' + error.message);
            return;
        }
        return _origUpdateHotelItemPrice(id, newValue);
    };

    // ── loadHotelPriceList override (특수거래처) ─────────────────────
    window.loadHotelPriceList = async function () {
        const hId = window.editingHotelIdForPrice;
        const isC = !!window.editingHotelIsConsignment;

        const catSelect = document.getElementById('hp_cat');
        const selectedCatId = catSelect ? catSelect.value : '';

        const { data: hotel } = await window.mySupabase
            .from('hotels').select('contract_type, hotel_type').eq('id', hId).single();
        const isSpecial = hotel && (hotel.contract_type === 'special' || hotel.hotel_type === 'special');
        const typeFilter = isSpecial ? 'special' : 'general';

        const { data: items } = await window.mySupabase
            .from('hotel_item_prices')
            .select('id, name, price, display_price, unit, sort_order, category_name, category_id')
            .eq('hotel_id', hId).eq('price_type', typeFilter)
            .order('sort_order', { ascending: true });

        const tbody = document.getElementById('hotelPriceList');
        if (!tbody) return;

        const thead = tbody.closest('table').querySelector('thead tr');
        if (thead) {
            thead.innerHTML = isC
                ? '<th style="width:28px; text-align:center;">순서</th><th>카테고리</th><th>품목명</th><th>우리 단가</th><th>호텔 단가</th><th>단위</th><th>관리</th>'
                : '<th style="width:28px; text-align:center;">순서</th><th>카테고리</th><th>품목명</th><th>단가</th><th>단위</th><th>관리</th>';
        }

        tbody.innerHTML = '';
        if (!items || items.length === 0) {
            const cols = isC ? 7 : 6;
            tbody.innerHTML = `<tr><td colspan="${cols}" style="text-align:center; padding:20px;">등록된 품목이 없습니다.</td></tr>`;
            return;
        }

        const filteredItems = items.filter(it => {
            if (selectedCatId && selectedCatId !== '' && selectedCatId !== 'all') {
                return it.category_id === selectedCatId;
            }
            return it.category_name !== '삭제';
        });

        tbody.innerHTML = filteredItems.map((it, idx) => {
            const pw = isC ? '76px' : '100px';
            const dpVal = it.display_price != null ? it.display_price : '';
            const dpCell = isC
                ? `<td><input type="number" value="${dpVal}" placeholder="미설정" onchange="updateHotelItemPrice('${it.id}', this.value, 'display_price')" style="width:76px; padding:4px;">원</td>`
                : '';
            return `<tr>
                <td style="text-align:center; color:#94a3b8; font-size:12px;">${idx + 1}</td>
                <td style="background:#f8fafc;"><span class="badge" style="background:#e2e8f0; color:#334155;">${it.category_name}</span></td>
                <td style="white-space:nowrap !important;"><strong>${it.name}</strong></td>
                <td><input type="number" value="${it.price}" onchange="updateHotelItemPrice('${it.id}', this.value, 'price')" style="width:${pw}; padding:4px;">원</td>
                ${dpCell}
                <td>${it.unit}</td>
                <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteHotelPrice('${it.id}')">삭제</button></td>
            </tr>`;
        }).join('');
    };

    // ── addHotelCustomItem override (특수거래처) ─────────────────────
    window.addHotelCustomItem = async function () {
        await window.mySupabase.from('hotel_item_prices').select('category_id, category_name').limit(1);

        const hId = window.editingHotelIdForPrice;
        const isC = !!window.editingHotelIsConsignment;
        const name = document.getElementById('hp_name').value.trim();
        const price = Number(document.getElementById('hp_price').value) || 0;
        const unit = document.getElementById('hp_unit').value.trim() || '개';
        const catId = document.getElementById('hp_cat').value;
        const dpEl = document.getElementById('hp_display_price');
        const displayPrice = (isC && dpEl && dpEl.value.trim() !== '')
            ? (Number(dpEl.value) || null) : null;

        if (!name) { alert('품목명을 입력해주세요.'); return; }
        if (!catId) { alert('카테고리를 선택해주세요.'); return; }

        const { data: catData } = await window.mySupabase
            .from('hotel_categories').select('name').eq('id', catId).single();
        const finalCatName = catData ? catData.name : '기본';

        const payload = {
            factory_id: String(currentFactoryId),
            hotel_id: String(hId),
            name: String(name),
            price: Number(price),
            unit: String(unit),
            category_id: String(catId),
            category_name: String(finalCatName),
            sort_order: Math.floor(Date.now() / 1000),
            price_type: 'special'
        };
        if (isC) payload.display_price = displayPrice;

        const { error } = await window.mySupabase
            .from('hotel_item_prices').upsert([payload], { onConflict: 'hotel_id,name' });
        if (error) { alert('품목 추가 실패: ' + error.message); return; }

        document.getElementById('hp_name').value = '';
        document.getElementById('hp_price').value = '0';
        if (dpEl) dpEl.value = '';
        document.getElementById('hp_name').focus();
        await window.loadHotelPriceList();
    };

})();
