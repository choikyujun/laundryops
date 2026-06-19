// 위탁 호텔 이중 단가 — 묶음 1+: 거래처 위탁 토글 + 단가 2칸 + 비번검증 + 순서컬럼 + 이름한줄 + 이동컬럼 + 설명글
// override: openHotelModal, saveNewHotel, openPriceSetting,
//           loadSimplePriceList, addSimpleItem,
//           loadHotelPriceList, addHotelCustomItem, updateHotelItemPrice
(function () {
    'use strict';

    // item-name-update.js 존재 여부 → "이동" 헤더 및 colspan 조정
    const _hasDrag = typeof window.updateItemNameWithCascade !== 'undefined';
    const _moveTh = _hasDrag ? '<th style="width:28px; text-align:center;">이동</th>' : '';

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

        const table = tbody.closest('table');
        const thead = table.querySelector('thead tr');
        if (thead) {
            thead.innerHTML = isC
                ? `${_moveTh}<th style="width:28px; text-align:center;">순서</th><th>품목</th><th>우리 단가</th><th>호텔 단가</th><th>단위</th><th>관리</th>`
                : `${_moveTh}<th style="width:28px; text-align:center;">순서</th><th>품목</th><th>단가</th><th>단위</th><th>관리</th>`;
        }

        // 설명글 (위탁일 때만 표시)
        let _sdesc = document.getElementById('cph-price-desc-simple');
        if (!_sdesc) {
            _sdesc = document.createElement('div');
            _sdesc.id = 'cph-price-desc-simple';
            _sdesc.style.cssText = 'font-size:11px; color:#64748b; padding:2px 0 6px;';
            _sdesc.textContent = '우리 단가 = 직영점 단가  ·  호텔 단가 = 위탁세탁 단가';
            table.parentNode.insertBefore(_sdesc, table);
        }
        _sdesc.style.display = isC ? '' : 'none';

        tbody.innerHTML = '';
        if (!items || items.length === 0) {
            const cols = (isC ? 6 : 5) + (_hasDrag ? 1 : 0);
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

        const table = tbody.closest('table');
        const thead = table.querySelector('thead tr');
        if (thead) {
            thead.innerHTML = isC
                ? `${_moveTh}<th style="width:28px; text-align:center;">순서</th><th>카테고리</th><th>품목명</th><th>우리 단가</th><th>호텔 단가</th><th>단위</th><th>관리</th>`
                : `${_moveTh}<th style="width:28px; text-align:center;">순서</th><th>카테고리</th><th>품목명</th><th>단가</th><th>단위</th><th>관리</th>`;
        }

        // 설명글 (위탁일 때만 표시)
        let _hdesc = document.getElementById('cph-price-desc-hotel');
        if (!_hdesc) {
            _hdesc = document.createElement('div');
            _hdesc.id = 'cph-price-desc-hotel';
            _hdesc.style.cssText = 'font-size:11px; color:#64748b; padding:2px 0 6px;';
            _hdesc.textContent = '우리 단가 = 직영점 단가  ·  호텔 단가 = 위탁세탁 단가';
            table.parentNode.insertBefore(_hdesc, table);
        }
        _hdesc.style.display = isC ? '' : 'none';

        tbody.innerHTML = '';
        if (!items || items.length === 0) {
            const cols = (isC ? 7 : 6) + (_hasDrag ? 1 : 0);
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

    // ── _getDisplayPriceMap: 위탁 단가표 name → display_price(없으면 price) 맵 ──
    async function _getDisplayPriceMap(hotelId, typeFilter) {
        const { data } = await window.mySupabase
            .from('hotel_item_prices')
            .select('name, price, display_price')
            .eq('hotel_id', hotelId)
            .eq('price_type', typeFilter);
        const map = {};
        (data || []).forEach(row => {
            map[row.name] = row.display_price != null ? Number(row.display_price) : Number(row.price);
        });
        return map;
    }

    // ── loadHotelDashboard: B1(카드) + B2(입고현황) 위탁 display_price 환산 ─
    const _origLoadHotelDashboard = window.loadHotelDashboard;
    window.loadHotelDashboard = async function () {
        await _origLoadHotelDashboard();
        if (!currentHotelId) return;

        const { data: hData } = await window.mySupabase
            .from('hotels')
            .select('is_consignment, contract_type, hotel_type')
            .eq('id', currentHotelId)
            .single();
        if (!hData || !hData.is_consignment) return;

        const isSpecial = hData.contract_type === 'special' || hData.hotel_type === 'special';
        const typeFilter = isSpecial ? 'special' : 'general';
        const dpMap = await _getDisplayPriceMap(currentHotelId, typeFilter);

        // 월 범위 (원본과 동일 로직)
        const sMonth = document.getElementById('hotelInvoiceMonth')?.value || getTodayString().substring(0, 7);
        const [sY, sM] = sMonth.split('-').map(Number);
        const lastDay = new Date(sY, sM, 0).getDate();
        const sMonthStart = sMonth + '-01';
        const sMonthEnd = sMonth + '-' + String(lastDay).padStart(2, '0');

        // invoice 목록 재조회
        const { data: invListRaw } = await window.mySupabase
            .from('invoices')
            .select('id, date, total_amount, staff_name')
            .eq('hotel_id', currentHotelId)
            .gte('date', sMonthStart)
            .lte('date', sMonthEnd)
            .order('date', { ascending: false });
        const invList = (invListRaw || []).filter(inv =>
            !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))
        );
        const invIds = invList.map(inv => inv.id);

        // invoice_items 재조회 (invoice_id + price 포함) → display 합계 산출
        const displayTotalByInvoice = {};
        if (invIds.length > 0) {
            const { data: itemRows } = await window.mySupabase
                .from('invoice_items')
                .select('invoice_id, name, qty, price')
                .in('invoice_id', invIds);
            (itemRows || []).forEach(it => {
                const dp = dpMap[it.name] != null ? dpMap[it.name] : Number(it.price || 0);
                displayTotalByInvoice[it.invoice_id] = (displayTotalByInvoice[it.invoice_id] || 0) + dp * Number(it.qty || 0);
            });
        }

        // tbody + 카드 재렌더 (display 금액으로 교체)
        const tbody = document.getElementById('hotelInvoiceList');
        if (tbody) tbody.innerHTML = '';
        let total = 0;
        invList.forEach(inv => {
            const invSum = Math.round(displayTotalByInvoice[inv.id] ?? Number(inv.total_amount || 0));
            total += invSum;
            if (tbody) {
                tbody.innerHTML += `<tr>
                    <td>${inv.date}</td>
                    <td style="text-align:right;">${invSum.toLocaleString()}원</td>
                    <td><span class="badge" style="background:var(--success)">입고완료</span></td>
                    <td><button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button></td>
                </tr>`;
            }
        });
        if (tbody && tbody.innerHTML === '') {
            tbody.innerHTML = `<tr><td colspan="4" style="padding:30px; color:gray;">${sMonth} 입고 내역 없음</td></tr>`;
        }
        const elTotal = document.getElementById('hotelMonthlyTotal');
        if (elTotal) elTotal.innerText = total.toLocaleString() + '원';
    };

    // ── viewInvoiceDetail: B6 위탁+파트너뷰일 때 display_price 환산 ─────
    window.viewInvoiceDetail = async function (id) {
        const { data: inv, error } = await window.mySupabase.from('invoices')
            .select('*, hotels(name, contract_type, hotel_type, is_consignment), invoice_items(name, qty, price, unit)')
            .eq('id', id)
            .single();
        if (error || !inv) { alert('데이터를 찾을 수 없습니다.'); return; }

        const isSpecial = inv.hotels && (inv.hotels.contract_type === 'special' || inv.hotels.hotel_type === 'special');
        const typeFilter = isSpecial ? 'special' : 'general';
        const isConsignment = !!(inv.hotels && inv.hotels.is_consignment);
        const isHotelView = !!currentHotelId;

        const dpMap = (isConsignment && isHotelView) ? await _getDisplayPriceMap(inv.hotel_id, typeFilter) : {};

        const savedItemsMap = {};
        (inv.invoice_items || []).forEach(it => { savedItemsMap[it.name] = Number(it.qty || 0); });

        let { data: priceList } = await window.mySupabase.from('hotel_item_prices')
            .select('name, price, unit, sort_order, category_name')
            .eq('hotel_id', inv.hotel_id)
            .eq('price_type', typeFilter)
            .order('sort_order', { ascending: true, nullsFirst: false });

        if (!priceList || priceList.length === 0) {
            const { data: defaultList } = await window.mySupabase.from('factory_default_prices')
                .select('name, price, unit, sort_order')
                .eq('factory_id', inv.factory_id)
                .order('sort_order', { ascending: true, nullsFirst: false });
            if (defaultList && defaultList.length > 0) {
                priceList = defaultList.map(p => ({ ...p, category_name: '기본' }));
            }
        }

        const mergedItems = [];
        if (priceList && priceList.length > 0) {
            priceList.forEach(p => {
                const base = Number(p.price || 0);
                const price = (isConsignment && isHotelView && dpMap[p.name] != null) ? dpMap[p.name] : base;
                mergedItems.push({ name: p.name, price, qty: savedItemsMap[p.name] || 0, category: p.category_name || '기타' });
            });
        } else {
            (inv.invoice_items || []).forEach(it => {
                const base = Number(it.price || 0);
                const price = (isConsignment && isHotelView && dpMap[it.name] != null) ? dpMap[it.name] : base;
                mergedItems.push({ name: it.name, price, qty: Number(it.qty || 0), category: '기타' });
            });
        }

        const supplyPrice = mergedItems.reduce((s, it) => s + (it.price * it.qty), 0);
        let reportHtml = '';

        if (isSpecial) {
            const grouped = {}, catOrder = [];
            mergedItems.forEach(it => {
                const cat = it.category;
                if (!grouped[cat]) { grouped[cat] = []; catOrder.push(cat); }
                grouped[cat].push(it);
            });
            let categoriesHtml = '';
            catOrder.forEach(cat => {
                if (grouped[cat].length === 0) return;
                categoriesHtml += `
                <div style="break-inside: avoid; margin-bottom:5px; border:1px solid #cbd5e1;">
                    <div style="background:#f1f5f9; padding:3px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                    <table style="width:100%; font-size:9px; border-collapse:collapse;">
                        <thead><tr style="background:#f8fafc;">
                            <th style="border-right:1px solid #cbd5e1; padding:1px 2px;">품목</th>
                            <th style="border-right:1px solid #cbd5e1; padding:1px 2px;">단가</th>
                            <th style="border-right:1px solid #cbd5e1; padding:1px 2px;">수량</th>
                            <th style="padding:1px 2px;">금액</th>
                        </tr></thead>
                        <tbody>
                            ${grouped[cat].map(it => `<tr>
                                <td style="border-right:1px solid #cbd5e1; padding:1px 2px;">${it.name}</td>
                                <td style="border-right:1px solid #cbd5e1; padding:1px 2px; text-align:center;">${it.price.toLocaleString()}</td>
                                <td style="border-right:1px solid #cbd5e1; padding:1px 2px; text-align:center;">${it.qty}</td>
                                <td style="padding:1px 2px; text-align:right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>`;
            });
            reportHtml = `
                <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:5px; margin-bottom:5px; font-size:18px;">거래명세서 상세 (${inv.hotels ? inv.hotels.name : ''})</h1>
                <div style="text-align:right; margin-bottom:5px; font-size:12px;">발행 일자: ${inv.date} | 담당자: ${inv.staff_name || ''}</div>
                <div style="display:grid !important; grid-template-columns: repeat(2, 1fr) !important; gap:6px !important; align-items:start !important; padding:3px !important; width: 100% !important;">
                    ${categoriesHtml}
                </div>
                <div style="margin-top:10px; padding:10px; border:2px solid #000; text-align:right; font-weight:700; font-size:13px; border-radius:8px;">
                    공급가: ₩ ${supplyPrice.toLocaleString()}
                </div>`;
        } else {
            reportHtml = `
            <div id="report-to-print" style="padding:10px; font-family:'Malgun Gothic', sans-serif;">
                <h1 style="text-align:center; color:#0f172a; border-bottom:3px solid #005b9f; padding-bottom:5px; margin-bottom:10px; font-size:18px;">세탁 명세서 (${inv.hotels ? inv.hotels.name : ''})</h1>
                <div style="text-align:left; margin-bottom:5px; color:#0f172a; font-size:12px; font-weight:700;">발행일: ${inv.date} | 담당자: ${inv.staff_name || ''}</div>
                <table style="width:100%; border-collapse:collapse; margin-top:5px; font-size:12px; border:1px solid #cbd5e1;">
                    <thead>
                        <tr style="background:#f1f5f9;">
                            <th style="padding:4px; border:1px solid #cbd5e1; text-align:left;">품목</th>
                            <th style="padding:4px; border:1px solid #cbd5e1; text-align:right;">단가</th>
                            <th style="padding:4px; border:1px solid #cbd5e1; text-align:right;">수량</th>
                            <th style="padding:4px; border:1px solid #cbd5e1; text-align:right;">금액</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${mergedItems.map(it => `
                        <tr>
                            <td style="padding:4px; border:1px solid #cbd5e1; text-align:left;">${it.name || '알수없음'}</td>
                            <td style="padding:4px; border:1px solid #cbd5e1; text-align:right;">${it.price.toLocaleString()}</td>
                            <td style="padding:4px; border:1px solid #cbd5e1; text-align:right;">${it.qty}</td>
                            <td style="padding:4px; border:1px solid #cbd5e1; text-align:right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="font-weight:700; background:#e2e8f0;">
                            <td colspan="3" style="padding:4px; border:1px solid #cbd5e1; text-align:right;">공급가</td>
                            <td style="padding:4px; border:1px solid #cbd5e1; text-align:right;">₩ ${supplyPrice.toLocaleString()}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>`;
        }

        reportHtml += `
        <div style="text-align:center; margin-top:10px;">
            <button class="btn btn-neutral" onclick="printInvoiceDetail()" style="padding:10px 30px;"><svg class="icon" aria-hidden="true"><use href="#i-printer"/></svg> 영수증 인쇄</button>
        </div>`;

        document.getElementById('invoiceDetailArea').innerHTML = reportHtml;
        openModal('invoiceDetailModal');
    };

})();
