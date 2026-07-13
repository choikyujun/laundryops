// 위탁 호텔 이중 단가 — 묶음 1+: 거래처 위탁 토글 + 단가 2칸 + 비번검증 + 순서컬럼 + 이름한줄 + 이동컬럼 + 설명글
// override: openHotelModal, saveNewHotel, openPriceSetting,
//           loadSimplePriceList, addSimpleItem,
//           loadHotelPriceList, addHotelCustomItem, updateHotelItemPrice
(function () {
    'use strict';

    // item-name-update.js 존재 여부 → "이동" 헤더 및 colspan 조정
    const _hasDrag = typeof window.updateItemNameWithCascade !== 'undefined';
    const _moveTh = _hasDrag ? '<th style="width:28px; text-align:center;">이동</th>' : '';

    // ── 거래명세서 보기 팝업: "인쇄하기(VAT포함)" 버튼용 금액 박제 ──
    // viewInvoiceDetail이 렌더할 때마다 supplyPrice/vat/총합계를 담아둔다.
    let _viewInvoiceVat = null;

    // ── UI 헬퍼: 단가 입력 폼 위탁/직영 전환 ─────────────────────────
    function _applyConsignmentPriceUI(isC) {
        // simplePriceModal 입력 폼
        const sdpg = document.getElementById('simp_display_price_group');
        const spLabel = document.getElementById('simp_price_label');
        const spInput = document.getElementById('simp_price');
        if (sdpg) sdpg.style.display = isC ? '' : 'none';
        if (spLabel) spLabel.textContent = isC ? '공장 단가' : '단가';
        if (spInput) spInput.style.width = isC ? '76px' : '100px';

        // priceSettingModal 입력 폼 (특수거래처)
        const hdpg = document.getElementById('hp_display_price_group');
        const hpLabel = document.getElementById('hp_price_label');
        const hpInput = document.getElementById('hp_price');
        if (hdpg) hdpg.style.display = isC ? '' : 'none';
        if (hpLabel) hpLabel.textContent = isC ? '공장 단가' : '단가';
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
                ? `${_moveTh}<th style="width:28px; text-align:center;">순서</th><th>품목</th><th>공장 단가</th><th>위탁 단가</th><th>단위</th><th>관리</th>`
                : `${_moveTh}<th style="width:28px; text-align:center;">순서</th><th>품목</th><th>단가</th><th>단위</th><th>관리</th>`;
        }

        // 설명글 (위탁일 때만 표시)
        let _sdesc = document.getElementById('cph-price-desc-simple');
        if (!_sdesc) {
            _sdesc = document.createElement('div');
            _sdesc.id = 'cph-price-desc-simple';
            _sdesc.style.cssText = 'font-size:11px; color:#64748b; padding:2px 0 6px;';
            _sdesc.textContent = '공장 단가 = 직영점 단가  ·  위탁 단가 = 위탁세탁 단가';
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
            if (error) alert('위탁 단가 수정 실패: ' + error.message);
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
                ? `${_moveTh}<th style="width:28px; text-align:center;">순서</th><th>카테고리</th><th>품목명</th><th>공장 단가</th><th>위탁 단가</th><th>단위</th><th>관리</th>`
                : `${_moveTh}<th style="width:28px; text-align:center;">순서</th><th>카테고리</th><th>품목명</th><th>단가</th><th>단위</th><th>관리</th>`;
        }

        // 설명글 (위탁일 때만 표시)
        let _hdesc = document.getElementById('cph-price-desc-hotel');
        if (!_hdesc) {
            _hdesc = document.createElement('div');
            _hdesc.id = 'cph-price-desc-hotel';
            _hdesc.style.cssText = 'font-size:11px; color:#64748b; padding:2px 0 6px;';
            _hdesc.textContent = '공장 단가 = 직영점 단가  ·  위탁 단가 = 위탁세탁 단가';
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

        // B3: 6개월 추이 재산출 (display_price 기준)
        const trendMonths = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(sMonth + '-01');
            d.setMonth(d.getMonth() - i);
            trendMonths.push(d.toISOString().substring(0, 7));
        }
        const newTrend = {};
        trendMonths.forEach(m => { newTrend[m] = 0; });

        for (const tm of trendMonths) {
            const [tmY, tmM] = tm.split('-').map(Number);
            const tmLastDay = new Date(tmY, tmM, 0).getDate();
            const tmStart = tm + '-01';
            const tmEnd = tm + '-' + String(tmLastDay).padStart(2, '0');

            const { data: tmInvs } = await window.mySupabase
                .from('invoices')
                .select('id, staff_name')
                .eq('hotel_id', currentHotelId)
                .gte('date', tmStart)
                .lte('date', tmEnd);

            const tmIds = (tmInvs || [])
                .filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)')))
                .map(inv => inv.id);

            if (tmIds.length === 0) continue;

            const { data: tmItems } = await window.mySupabase
                .from('invoice_items')
                .select('name, qty, price')
                .in('invoice_id', tmIds);

            let tmTotal = 0;
            (tmItems || []).forEach(it => {
                const dp = dpMap[it.name] != null ? dpMap[it.name] : Number(it.price || 0);
                tmTotal += dp * Number(it.qty || 0);
            });
            newTrend[tm] = Math.round(tmTotal);
        }
        window.updateHotelTrendChart(newTrend);
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
            .select('name, price, display_price, unit, sort_order, category_name')
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
                const consignPrice = (p.display_price != null) ? Number(p.display_price) : null;
                mergedItems.push({ name: p.name, price, qty: savedItemsMap[p.name] || 0, category: p.category_name || '기타', consignPrice });
            });
        } else {
            (inv.invoice_items || []).forEach(it => {
                const base = Number(it.price || 0);
                const price = (isConsignment && isHotelView && dpMap[it.name] != null) ? dpMap[it.name] : base;
                mergedItems.push({ name: it.name, price, qty: Number(it.qty || 0), category: '기타', consignPrice: null });
            });
        }

        const supplyPrice = mergedItems.reduce((s, it) => s + (it.price * it.qty), 0);
        // [작업4] 대표(admin) 화면 전용 참고 열: 위탁단가(display_price). isHotelView(파트너)면 항상 false
        const showConsign = isConsignment && !isHotelView && mergedItems.some(it => it.consignPrice != null);
        const grayBg = !isHotelView ? ' background:#f1f5f9;' : '';
        // 대표 화면에서만 단가·금액 열 회색. 파트너 화면은 빈 문자열 → 음영 없음.

        // [VAT] 인쇄하기(VAT포함) 버튼용 금액 박제 — 최종 합계 기준 1회(Math.floor), 항목별 아님
        const _vat = Math.floor(supplyPrice * 0.1);
        _viewInvoiceVat = { supplyPrice, vat: _vat, totalWithVat: supplyPrice + _vat, isSpecial, labelColspan: showConsign ? 4 : 3 };

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
                            <th style="border-right:1px solid #cbd5e1; padding:1px 2px; width:16%;${grayBg}">단가</th>
                            ${showConsign ? '<th class="consign-price-col" style="border-right:1px solid #cbd5e1; padding:1px 2px; width:16%;">위탁단가</th>' : ''}
                            <th style="border-right:1px solid #cbd5e1; padding:1px 2px;">수량</th>
                            <th style="padding:1px 2px;${grayBg}">금액</th>
                        </tr></thead>
                        <tbody>
                            ${grouped[cat].map(it => `<tr>
                                <td style="border-right:1px solid #cbd5e1; padding:1px 2px;">${it.name}</td>
                                <td style="border-right:1px solid #cbd5e1; padding:1px 2px; text-align:center; width:16%;${grayBg}">${it.price.toLocaleString()}</td>
                                ${showConsign ? `<td class="consign-price-col" style="border-right:1px solid #cbd5e1; padding:1px 2px; text-align:center;">${it.consignPrice != null ? it.consignPrice.toLocaleString() : '-'}</td>` : ''}
                                <td style="border-right:1px solid #cbd5e1; padding:1px 2px; text-align:center;">${it.qty}</td>
                                <td style="padding:1px 2px; text-align:right;${grayBg}">₩ ${(it.price * it.qty).toLocaleString()}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>`;
            });
            reportHtml = `
                <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:5px; margin-bottom:5px; font-size:18px;">거래명세서 상세 (${inv.hotels ? inv.hotels.name : ''})${isConsignment ? ' <span style="color:#dc2626; font-weight:700;">(위탁)</span>' : ''}</h1>
                <div style="text-align:right; margin-bottom:5px; font-size:12px;">발행 일자: ${inv.date} | 담당자: ${inv.staff_name || ''}</div>
                <div style="display:grid !important; grid-template-columns: repeat(2, 1fr) !important; gap:6px !important; align-items:start !important; padding:3px !important; width: 100% !important;">
                    ${categoriesHtml}
                </div>
                <div id="invDetailVatSpecialBox" style="margin-top:10px; padding:10px; border:2px solid #000; text-align:right; font-weight:700; font-size:13px; border-radius:8px;">
                    공급가: ₩ ${supplyPrice.toLocaleString()}
                </div>`;
        } else {
            reportHtml = `
            <div id="report-to-print" style="padding:10px; font-family:'Malgun Gothic', sans-serif;">
                <h1 style="text-align:center; color:#0f172a; border-bottom:3px solid #005b9f; padding-bottom:5px; margin-bottom:10px; font-size:18px;">세탁 명세서 (${inv.hotels ? inv.hotels.name : ''})${isConsignment ? ' <span style="color:#dc2626; font-weight:700;">(위탁)</span>' : ''}</h1>
                <div style="text-align:left; margin-bottom:5px; color:#0f172a; font-size:12px; font-weight:700;">발행일: ${inv.date} | 담당자: ${inv.staff_name || ''}</div>
                <table style="width:100%; border-collapse:collapse; margin-top:5px; font-size:12px; border:1px solid #cbd5e1;">
                    <thead>
                        <tr style="background:#f1f5f9;">
                            <th style="padding:4px; border:1px solid #cbd5e1; text-align:left;">품목</th>
                            <th style="padding:4px; border:1px solid #cbd5e1; text-align:right; width:15%;${grayBg}">단가</th>
                            ${showConsign ? '<th class="consign-price-col" style="padding:4px;border:1px solid #cbd5e1;text-align:right; width:15%;">위탁단가</th>' : ''}
                            <th style="padding:4px; border:1px solid #cbd5e1; text-align:right;">수량</th>
                            <th style="padding:4px; border:1px solid #cbd5e1; text-align:right;${grayBg}">금액</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${mergedItems.map(it => `
                        <tr>
                            <td style="padding:4px; border:1px solid #cbd5e1; text-align:left;">${it.name || '알수없음'}</td>
                            <td style="padding:4px; border:1px solid #cbd5e1; text-align:right; width:15%;${grayBg}">${it.price.toLocaleString()}</td>
                            ${showConsign ? `<td class="consign-price-col" style="padding:4px;border:1px solid #cbd5e1;text-align:right; width:15%;">${it.consignPrice != null ? it.consignPrice.toLocaleString() : '-'}</td>` : ''}
                            <td style="padding:4px; border:1px solid #cbd5e1; text-align:right;">${it.qty}</td>
                            <td style="padding:4px; border:1px solid #cbd5e1; text-align:right;${grayBg}">₩ ${(it.price * it.qty).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                    <tfoot id="invDetailVatFoot">
                        <tr style="font-weight:700; background:#e2e8f0;">
                            <td colspan="${showConsign ? 4 : 3}" style="padding:4px; border:1px solid #cbd5e1; text-align:right;">공급가</td>
                            <td style="padding:4px; border:1px solid #cbd5e1; text-align:right;">₩ ${supplyPrice.toLocaleString()}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>`;
        }

        reportHtml += `
        <div style="text-align:center; margin-top:10px;">
            <button class="btn btn-neutral" onclick="printInvoiceDetail()" style="padding:10px 30px;"><svg class="icon" aria-hidden="true"><use href="#i-printer"/></svg> 영수증 인쇄</button>
            <button class="btn btn-neutral" onclick="printInvoiceDetailVat()" style="padding:10px 30px; margin-left:8px;"><svg class="icon" aria-hidden="true"><use href="#i-printer"/></svg> 인쇄하기(VAT포함)</button>
        </div>`;

        document.getElementById('invoiceDetailArea').innerHTML = reportHtml;
        openModal('invoiceDetailModal');
    };

    // ── 인쇄하기(VAT포함): 인쇄본에만 부가세(10%)/총 합계 행을 임시로 더해 인쇄 ──
    // 화면 팝업 표시(공급가만)와 기존 "영수증 인쇄"(printInvoiceDetail)는 건드리지 않는다.
    // printReport가 #invoiceDetailArea를 동기적으로 clone한 뒤 인쇄하므로,
    // 임시 행을 추가 → printInvoiceDetail(bank_info 삽입 + printReport) await → finally에서 원복.
    window.printInvoiceDetailVat = async function () {
        const info = _viewInvoiceVat;
        if (!info) { alert('금액 정보를 찾을 수 없습니다.'); return; }
        const won = (n) => '₩ ' + Number(n || 0).toLocaleString();
        const added = [];
        try {
            if (info.isSpecial) {
                const box = document.getElementById('invDetailVatSpecialBox');
                if (box) {
                    const vatLine = document.createElement('div');
                    vatLine.className = 'vat-temp-row';
                    vatLine.style.marginTop = '4px';
                    vatLine.textContent = '부가세(10%): ' + won(info.vat);
                    const totLine = document.createElement('div');
                    totLine.className = 'vat-temp-row';
                    totLine.style.marginTop = '4px';
                    totLine.textContent = '총 합계: ' + won(info.totalWithVat);
                    box.appendChild(vatLine);
                    box.appendChild(totLine);
                    added.push(vatLine, totLine);
                }
            } else {
                const foot = document.getElementById('invDetailVatFoot');
                if (foot) {
                    const cs = info.labelColspan;
                    const cellR = 'padding:4px; border:1px solid #cbd5e1; text-align:right;';
                    const vatTr = document.createElement('tr');
                    vatTr.className = 'vat-temp-row';
                    vatTr.style.fontWeight = '700';
                    vatTr.innerHTML = `<td colspan="${cs}" style="${cellR}">부가세(10%)</td><td style="${cellR}">${won(info.vat)}</td>`;
                    const totTr = document.createElement('tr');
                    totTr.className = 'vat-temp-row';
                    totTr.style.fontWeight = '700';
                    totTr.style.background = '#e2e8f0';
                    totTr.innerHTML = `<td colspan="${cs}" style="${cellR}">총 합계</td><td style="${cellR}">${won(info.totalWithVat)}</td>`;
                    foot.appendChild(vatTr);
                    foot.appendChild(totTr);
                    added.push(vatTr, totTr);
                }
            }
            // 기존 인쇄 준비(bank_info 삽입) + printReport clone을 그대로 재사용
            await window.printInvoiceDetail();
        } finally {
            added.forEach((n) => { try { n.remove(); } catch (e) {} });
        }
    };

    // ── B4 save: confirmSendInvoice — display_total_amount 박제 (위탁만) ──
    const _origConfirmSendInvoice = window.confirmSendInvoice;
    window.confirmSendInvoice = async function (sDate, eDate, hotelId, totalAmount, supplyPrice, vat) {
        const { data: hCheck } = await window.mySupabase
            .from('hotels').select('is_consignment, contract_type, hotel_type').eq('id', hotelId).single();
        if (!hCheck || !hCheck.is_consignment) {
            return _origConfirmSendInvoice.apply(this, arguments);
        }

        const isSpecial = hCheck.contract_type === 'special' || hCheck.hotel_type === 'special';
        const typeFilter = isSpecial ? 'special' : 'general';
        const dpMap = await _getDisplayPriceMap(hotelId, typeFilter);

        const { data: invData } = await window.mySupabase
            .from('invoices')
            .select('invoice_items(name, qty, price)')
            .eq('factory_id', currentFactoryId)
            .eq('hotel_id', hotelId)
            .gte('date', sDate)
            .lte('date', eDate);

        let displaySupply = 0;
        (invData || []).forEach(inv => {
            (inv.invoice_items || []).forEach(it => {
                const dp = dpMap[it.name] != null ? dpMap[it.name] : Number(it.price || 0);
                displaySupply += dp * Number(it.qty || 0);
            });
        });
        const displayVat = Math.floor(Math.round(displaySupply) * 0.1);
        const displayTotal = Math.round(displaySupply) + displayVat;

        const sentAtVal = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const { error: sentErr } = await window.mySupabase.from('sent_logs').insert([{
            factory_id: currentFactoryId,
            hotel_id: hotelId,
            period: sDate + ' ~ ' + eDate,
            total_amount: totalAmount,
            supply_price: supplyPrice,
            vat: vat,
            sent_at: sentAtVal,
            is_confirmed: false,
            display_total_amount: displayTotal
        }]);
        if (sentErr) { alert('발송 저장 실패: ' + sentErr.message); return; }

        await window.mySupabase.from('invoices')
            .update({ is_sent: true, report_period: sDate + ' ~ ' + eDate })
            .eq('factory_id', currentFactoryId)
            .eq('hotel_id', hotelId)
            .gte('date', sDate)
            .lte('date', eDate);

        {
            alert('성공적으로 발송되었습니다.');
            closeModal('sendInvoiceModal');
            loadAdminDashboard();
            window.loadAdminSentList();
        }

        try {
            const { data: hInfo } = await window.mySupabase
                .from('hotels').select('name, phone').eq('id', hotelId).maybeSingle();
            if (hInfo && hInfo.phone) {
                const { data: fInfo } = await window.mySupabase
                    .from('factories').select('name').eq('id', currentFactoryId).maybeSingle();
                await fetch('https://tphagookafjldzvxaxui.supabase.co/functions/v1/send-kakao', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'billing',
                        to: hInfo.phone.replace(/-/g, ''),
                        factoryName: fInfo ? fInfo.name : '',
                        hotelName: hInfo.name,
                        startDate: sDate,
                        endDate: eDate
                    })
                });
            }
        } catch (e) { console.warn('[월정산 알림톡 발송 실패]', e); }
    };

    // ── B4 display: 수신함 목록 + 페이징 (display_total_amount 표시) ────
    let _cphReceivedData = null;
    let _cphReceivedPage = 1;
    const _CPH_PAGE_SIZE = 10;

    window.loadHotelReceivedInvoicesList = async function () {
        const tbody = document.getElementById('hotelReceivedInvoicesList');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">불러오는 중...</td></tr>';

        const { data: logs, error } = await window.mySupabase
            .from('sent_logs')
            .select('id, period, total_amount, display_total_amount, sent_at, is_confirmed')
            .eq('hotel_id', currentHotelId)
            .order('sent_at', { ascending: false });

        if (error || !logs) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--danger);">오류: ${error?.message || '알 수 없는 오류'}</td></tr>`;
            window.renderHotelReceivedPaging(0);
            return;
        }
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="padding:20px; text-align:center; color:gray;">수신된 정산 리포트가 없습니다.</td></tr>';
            window.renderHotelReceivedPaging(0);
            return;
        }

        _cphReceivedData = logs;
        _cphReceivedPage = 1;
        window.renderHotelReceivedPage();
    };

    window.renderHotelReceivedPage = function () {
        const tbody = document.getElementById('hotelReceivedInvoicesList');
        if (!tbody || !_cphReceivedData) return;

        const total = _cphReceivedData.length;
        const totalPages = Math.ceil(total / _CPH_PAGE_SIZE);
        const start = (_cphReceivedPage - 1) * _CPH_PAGE_SIZE;
        const pageData = _cphReceivedData.slice(start, start + _CPH_PAGE_SIZE);

        tbody.innerHTML = '';
        pageData.forEach(log => {
            const displayPeriod = log.period || '-';
            const amt = log.display_total_amount != null ? log.display_total_amount : log.total_amount;
            const confirmed = log.is_confirmed === true;
            const statusBadge = confirmed
                ? `<span class="badge" style="background:#16a34a; color:white; padding:2px 8px; border-radius:4px;"><svg class="icon" aria-hidden="true"><use href="#i-check-circle"/></svg> 확인완료</span>`
                : `<span class="badge" style="background:var(--danger); color:white; padding:2px 8px; border-radius:4px;"><svg class="icon icon-dot" aria-hidden="true"><use href="#i-dot-red"/></svg> 수신완료</span>`;
            tbody.innerHTML += `<tr>
                <td style="text-align:left;">${displayPeriod}</td>
                <td style="text-align:right;">${Number(amt || 0).toLocaleString()}원</td>
                <td style="text-align:center;">${statusBadge}</td>
                <td style="text-align:center; white-space:nowrap;">
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; background:var(--primary); color:white; border:1px solid var(--primary); border-radius:4px; height:auto; display:inline-block;" onclick="viewHotelSentLogDetail('${log.id}')">상세</button>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; background:#16a34a; color:white; border:1px solid #16a34a; border-radius:4px; margin-left:4px; height:auto; display:inline-block;" onclick="downloadSentLogExcel('${log.id}', '${displayPeriod}')">Excel</button>
                </td>
            </tr>`;
        });

        window.renderHotelReceivedPaging(totalPages);
    };

    window.renderHotelReceivedPaging = function (totalPages) {
        const paging = document.getElementById('hotelReceivedPagination');
        if (!paging) return;
        paging.innerHTML = '';
        if (!_cphReceivedData || totalPages <= 1) return;

        const total = _cphReceivedData.length;
        const btnStyle = (active) => `padding:6px 12px; border-radius:6px; border:1px solid #cbd5e1; cursor:pointer; font-size:13px; font-weight:${active ? '700' : '400'}; background:${active ? 'var(--primary)' : 'white'}; color:${active ? 'white' : '#334155'}; min-width:36px; min-height:36px;`;

        const prevBtn = document.createElement('button');
        prevBtn.textContent = '◀';
        prevBtn.style.cssText = btnStyle(false);
        prevBtn.disabled = _cphReceivedPage === 1;
        prevBtn.style.opacity = _cphReceivedPage === 1 ? '0.4' : '1';
        prevBtn.onclick = () => { _cphReceivedPage--; window.renderHotelReceivedPage(); };
        paging.appendChild(prevBtn);

        const maxShow = 5;
        let pageStart = Math.max(1, _cphReceivedPage - Math.floor(maxShow / 2));
        let pageEnd = Math.min(totalPages, pageStart + maxShow - 1);
        if (pageEnd - pageStart < maxShow - 1) pageStart = Math.max(1, pageEnd - maxShow + 1);

        for (let i = pageStart; i <= pageEnd; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.style.cssText = btnStyle(i === _cphReceivedPage);
            btn.onclick = ((p) => () => { _cphReceivedPage = p; window.renderHotelReceivedPage(); })(i);
            paging.appendChild(btn);
        }

        const nextBtn = document.createElement('button');
        nextBtn.textContent = '▶';
        nextBtn.style.cssText = btnStyle(false);
        nextBtn.disabled = _cphReceivedPage === totalPages;
        nextBtn.style.opacity = _cphReceivedPage === totalPages ? '0.4' : '1';
        nextBtn.onclick = () => { _cphReceivedPage++; window.renderHotelReceivedPage(); };
        paging.appendChild(nextBtn);

        const info = document.createElement('span');
        info.style.cssText = 'font-size:12px; color:var(--secondary); margin-left:8px; display:inline-block;';
        info.textContent = `총 ${total}건 / ${_cphReceivedPage}페이지`;
        paging.appendChild(info);
    };

    // ── B5: viewSentDetail — 위탁+파트너뷰 display_price 환산 ───────────
    const _origViewSentDetail = window.viewSentDetail;
    window.viewSentDetail = async function (hotelName, period, sentLogId, isPartnerView, hotelId, isConfirmed) {
        if (!isPartnerView || !hotelId) {
            return _origViewSentDetail.apply(this, arguments);
        }
        const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
        if (!h) { alert('거래처 정보가 없습니다.'); return; }
        if (!h.is_consignment) {
            return _origViewSentDetail.apply(this, arguments);
        }

        const [sDate, eDate] = period.split(' ~ ');

        const { data: invData, error: invErr } = await window.mySupabase
            .from('invoices')
            .select('id, date, invoice_items(name, qty, price, unit), staff_name')
            .eq('factory_id', currentFactoryId)
            .eq('hotel_id', hotelId)
            .gte('date', sDate)
            .lte('date', eDate)
            .order('date', { ascending: true });
        if (invErr) { alert('명세서 조회 에러: ' + invErr.message); return; }

        const list = invData || [];
        if (list.length === 0) { alert('조회된 데이터가 없습니다.'); return; }

        const filteredList = list.filter(inv => {
            if (!inv.staff_name || !inv.staff_name.startsWith('관리자(차감)')) return true;
            return inv.staff_name === '관리자(차감)_' + sentLogId;
        });

        const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';
        const typeFilter = isSpecial ? 'special' : 'general';
        const dpMap = await _getDisplayPriceMap(hotelId, typeFilter);

        const itemInfoMap = {};
        const dailyData = {};
        const negativeDailyData = {};
        let globalHasDeduction = false;

        filteredList.forEach(inv => {
            (inv.invoice_items || []).forEach(it => {
                if (!it.name || it.name.trim() === '') return;
                const isDeduction = (inv.staff_name && inv.staff_name.startsWith('관리자(차감)')) || it.name.includes('(차감)') || it.name.includes('(클레임차감)');
                const cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
                if (isDeduction) {
                    globalHasDeduction = true;
                    if (!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                    negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
                } else {
                    if (!dailyData[inv.date]) dailyData[inv.date] = {};
                    dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
                }
                if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price || 0), category: it.category || '기타' };
            });
        });

        Object.keys(itemInfoMap).forEach(name => {
            if (dpMap[name] != null) itemInfoMap[name].price = dpMap[name];
        });

        let supplyPrice = 0;
        filteredList.forEach(inv => {
            (inv.invoice_items || []).forEach(it => {
                if (!it.name || it.name.trim() === '') return;
                const cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
                const dp = dpMap[cleanName] != null ? dpMap[cleanName] : Number(it.price || 0);
                supplyPrice += dp * Number(it.qty || 0);
            });
        });
        supplyPrice = Math.round(supplyPrice);
        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmount = supplyPrice + vat;

        const allDates = [];
        for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate() + 1)) {
            allDates.push(d.toISOString().split('T')[0]);
        }

        const viewSentTypeFilter = isSpecial ? 'special' : 'general';
        const { data: priceData } = await window.mySupabase.from('hotel_item_prices')
            .select('name, category_name')
            .eq('hotel_id', hotelId)
            .eq('price_type', viewSentTypeFilter)
            .order('sort_order', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: true });

        let itemNames = [];
        if (priceData && priceData.length > 0) {
            const orderedNames = priceData.map(p => p.name).filter(n => itemInfoMap[n]);
            const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
            itemNames = [...orderedNames, ...extraNames];
            priceData.forEach(p => {
                if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
            });
        } else {
            itemNames = Object.keys(itemInfoMap);
        }

        let reportHtml = '';

        if (isSpecial) {
            const { data: catData } = await window.mySupabase.from('hotel_categories')
                .select('name').eq('hotel_id', hotelId).eq('price_type', 'special').order('created_at');
            const orderedCats = catData ? catData.map(c => c.name) : [];
            if (!orderedCats.includes('기타')) orderedCats.push('기타');

            const grouped = {};
            orderedCats.forEach(c => { grouped[c] = []; });
            itemNames.forEach(name => {
                const cat = itemInfoMap[name].category || '기타';
                if (!grouped[cat]) grouped[cat] = [];
                const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
            });

            let categoriesHtml = '';
            orderedCats.forEach(cat => {
                if (!grouped[cat] || grouped[cat].length === 0) return;
                categoriesHtml += `
                <div style="break-inside:avoid; margin-bottom:5px; border:1px solid #cbd5e1;">
                    <div style="background:#f1f5f9; padding:2px 4px; font-weight:700; font-size:10px; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                    <table style="width:100%; font-size:10px; border-collapse:collapse; line-height:1.1;">
                        <thead><tr style="background:#f8fafc;">
                            <th style="border:1px solid #cbd5e1; padding:2px 3px;">품목</th>
                            <th style="border:1px solid #cbd5e1; padding:2px 3px;">단가</th>
                            <th style="border:1px solid #cbd5e1; padding:2px 3px;">수량(합계)</th>
                            ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:2px 3px; color:#dc2626;">차감</th>` : ''}
                            <th style="border:1px solid #cbd5e1; padding:2px 3px;">금액</th>
                        </tr></thead>
                        <tbody>
                            ${grouped[cat].map(it => `<tr>
                                <td style="border:1px solid #cbd5e1; padding:1px 3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:1px 3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:1px 3px; text-align:right;">${it.posQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:1px 3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:1px 3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>`;
            });

            reportHtml = `
                <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:6px;">
                    <h2 style="text-align:center; font-size:15px; margin:0 0 5px 0; padding-bottom:6px; border-bottom:2px solid #005b9f; color:#0f172a;">세탁 거래명세서 — ${h.name}</h2>
                    <div style="text-align:right; margin-bottom:5px; font-size:11px; color:#64748b;">조회 기간: ${sDate} ~ ${eDate}</div>
                    <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:5px; align-items:start;">
                        ${categoriesHtml}
                    </div>
                    <div style="margin-top:8px; padding:8px 12px; border:2px solid #005b9f; font-weight:700; font-size:13px; border-radius:6px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:12px;">공급가: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                        <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
                    </div>
                </div>`;
        } else {
            reportHtml = `
                <div id="send-report-print-area" style="font-family:'Malgun Gothic',sans-serif; padding:6px;">
                <h2 style="text-align:center; font-size:15px; margin:0 0 5px 0; padding-bottom:6px; border-bottom:2px solid #005b9f; color:#0f172a;">세탁 거래명세서 — ${h.name}</h2>
                <div style="text-align:right; margin-bottom:5px; font-size:11px; color:#64748b;">조회 기간: ${sDate} ~ ${eDate}</div>
                <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; margin-top: 3px; border: 1px solid #cbd5e1; font-size: 10px; line-height:1.1;">
                    <thead>
                        <tr>
                            <th style="background: #f1f5f9; padding: 2px 3px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                            ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 2px 3px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${allDates.map(d => `<tr>
                            <td style="padding: 1px 3px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 1px 3px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`).join('')}
                    </tbody>
                    <tfoot>
                        ${globalHasDeduction ? `
                        <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                            <td style="padding: 2px 3px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                            ${itemNames.map(name => {
                                const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                                return `<td style="padding: 2px 3px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                            }).join('')}
                        </tr>` : ''}
                        <tr style="background: #e2e8f0; font-weight: 700;">
                            <td style="padding: 2px 3px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                            ${itemNames.map(name => {
                                const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                                const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                                return `<td style="padding: 2px 3px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                            }).join('')}
                        </tr>
                        <tr style="background: #f1f5f9; font-weight: 700;">
                            <td style="padding: 2px 3px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                            ${itemNames.map(name => `<td style="padding: 2px 3px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                        </tr>
                        <tr style="background: #fef3c7; font-weight: 700;">
                            <td style="padding: 2px 3px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                            ${itemNames.map(name => {
                                const posQty = allDates.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                                const negQty = allDates.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                                const netQty = posQty + negQty;
                                return `<td style="padding: 2px 3px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                            }).join('')}
                        </tr>
                    </tfoot>
                </table>
                </div>
                <div style="margin-top:8px; padding:8px 12px; border:2px solid #005b9f; font-weight:700; font-size:13px; border-radius:6px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:12px;">공급가: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                    <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
                </div>
                </div>`;
        }

        let confirmBtnHtml = '';
        if (isPartnerView && sentLogId) {
            confirmBtnHtml = isConfirmed
                ? `<div style="padding:8px 20px; background:#dcfce7; color:#16a34a; font-weight:700; border-radius:8px; font-size:14px;"><svg class="icon" aria-hidden="true"><use href="#i-check-circle"/></svg> 정산 확인 완료</div>`
                : `<button onclick="confirmHotelSettlement('${sentLogId}')" style="padding:10px 24px; cursor:pointer; font-size:14px; font-weight:700; background:#16a34a; color:white; border:none; border-radius:8px;"><svg class="icon" aria-hidden="true"><use href="#i-check-circle"/></svg> 정산확인</button>`;
        }

        reportHtml += `
        <div class="no-print" style="display:flex; gap:10px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
            ${confirmBtnHtml}
            <button onclick="printReport('send-report-print-area')" style="padding:10px 30px; cursor:pointer; font-size:14px; font-weight:700; background:#64748b; color:white; border:none; border-radius:8px;"><svg class="icon" aria-hidden="true"><use href="#i-printer"/></svg> 인쇄하기</button>
            <button onclick="closeModal('sendInvoiceModal')" style="padding:10px 20px; cursor:pointer; font-size:14px; font-weight:700; background:#e2e8f0; color:#374151; border:none; border-radius:8px;">닫기</button>
        </div>`;

        const sendArea = document.getElementById('sendInvoiceArea');
        sendArea.dataset.hotelName = hotelName;
        sendArea.dataset.periodStart = sDate || '';
        sendArea.dataset.periodEnd = eDate || '';
        sendArea.innerHTML = reportHtml;
        window.openSendInvoiceModal();
    };

    // ── fix: 대시보드 증감율 — 동기간 대비(이번달 1일~오늘 vs 전월 1일~전월 동일자) ─
    // app_v38.js 원본: 이번달 누적 vs 전월 전체 비교 → 월 중반엔 항상 불리
    // 수정: 전월 동일 기간과 비교해 진짜 증감율 표시
    const _origUpdateTrendChartOnly = window.updateTrendChartOnly;
    if (_origUpdateTrendChartOnly) {
        window.updateTrendChartOnly = async function () {
            await _origUpdateTrendChartOnly.apply(this, arguments);
            const el = document.getElementById('adminGrowthRate');
            if (!el || !currentFactoryId) return;

            try {
                const today = new Date();
                const ty = today.getFullYear(), tm = today.getMonth() + 1, td = today.getDate();
                const todayStr = `${ty}-${String(tm).padStart(2,'0')}-${String(td).padStart(2,'0')}`;
                const curMonthStr = `${ty}-${String(tm).padStart(2,'0')}`;

                const prevY = tm === 1 ? ty - 1 : ty;
                const prevM = tm === 1 ? 12 : tm - 1;
                const prevMonthStr = `${prevY}-${String(prevM).padStart(2,'0')}`;
                const prevLastDay = new Date(ty, tm - 1, 0).getDate();
                const prevEnd = `${prevMonthStr}-${String(Math.min(td, prevLastDay)).padStart(2,'0')}`;

                const { data: factoryHotels, error: hotelErr } = await window.mySupabase
                    .from('hotels').select('id').eq('factory_id', currentFactoryId);
                const hotelIds = (factoryHotels || []).map(h => h.id);
                if (hotelIds.length === 0) { return; }

                const [curRes, prevRes] = await Promise.all([
                    window.mySupabase.from('invoices').select('total_amount')
                        .in('hotel_id', hotelIds)
                        .gte('date', curMonthStr + '-01').lte('date', todayStr),
                    window.mySupabase.from('invoices').select('total_amount')
                        .in('hotel_id', hotelIds)
                        .gte('date', prevMonthStr + '-01').lte('date', prevEnd)
                ]);

                const curTotal = (curRes.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
                const prevTotal = (prevRes.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);

                let g = 0;
                if (prevTotal > 0) {
                    g = ((curTotal - prevTotal) / prevTotal) * 100;
                } else if (curTotal > 0) {
                    g = 100;
                }

                const absG = Math.abs(g);
                if (absG < 0.05) {
                    el.innerHTML = '<span style="color:var(--secondary);">0.0%</span>';
                } else if (g > 0) {
                    el.innerHTML = `<span style="color:var(--success);">&#9650; ${absG.toFixed(1)}%</span>`;
                } else {
                    el.innerHTML = `<span style="color:var(--danger);">&#9660; ${absG.toFixed(1)}%</span>`;
                }
            } catch (e) {
                console.warn('[동기간 증감율 재계산 오류]', e);
            }
        };
    }

})();
