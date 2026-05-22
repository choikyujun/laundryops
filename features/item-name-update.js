// features/item-name-update.js
// 1. 품목명 인라인 편집 + invoice_items cascade 업데이트
// 2. 드래그 앤 드롭 순서 변경 (sort_order 저장)

(function() {
    'use strict';

    /* ───────────── CASCADE UPDATE ───────────── */

    window.updateItemNameWithCascade = async function(itemId, oldName, newName) {
        newName = newName.trim();
        if (!newName || newName === oldName) return { skipped: true };

        const db = window.mySupabase;

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

        const { error: updateErr } = await db
            .from('hotel_item_prices')
            .update({ name: newName })
            .eq('id', itemId);

        if (updateErr) {
            console.error('[item-name-update] hotel_item_prices 업데이트 실패', updateErr);
            return { error: updateErr };
        }

        const { data: invoices, error: invErr } = await db
            .from('invoices')
            .select('id')
            .eq('hotel_id', hotelId);

        if (invErr) {
            console.error('[item-name-update] invoices 조회 실패', invErr);
            return { error: invErr };
        }

        if (!invoices || invoices.length === 0) return { updated: 0 };

        const invoiceIds = invoices.map(inv => inv.id);

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
            if (btn) { btn.disabled = false; btn.textContent = '저장'; }
            return;
        }

        inputEl.dataset.oldName = newName;
        if (btn) { btn.disabled = false; btn.textContent = '저장'; }

        if (typeof window.loadHotelPriceList === 'function') window.loadHotelPriceList();
        else if (typeof window.loadSimplePriceList === 'function') window.loadSimplePriceList();

        const msg = result.updated > 0
            ? `품목명이 변경되었습니다.\n기존 청구서 품목 ${result.updated}건도 업데이트되었습니다.`
            : '품목명이 변경되었습니다.';
        alert(msg);
    };

    /* ───────────── DRAG & DROP SORT ───────────── */

    const DRAG_HANDLE_STYLE = 'cursor:grab; padding:4px 8px; color:#94a3b8; font-size:16px; user-select:none; touch-action:none;';

    function initDragSort(tbody) {
        let draggingRow = null;

        tbody.addEventListener('dragstart', e => {
            const row = e.target.closest('tr[data-item-id]');
            if (!row) return;
            draggingRow = row;
            row.style.opacity = '0.4';
            e.dataTransfer.effectAllowed = 'move';
        });

        tbody.addEventListener('dragend', e => {
            const row = e.target.closest('tr[data-item-id]');
            if (row) row.style.opacity = '';
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

            // DOM 재정렬
            const rows = [...tbody.querySelectorAll('tr[data-item-id]')];
            const fromIdx = rows.indexOf(draggingRow);
            const toIdx = rows.indexOf(targetRow);
            if (fromIdx < toIdx) {
                targetRow.after(draggingRow);
            } else {
                targetRow.before(draggingRow);
            }

            // sort_order 일괄 저장
            const orderedIds = [...tbody.querySelectorAll('tr[data-item-id]')].map(r => r.dataset.itemId);
            await saveSortOrder(orderedIds);
        });

        // 드래그 오버 강조 스타일 (한 번만 주입)
        if (!document.getElementById('drag-sort-style')) {
            const style = document.createElement('style');
            style.id = 'drag-sort-style';
            style.textContent = 'tr.drag-over td { background: #dbeafe !important; }';
            document.head.appendChild(style);
        }
    }

    async function saveSortOrder(orderedIds) {
        const db = window.mySupabase;
        const updates = orderedIds.map((id, idx) =>
            db.from('hotel_item_prices').update({ sort_order: idx }).eq('id', id)
        );
        await Promise.all(updates);
        console.log('[item-sort] sort_order 저장 완료', orderedIds.length, '건');
    }

    /* ───────────── ROW POST-PROCESSING ───────────── */

    function extractItemId(row, deletePattern) {
        const delBtn = row.querySelector(`button[onclick*="${deletePattern}"]`);
        if (!delBtn) return null;
        const match = delBtn.getAttribute('onclick').match(new RegExp(`${deletePattern}\\(['"]([^'"]+)['"]\\)`));
        return match ? match[1] : null;
    }

    function injectRowUI(tbody, deletePattern) {
        let dragInitialized = false;

        tbody.querySelectorAll('tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 2) return;

            const itemId = extractItemId(row, deletePattern);
            if (!itemId) return;

            row.dataset.itemId = itemId;
            row.draggable = true;

            // 드래그 핸들 셀 (첫 번째로 삽입)
            if (!row.querySelector('td.drag-handle')) {
                const handleTd = document.createElement('td');
                handleTd.className = 'drag-handle';
                handleTd.innerHTML = `<span style="${DRAG_HANDLE_STYLE}" title="드래그하여 순서 변경">≡</span>`;
                row.insertBefore(handleTd, row.firstChild);
            }

            // name 셀 편집 UI (hotelPriceList: col 2 / simplePriceList: col 1 — 핸들 삽입 후)
            const nameCellIdx = deletePattern === 'deleteHotelPrice' ? 2 : 1;
            const updatedCells = row.querySelectorAll('td');
            const nameCell = updatedCells[nameCellIdx];
            if (!nameCell || nameCell.querySelector('input[data-old-name]')) return;
            const strong = nameCell.querySelector('strong');
            if (!strong) return;
            const name = strong.textContent;
            nameCell.innerHTML = `
                <input type="text" value="${name.replace(/"/g, '&quot;')}" data-old-name="${name.replace(/"/g, '&quot;')}"
                    style="width:110px; padding:3px 5px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px;"
                    onkeydown="if(event.key==='Enter') window._itemNameSave('${itemId}', this)">
                <button class="btn" onclick="window._itemNameSave('${itemId}', this.previousElementSibling)"
                    style="padding:3px 8px; font-size:11px; margin-left:4px; background:#3b82f6; color:#fff; border:none; border-radius:4px; cursor:pointer;">저장</button>`;

            dragInitialized = true;
        });

        if (dragInitialized) initDragSort(tbody);
    }

    /* ───────────── FUNCTION WRAPPERS ───────────── */

    function patchHotelPriceList() {
        const orig = window.loadHotelPriceList;
        if (!orig || orig.__patched) return;

        window.loadHotelPriceList = async function(...args) {
            await orig.apply(this, args);
            const tbody = document.getElementById('hotelPriceList');
            if (tbody) injectRowUI(tbody, 'deleteHotelPrice');
        };
        window.loadHotelPriceList.__patched = true;
    }

    function patchSimplePriceList() {
        const orig = window.loadSimplePriceList;
        if (!orig || orig.__patched) return;

        window.loadSimplePriceList = async function(...args) {
            await orig.apply(this, args);
            const tbody = document.getElementById('simplePriceList');
            if (tbody) injectRowUI(tbody, 'deleteSimpleItem');
        };
        window.loadSimplePriceList.__patched = true;
    }

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
