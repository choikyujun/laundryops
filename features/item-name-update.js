// features/item-name-update.js
// 1. 품목명 인라인 편집 + invoice_items cascade 업데이트 (호텔 단가)
// 2. 기본 단가 품목명 인라인 편집
// 3. 드래그 앤 드롭 순서 변경 (hotel_item_prices / factory_default_prices)

(function() {
    'use strict';

    /* ─────────────────────────────────────────
       CASCADE UPDATE (호텔 단가 → invoice_items)
    ───────────────────────────────────────── */

    window.updateItemNameWithCascade = async function(itemId, oldName, newName) {
        newName = newName.trim();
        if (!newName || newName === oldName) return { skipped: true };

        const db = window.mySupabase;

        const { data: priceRow, error: priceErr } = await db
            .from('hotel_item_prices')
            .select('hotel_id')
            .eq('id', itemId)
            .single();

        if (priceErr || !priceRow) return { error: priceErr };

        const hotelId = priceRow.hotel_id;

        const { error: updateErr } = await db
            .from('hotel_item_prices')
            .update({ name: newName })
            .eq('id', itemId);

        if (updateErr) return { error: updateErr };

        // [점검 메모] hotel_id만 필터, 날짜범위 없음. 호텔당 명세서 수 적어 현재 안전하나 누적 시 1000-row 캡 위험. 데이터 증가 시 재점검.
        const { data: invoices, error: invErr } = await db
            .from('invoices').select('id').eq('hotel_id', hotelId);

        if (invErr) return { error: invErr };
        if (!invoices || invoices.length === 0) return { updated: 0 };

        const { data: updatedItems, error: cascadeErr } = await db
            .from('invoice_items')
            .update({ name: newName })
            .in('invoice_id', invoices.map(i => i.id))
            .eq('name', oldName)
            .select('id');

        if (cascadeErr) return { error: cascadeErr };

        const count = updatedItems ? updatedItems.length : 0;
        console.log(`[item-name] "${oldName}" → "${newName}", invoice_items ${count}건`);
        return { updated: count };
    };

    // 호텔 단가 품목명 저장
    window._itemNameSave = async function(itemId, inputEl) {
        const oldName = inputEl.dataset.oldName;
        const newName = inputEl.value.trim();
        if (!newName) { alert('품목명을 입력해주세요.'); inputEl.value = oldName; return; }
        if (newName === oldName) return;

        const btn = inputEl.nextElementSibling;
        if (btn) { btn.disabled = true; btn.textContent = '저장중...'; }

        const result = await window.updateItemNameWithCascade(itemId, oldName, newName);

        if (result.error) {
            alert('저장 실패: ' + (result.error.message || '오류'));
            inputEl.value = oldName;
            if (btn) { btn.disabled = false; btn.textContent = '품목수정'; }
            return;
        }

        inputEl.dataset.oldName = newName;
        if (btn) { btn.disabled = false; btn.textContent = '품목수정'; }
        if (typeof window.loadHotelPriceList === 'function') window.loadHotelPriceList();
        else if (typeof window.loadSimplePriceList === 'function') window.loadSimplePriceList();

        alert(result.updated > 0
            ? `품목명이 변경되었습니다.\n기존 청구서 품목 ${result.updated}건도 업데이트되었습니다.`
            : '품목명이 변경되었습니다.');
    };

    /* ─────────────────────────────────────────
       기본 단가 품목명 저장 (cascade 없음)
    ───────────────────────────────────────── */

    window._defaultItemNameSave = async function(itemId, inputEl) {
        const oldName = inputEl.dataset.oldName;
        const newName = inputEl.value.trim();
        if (!newName) { alert('품목명을 입력해주세요.'); inputEl.value = oldName; return; }
        if (newName === oldName) return;

        const btn = inputEl.nextElementSibling;
        if (btn) { btn.disabled = true; btn.textContent = '저장중...'; }

        const { error } = await window.mySupabase
            .from('factory_default_prices')
            .update({ name: newName })
            .eq('id', itemId);

        if (error) {
            alert('저장 실패: ' + (error.message || '오류'));
            inputEl.value = oldName;
            if (btn) { btn.disabled = false; btn.textContent = '품목수정'; }
            return;
        }

        inputEl.dataset.oldName = newName;
        if (btn) { btn.disabled = false; btn.textContent = '품목수정'; }
        alert('품목명이 변경되었습니다.');
    };

    /* ─────────────────────────────────────────
       DRAG & DROP (공통)
    ───────────────────────────────────────── */

    if (!document.getElementById('drag-sort-style')) {
        const style = document.createElement('style');
        style.id = 'drag-sort-style';
        style.textContent = 'tr.drag-over td { background: #dbeafe !important; }';
        document.head.appendChild(style);
    }

    const HANDLE_STYLE = 'cursor:grab; padding:4px 10px; color:#94a3b8; font-size:16px; user-select:none;';

    function initDragSort(tbody, saveFn) {
        let draggingRow = null;

        tbody.addEventListener('dragstart', e => {
            const row = e.target.closest('tr[data-item-id]');
            if (!row) return;
            draggingRow = row;
            row.style.opacity = '0.4';
            e.dataTransfer.effectAllowed = 'move';
        });

        tbody.addEventListener('dragend', e => {
            if (draggingRow) draggingRow.style.opacity = '';
            tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
            draggingRow = null;
        });

        tbody.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const row = e.target.closest('tr[data-item-id]');
            if (!row || row === draggingRow) return;
            tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
            row.classList.add('drag-over');
        });

        tbody.addEventListener('drop', async e => {
            e.preventDefault();
            const targetRow = e.target.closest('tr[data-item-id]');
            if (!targetRow || !draggingRow || targetRow === draggingRow) return;
            const rows = [...tbody.querySelectorAll('tr[data-item-id]')];
            if (rows.indexOf(draggingRow) < rows.indexOf(targetRow)) targetRow.after(draggingRow);
            else targetRow.before(draggingRow);
            const orderedIds = [...tbody.querySelectorAll('tr[data-item-id]')].map(r => r.dataset.itemId);
            await saveFn(orderedIds);
        });
    }

    async function saveHotelSortOrder(orderedIds) {
        await Promise.all(orderedIds.map((id, idx) =>
            window.mySupabase.from('hotel_item_prices').update({ sort_order: idx }).eq('id', id)
        ));
    }

    async function saveDefaultSortOrder(orderedIds) {
        await Promise.all(orderedIds.map((id, idx) =>
            window.mySupabase.from('factory_default_prices').update({ sort_order: idx }).eq('id', id)
        ));
    }

    /* ─────────────────────────────────────────
       ROW INJECTION — 호텔 단가 (핸들 셀 삽입)
    ───────────────────────────────────────── */

    function injectHotelRowUI(tbody, deletePattern, saveSortFn) {
        let any = false;

        tbody.querySelectorAll('tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 2) return;

            const delBtn = row.querySelector(`button[onclick*="${deletePattern}"]`);
            if (!delBtn) return;
            const m = delBtn.getAttribute('onclick').match(new RegExp(`${deletePattern}\\(['"]([^'"]+)['"]\\)`));
            if (!m) return;
            const itemId = m[1];

            row.dataset.itemId = itemId;
            row.draggable = true;

            // 드래그 핸들 셀 삽입 (한 번만)
            if (!row.querySelector('td.drag-handle')) {
                const td = document.createElement('td');
                td.className = 'drag-handle';
                td.innerHTML = `<span style="${HANDLE_STYLE}" title="드래그하여 순서 변경">≡</span>`;
                row.insertBefore(td, row.firstChild);
            }

            // 핸들 삽입 후 name 셀 위치: hotelPriceList → col 3(순서+카테고리), simplePriceList → col 2(순서)
            const nameCellIdx = deletePattern === 'deleteHotelPrice' ? 3 : 2;
            const nameCell = row.querySelectorAll('td')[nameCellIdx];
            if (!nameCell || nameCell.querySelector('input[data-old-name]')) return;
            const strong = nameCell.querySelector('strong');
            if (!strong) return;
            const name = strong.textContent;
            nameCell.innerHTML = makeNameInput(itemId, name, '_itemNameSave');
            any = true;
        });

        if (any) initDragSort(tbody, saveSortFn);
    }

    /* ─────────────────────────────────────────
       ROW INJECTION — 기본 단가 (sort_order 셀 교체)
    ───────────────────────────────────────── */

    function injectDefaultRowUI(tbody) {
        let any = false;

        tbody.querySelectorAll('tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            // col 0: sort_order input, col 1: name, col 2: price, col 3: unit, col 4: delete
            if (cells.length < 5) return;

            const delBtn = row.querySelector('button[onclick*="deleteDefaultPrice"]');
            if (!delBtn) return;
            const m = delBtn.getAttribute('onclick').match(/deleteDefaultPrice\(['"]([^'"]+)['"]\)/);
            if (!m) return;
            const itemId = m[1];

            row.dataset.itemId = itemId;
            row.draggable = true;

            // col 0: 숫자 입력 → 드래그 핸들로 교체
            if (!cells[0].querySelector('span.drag-handle-icon')) {
                cells[0].innerHTML = `<span class="drag-handle-icon" style="${HANDLE_STYLE}" title="드래그하여 순서 변경">≡</span>`;
                cells[0].style.padding = '4px 2px';
            }

            // col 1: 품목명 → 인라인 편집
            if (!cells[1].querySelector('input[data-old-name]')) {
                const name = cells[1].textContent.trim();
                cells[1].innerHTML = makeNameInput(itemId, name, '_defaultItemNameSave');
            }

            any = true;
        });

        if (any) initDragSort(tbody, saveDefaultSortOrder);
    }

    function makeNameInput(itemId, name, saveFn) {
        const escaped = name.replace(/"/g, '&quot;');
        return `<input type="text" value="${escaped}" data-old-name="${escaped}"
            style="width:110px; padding:3px 5px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px;"
            onkeydown="if(event.key==='Enter') window.${saveFn}('${itemId}', this)">
        <button class="btn" onclick="window.${saveFn}('${itemId}', this.previousElementSibling)"
            style="padding:3px 8px; font-size:11px; margin-left:4px; background:#3b82f6; color:#fff; border:none; border-radius:4px; cursor:pointer;">품목수정</button>`;
    }

    /* ─────────────────────────────────────────
       FUNCTION WRAPPERS
    ───────────────────────────────────────── */

    function patchHotelPriceList() {
        const orig = window.loadHotelPriceList;
        if (!orig || orig.__patched) return;
        window.loadHotelPriceList = async function(...args) {
            await orig.apply(this, args);
            const tbody = document.getElementById('hotelPriceList');
            if (tbody) injectHotelRowUI(tbody, 'deleteHotelPrice', saveHotelSortOrder);
        };
        window.loadHotelPriceList.__patched = true;
    }

    function patchSimplePriceList() {
        const orig = window.loadSimplePriceList;
        if (!orig || orig.__patched) return;
        window.loadSimplePriceList = async function(...args) {
            await orig.apply(this, args);
            const tbody = document.getElementById('simplePriceList');
            if (tbody) injectHotelRowUI(tbody, 'deleteSimpleItem', saveHotelSortOrder);
        };
        window.loadSimplePriceList.__patched = true;
    }

    function patchAdminDefaultPriceList() {
        const orig = window.loadAdminDefaultPriceList;
        if (!orig || orig.__patched) return;
        window.loadAdminDefaultPriceList = async function(...args) {
            await orig.apply(this, args);
            const tbody = document.getElementById('adminDefaultPriceList');
            if (tbody) injectDefaultRowUI(tbody);
        };
        window.loadAdminDefaultPriceList.__patched = true;
    }

    function applyPatches() {
        patchHotelPriceList();
        patchSimplePriceList();
        patchAdminDefaultPriceList();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyPatches);
    } else {
        applyPatches();
    }

    // 재사용 노출: 입금확인(features/hotel-payments.js) 등에서 동일 DnD 로직 사용(복제 금지).
    window.initDragSort = initDragSort;
    window.DRAG_HANDLE_STYLE = HANDLE_STYLE;
})();
