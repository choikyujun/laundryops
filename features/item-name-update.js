// features/item-name-update.js
// hotel_item_prices 품목명 변경 시 invoice_items 일괄 업데이트

(function() {
    'use strict';

    // hotel_item_prices.name 업데이트 + invoice_items cascade 업데이트
    window.updateItemNameWithCascade = async function(itemId, oldName, newName) {
        newName = newName.trim();
        if (!newName || newName === oldName) return { skipped: true };

        const db = window.mySupabase;

        // 1. hotel_item_prices에서 hotel_id 조회
        const { data: priceRow, error: priceErr } = await db
            .from('hotel_item_prices')
            .select('hotel_id')
            .eq('id', itemId)
            .single();

        if (priceErr || !priceRow) {
            console.error('[item-name-update] hotel_item_prices 조회 실패', priceErr);
            return { error: priceErr };
        }

        const hotelId = priceRow.hotel_id;

        // 2. hotel_item_prices 품목명 업데이트
        const { error: updateErr } = await db
            .from('hotel_item_prices')
            .update({ name: newName })
            .eq('id', itemId);

        if (updateErr) {
            console.error('[item-name-update] hotel_item_prices 업데이트 실패', updateErr);
            return { error: updateErr };
        }

        // 3. 해당 호텔의 invoice id 목록 조회
        const { data: invoices, error: invErr } = await db
            .from('invoices')
            .select('id')
            .eq('hotel_id', hotelId);

        if (invErr) {
            console.error('[item-name-update] invoices 조회 실패', invErr);
            return { error: invErr };
        }

        if (!invoices || invoices.length === 0) {
            return { updated: 0 };
        }

        const invoiceIds = invoices.map(inv => inv.id);

        // 4. invoice_items.name 일괄 업데이트 (oldName → newName)
        const { data: updatedItems, error: cascadeErr } = await db
            .from('invoice_items')
            .update({ name: newName })
            .in('invoice_id', invoiceIds)
            .eq('name', oldName)
            .select('id');

        if (cascadeErr) {
            console.error('[item-name-update] invoice_items cascade 실패', cascadeErr);
            return { error: cascadeErr };
        }

        const count = updatedItems ? updatedItems.length : 0;
        console.log(`[item-name-update] "${oldName}" → "${newName}" 완료. invoice_items ${count}건 업데이트`);
        return { updated: count };
    };

    // 저장 버튼 핸들러
    window._itemNameSave = async function(itemId, inputEl) {
        const oldName = inputEl.dataset.oldName;
        const newName = inputEl.value.trim();

        if (!newName) {
            alert('품목명을 입력해주세요.');
            inputEl.value = oldName;
            return;
        }

        if (newName === oldName) return;

        const btn = inputEl.nextElementSibling;
        if (btn) { btn.disabled = true; btn.textContent = '저장중...'; }

        const result = await window.updateItemNameWithCascade(itemId, oldName, newName);

        if (result.error) {
            alert('저장 실패: ' + (result.error.message || '오류'));
            inputEl.value = oldName;
            if (btn) { btn.disabled = false; btn.textContent = '저장'; }
            return;
        }

        inputEl.dataset.oldName = newName;
        if (btn) { btn.disabled = false; btn.textContent = '저장'; }

        // 목록 새로고침
        if (typeof window.loadHotelPriceList === 'function') {
            window.loadHotelPriceList();
        } else if (typeof window.loadSimplePriceList === 'function') {
            window.loadSimplePriceList();
        }

        const msg = result.updated > 0
            ? `품목명이 변경되었습니다.\n기존 청구서 품목 ${result.updated}건도 업데이트되었습니다.`
            : '품목명이 변경되었습니다.';
        alert(msg);
    };

    // loadHotelPriceList 래핑 — name 셀을 편집 가능하게 교체
    function patchHotelPriceList() {
        const orig = window.loadHotelPriceList;
        if (!orig || orig.__patched) return;

        window.loadHotelPriceList = async function(...args) {
            await orig.apply(this, args);
            const tbody = document.getElementById('hotelPriceList');
            if (!tbody) return;
            tbody.querySelectorAll('tr').forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length < 2) return;
                // col 1 = name (category, name, price, unit, delete)
                const nameCell = cells[1];
                const strong = nameCell.querySelector('strong');
                if (!strong || nameCell.querySelector('input[data-old-name]')) return;
                const name = strong.textContent;
                // delete 버튼 onclick="deleteHotelPrice('ID')" → extract id
                const delBtn = row.querySelector('button[onclick*="deleteHotelPrice"]');
                if (!delBtn) return;
                const match = delBtn.getAttribute('onclick').match(/deleteHotelPrice\(['"]([^'"]+)['"]\)/);
                if (!match) return;
                const itemId = match[1];
                nameCell.innerHTML = `
                    <input type="text" value="${name}" data-old-name="${name}"
                        style="width:110px; padding:3px 5px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px;"
                        onkeydown="if(event.key==='Enter') window._itemNameSave('${itemId}', this)">
                    <button class="btn" onclick="window._itemNameSave('${itemId}', this.previousElementSibling)"
                        style="padding:3px 8px; font-size:11px; margin-left:4px; background:#3b82f6; color:#fff; border:none; border-radius:4px; cursor:pointer;">저장</button>`;
            });
        };
        window.loadHotelPriceList.__patched = true;
    }

    // loadSimplePriceList 래핑 — name 셀을 편집 가능하게 교체
    function patchSimplePriceList() {
        const orig = window.loadSimplePriceList;
        if (!orig || orig.__patched) return;

        window.loadSimplePriceList = async function(...args) {
            await orig.apply(this, args);
            const tbody = document.getElementById('simplePriceList');
            if (!tbody) return;
            tbody.querySelectorAll('tr').forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length < 1) return;
                // col 0 = name (name, price, unit, delete)
                const nameCell = cells[0];
                const strong = nameCell.querySelector('strong');
                if (!strong || nameCell.querySelector('input[data-old-name]')) return;
                const name = strong.textContent;
                // delete 버튼 onclick="deleteSimpleItem('ID')" → extract id
                const delBtn = row.querySelector('button[onclick*="deleteSimpleItem"]');
                if (!delBtn) return;
                const match = delBtn.getAttribute('onclick').match(/deleteSimpleItem\(['"]([^'"]+)['"]\)/);
                if (!match) return;
                const itemId = match[1];
                nameCell.innerHTML = `
                    <input type="text" value="${name}" data-old-name="${name}"
                        style="width:110px; padding:3px 5px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px;"
                        onkeydown="if(event.key==='Enter') window._itemNameSave('${itemId}', this)">
                    <button class="btn" onclick="window._itemNameSave('${itemId}', this.previousElementSibling)"
                        style="padding:3px 8px; font-size:11px; margin-left:4px; background:#3b82f6; color:#fff; border:none; border-radius:4px; cursor:pointer;">저장</button>`;
            });
        };
        window.loadSimplePriceList.__patched = true;
    }

    // app_v38.js가 완전히 실행된 뒤 패치 (DOMContentLoaded 이후)
    function applyPatches() {
        patchHotelPriceList();
        patchSimplePriceList();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyPatches);
    } else {
        applyPatches();
    }
})();
