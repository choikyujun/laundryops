// 정액제 운영중지 반영 (B안) — 상단 카드(이번달/올해) + 매출 TOP
// app_v38.js:6816 calculateAdminDashStats 의 사본 + inactive_at 가드.
// !! 원본 변경 시 이 사본도 재동기화 필요 !!
// 원본은 함수 내부에서 hotels를 직접 조회하고 정액 루프도 인라인이라 좁은 훅 seam이 없어
// 통째 오버라이드로 처리. 바뀐 지점은 (1) hotels select에 status,inactive_at 추가
// (2) 정액 가산 조건에 inactiveMonth 가드 추가 뿐. 나머지 로직은 원본과 동일.
// 단가제(오늘/이번달/올해)·카드4 거래처수·TOP 랭킹 렌더 등 원본 역할 전부 보존.
(function () {
  window.calculateAdminDashStats = async function() {
      const curMonth = document.getElementById('adminStatsMonth')?.value || getTodayString().substring(0, 7);
      const todayStr = getTodayString();
  
      // 카드2: curMonth 기준 전월 비교
      const parts = curMonth.split('-');
      let prevMonthD = new Date(parseInt(parts[0]), parseInt(parts[1]) - 2, 1);
      let pM = prevMonthD.getMonth() + 1;
      let pY = prevMonthD.getFullYear();
      const prevMonthStr = pY + '-' + (pM < 10 ? '0' + pM : pM);
      const todayDay = parseInt(todayStr.split('-')[2]);
      const prevMonthLastDay = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 0).getDate();
      const cappedDay = Math.min(todayDay, prevMonthLastDay);
      const prevMonthStart = prevMonthStr + '-01';
      const prevMonthEnd = prevMonthStr + '-' + String(cappedDay).padStart(2, '0');
  
      // 카드1: today 기준 전월 같은날 (단일일)
      const todayParts = todayStr.split('-');
      const todayYear = todayParts[0];
      const todayMonthNum = parseInt(todayParts[1]);
      let tpMonthD = new Date(parseInt(todayYear), todayMonthNum - 2, 1);
      const tpM = tpMonthD.getMonth() + 1;
      const tpY = tpMonthD.getFullYear();
      const todayPrevMonthStr = tpY + '-' + String(tpM).padStart(2, '0');
      const todayPrevMonthLastDay = new Date(parseInt(todayYear), todayMonthNum - 1, 0).getDate();
      const todayCappedDay = Math.min(todayDay, todayPrevMonthLastDay);
      const prevDayStr = todayPrevMonthStr + '-' + String(todayCappedDay).padStart(2, '0');
  
      // 카드3: 올해/전년 YTD (today 기준, 윤년 캡 포함)
      const curYear = todayYear;
      const curYearStart = curYear + '-01-01';
      const prevYearNum = parseInt(curYear) - 1;
      const prevYear = String(prevYearNum);
      const prevYearMonthLastDay = new Date(prevYearNum, todayMonthNum, 0).getDate();
      const prevYearEndDay = Math.min(todayDay, prevYearMonthLastDay);
      const prevYearEndStr = prevYear + '-' + String(todayMonthNum).padStart(2, '0') + '-' + String(prevYearEndDay).padStart(2, '0');
      const prevYearStart = prevYear + '-01-01';
  
      function growthHtml(cur, prev) {
          if (prev <= 0 && cur > 0) return `<span style="color:var(--success);">&#9650; 100.0%</span>`;
          if (prev > 0) {
              const g = ((cur - prev) / prev) * 100;
              const absG = Math.abs(g);
              if (absG < 0.05) return `<span style="color:var(--secondary);">0.0%</span>`;
              return g >= 0
                  ? `<span style="color:var(--success);">&#9650; ${absG.toFixed(1)}%</span>`
                  : `<span style="color:var(--danger);">&#9660; ${absG.toFixed(1)}%</span>`;
          }
          return `<span style="color:var(--secondary);">0.0%</span>`;
      }
      function daysIn(yearNum, monthNum) {
          return new Date(yearNum, monthNum, 0).getDate();
      }
  
      let todayRev = 0, monthRev = 0, prevMonthRev = 0;
      let prevDayRev = 0, yearRev = 0, prevYearRev = 0;
      const hotelSales = {};
  
      // 1. 단가제 매출 — 카드별 날짜-범위 쿼리 (Supabase 서버 1000-row 캡 우회)
      const invSel = 'date, total_amount, hotel_id, staff_name, hotels(name, contract_type)';
      const fId = currentFactoryId;
  
      // 이번달 범위: 과거월 선택 시 월말 캡, 현재월이면 오늘까지
      const curMonthStart = curMonth + '-01';
      const curMonthLastDate = curMonth + '-' + String(daysIn(parseInt(parts[0]), parseInt(parts[1]))).padStart(2, '0');
      const curMonthEnd = curMonthLastDate < todayStr ? curMonthLastDate : todayStr;
  
      // 올해 YTD 월별 쿼리 (1월~오늘 달, 각 월 독립 — 1000-row 캡 원천 차단)
      const curYearMonthPromises = [];
      for (let m = 1; m <= todayMonthNum; m++) {
          const mPfx = curYear + '-' + String(m).padStart(2, '0');
          const mEnd = m < todayMonthNum
              ? mPfx + '-' + String(daysIn(parseInt(curYear), m)).padStart(2, '0')
              : todayStr;
          curYearMonthPromises.push(
              window.mySupabase.from('invoices').select(invSel).eq('factory_id', fId)
                  .gte('date', mPfx + '-01').lte('date', mEnd)
          );
      }
  
      // 전년 YTD 월별 쿼리 (1월~오늘 달, 마지막 달은 prevYearEndStr 윤년 캡)
      const prevYearMonthPromises = [];
      for (let m = 1; m <= todayMonthNum; m++) {
          const mPfx = prevYear + '-' + String(m).padStart(2, '0');
          const mEnd = m < todayMonthNum
              ? mPfx + '-' + String(daysIn(prevYearNum, m)).padStart(2, '0')
              : prevYearEndStr;
          prevYearMonthPromises.push(
              window.mySupabase.from('invoices').select(invSel).eq('factory_id', fId)
                  .gte('date', mPfx + '-01').lte('date', mEnd)
          );
      }
  
      // 전체 병렬 실행 (오늘·전월같은날·이번달·전월·호텔목록·올해월별·전년월별)
      const allResults = await Promise.all([
          window.mySupabase.from('invoices').select(invSel).eq('factory_id', fId).eq('date', todayStr),
          window.mySupabase.from('invoices').select(invSel).eq('factory_id', fId).eq('date', prevDayStr),
          window.mySupabase.from('invoices').select(invSel).eq('factory_id', fId).gte('date', curMonthStart).lte('date', curMonthEnd),
          window.mySupabase.from('invoices').select(invSel).eq('factory_id', fId).gte('date', prevMonthStart).lte('date', prevMonthEnd),
          window.mySupabase.from('hotels').select('name, contract_type, fixed_amount, created_at, status, inactive_at').eq('factory_id', fId),
          ...curYearMonthPromises,
          ...prevYearMonthPromises,
      ]);
  
      const nYearMonths       = curYearMonthPromises.length; // = todayMonthNum
      const todayData         = allResults[0].data;
      const prevDayData       = allResults[1].data;
      const curMonthData      = allResults[2].data;
      const prevMonthData     = allResults[3].data;
      const hotelData         = allResults[4].data;
      const curYearMonthData  = allResults.slice(5, 5 + nYearMonths).map(r => r.data);
      const prevYearMonthData = allResults.slice(5 + nYearMonths).map(r => r.data);
  
      // 차감 명세서·정액제 거래처 제외 필터 (기존 로직 동일)
      function filterInv(rows) {
          return (rows || []).filter(inv => {
              if (inv.staff_name && inv.staff_name.startsWith('관리자(차감)')) return false;
              if (inv.hotels && inv.hotels.contract_type === 'fixed') return false;
              return true;
          });
      }
  
      // 카드1: 오늘 / 전월 같은날
      filterInv(todayData).forEach(inv => { todayRev += inv.total_amount; });
      filterInv(prevDayData).forEach(inv => { prevDayRev += inv.total_amount; });
  
      // 카드2: 이번달 단가제 (TOP 랭킹 hotelSales 동시 집계) + 전월
      filterInv(curMonthData).forEach(inv => {
          monthRev += inv.total_amount;
          const hName = inv.hotels ? inv.hotels.name : '알수없음';
          hotelSales[hName] = (hotelSales[hName] || 0) + inv.total_amount;
      });
      filterInv(prevMonthData).forEach(inv => { prevMonthRev += inv.total_amount; });
  
      // 카드3: 올해/전년 YTD 단가제 (월별 독립 집계)
      curYearMonthData.forEach(rows => filterInv(rows).forEach(inv => { yearRev += inv.total_amount; }));
      prevYearMonthData.forEach(rows => filterInv(rows).forEach(inv => { prevYearRev += inv.total_amount; }));
  
      // 2. 정액제 매출 합산
      let activeHotels = 0;
      if(hotelData) {
          hotelData.forEach(h => {
              activeHotels++;
              if(h.contract_type === 'fixed') {
                  const fixAmt = Number(h.fixed_amount || 0);
                  const createdMonth = h.created_at ? h.created_at.substring(0, 7) : '2000-01';
                  // [inactive_at 가드] 운영중지월부터 정액 미가산(과거 달 보존). inactive_at null이면 가산 유지.
                  const inactiveMonth = h.inactive_at ? String(h.inactive_at).substring(0, 7) : null;
  
                  // 카드1: 정액제 기여 없음 (단가제만)
  
                  // 카드2: 이번달 정액 전액 (계약 시작월 이후만)
                  if (curMonth >= createdMonth && (inactiveMonth === null || curMonth < inactiveMonth)) {
                      monthRev += fixAmt;
                      hotelSales[h.name] = (hotelSales[h.name] || 0) + fixAmt;
                  }
                  // 카드2 성장률: 전월 정액 전액
                  if (prevMonthStr >= createdMonth && (inactiveMonth === null || prevMonthStr < inactiveMonth)) {
                      prevMonthRev += fixAmt;
                  }
  
                  // 카드3: 올해 1~현재월 각 달 전액 합산
                  for (let m = 1; m <= todayMonthNum; m++) {
                      const mStr = curYear + '-' + String(m).padStart(2, '0');
                      if (mStr >= createdMonth && (inactiveMonth === null || mStr < inactiveMonth)) yearRev += fixAmt;
                  }
                  // 카드3 성장률: 전년 1~todayMonth 각 달 전액 합산
                  for (let m = 1; m <= todayMonthNum; m++) {
                      const mStr = prevYear + '-' + String(m).padStart(2, '0');
                      if (mStr >= createdMonth && (inactiveMonth === null || mStr < inactiveMonth)) prevYearRev += fixAmt;
                  }
              }
          });
      }
  
      // 카드1: 오늘
      const elTD = document.getElementById('adminTodayDate');
      if (elTD) {
          const weekday = new Date(todayStr + 'T00:00:00').toLocaleDateString('ko-KR', {timeZone: 'Asia/Seoul', weekday: 'short'});
          elTD.innerText = `오늘 ${parseInt(todayParts[1])}월 ${parseInt(todayParts[2])}일(${weekday})`;
      }
      const elMH = document.getElementById('adminMonthHeader');
      if (elMH) elMH.innerText = `이번 달 (${parseInt(parts[1])}월)`;
      const elYH = document.getElementById('adminYearHeader');
      if (elYH) elYH.innerText = `올해 (${todayYear}년)`;
      const rToday = Math.round(todayRev), rPrevDay = Math.round(prevDayRev);
      const rMonth = Math.round(monthRev), rPrevMonth = Math.round(prevMonthRev);
      const rYear = Math.round(yearRev), rPrevYear = Math.round(prevYearRev);
      const el1 = document.getElementById('adminTodayRevenue');
      if(el1) el1.innerText = rToday.toLocaleString() + '원';
      const elTG = document.getElementById('adminTodayGrowth');
      if(elTG) elTG.innerHTML = growthHtml(rToday, rPrevDay);
  
      // 카드2: 이번달
      const el2 = document.getElementById('adminMonthlyRevenue');
      if(el2) el2.innerText = rMonth.toLocaleString() + '원';
      const elMG = document.getElementById('adminMonthGrowth');
      if(elMG) elMG.innerHTML = growthHtml(rMonth, rPrevMonth);
  
      // 카드3: 올해
      const el3 = document.getElementById('adminYearRevenue');
      if(el3) el3.innerText = rYear.toLocaleString() + '원';
      const elYG = document.getElementById('adminYearGrowth');
      if(elYG) elYG.innerHTML = growthHtml(rYear, rPrevYear);
  
      // 카드4: 거래처/직원
      const el4 = document.getElementById('adminSummaryCount');
      if(el4) {
          const { count: staffCount } = await window.mySupabase.from('staff').select('*', { count: 'exact', head: true }).eq('factory_id', currentFactoryId);
          el4.innerText = `${activeHotels} / ${staffCount || 0}`;
      }
  
      // Top 10 그리기
      const titleEl = document.getElementById('rankingTitle');
      if (titleEl) titleEl.innerHTML = `${parts[0]}년 ${parts[1]}월 매출 TOP`;
  
      const rankingArea = document.getElementById('adminTopRankingArea');
      if(rankingArea) {
          const sorted = Object.entries(hotelSales).sort((a,b) => b[1] - a[1]);
          if(sorted.length === 0) {
              rankingArea.innerHTML = '<div style="color:gray; padding:10px;">데이터가 없습니다.</div>';
          } else {
              rankingArea.innerHTML = '<table class="admin-table"><thead><tr><th>순위</th><th>거래처명</th><th>이번 달 매출</th></tr></thead><tbody>' +
                  sorted.map((f, i) => `<tr><td>${i+1}위</td><td>${f[0]}</td><td style="text-align:right;">${f[1].toLocaleString()}원</td></tr>`).join('') + '</tbody></table>';
          }
      }
      console.log("DEBUG: Final hotelSales after render:", hotelSales);
  };
})();
