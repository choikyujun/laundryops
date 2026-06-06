// [v38 Excel Redesign] downloadSentLogExcel 디자인 교체
// app_v38.js의 데이터/계산 로직은 100% 유지, 스타일(색상·폰트·레이아웃)만 교체.
// 일반거래처 / 특수거래처 분기 구조 유지.
(function () {
  'use strict';

  // ── 헬퍼 ────────────────────────────────────────────────────────────
  function colStr(n) {
    if (n <= 26) return String.fromCharCode(64 + n);
    return String.fromCharCode(64 + Math.floor((n - 1) / 26)) +
           String.fromCharCode(65 + ((n - 1) % 26));
  }

  const FONT = 'Arial';

  const C = {
    green:     { argb: 'FF0F6E56' },
    greenDeep: { argb: 'FF0B5340' },
    greenTint: { argb: 'FFE6F0EC' },
    body:      { argb: 'FF1A1A18' },
    dim:       { argb: 'FF6B6B66' },
    divider:   { argb: 'FFE7E7E2' },
    headerBg:  { argb: 'FFF4F4F1' },
    white:     { argb: 'FFFFFFFF' },
    red:       { argb: 'FFDC2626' },
    deductBg:  { argb: 'FFFEE2E2' },
  };

  function fillSolid(color) {
    return { type: 'pattern', pattern: 'solid', fgColor: color };
  }

  // 4면 thin 격자선. overrides로 특정 면을 medium 등으로 오버라이드 가능.
  function gridBorder(overrides) {
    const b = {
      top:    { style: 'thin', color: C.divider },
      bottom: { style: 'thin', color: C.divider },
      left:   { style: 'thin', color: C.divider },
      right:  { style: 'thin', color: C.divider },
    };
    if (overrides) Object.assign(b, overrides);
    return b;
  }

  // 헤더 2행: 좌측 제목/기간 + 우측 거래처명/브랜드, 2행 하단 그린 medium 라인
  function addHeaderRows(ws, cs, last, hotelName, period) {
    const mid = cs + Math.floor((last - cs) / 2);

    ws.mergeCells(1, cs, 1, mid);
    ws.mergeCells(1, mid + 1, 1, last);
    const tL = ws.getCell(1, cs);
    tL.value = '세탁 거래명세서';
    tL.font  = { name: FONT, bold: true, size: 17, color: C.body };
    tL.alignment = { vertical: 'middle', horizontal: 'left' };
    const tR = ws.getCell(1, mid + 1);
    tR.value = hotelName;
    tR.font  = { name: FONT, bold: true, size: 17, color: C.body };
    tR.alignment = { vertical: 'middle', horizontal: 'right' };
    ws.getRow(1).height = 28;

    ws.mergeCells(2, cs, 2, mid);
    ws.mergeCells(2, mid + 1, 2, last);
    const pL = ws.getCell(2, cs);
    pL.value = '조회기간  ' + period;
    pL.font  = { name: FONT, size: 10, color: C.dim };
    pL.alignment = { vertical: 'middle', horizontal: 'left' };
    pL.border = { bottom: { style: 'medium', color: C.green } };
    const bR = ws.getCell(2, mid + 1);
    bR.value = 'CEGO · 씨고 세탁고수';
    bR.font  = { name: FONT, bold: true, size: 9.5, color: C.green };
    bR.alignment = { vertical: 'middle', horizontal: 'right' };
    bR.border = { bottom: { style: 'medium', color: C.green } };
    ws.getRow(2).height = 20;
  }

  // 하단 합계 행: 공급가액 | 부가세(10%) | 합계 금액(그린 강조)
  function addTotalRow(ws, rowNum, cs, last, supply, vat, total) {
    const cols = last - cs + 1;

    if (cols < 3) {
      // 열이 2개 이하인 극단적 케이스: 전체 병합 후 한 줄 텍스트
      ws.mergeCells(rowNum, cs, rowNum, last);
      const tc = ws.getCell(rowNum, cs);
      tc.value = '공급가액 ₩' + supply.toLocaleString() +
                 '  |  부가세(10%) ₩' + vat.toLocaleString() +
                 '  |  합계 ₩' + total.toLocaleString();
      tc.font  = { name: FONT, bold: true, size: 10, color: C.white };
      tc.fill  = fillSolid(C.green);
      tc.alignment = { vertical: 'middle', horizontal: 'center' };
      tc.border = gridBorder({ top: { style: 'medium', color: C.body } });
      ws.getRow(rowNum).height = 22;
      return;
    }

    // 상단 medium 테두리 전체 적용
    for (let c = cs; c <= last; c++) {
      ws.getCell(rowNum, c).border = gridBorder({ top: { style: 'medium', color: C.body } });
    }

    // 합계 금액(그린) 최소 2열 확보: supply ~30%, vat ~20%, total ~50%
    const safeGreen = Math.min(Math.max(2, Math.ceil(cols * 0.5)), cols - 2);
    const remaining = cols - safeGreen;
    const vatCols   = Math.max(1, Math.floor(remaining / 2));
    const supCols   = remaining - vatCols;
    let e1 = cs + supCols - 1;
    let e2 = e1 + vatCols;

    ws.mergeCells(rowNum, cs, rowNum, e1);
    const sc = ws.getCell(rowNum, cs);
    sc.value = '공급가액  ₩' + supply.toLocaleString();
    sc.font  = { name: FONT, size: 10, color: C.body };
    sc.alignment = { vertical: 'middle', horizontal: 'center' };

    ws.mergeCells(rowNum, e1 + 1, rowNum, e2);
    const vc = ws.getCell(rowNum, e1 + 1);
    vc.value = '부가세 (10%)  ₩' + vat.toLocaleString();
    vc.font  = { name: FONT, size: 10, color: C.dim };
    vc.alignment = { vertical: 'middle', horizontal: 'center' };

    ws.mergeCells(rowNum, e2 + 1, rowNum, last);
    const tc = ws.getCell(rowNum, e2 + 1);
    tc.value = '합계 금액  ₩' + total.toLocaleString();
    tc.font  = { name: FONT, bold: true, size: 10, color: C.white };
    tc.fill  = fillSolid(C.green);
    tc.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    ws.getRow(rowNum).height = 22;
  }

  // ── 메인 함수 오버라이드 ─────────────────────────────────────────────
  window.downloadSentLogExcel = async function (logId, displayPeriod) {

    // ── 데이터 조회 (원본 코드 100% 유지) ───────────────────────────────
    const { data: log } = await window.mySupabase
      .from('sent_logs')
      .select('id, period, total_amount, hotel_id, hotels(name)')
      .eq('id', logId).single();
    if (!log || !log.period) { alert('데이터를 불러올 수 없습니다.'); return; }

    const [sDate, eDate] = log.period.split(' ~ ').map(function (s) { return s.trim(); });
    const hotelName = log.hotels?.name || '거래처';
    const hotelId   = log.hotel_id;

    const { data: h } = await window.mySupabase
      .from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보를 불러올 수 없습니다.'); return; }

    const { data: invData } = await window.mySupabase
      .from('invoices')
      .select('id, date, invoice_items(name, qty, price), staff_name')
      .eq('hotel_id', hotelId)
      .gte('date', sDate).lte('date', eDate)
      .order('date', { ascending: true });

    const list = invData || [];
    if (list.length === 0) { alert('해당 기간에 명세서 데이터가 없습니다.'); return; }

    const filteredList = list.filter(function (inv) {
      if (!inv.staff_name || !inv.staff_name.startsWith('관리자(차감)')) return true;
      return inv.staff_name === '관리자(차감)_' + logId;
    });

    const supplyPrice = filteredList.reduce(function (sum, inv) {
      return sum + (inv.invoice_items || []).reduce(function (s, it) {
        return s + (Number(it.price || 0) * Number(it.qty || 0));
      }, 0);
    }, 0);

    const itemInfoMap      = {};
    const dailyData        = {};
    const negativeDailyData = {};
    let   globalHasDeduction = false;

    filteredList.forEach(function (inv) {
      (inv.invoice_items || []).forEach(function (it) {
        if (!it.name || it.name.trim() === '') return;
        const isMonthlyDeduction =
          (inv.staff_name && inv.staff_name.startsWith('관리자(차감)')) ||
          it.name.includes('(차감)') || it.name.includes('(클레임차감)');
        const cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();

        if (isMonthlyDeduction) {
          globalHasDeduction = true;
          if (!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
          negativeDailyData[inv.date][cleanName] =
            (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
        } else {
          if (!dailyData[inv.date]) dailyData[inv.date] = {};
          dailyData[inv.date][cleanName] =
            (dailyData[inv.date][cleanName] || 0) + it.qty;
        }
        if (!itemInfoMap[cleanName])
          itemInfoMap[cleanName] = { price: Number(it.price || 0), category: it.category || '기타' };
      });
    });

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase
      .from('hotel_item_prices')
      .select('name, category_name')
      .eq('hotel_id', hotelId)
      .eq('price_type', isSpecial ? 'special' : 'general')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    let itemNames = [];
    if (priceOrder && priceOrder.length > 0) {
      const orderedNames = priceOrder.map(function (p) { return p.name; })
                                     .filter(function (n) { return itemInfoMap[n]; });
      const extraNames = Object.keys(itemInfoMap)
                               .filter(function (n) { return !orderedNames.includes(n); });
      itemNames = orderedNames.concat(extraNames);
      priceOrder.forEach(function (p) {
        if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
      });
    } else {
      itemNames = Object.keys(itemInfoMap);
    }

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate() + 1)) {
      allDates.push(d.toISOString().split('T')[0]);
    }

    // ── 합계 계산 (원본 동일) ───────────────────────────────────────────
    const vat      = Math.floor(supplyPrice * 0.1);
    const totalAmt = supplyPrice + vat;

    // ── 워크북 생성 ─────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('정산내역');
    ws.views = [{ showGridLines: false }];

    let lastRow;

    // ── 특수거래처 ─────────────────────────────────────────────────────
    if (isSpecial) {
      const { data: catData } = await window.mySupabase
        .from('hotel_categories')
        .select('name').eq('hotel_id', hotelId).eq('price_type', 'special').order('created_at');
      const orderedCats = catData ? catData.map(function (c) { return c.name; }) : [];
      if (!orderedCats.includes('기타')) orderedCats.push('기타');

      const grouped = {};
      orderedCats.forEach(function (c) { grouped[c] = []; });
      itemNames.forEach(function (name) {
        const cat = itemInfoMap[name].category || '기타';
        if (!grouped[cat]) grouped[cat] = [];
        const posQty = allDates.reduce(function (s, d) {
          return s + ((dailyData[d] && dailyData[d][name]) || 0);
        }, 0);
        const negQty = allDates.reduce(function (s, d) {
          return s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
        }, 0);
        grouped[cat].push({
          name,
          posQty,
          negQty,
          netQty: posQty + negQty,
          price: itemInfoMap[name]?.price || 0,
        });
      });

      // 열 정의: A=여백, B~=내용
      if (globalHasDeduction) {
        ws.columns = [
          { width: 2.4 }, { width: 22 }, { width: 13 }, { width: 10 }, { width: 12 }, { width: 16 }, { width: 2.4 },
        ];
      } else {
        ws.columns = [
          { width: 2.4 }, { width: 22 }, { width: 13 }, { width: 12 }, { width: 16 }, { width: 2.4 },
        ];
      }
      const CS   = 2;
      const LAST = globalHasDeduction ? 6 : 5;

      addHeaderRows(ws, CS, LAST, hotelName, log.period);

      let rowNum = 3;
      orderedCats.forEach(function (cat) {
        if (!grouped[cat] || grouped[cat].length === 0) return;

        // 카테고리 밴드 (그린틴트 배경, 진한 그린 굵게, 좌측)
        ws.mergeCells(rowNum, CS, rowNum, LAST);
        const catCell    = ws.getCell(rowNum, CS);
        catCell.value    = cat;
        catCell.font     = { name: FONT, bold: true, size: 10, color: C.greenDeep };
        catCell.fill     = fillSolid(C.greenTint);
        catCell.alignment = { vertical: 'middle', horizontal: 'left' };
        catCell.border    = gridBorder();
        ws.getRow(rowNum).height = 20;
        rowNum++;

        // 표 헤더 (#F4F4F1 배경, 굵게, 하단 그린 thin 테두리)
        const headers = globalHasDeduction
          ? ['품목', '단가', '수량', '차감', '금액']
          : ['품목', '단가', '수량', '금액'];
        headers.forEach(function (v, i) {
          const c    = ws.getCell(rowNum, CS + i);
          c.value    = v;
          c.font     = { name: FONT, bold: true, size: 10, color: C.body };
          c.fill     = fillSolid(C.headerBg);
          c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' };
          c.border   = gridBorder({ bottom: { style: 'medium', color: C.green } });
        });
        ws.getRow(rowNum).height = 18;
        rowNum++;

        // 품목 행
        grouped[cat].forEach(function (it) {
          const vals = globalHasDeduction
            ? [it.name, it.price, it.posQty, it.negQty !== 0 ? it.negQty : 0, it.price * it.netQty]
            : [it.name, it.price, it.posQty, it.price * it.netQty];

          vals.forEach(function (v, i) {
            const c    = ws.getCell(rowNum, CS + i);
            c.value    = v;
            c.font     = { name: FONT, size: 10, color: C.body };
            c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' };
            c.border    = gridBorder();
            if (i === 0) return;
            if (i === 1) {
              c.numFmt = '#,##0';               // 단가
            } else if (i === vals.length - 1) {
              c.numFmt = '#,##0';               // 금액
            } else {
              // 수량류: 0이면 '-' 직접 기록 (Numbers/구글 시트 호환)
              if (typeof v === 'number' && v === 0) c.value = '-';
              else c.numFmt = '#,##0';
            }
            if (globalHasDeduction && i === 3 && typeof v === 'number' && v < 0) {
              c.font = { name: FONT, size: 10, color: C.red };
            }
          });
          rowNum++;
        });

        rowNum++; // 카테고리 간 빈 행
      });

      addTotalRow(ws, rowNum, CS, LAST, supplyPrice, vat, totalAmt);
      lastRow = rowNum;


    // ── 일반거래처 ─────────────────────────────────────────────────────
    } else {
      ws.columns = [
        { width: 2.4 },
        { width: 10 },
      ].concat(itemNames.map(function () { return { width: 10 }; }))
       .concat([{ width: 2.4 }]);

      const CS   = 2;
      const LAST = 2 + itemNames.length;  // A(여백)+B(일자)+N(품목)

      addHeaderRows(ws, CS, LAST, hotelName, log.period);

      // 표 헤더 행 (행 3)
      const dateHdr    = ws.getCell(3, CS);
      dateHdr.value    = '일자';
      dateHdr.font     = { name: FONT, bold: true, size: 10, color: C.body };
      dateHdr.fill     = fillSolid(C.headerBg);
      dateHdr.alignment = { vertical: 'middle', horizontal: 'center' };
      dateHdr.border   = gridBorder({ bottom: { style: 'medium', color: C.green } });

      itemNames.forEach(function (n, i) {
        const c    = ws.getCell(3, CS + 1 + i);
        c.value    = n;
        c.font     = { name: FONT, bold: true, size: 10, color: C.body };
        c.fill     = fillSolid(C.headerBg);
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        c.border   = gridBorder({ bottom: { style: 'medium', color: C.green } });
      });
      ws.getRow(3).height = 18;

      // 일자별 데이터 행
      let r = 4;
      allDates.forEach(function (d) {
        const dr    = ws.getCell(r, CS);
        dr.value    = d.slice(8) + '일';
        dr.font     = { name: FONT, size: 10, color: C.dim };
        dr.alignment = { vertical: 'middle', horizontal: 'center' };
        dr.border   = gridBorder();

        itemNames.forEach(function (n, i) {
          const c   = ws.getCell(r, CS + 1 + i);
          const rawVal = (dailyData[d] && dailyData[d][n]) || 0;
          c.value   = rawVal === 0 ? '-' : rawVal;
          c.font    = { name: FONT, size: 10, color: rawVal < 0 ? C.red : C.body };
          if (rawVal !== 0) c.numFmt = '#,##0';
          c.alignment = { vertical: 'middle', horizontal: 'center' };
          c.border  = gridBorder();
        });
        r++;
      });

      // 월말 차감 행
      if (globalHasDeduction) {
        const dl    = ws.getCell(r, CS);
        dl.value    = '월말 차감';
        dl.font     = { name: FONT, bold: true, size: 10, color: C.red };
        dl.fill     = fillSolid(C.deductBg);
        dl.alignment = { vertical: 'middle', horizontal: 'center' };
        dl.border    = gridBorder();

        itemNames.forEach(function (n, i) {
          const negQty = allDates.reduce(function (s, d) {
            return s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0);
          }, 0);
          const c   = ws.getCell(r, CS + 1 + i);
          const dedVal = negQty < 0 ? negQty : 0;
          c.value   = dedVal === 0 ? '-' : dedVal;
          c.font    = { name: FONT, bold: true, size: 10, color: C.red };
          c.fill    = fillSolid(C.deductBg);
          if (dedVal !== 0) c.numFmt = '#,##0';
          c.alignment = { vertical: 'middle', horizontal: 'center' };
          c.border    = gridBorder();
        });
        r++;
      }

      // 수량 합계 행 (#F4F4F1 배경 + 굵게 + 상단 진한 테두리)
      const sumLabel    = ws.getCell(r, CS);
      sumLabel.value    = '수량 합계';
      sumLabel.font     = { name: FONT, bold: true, size: 10, color: C.body };
      sumLabel.fill     = fillSolid(C.headerBg);
      sumLabel.alignment = { vertical: 'middle', horizontal: 'center' };
      sumLabel.border   = gridBorder({ top: { style: 'medium', color: C.body } });

      itemNames.forEach(function (n, i) {
        const posQty = allDates.reduce(function (s, d) {
          return s + ((dailyData[d] && dailyData[d][n]) || 0);
        }, 0);
        const negQty = allDates.reduce(function (s, d) {
          return s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0);
        }, 0);
        const c   = ws.getCell(r, CS + 1 + i);
        const sumQty = posQty + negQty;
        c.value   = sumQty === 0 ? '-' : sumQty;
        c.font    = { name: FONT, bold: true, size: 10, color: C.body };
        c.fill    = fillSolid(C.headerBg);
        if (sumQty !== 0) c.numFmt = '#,##0';
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        c.border  = gridBorder({ top: { style: 'medium', color: C.body } });
      });
      r++;

      // 단가 행 (흐림 글씨, ₩ 표기)
      const prLabel    = ws.getCell(r, CS);
      prLabel.value    = '단가';
      prLabel.font     = { name: FONT, size: 10, color: C.dim };
      prLabel.alignment = { vertical: 'middle', horizontal: 'center' };
      prLabel.border    = gridBorder();

      itemNames.forEach(function (n, i) {
        const c   = ws.getCell(r, CS + 1 + i);
        c.value   = itemInfoMap[n]?.price || 0;
        c.font    = { name: FONT, size: 10, color: C.dim };
        c.numFmt  = '#,##0';
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        c.border  = gridBorder();
      });
      r++;

      // 항목 합계 행 (옅은 그린틴트 배경 + 진한 그린 굵은 글씨)
      const totLabel    = ws.getCell(r, CS);
      totLabel.value    = '항목 합계';
      totLabel.font     = { name: FONT, bold: true, size: 10, color: C.greenDeep };
      totLabel.fill     = fillSolid(C.greenTint);
      totLabel.alignment = { vertical: 'middle', horizontal: 'center' };
      totLabel.border    = gridBorder();

      itemNames.forEach(function (n, i) {
        const posQty = allDates.reduce(function (s, d) {
          return s + ((dailyData[d] && dailyData[d][n]) || 0);
        }, 0);
        const negQty = allDates.reduce(function (s, d) {
          return s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0);
        }, 0);
        const c   = ws.getCell(r, CS + 1 + i);
        c.value   = (posQty + negQty) * (itemInfoMap[n]?.price || 0);
        c.font    = { name: FONT, bold: true, size: 10, color: C.greenDeep };
        c.fill    = fillSolid(C.greenTint);
        c.numFmt  = '#,##0';
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        c.border  = gridBorder();
      });
      r++;

      addTotalRow(ws, r, CS, LAST, supplyPrice, vat, totalAmt);
      lastRow = r;

    }

    // ── 입금 계좌 정보 행 (원본 로직 유지, 변수명만 정리) ─────────────
    try {
      const { data: fInfo } = await window.mySupabase
        .from('factories').select('bank_info').eq('id', currentFactoryId).maybeSingle();
      if (fInfo && fInfo.bank_info) {
        lastRow++;
        const bankLastCol = isSpecial
          ? (globalHasDeduction ? 6 : 5)
          : (2 + itemNames.length);
        ws.mergeCells(lastRow, 1, lastRow, bankLastCol);
        const bankCell    = ws.getCell(lastRow, 1);
        bankCell.value    = '💳 입금 계좌 정보: ' + fInfo.bank_info;
        bankCell.font     = { name: FONT, bold: true, size: 10, color: { argb: 'FF166534' } };
        bankCell.fill     = fillSolid({ argb: 'FFF0FDF4' });
        bankCell.alignment = { vertical: 'middle', horizontal: 'left' };
        ws.getRow(lastRow).height = 20;
      }
    } catch (e) { console.warn('[엑셀 계좌 정보 추가 실패]', e); }

    // ── 파일 다운로드 (원본 코드 100% 유지) ────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    const blob   = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href    = url;
    const safePeriod = log.period.replace(/\s+/g, '').replace(/~/g, '_');
    a.download = hotelName + '_' + safePeriod + '.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

})();
