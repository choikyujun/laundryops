// features/hotel-payments.js
// 월정산 관리 > 입금확인(수금 관리) 탭. 그 달 거래처별 청구 / 입금 / 미수금을 한 화면에서.
// 기준: 01-prd-입금확인.md, 03-design-입금확인.md.
//
// 이 파일(태스크 2): 탭 패널에 스캐폴드(월 이동 + 요약 3카드 + 표 헤더)를 1회 주입.
//   데이터 결합·입금 CRUD·드래그 순서는 이후 태스크(3~5)에서 채운다.
//   window.initDragSort(item-name-update.js) 재사용 예정 → 로드 순서상 그 파일 뒤에 온다.
//
// 로드 순서: features/item-name-update.js 뒤(index.html).
(function () {
    'use strict';

    const PANEL_ID = 'tab_adminCollect';
    const YM_ID = 'hp-ym';          // 월 단일 출처(YYYY-MM)

    // ── 유틸 ─────────────────────────────────────────────
    function todayYm() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }

    // 'YYYY-MM' + delta개월 → 'YYYY-MM'
    function shiftYm(ym, delta) {
        const parts = String(ym).split('-').map(Number);
        const d = new Date(parts[0], (parts[1] - 1) + delta, 1);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }

    // 'YYYY-MM' → '2026년 7월'
    function ymLabel(ym) {
        const parts = String(ym).split('-').map(Number);
        return parts[0] + '년 ' + parts[1] + '월';
    }

    function getYm() {
        const el = document.getElementById(YM_ID);
        return (el && el.value) ? el.value : todayYm();
    }

    function setYm(ym) {
        const el = document.getElementById(YM_ID);
        if (el) el.value = ym;
        const lbl = document.getElementById('hp-ym-label');
        if (lbl) lbl.textContent = ymLabel(ym);
    }

    // 금액 열 등폭(자릿수 세로 정렬) — revenue-top-align.js와 동일 접근.
    // 앱 기본 폰트에 tabular figures가 없어 monospace 스택으로 숫자 등폭을 보장.
    const MONO = 'font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace; font-variant-numeric: tabular-nums;';

    function won(n) { return Number(n || 0).toLocaleString() + '원'; }
    function mmdd(dateStr) {
        if (!dateStr) return '-';
        const s = String(dateStr).substring(0, 10); // YYYY-MM-DD
        const parts = s.split('-');
        return parts.length === 3 ? (parts[1] + '-' + parts[2]) : s;
    }
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // 배열을 size개씩 청크로
    function chunk(arr, size) {
        const out = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
    }

    // 거래처별 그 달 매출(trend[ym]). computeMonthlyRevenue 미로드/에러 시 0.
    async function hotelRevenue(hotelId, ym) {
        if (typeof window.computeMonthlyRevenue !== 'function') return 0;
        try {
            const out = await window.computeMonthlyRevenue({
                factoryId: currentFactoryId, fromYm: ym, toYm: ym, hotelFilter: hotelId
            });
            return Number((out && out.trend && out.trend[ym]) || 0);
        } catch (e) {
            console.warn('[hotel-payments] 매출 조회 실패', hotelId, e);
            return 0;
        }
    }

    // 최신 요청만 렌더하도록(월 화살표 연타 race 방지)
    let _reqSeq = 0;

    // ── 데이터 결합 → 표 + 요약 렌더 ──
    async function refreshData() {
        const panel = document.getElementById(PANEL_ID);
        if (!panel || panel.dataset.hpReady !== '1') return;
        const tbody = document.getElementById('hp-list');
        if (!tbody) return;

        const ym = getYm();
        const seq = ++_reqSeq;

        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--secondary,#64748b);">불러오는 중...</td></tr>';

        try {
            if (!currentFactoryId) { throw new Error('공장 정보 없음'); }

            // 1) 거래처 + 위탁사 + 발송분 + 입금 (병렬 4쿼리)
            const [hotelsRes, companiesRes, sentRes, payRes] = await Promise.all([
                window.mySupabase.from('hotels')
                    .select('id, name, is_consignment, consignment_company_id')
                    .eq('factory_id', currentFactoryId).order('name', { ascending: true }),
                window.mySupabase.from('consignment_companies')
                    .select('id, name')
                    .eq('factory_id', currentFactoryId),
                // period = "YYYY-MM-DD ~ ..." → 앞 7자 = ym 인 행만
                window.mySupabase.from('sent_logs')
                    .select('hotel_id, period, total_amount')
                    .eq('factory_id', currentFactoryId)
                    .like('period', ym + '%'),
                window.mySupabase.from('hotel_payments')
                    .select('hotel_id, company_id, paid_amount, paid_at')
                    .eq('factory_id', currentFactoryId)
                    .eq('year_month', ym)
            ]);

            for (const r of [hotelsRes, companiesRes, sentRes, payRes]) {
                if (r.error) throw r.error;
            }
            if (seq !== _reqSeq) return; // 더 최신 요청이 진행 중

            const hotels = hotelsRes.data || [];
            const companyName = {};
            (companiesRes.data || []).forEach(c => { companyName[c.id] = c.name; });

            // 발송분: 호텔별 그 달 total_amount 합(같은 달 다건이면 합산, VAT 재연산 없음)
            const sentByHotel = {};
            (sentRes.data || []).forEach(row => {
                if (row.period && row.period.substring(0, 7) !== ym) return; // like 보정
                const k = row.hotel_id;
                sentByHotel[k] = (sentByHotel[k] || 0) + Number(row.total_amount || 0);
            });

            // 입금: payer별
            const paidByHotel = {};
            const paidByCompany = {};
            (payRes.data || []).forEach(p => {
                if (p.hotel_id) paidByHotel[p.hotel_id] = { amount: Number(p.paid_amount || 0), at: p.paid_at };
                else if (p.company_id) paidByCompany[p.company_id] = { amount: Number(p.paid_amount || 0), at: p.paid_at };
            });

            // 2) 발송분 없는 거래처만 매출 조회(발송분 있으면 청구액 = 발송분, 매출 불필요)
            const needRevenue = hotels.filter(h => !(h.id in sentByHotel));
            const revById = {};
            const groups = chunk(needRevenue, 8); // 8개씩 병렬
            for (const g of groups) {
                const vals = await Promise.all(g.map(h => hotelRevenue(h.id, ym)));
                g.forEach((h, i) => { revById[h.id] = vals[i]; });
                if (seq !== _reqSeq) return;
            }

            // 3) 거래처별 청구액 산출 + 포함 여부(매출0 & 발송분 없음 → 제외)
            const directRows = [];      // 직영 + 위탁 미지정
            const companyBilled = {};   // company_id -> 청구액 합
            const companyHasMember = {};

            hotels.forEach(h => {
                const hasSent = (h.id in sentByHotel);
                let billed;
                if (hasSent) {
                    billed = sentByHotel[h.id];               // 발송분(VAT 포함, 그대로)
                } else {
                    const rev = Number(revById[h.id] || 0);
                    if (rev === 0) return;                    // 매출0 & 발송분 없음 → 제외
                    billed = rev + Math.floor(rev * 0.1);     // 미발송분 = 매출 + VAT
                }

                if (h.is_consignment && h.consignment_company_id) {
                    const cid = h.consignment_company_id;
                    companyBilled[cid] = (companyBilled[cid] || 0) + billed;
                    companyHasMember[cid] = true;
                } else {
                    directRows.push({
                        payerType: 'hotel', payerId: h.id,
                        name: h.name, billed: billed,
                        badgeKind: h.is_consignment ? 'unassigned' : (hasSent ? 'sent' : 'unsent')
                    });
                }
            });

            // 위탁사(그룹) 행
            const companyRows = Object.keys(companyBilled).map(cid => ({
                payerType: 'company', payerId: cid,
                name: companyName[cid] || '(이름 없는 위탁사)',
                billed: companyBilled[cid], badgeKind: 'company'
            }));

            // 4) 정렬: 이름 가나다순(거래처 탭과 동일 기준). 순서 테이블은 태스크 5.
            const rows = directRows.concat(companyRows)
                .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));

            if (seq !== _reqSeq) return;
            renderRows(rows, paidByHotel, paidByCompany);

        } catch (e) {
            if (seq !== _reqSeq) return;
            console.warn('[hotel-payments] 조회 오류', e);
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--danger,#dc2626);">조회 오류: ${esc(e.message || e)}</td></tr>`;
            setSummary(0, 0, 0);
        }
    }

    const BADGE = {
        sent: 'background:var(--bg-accent,#eff6ff); color:var(--accent,#2563eb);',
        unsent: 'background:var(--surface,#f1f5f9); color:var(--secondary,#64748b);',
        company: 'background:var(--bg-accent,#eff6ff); color:var(--accent,#2563eb);',
        unassigned: 'background:#fef3c7; color:#92400e;'
    };
    const BADGE_TEXT = { sent: '발송', unsent: '미발송', company: '위탁사', unassigned: '위탁사 미지정' };

    function badgeHtml(kind) {
        return `<span style="display:inline-block; font-size:11px; padding:1px 5px; border-radius:4px; ${BADGE[kind] || BADGE.unsent}">${BADGE_TEXT[kind] || ''}</span>`;
    }

    function setSummary(billed, paid, unpaid) {
        const b = document.getElementById('hp-sum-billed');
        const p = document.getElementById('hp-sum-paid');
        const u = document.getElementById('hp-sum-unpaid');
        if (b) b.textContent = won(billed);
        if (p) p.textContent = won(paid);
        if (u) u.textContent = won(unpaid);
    }

    function renderRows(rows, paidByHotel, paidByCompany) {
        const tbody = document.getElementById('hp-list');
        if (!tbody) return;

        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--secondary,#64748b);">이 달 청구 대상 거래처가 없습니다.</td></tr>';
            setSummary(0, 0, 0);
            return;
        }

        const moneyTd = 'text-align:right; ' + MONO;
        let sumBilled = 0, sumPaid = 0, sumUnpaid = 0;
        let html = '';

        rows.forEach(row => {
            const payInfo = row.payerType === 'company'
                ? paidByCompany[row.payerId]
                : paidByHotel[row.payerId];
            const paid = payInfo ? Number(payInfo.amount || 0) : 0;
            const hasPaid = !!payInfo;
            const billed = Number(row.billed || 0);
            const unpaid = Math.max(billed - paid, 0);

            // 요약은 목록 합계와 일치: 입금완료 = min(paid, billed), 미수금 = max(billed-paid,0)
            sumBilled += billed;
            sumPaid += Math.min(paid, billed);
            sumUnpaid += unpaid;

            // 상태
            let rowStyle = '';
            let paidCell, unpaidCell, doneCell;
            if (!hasPaid || paid <= 0) {
                // 미입금
                paidCell = `<td style="${moneyTd} color:var(--secondary,#94a3b8);">-</td>`;
                unpaidCell = `<td style="${moneyTd} color:var(--danger,#dc2626);">${won(unpaid)}</td>`;
                doneCell = `<td style="text-align:center; color:var(--secondary,#cbd5e1);">-</td>`;
            } else if (paid < billed) {
                // 부분입금
                rowStyle = ' style="background:var(--bg-danger,#fef2f2);"';
                paidCell = `<td style="${moneyTd}">${won(paid)}</td>`;
                unpaidCell = `<td style="${moneyTd} color:var(--danger,#dc2626); font-weight:700;">${won(unpaid)}</td>`;
                doneCell = `<td style="text-align:center; color:var(--secondary,#cbd5e1);">-</td>`;
            } else {
                // 완료 (paid >= billed)
                paidCell = `<td style="${moneyTd} color:var(--success,#16a34a);">${won(paid)}</td>`;
                unpaidCell = `<td style="${moneyTd} color:var(--secondary,#94a3b8);">0원</td>`;
                doneCell = `<td style="text-align:center; color:var(--success,#16a34a);"><svg class="icon" aria-hidden="true"><use href="#i-check-circle"/></svg></td>`;
            }

            html += `<tr${rowStyle}>
                <td style="text-align:center; color:var(--secondary,#cbd5e1);"></td>
                <td style="text-align:left; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><strong>${esc(row.name)}</strong> ${badgeHtml(row.badgeKind)}</td>
                <td style="${moneyTd}">${won(billed)}</td>
                ${paidCell}
                ${unpaidCell}
                <td style="text-align:center; ${MONO}">${payInfo ? mmdd(payInfo.at) : '-'}</td>
                ${doneCell}
            </tr>`;
        });

        tbody.innerHTML = html;
        setSummary(sumBilled, sumPaid, sumUnpaid);
    }

    function goMonth(delta) {
        setYm(shiftYm(getYm(), delta));
        refreshData();
    }
    // 화살표 onclick에서 부르도록 노출
    window._hpGoMonth = goMonth;

    // ── 스캐폴드 1회 주입 ────────────────────────────────
    function ensureScaffold() {
        const panel = document.getElementById(PANEL_ID);
        if (!panel) return false;
        if (panel.dataset.hpReady === '1') return true; // 멱등 가드

        const cardStyle = 'flex:1; min-width:0; background:var(--surface,#fff); border:1px solid var(--border,#e2e8f0); border-radius:var(--radius,12px); padding:14px 16px;';
        const cardTitle = 'font-size:13px; color:var(--secondary,#64748b); margin-bottom:6px;';
        const cardValue = 'font-size:24px; font-weight:500; ' + MONO;

        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin:14px 0 12px;">
                <h3 style="margin:0; font-size:15px;"><svg class="icon" aria-hidden="true"><use href="#i-banknote"/></svg> 입금확인</h3>
                <div style="display:flex; align-items:center; gap:8px; background:var(--surface,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:8px; padding:4px 6px;">
                    <button type="button" onclick="window._hpGoMonth(-1)" style="border:none; background:none; cursor:pointer; font-size:15px; padding:2px 8px; color:#334155;" aria-label="이전 달">&#9664;</button>
                    <span id="hp-ym-label" style="font-size:14px; font-weight:700; min-width:96px; text-align:center;"></span>
                    <button type="button" onclick="window._hpGoMonth(1)" style="border:none; background:none; cursor:pointer; font-size:15px; padding:2px 8px; color:#334155;" aria-label="다음 달">&#9654;</button>
                    <input type="hidden" id="${YM_ID}">
                </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-bottom:14px;">
                <div style="${cardStyle}">
                    <div style="${cardTitle}">청구 총액</div>
                    <div id="hp-sum-billed" style="${cardValue}">0원</div>
                </div>
                <div style="${cardStyle}">
                    <div style="${cardTitle}">입금 완료</div>
                    <div id="hp-sum-paid" style="${cardValue} color:var(--success,#16a34a);">0원</div>
                </div>
                <div style="${cardStyle} background:var(--bg-danger,#fef2f2); border-color:var(--danger,#fca5a5);">
                    <div style="${cardTitle} color:var(--danger,#dc2626);">미수금</div>
                    <div id="hp-sum-unpaid" style="${cardValue} color:var(--danger,#dc2626);">0원</div>
                </div>
            </div>

            <div class="chart-container">
                <div class="table-scroll-wrap">
                    <table class="admin-table" style="min-width:640px; table-layout:fixed;">
                        <thead>
                            <tr>
                                <th style="width:5%;"></th>
                                <th style="width:26%; text-align:left;">거래처</th>
                                <th style="width:15%; text-align:right;">청구액</th>
                                <th style="width:16%; text-align:right;">입금액</th>
                                <th style="width:15%; text-align:right;">미수금</th>
                                <th style="width:13%; text-align:center;">입금일</th>
                                <th style="width:10%; text-align:center;">완료</th>
                            </tr>
                        </thead>
                        <tbody id="hp-list">
                            <tr><td colspan="7" style="text-align:center; padding:20px; color:var(--secondary,#64748b);">준비 중입니다.</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>`;

        panel.dataset.hpReady = '1';
        return true;
    }

    // ── 진입점: 탭 클릭 시 호출(index.html onclick) ──
    window.loadHotelPayments = function () {
        if (!ensureScaffold()) return;
        if (!getYm()) setYm(todayYm());
        else setYm(getYm()); // 라벨 동기화
        refreshData();
    };
})();
