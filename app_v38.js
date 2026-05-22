let _isInvoiceLoading = false;
console.log("APP_V38 LOADED - 2026-04-13");

// ── 로그인 화면 미리보기 갤러리 ────────────────────────────────
(function initPreviewGallery() {
  if (!window.PREVIEW_IMAGES || !window.PREVIEW_IMAGES.length) return;

  function openLightbox(src, caption) {
    var lb = document.getElementById('previewLightbox');
    var img = document.getElementById('lightboxImg');
    var cap = document.getElementById('lightboxCaption');
    if (!lb || !img) return;
    img.src = src;
    cap.textContent = caption;
    lb.style.display = 'flex';
  }
  window.closeLightbox = function() {
    var lb = document.getElementById('previewLightbox');
    if (lb) lb.style.display = 'none';
  };

  function buildCard(item, rotate, isInline) {
    var wrapper = document.createElement('div');
    wrapper.style.cssText = isInline
      ? 'display:inline-block; vertical-align:top; margin-right:12px; cursor:pointer;'
      : 'cursor:pointer;';

    var card = document.createElement('div');
    card.style.cssText = [
      'border-radius:8px',
      'overflow:hidden',
      'box-shadow:0 3px 12px rgba(0,0,0,0.18)',
      'transform:rotate(' + rotate + 'deg)',
      'transition:transform 0.2s, box-shadow 0.2s',
      isInline ? 'width:130px' : 'width:100%'
    ].join(';');
    card.onmouseenter = function() { card.style.transform = 'rotate(0deg) scale(1.04)'; card.style.boxShadow = '0 6px 20px rgba(0,0,0,0.28)'; };
    card.onmouseleave = function() { card.style.transform = 'rotate(' + rotate + 'deg)'; card.style.boxShadow = '0 3px 12px rgba(0,0,0,0.18)'; };

    var img = document.createElement('img');
    img.src = item.src;
    img.alt = item.caption;
    img.style.cssText = 'width:100%; display:block;';

    var cap = document.createElement('div');
    cap.textContent = item.caption;
    cap.style.cssText = 'background:#1e293b; color:#e2e8f0; font-size:11px; padding:4px 6px; text-align:center; font-weight:600;';

    card.appendChild(img);
    card.appendChild(cap);
    wrapper.appendChild(card);
    wrapper.onclick = function(e) { e.stopPropagation(); openLightbox(item.src, item.caption); };
    return wrapper;
  }

  var imgs = window.PREVIEW_IMAGES;
  var rotations = [-3, 2, -2, 3, -1, 2];

  document.addEventListener('DOMContentLoaded', function() {
    var left    = document.getElementById('galleryLeft');
    var right   = document.getElementById('galleryRight');
    var mob     = document.getElementById('galleryMobile');
    var wrapper = document.getElementById('loginPageWrapper');

    // 카드를 각 컨테이너에 미리 삽입 (한 번만)
    imgs.forEach(function(item, i) {
      var rot = rotations[i % rotations.length];
      if (i < 3 && left)  left.appendChild(buildCard(item, rot, false));
      else if (right)     right.appendChild(buildCard(item, rot, false));
      if (mob) mob.appendChild(buildCard(item, rot, true));
    });

    function applyLayout() {
      var isMobile = window.innerWidth < 900;
      if (left)    left.style.display    = isMobile ? 'none' : 'flex';
      if (right)   right.style.display   = isMobile ? 'none' : 'flex';
      if (wrapper) wrapper.style.display = isMobile ? 'block' : 'flex';
      if (mob)     mob.style.display     = isMobile ? 'block' : 'none';
    }

    applyLayout();
    window.addEventListener('resize', applyLayout);
  });
})();
// ── 갤러리 끝 ────────────────────────────────────────────────
console.log("app.js loaded");

// Supabase 초기화 및 데이터 로드
const supabaseUrl = 'https://tphagookafjldzvxaxui.supabase.co';
const supabaseKey = 'sb_publishable_IqYQq0XqJCz6ZdROfokIMA_GeltPVZq';
if (window.supabase) {
    window.mySupabase = window.supabase.createClient(supabaseUrl, supabaseKey);
}

async function fetchFromSupabase() {
    console.log("DEBUG: fetchFromSupabase (SQL-First 모드, 데이터 로드 안 함)");
    // SQL-First 모드에서는 각 함수들이 직접 Supabase를 조회하므로 여기서는 빈 함수로 유지합니다.
}

function setupRealtimeSubscription() {
    if (!window.mySupabase) return;
    console.log("Realtime subscription setup started");
    // [v37 Cleanup] platform_data 리스너 제거됨
}

console.log("=== v37 파일이 정상 로드되었습니다! ===");
window.initApp = async function() {
    // [Fast-Track] 관리자가 공장 관리에서 클릭하여 들어온 경우만 자동 로그인
    const adminAccessId = localStorage.getItem('adminAccessFactoryId');
    if (adminAccessId) {
        currentFactoryId = adminAccessId;
        const { data: f } = await window.mySupabase.from('factories').select('name').eq('id', currentFactoryId).maybeSingle();
        if (f) {
            localStorage.removeItem('adminAccessFactoryId'); // 1회용 소진
            showView('adminView', f.name + ' - 대표');
            setupRealtimeSubscription(); // [수정] 바로가기 시에도 실시간 구독 연결
            await window.loadAdminDashboard();
            return;
        }
    }

    await fetchFromSupabase();
    console.log("Supabase 데이터 로드 시도 완료");
    setupRealtimeSubscription();
}
window.addEventListener('DOMContentLoaded', window.initApp);

window.logout = function() {
    localStorage.removeItem('currentFactoryId');
    localStorage.removeItem('adminAccessFactoryId');
    location.reload();
};

// platformData 전역 변수 초기화 (더 이상 데이터 저장용으로 쓰지 않음)
let platformData = { factories: {}, pendingFactories: {} };



let currentFactoryId = null, currentHotelId = null, editingHotelId = null, editingFactoryId = null, currentStaffName = null;
let currentPage = 1, currentStaffPage = 1, adminSentPage = 1;
const itemsPerPage = 50;
let revenueTrendChart = null, hotelItemChart = null, hotelTrendChart = null;

window.toggleDropdown = function() {
    console.log("toggleDropdown triggered");
    const menu = document.getElementById('dropdownMenu');
    if (!menu) {
        console.error("dropdownMenu element not found");
        return;
    }
    menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
};

window.getSubscriptionStyles = function(status) {
    const styles = {
        'active': { bg: '#dcfce7', color: '#166534' },
        'trial': { bg: '#e0f2fe', color: '#075985' },
        'expiring': { bg: '#fef3c7', color: '#92400e' },
        'expired': { bg: '#fee2e2', color: '#991b1b' }
    };
    return styles[status] || { bg: '#f1f5f9', color: '#64748b' };
};

window.getSubscriptionStatus = function(factory) {
    const today = new Date();
    
    // 1. 저장된 구독 상태가 있으면 우선 반환 (snake_case DB 필드 우선)
    const subStatusValue = factory.sub_status || factory.subStatus;
    if (subStatusValue) {
        const statusLabels = { 'active': '활성(운영중)', 'operating': '활성(운영중)', 'expiring': '만료 임박', 'expired': '만료됨', 'trial': '무료체험' };
        return { status: subStatusValue, label: statusLabels[subStatusValue] || subStatusValue };
    }

    if (!factory.createdAt) return { status: 'active', label: '사용중' };
    const createdDate = new Date(factory.createdAt);
    const diffDays = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24));

    if (factory.planExpiry) {
        const expiryDate = new Date(factory.planExpiry);
        if (expiryDate < today) return { status: 'expired', label: '요금제 만료됨' };
        if (expiryDate - today < 7 * 24 * 60 * 60 * 1000) return { status: 'expiring', label: '요금제 만료 임박' };
    }

    if (diffDays <= 30 && (!factory.plan || factory.plan === '라이트')) {
        return { status: 'trial', label: `무료 체험 중 (${30 - diffDays}일 남음)` };
    }

    return { status: 'active', label: (factory.plan || '라이트') + ' 요금제 사용 중' };
};

window.selectCustomRole = function(role, text) {
    document.getElementById('loginRole').value = role;
    const roleText = document.getElementById('selectedRoleText');
    roleText.innerText = text;
    roleText.style.color = 'var(--primary)'; // 선택 후 글자색 진하게
    document.getElementById('dropdownMenu').style.display = 'none';

    // Admin인 경우에만 회원가입 버튼 표시
    const registerBtn = document.querySelector('button[onclick="openRegisterModal()"]');
    if(registerBtn) registerBtn.style.display = (role === 'admin') ? 'block' : 'none';
};

// 외부 클릭 시 닫기
window.addEventListener('click', (e) => {
    const dropdown = document.getElementById('customDropdown');
    const menu = document.getElementById('dropdownMenu');
    if (dropdown && menu && !dropdown.contains(e.target)) {
        menu.style.display = 'none';
    }
});

// URL 해시 체크하여 superadmin 옵션 추가
window.addEventListener('DOMContentLoaded', () => {
    if (window.location.hash === '#superadmin') {
        const saOption = document.getElementById('saOption');
        if (saOption) saOption.style.display = 'block';
    }
});

// [SQL-First] 이제 모든 데이터 처리는 직접 DB(Supabase)를 사용하므로 saveData는 사용하지 않습니다.
// 모든 saveData() 호출은 주석 처리 또는 제거되었습니다.
window.saveData = async function() {
    console.log("SQL-First 모드에서는 saveData()를 사용하지 않습니다.");
};
function openModal(id) { 
    const el = document.getElementById(id);
    if (el) {
        el.style.display = 'flex'; 
    } else {
        console.error("DEBUG: Modal element not found for ID:", id);
        alert('모달창을 찾을 수 없습니다.');
    }
}
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// 거래명세서 인쇄 (계좌 정보 삽입 완료 후 인쇄)
window.printInvoiceDetail = async function() {
    // 계좌 정보 삽입 (없을 때만)
    if (!document.getElementById('bankInfoInvoice') && currentFactoryId) {
        try {
            const { data: f } = await window.mySupabase
                .from('factories').select('bank_info').eq('id', currentFactoryId).maybeSingle();
            if (f && f.bank_info) {
                const area = document.getElementById('invoiceDetailArea');
                if (area) {
                    const bankHtml = `<div id="bankInfoInvoice" style="margin-top:16px; padding:14px 18px; background:#f0fdf4; border:1.5px solid #86efac; border-radius:8px; font-size:14px; color:#166534;"><span style="font-weight:700;">💳 입금 계좌 정보: </span><span>${f.bank_info}</span></div>`;
                    area.insertAdjacentHTML('beforeend', bankHtml);
                }
            }
        } catch(e) {}
    }
    // 삽입 완료 후 인쇄 (다음 이벤트 루프로 지연)
    await new Promise(r => setTimeout(r, 100));
    printReport('invoiceDetailArea');
};

// 월정산 팝업 인쇄 (계좌 정보 포함 보장)
window.printSendInvoice = async function() {
    // 계좌 정보가 아직 없으면 먼저 추가
    if (!document.getElementById('bankInfoArea') && currentFactoryId) {
        try {
            const { data: f } = await window.mySupabase
                .from('factories').select('bank_info').eq('id', currentFactoryId).maybeSingle();
            if (f && f.bank_info) {
                const area = document.getElementById('sendInvoiceArea');
                if (area) {
                    const bankHtml = `<div id="bankInfoArea" style="margin-top:16px; padding:14px 18px; background:#f0fdf4; border:1.5px solid #86efac; border-radius:8px; font-size:14px; color:#166534;"><span style="font-weight:700;">💳 입금 계좌 정보: </span><span>${f.bank_info}</span></div>`;
                    area.insertAdjacentHTML('beforeend', bankHtml);
                }
            }
        } catch(e) {}
    }
    printReport('sendInvoiceArea');
};

// 월정산 팝업 열기 - 세탁공장 입금 계좌 정보 하단 자동 추가 (팝업/인쇄 공통)
window.openSendInvoiceModal = async function() {
    openModal('sendInvoiceModal');
    try {
        if (!currentFactoryId) return;
        const { data: f } = await window.mySupabase
            .from('factories')
            .select('bank_info')
            .eq('id', currentFactoryId)
            .maybeSingle();
        if (!f || !f.bank_info) return;

        const bankHtml = `<div id="bankInfoArea" style="margin-top:16px; padding:14px 18px; background:#f0fdf4; border:1.5px solid #86efac; border-radius:8px; font-size:14px; color:#166534;"><span style="font-weight:700;">💳 입금 계좌 정보: </span><span>${f.bank_info}</span></div>`;

        // 1) 인쇄 영역 ID가 있으면 그 안에 추가 (발송내역 팝업)
        const printIds = ['sent-report-to-print', 'send-report-print-area'];
        let inserted = false;
        printIds.forEach(printId => {
            const printEl = document.getElementById(printId);
            if (!printEl) return;
            const ex = printEl.querySelector('#bankInfoArea');
            if (ex) ex.remove();
            printEl.insertAdjacentHTML('beforeend', bankHtml);
            inserted = true;
        });

        // 2) 인쇄 영역 없으면 sendInvoiceArea 맨 끝에 추가 (날짜조회 팝업)
        if (!inserted) {
            const area = document.getElementById('sendInvoiceArea');
            if (area) {
                const ex = area.querySelector('#bankInfoArea');
                if (ex) ex.remove();
                area.insertAdjacentHTML('beforeend', bankHtml);
            }
        }
    } catch(e) { console.warn('[계좌 정보 표시 실패]', e); }
};

window.openManualModal = function() { openModal('manualModal'); }

window.openBackupHelpModal = function() { openModal('backupHelpModal'); }

window.backupFactoryData = async function() {
    if (await window.checkAdminExpired()) return;
    
    // 1. Plan 체크 먼저 수행 (빠르게 팝업 띄우기)
    const { data: planData } = await window.mySupabase.from('factories').select('plan').eq('id', currentFactoryId).single();
    if (!await window.checkAccess('DATA_BACKUP', planData, '데이터 백업은 엔터프라이즈 요금제 전용 기능입니다. \n [요금제 업그레이드] 해주세요')) return;
    
    if (!confirm('현재 데이터를 백업 파일로 저장하시겠습니까?')) return;

    // 2. Plan 통과 시에만 무거운 DB 전체 데이터 가져오기
    const { data: f } = await window.mySupabase.from('factories').select('*, hotels(*), invoices(*), staff(*), factory_default_prices(*)').eq('id', currentFactoryId).single();
    if (!f) { alert('데이터를 불러오는 중 오류가 발생했습니다.'); return; }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(f));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", `backup_${f.name}_${getTodayString()}.json`);
    dl.click();
};

window.openRestoreDialog = async function() {
    if (await window.checkAdminExpired()) return;

    const { data: f } = await window.mySupabase.from('factories').select('plan').eq('id', currentFactoryId).single();
    if (!await window.checkAccess('DATA_BACKUP', f, '데이터 복구는 엔터프라이즈 요금제 전용 기능입니다. \n [요금제 업그레이드] 해주세요')) return;
    
    document.getElementById('restoreFile').click();
};

window.restoreFactoryData = function(input) {
    // 복구 실행 전 최종 확인
    if (!confirm('업로드한 데이터로 시스템을 복구하고 새로고침하시겠습니까?')) {
        input.value = ''; // 초기화
        return;
    }

    const file = input.files[0];
    if (!file) return;
    
    // 복구 시작 알림
    alert('데이터 복구 중입니다. 잠시만 기다려주세요.');

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const restoredData = JSON.parse(e.target.result);
            if (!restoredData.name || !restoredData.adminId) throw new Error("유효하지 않은 데이터 파일입니다.");
            // [v38 SQL-First] 복구 데이터를 Supabase DB에 직접 업데이트
            const updatePayload = {
                name: restoredData.name,
                admin_id: restoredData.adminId,
                admin_pw: restoredData.adminPw || restoredData.admin_pw,
                ceo: restoredData.ceo,
                phone: restoredData.phone,
                address: restoredData.address,
                bank_info: restoredData.bankInfo || restoredData.bank_info,
                plan: restoredData.plan,
                plan_expiry: restoredData.planExpiry || restoredData.plan_expiry,
                status: restoredData.status,
                memo: restoredData.memo
            };
            const { error: restoreErr } = await window.mySupabase.from('factories').update(updatePayload).eq('id', currentFactoryId);
            if (restoreErr) throw new Error('DB 복구 실패: ' + restoreErr.message);
            alert('복구가 완료되었습니다.');
            if (typeof loadAdminDashboard === 'function') loadAdminDashboard();
            if (typeof loadAdminHotelList === 'function') loadAdminHotelList();
            if (typeof loadAdminStaffList === 'function') loadAdminStaffList();
            if (typeof loadAdminSentList === 'function') loadAdminSentList();
        } catch (err) { 
            alert('복구 실패: ' + err.message); 
        }
    };
    reader.readAsText(file);
};
function getTodayString() { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]; }

async function syncToSupabase(data) {
    if (!window.mySupabase) return;
    try {
// [v37 Cleanup] platform_data 저장 함수 제거됨
        console.log("Supabase 동기화 성공");
    } catch (e) {
        console.error("Supabase 동기화 실패:", e);
    }
}

window.openPlanInfoModal = function() {
    openModal('planInfoModal');
};

function showView(id, title) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(id);
  if(el) el.classList.add('active');
  const header = document.getElementById('headerTitle');
  if(header) header.innerText = title;

  const logoutBtn = document.getElementById('logoutBtn');
  const helpBtn = document.getElementById('helpBtn');
  const planInfoBtn = document.getElementById('planInfoBtn');
  if(logoutBtn) logoutBtn.style.display = (id === 'loginView') ? 'none' : 'block';
  if(helpBtn) helpBtn.style.display = (id === 'adminView') ? 'block' : 'none';
  if(planInfoBtn) planInfoBtn.style.display = (id === 'adminView') ? 'block' : 'none';

  if(id === 'superAdminView') loadSuperAdminDashboard();
  if(id === 'adminView') loadAdminDashboard();
  if(id === 'staffView') loadStaffDashboard();
}

window.checkAdminExpired = async function() {
    const { data: f, error } = await window.mySupabase.from('factories').select('*').eq('id', currentFactoryId).maybeSingle();
    if (error || !f) return false;

    // 만료 여부는 요금제(plan)가 아니라, 구독 상태(sub_status)가 expired인지 직접 확인
    const subStatus = window.getSubscriptionStatus(f);
    if (subStatus.status === 'expired' || f.sub_status === 'expired') {
        const paymentMsg = document.getElementById('paymentMsg');
        if (paymentMsg) paymentMsg.innerText = "구독 상태가 만료되었습니다. 결제 후 이용 가능합니다.";
        openModal('paymentModal');
        if (typeof window.loadAdminPayment === 'function') window.loadAdminPayment();
        return true;
    }
    return false;
};

window.switchTab = async function(el, tabId) {
  // 요금제 만료 상태에서 관리자 탭 접근 시 차단 및 결제 유도
  if (['adminStats', 'adminHotel', 'adminStaff', 'adminSent'].includes(tabId)) {
      if (await window.checkAdminExpired()) return;
  }

  // [보완] 관리자 탭 한정으로만 레거시 동기화 실행 (슈퍼어드민은 별도 처리)
  if (['adminStats', 'adminHotel', 'adminStaff', 'adminSent', 'adminPayment'].includes(tabId)) {
      await window.fetchFromSupabase();
  }
  
  // 데이터 동기화 후 다시 렌더링하도록 탭 전환 로직 개선
  const parent = el.closest('.view');
  parent.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
  parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const target = parent.querySelector('#tab_' + tabId);
  if(target) target.classList.add('active');
  
  // 탭 전환 시 데이터 로드 함수 명시적 호출
  if(tabId === 'adminStats') await window.loadAdminDashboard();
  if(tabId === 'adminHotel') window.loadAdminHotelList();
  if(tabId === 'adminStaff') window.loadAdminStaffList();
  if(tabId === 'adminSent') window.loadAdminSentList();
  if(tabId === 'adminPayment') window.loadAdminPayment();
  
  // 총괄 관리자 - 현황 탭 클릭 시 데이터 새로고침
  if (tabId === 'superAdminStats') {
      if (typeof window.loadSuperAdminDashboard === 'function') window.loadSuperAdminDashboard();
  }
};

window.goToPaymentTab = function() {
    closeModal('paymentModal');
    
    // [변경] 결제 폼 모달을 직접 열기
    openModal('paymentDirectModal');
    window.loadAdminPayment();
};

window.loadAdminPayment = function() {
    if(!currentFactoryId) return;
    
    // factory ID를 사용해 최신 데이터 다시 로드
    // Supabase에서 현재 공장 정보 다시 가져오기
    window.mySupabase.from('factories').select('*').eq('id', currentFactoryId).maybeSingle().then(({data}) => {
        if(data) {
            const subStatus = window.getSubscriptionStatus(data);
            const planName = data.plan || '라이트';
            const htmlContent = `
                <div style="font-size: 24px; font-weight: 900; color: var(--primary); margin-bottom: 5px;">${planName} 요금제</div>
                <div style="font-size: 14px; font-weight: 600; color: var(--secondary);">구독상태: ${subStatus.label} | 만료일: ${data.plan_expiry || '제한없음'}</div>
            `;
            
            const subStatusBox = document.getElementById('subStatusBox');
            const modalSubStatusBox = document.getElementById('modalSubStatusBox');
            
            if (subStatusBox) subStatusBox.innerHTML = htmlContent;
            if (modalSubStatusBox) modalSubStatusBox.innerHTML = htmlContent;
        }
    });
};

// [v37 버그픽스] invoices 테이블 조회 시 invoice_items 조인 제거하여 400 에러 해결
window.isAdminInvoicesLoading = false;
window.loadAdminSentList = async function() {
    console.log("DEBUG: loadAdminSentList 시작");
    if (window.isAdminInvoicesLoading) return;
    window.isAdminInvoicesLoading = true;
    
    const tbody = document.getElementById('adminSentList');
    if(!tbody) { console.log("DEBUG: adminSentList 엘리먼트 없음"); window.isAdminInvoicesLoading = false; return; }
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">목록 불러오는 중...</td></tr>';

    console.log("DEBUG: currentFactoryId:", currentFactoryId);
    
    // SQL-First: sent_logs 테이블에서 조회
    const { data: logs, error } = await window.mySupabase
        .from('sent_logs')
        .select('id, period, total_amount, sent_at, hotel_id')
        .eq('factory_id', String(currentFactoryId))
        .order('sent_at', { ascending: false });

    console.log("DEBUG: sent_logs response:", { logs, error });

    if(error) { 
        console.error("DEBUG: AdminSentList Supabase Error:", error);
        tbody.innerHTML = `<tr><td colspan="6" style="color:red;">에러: ${error.message}</td></tr>`; 
        window.isAdminInvoicesLoading = false;
        return; 
    }

    // 호텔 이름 매핑용 조회 (별도 실행)
    const { data: hotels } = await window.mySupabase.from('hotels').select('id, name');
    const hotelMap = {};
    if(hotels) hotels.forEach(h => hotelMap[h.id] = h.name);

    const searchEl = document.getElementById('adminSentSearch');
    const searchTerm = searchEl ? searchEl.value.toLowerCase() : '';

    let newHtml = '';
    const filteredLogs = logs ? logs.filter(log => {
        const hName = (hotelMap[log.hotel_id] || '거래처없음').toLowerCase();
        return hName.includes(searchTerm) || log.period.toLowerCase().includes(searchTerm);
    }) : [];

    if(filteredLogs.length > 0) {
        filteredLogs.forEach(log => {
            const hName = hotelMap[log.hotel_id] || '거래처없음';
            const sentDate = log.sent_at ? log.sent_at.substring(0, 10) : '-';
            // 데이터 검증: total_amount가 없으면 0으로 처리
            const rawAmount = Number(log.total_amount) || 0;
            const totalWithTax = Math.round(rawAmount * 1.1);
            
            newHtml += `<tr>
                <td>${log.period}</td>
                <td>${hName}</td>
                <td>${totalWithTax.toLocaleString()}원</td>
                <td>${sentDate}</td>
                <td>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; background:#16a34a; color:white; border:1px solid #16a34a; border-radius:4px; margin-right:5px; height:auto; display:inline-block;" onclick="downloadSentLogExcel('${log.id}', '${log.period}')">Excel</button>
                    <button class="btn btn-neutral" style="background:var(--primary); color:white; padding:4px 8px; font-size:11px; border:1px solid var(--primary); border-radius:4px; height:auto; display:inline-block;" onclick="viewSentDetail('${hName}', '${log.period}', '${log.id}', false, '${log.hotel_id}')">내역확인</button>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:11px; margin-left:5px; border-radius:4px; height:auto; display:inline-block;" onclick="deleteSentLog('${log.id}')">발송취소</button>
                </td>
            </tr>`;
        });
    } else {
        newHtml = '<tr><td colspan="6" style="text-align:center;">발송 내역이 없습니다.</td></tr>';
    }
    tbody.innerHTML = newHtml;
    window.isAdminInvoicesLoading = false;
};

window.deleteSentLog = async function(logId) {
    if(!confirm('정말 발송 기록을 취소(삭제)하시겠습니까?\n(해당 발송에 포함된 월말 차감 데이터도 함께 삭제됩니다.)')) return;
    
    // 1. 해당 발송 로그와 연결된 '월말 차감' 명세서(invoices) 조회
    const staffNameTag = '관리자(차감)_' + logId;
    const { data: dInvs } = await window.mySupabase.from('invoices').select('id').eq('staff_name', staffNameTag);
    
    if (dInvs && dInvs.length > 0) {
        const invIds = dInvs.map(inv => inv.id);
        // 외래키 cascade 설정이 없어도 에러가 나지 않도록 invoice_items 먼저 삭제
        await window.mySupabase.from('invoice_items').delete().in('invoice_id', invIds);
        // 그 다음 invoices 삭제
        const { error: invErr } = await window.mySupabase.from('invoices').delete().in('id', invIds);
        if(invErr) console.error('차감 명세서 삭제 실패:', invErr);
    }

    // 2. 발송 로그(sent_logs) 삭제
    const { error } = await window.mySupabase.from('sent_logs').delete().eq('id', logId);
    if(error) {
        alert('삭제 실패: ' + error.message);
        return;
    }
    
    alert('발송 기록 및 관련 차감 데이터가 성공적으로 삭제되었습니다.');
    if (typeof window.loadAdminSentList === 'function') window.loadAdminSentList();
};

window.changeAdminSentPage = function(delta) {
    adminSentPage += delta;
    loadAdminSentList();
};


window.deleteSentInvoice = async function(sentAt) {
    // [v38 SQL-First] 레거시 코드 제거됨 - sent_logs 테이블에서 직접 삭제
    if(!confirm('정말 삭제하시겠습니까?')) return;
    const { error } = await window.mySupabase.from('sent_logs').delete().eq('sent_at', sentAt).eq('factory_id', currentFactoryId);
    if(error) { alert('삭제 실패: ' + error.message); return; }
    window.loadAdminSentList();
};

// --- Admin Credentials & Global Notice Logic (SQL-First) ---
window.saveAdminCredentials = async function() {
    const id = document.getElementById('sa_id').value.trim();
    const pw = document.getElementById('sa_pw').value.trim();
    const phoneEl = document.getElementById('sa_phone');
    const phone = phoneEl ? phoneEl.value.trim() : '';

    if(!id || !pw) { alert('ID와 비밀번호를 모두 입력하세요.'); return; }
    
    // 기존 데이터 보존
    const { data: currentSettings } = await window.mySupabase.from('platform_settings').select('*').eq('id', 'master_config').maybeSingle();
    const payload = currentSettings || { id: 'master_config' };
    
    payload.admin_id = id;
    payload.admin_pw = pw;
    payload.admin_phone = phone;

    const { error } = await window.mySupabase.from('platform_settings').upsert(payload);
        
    if (error) { 
        alert('계정 저장 중 오류가 발생했습니다: ' + error.message + '\n(혹시 admin_phone 컬럼이 없다면 Supabase에서 추가해주세요.)'); 
        return; 
    }
    
    alert('플랫폼 총괄 관리자 정보가 데이터베이스에 안전하게 변경/저장되었습니다.\n새로운 계정으로 다시 로그인해 주세요.');
    location.reload();
};

window.saveNotice = async function() {
    const noticeContent = document.getElementById('globalNoticeInput').value.trim();
    
    // 플랫폼 설정 테이블의 기존 데이터를 조회해서 덮어씌움 방지
    const { data: currentSettings } = await window.mySupabase.from('platform_settings').select('*').eq('id', 'master_config').maybeSingle();
    
    const updateData = {
        id: 'master_config',
        global_notice: noticeContent
    };
    
    if (currentSettings) {
        updateData.admin_id = currentSettings.admin_id;
        updateData.admin_pw = currentSettings.admin_pw;
    }
    
    const { error } = await window.mySupabase.from('platform_settings').upsert(updateData);
    
    if (error) { alert('공지사항 저장 중 오류가 발생했습니다: ' + error.message); return; }
    
    alert(noticeContent ? '공지사항이 데이터베이스에 등록/업데이트 되었습니다.' : '공지사항이 삭제되었습니다.');
    window.loadGlobalNotice();
};

window.loadGlobalNotice = async function() {
    const bar = document.getElementById('globalNoticeBar');
    const input = document.getElementById('globalNoticeInput');
    
    const { data: settings } = await window.mySupabase.from('platform_settings').select('global_notice').eq('id', 'master_config').maybeSingle();
    const notice = settings && settings.global_notice ? settings.global_notice : '';
    
    if (input) input.value = notice;
    
    if (bar) {
        if (notice) {
            bar.innerText = notice;
            bar.style.display = 'block';
        } else {
            bar.style.display = 'none';
        }
    }
};

window.login_OLD = function() {
  try {
    const roleEl = document.getElementById('loginRole');
    const idEl = document.getElementById('loginId');
    const pwEl = document.getElementById('loginPw');

    if(!roleEl || !idEl || !pwEl) return;

    const role = roleEl.value;
    const lId = idEl.value.trim();
    const lPw = pwEl.value.trim();

    // 관리자 계정 확인
    const adminAuth = JSON.parse(localStorage.getItem('adminAuth')) || { id: 'admin', pw: '1111' };

    if (role === 'superadmin' && lId === adminAuth.id && lPw === adminAuth.pw) {
        showView('superAdminView', '플랫폼 총괄 관리자');
        return;
    }

    // 플랫폼 데이터가 정상 로드되었는지 확인
    if (!platformData || !platformData.factories) {
        console.error('플랫폼 데이터가 비어있습니다.');
        alert('데이터 로드 오류: 관리자에게 문의하세요.');
        return;
    }

    for (const fId in platformData.factories) {
        const f = platformData.factories[fId];
        if (role === 'admin' && f.adminId === lId && f.adminPw === lPw) {
            if (f.status === 'suspended') {
                alert('세탁공장 상태가 미운영 입니다. 관리자에게 문의하십시요');
                return;
            }
            currentFactoryId = fId;
            localStorage.setItem('currentFactoryId', fId); // [저장] 로그인 상태 유지
            showView('adminView', f.name + ' - 대표');
            return;
        }
        if (role === 'staff' && f.staffAccounts) {
            for (const sId in f.staffAccounts) {
                if (f.staffAccounts[sId].loginId === lId && f.staffAccounts[sId].loginPw === lPw) {
                    currentFactoryId = fId;
                    currentStaffName = f.staffAccounts[sId].name;
                    showView('staffView', f.name + ' - 현장직원');
                    loadStaffDashboard();
                    return;
                }
            }
        }
        if (role === 'hotel' && f.hotels) {
            for (const hId in f.hotels) {
                if (f.hotels[hId].loginId === lId && f.hotels[hId].loginPw === lPw) {
                    currentFactoryId = fId;
                    currentHotelId = hId;
                    console.log('Hotel login success:', f.hotels[hId].name);
                    showView('hotelView', f.hotels[hId].name);
                    loadHotelDashboard();
                    return;
                }
            }
        }
    }
    for (const reqId in platformData.pendingFactories) {
        if (platformData.pendingFactories[reqId].adminId === lId) {
            alert('아직 승인대기중 입니다. 잠시만 기다려주세요');
            return;
        }
    }
    alert('로그인 정보가 올바르지 않습니다.');
  } catch(e) {
    console.error('로그인 중 에러 발생:', e);
    alert('로그인 처리 중 에러가 발생했습니다: ' + e.message);
  }
};

// --- Password Recovery Logic ---
window.openFindPwModal = function() {
    console.log("openFindPwModal clicked!");
    document.getElementById('findPwId').value = '';
    document.getElementById('findPwPhone').value = '';
    openModal('findPwModal');
};

window.findAndResetPassword = async function() {
    const lId = document.getElementById('findPwId').value.trim();
    const phone = document.getElementById('findPwPhone').value.trim();

    if (!lId || !phone) {
        alert('아이디와 휴대폰 번호를 모두 입력해주세요.');
        return;
    }

    // 1. 공장 테이블에서 아이디로 먼저 조회 (전화번호 형식 하이픈 무시를 위함)
    const { data: factory, error } = await window.mySupabase
        .from('factories')
        .select('id, admin_id, phone, name')
        .eq('admin_id', lId)
        .maybeSingle();

    if (error || !factory) {
        alert('입력하신 아이디와 일치하는 계정을 찾을 수 없습니다.');
        return;
    }

    // 휴대폰 번호 하이픈 제거 후 비교
    const dbPhone = (factory.phone || '').replace(/-/g, '').trim();
    const inputPhone = phone.replace(/-/g, '').trim();

    if (dbPhone !== inputPhone) {
        alert('입력하신 아이디와 휴대폰 번호 정보가 일치하지 않습니다.');
        return;
    }

    // 2. 임시 비밀번호 생성 (6자리 숫자)
    const tempPw = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. DB 비밀번호 업데이트
    const { error: updateErr } = await window.mySupabase
        .from('factories')
        .update({ admin_pw: tempPw })
        .eq('id', factory.id);

    if (updateErr) {
        alert('비밀번호 초기화 중 오류가 발생했습니다: ' + updateErr.message);
        return;
    }

    // 4. 알리고 SMS 발송 (Supabase Edge Function 경유)
    try {
        const smsRes = await fetch(
            'https://tphagookafjldzvxaxui.supabase.co/functions/v1/send-sms',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    receiver: inputPhone,
                    message: `[${factory.name || '세탁공장'}] 임시 비밀번호는 [${tempPw}] 입니다. 로그인 후 반드시 변경해주세요.`
                })
            }
        );
        const smsData = await smsRes.json();
        if (smsData.statusCode === '2000') {
            alert('임시 비밀번호가 문자로 발송되었습니다.\n잠시 후 SMS를 확인해주세요.');
        } else {
            console.error('[SMS 발송 오류]', smsData);
            alert(`임시 비밀번호 발급은 완료되었으나 SMS 발송에 실패했습니다.\n(사유: ${smsData.statusMessage || '알 수 없음'})\n\n관리자에게 문의해주세요.`);
        }
    } catch (smsErr) {
        console.error('[SMS 발송 예외]', smsErr);
        alert('임시 비밀번호 발급은 완료되었으나 SMS 발송 중 오류가 발생했습니다.\n관리자에게 문의해주세요.');
    }
    closeModal('findPwModal');
};

// --- Registration Logic ---
window.openRegisterModal = function() {
  ['reg_name', 'reg_bizNo', 'reg_phone', 'reg_address', 'reg_id', 'reg_pw'].forEach(f => {
      const el = document.getElementById(f);
      if(el) { el.value = ''; el.classList.remove('error'); }
      const err = document.getElementById('err_' + f);
      if(err) err.style.display = 'none';
  });
  openModal('registerModal');
};

let _submitLock = false;
window.submitRegistration = async function() {
    // 이중 클릭 방지
    if (_submitLock) return;
    _submitLock = true;
    const btn = document.querySelector('button[onclick="submitRegistration()"]');
    if (btn) { btn.disabled = true; btn.innerText = '처리 중...'; }

    const fields = [
        { id: 'reg_name', err: 'err_reg_name' }, { id: 'reg_bizNo', err: 'err_reg_bizNo' },
        { id: 'reg_phone', err: 'err_reg_phone' }, { id: 'reg_address', err: 'err_reg_address' },
        { id: 'reg_id', err: 'err_reg_id' }, { id: 'reg_pw', err: 'err_reg_pw' }
    ];
    const regex = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/;
    let isValid = true, firstErrorEl = null;
    fields.forEach(f => {
        const el = document.getElementById(f.id);
        const err = document.getElementById(f.err);
        const val = el.value.trim();
        if(!val) {
            el.classList.add('error');
            if(err) { err.innerText = "필수 항목입니다."; err.style.display = 'block'; }
            if(!firstErrorEl) firstErrorEl = el;
            isValid = false;
        } else if((f.id === 'reg_id' || f.id === 'reg_pw') && !regex.test(val)) {
            el.classList.add('error');
            if(err) { err.innerText = "영문, 숫자, 특수문자만 가능합니다."; err.style.display = 'block'; }
            if(!firstErrorEl) firstErrorEl = el;
            isValid = false;
        } else {
            el.classList.remove('error');
            if(err) err.style.display = 'none';
        }
    });
    if(!isValid) { firstErrorEl.focus(); _submitLock = false; if(btn) { btn.disabled = false; btn.innerText = '가입 신청'; } return; }

    const regId = document.getElementById('reg_id').value.trim();
    
    // DB에서 중복 ID 체크
    const { data: existingFactory } = await window.mySupabase.from('factories').select('id').eq('admin_id', regId).maybeSingle();
    if(existingFactory) { alert('이미 사용 중인 ID입니다.'); _submitLock = false; if(btn) { btn.disabled = false; btn.innerText = '가입 신청'; } return; }
    
    const { data: existingPending } = await window.mySupabase.from('pending_factories').select('id').eq('admin_id', regId).maybeSingle();
    if(existingPending) { alert('이미 가입 신청 중인 ID입니다.'); _submitLock = false; if(btn) { btn.disabled = false; btn.innerText = '가입 신청'; } return; }

    const reqId = 'req_' + Date.now();
    const newFactory = {
        id: reqId,
        name: document.getElementById('reg_name').value.trim(),
        biz_no: document.getElementById('reg_bizNo').value.trim(),
        phone: document.getElementById('reg_phone').value.trim(),
        address: document.getElementById('reg_address').value.trim(),
        admin_id: document.getElementById('reg_id').value.trim(),
        admin_pw: document.getElementById('reg_pw').value.trim(),
        status: 'operating',
        sub_status: 'trial',
        plan: '무료요금제',
        plan_expiry: new Date(new Date().setMonth(new Date().getMonth() + 5)).toISOString().split('T')[0],
        date: getTodayString()
    };
    
    const { error } = await window.mySupabase.from('pending_factories').insert([newFactory]);
    if (error) {
        // UNIQUE 제약조건 위반 등 중복 에러 → 사용자 친화적 메시지
        const msg = (error.code === '23505' || error.message?.includes('duplicate'))
            ? '이미 동일한 ID로 가입 신청이 접수되었습니다.' 
            : '가입 신청 실패: ' + error.message;
        alert(msg);
        _submitLock = false; if(btn) { btn.disabled = false; btn.innerText = '가입 신청'; }
        return;
    }

    closeModal('registerModal'); 
    alert('가입 신청이 완료되었습니다! 관리자 승인 후 로그인 가능합니다. 🐾');

    // 관리자에게 가입 신청 SMS 발송
    try {
        const { data: mConfig } = await window.mySupabase
            .from('platform_settings')
            .select('admin_phone')
            .eq('id', 'master_config')
            .maybeSingle();
        if (mConfig && mConfig.admin_phone) {
            await fetch('https://tphagookafjldzvxaxui.supabase.co/functions/v1/send-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    receiver: mConfig.admin_phone.replace(/-/g, ''),
                    message: `[CEgo플랫폼] 가입신청: ${newFactory.name} ${newFactory.phone}`
                })
            });
        }
    } catch(e) { console.warn('[관리자 SMS 발송 실패]', e); }
};

// --- Staff Dashboard ---
// [v38 SQL-First] 레거시 platformData 완전 제거 - DB 쿼리 방식으로 통일
window.loadStaffDashboard = async function() {
    if (typeof window.loadGlobalNotice === 'function') window.loadGlobalNotice();
    const invoiceDateEl = document.getElementById('invoiceDate');
    if (invoiceDateEl) invoiceDateEl.value = getTodayString();
    // [v38 수정] searchDate 초기값 비움 → 최근 50건 전체 표시 (날짜 입력 시 필터링)
    const searchDateEl = document.getElementById('staffSearchDate');
    if (searchDateEl) searchDateEl.value = '';
    if (typeof window.loadStaffHotelSelect === 'function') await window.loadStaffHotelSelect();
    if (typeof window.loadStaffInvoiceList === 'function') window.loadStaffInvoiceList();
};

window.saveAndPrintInvoice = async function() {
    // [중복 저장 방지] 버튼 즉시 비활성화
    const saveBtn = document.getElementById('btnSaveInvoice');
    if (saveBtn) {
        if (saveBtn.dataset.saving === 'true') return; // 이미 저장 중이면 무시
        saveBtn.dataset.saving = 'true';
        saveBtn.disabled = true;
        saveBtn.innerText = '저장 중...';
    }
    try {
    const hId = document.getElementById('staffHotelSelect').value;
    const date = document.getElementById('invoiceDate').value;
    if (!hId || !date) { if(saveBtn) { saveBtn.dataset.saving=''; saveBtn.disabled=false; saveBtn.innerText='💾 저장하기'; } return; }

    // 품목 수집 (item-price 셀에서 가격 읽기)
    const items = [];
    document.querySelectorAll('#staffInvoiceBody tr').forEach(tr => {
        const qtyInput = tr.querySelector('.inv-qty');
        if (!qtyInput) return;
        const q = Number(qtyInput.value);
        if (q === 0) return; // 0만 무시하고 마이너스(-) 허용
        const name = tr.cells[0]?.innerText?.trim();
        const priceCell = tr.querySelector('.item-price');
        const price = priceCell ? Number(priceCell.innerText.replace(/[^0-9-]/g, '')) : 0;
        if (name) items.push({ name, price, qty: q });
    });

    if (items.length === 0) { alert('수량을 입력해주세요.'); return; }

    const totalAmount = items.reduce((s, i) => s + (i.price * i.qty), 0);

    // 같은 날짜+거래처 명세서가 이미 있으면 업데이트, 없으면 insert
    const { data: existing } = await window.mySupabase
        .from('invoices').select('id')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hId)
        .eq('date', date)
        .maybeSingle();

    let invoiceId;
    if (existing) {
        invoiceId = existing.id;
        await window.mySupabase.from('invoices').update({
            total_amount: totalAmount,
            staff_name: currentStaffName || '현장직원'
        }).eq('id', invoiceId);
        await window.mySupabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
    } else {
        // [추가] 신규 발행일 경우 요금제별 건수 제한 확인
        if (!await window.checkIssuanceLimit()) return;

        const { data: newInv, error: invErr } = await window.mySupabase.from('invoices').insert([{
            id: 'inv_' + Date.now(),
            factory_id: currentFactoryId,
            hotel_id: hId,
            date: date,
            total_amount: totalAmount,
            staff_name: currentStaffName || '현장직원',
            is_sent: false
        }]).select('id').single();
        if (invErr) { alert('저장 실패: ' + invErr.message); return; }
        invoiceId = newInv.id;
    }

    // invoice_items insert
    const itemRows = items.map(it => ({
        id: crypto.randomUUID(),
        invoice_id: invoiceId,
        name: it.name,
        price: it.price,
        qty: it.qty,
        unit: '개'
    }));
    const { error: itemErr } = await window.mySupabase.from('invoice_items').insert(itemRows);
    if (itemErr) { alert('품목 저장 실패: ' + itemErr.message); return; }

    const isEdit = !!existing;
    alert(isEdit ? '✏️ 수정 완료!' : '✅ 저장 완료!');

    // 폼 초기화
    document.getElementById('invoiceFormArea').style.display = 'none';
    document.getElementById('staffHotelSelect').value = '';
    const badge = document.getElementById('editModeBadge');
    if (badge) badge.style.display = 'none';

    if (typeof window.loadStaffInvoiceList === 'function') window.loadStaffInvoiceList();

    } catch(e) {
        console.error('[saveAndPrintInvoice 오류]', e);
        alert('저장 중 오류가 발생했습니다: ' + e.message);
    } finally {
        // 저장 완료 또는 오류 시 버튼 복원
        if (saveBtn) {
            saveBtn.dataset.saving = '';
            saveBtn.disabled = false;
            saveBtn.innerText = '💾 저장하기';
        }
    }
};

window.printReport = function(elementId) {
    const el = document.getElementById(elementId);
    if (!el) { alert('인쇄할 내용을 찾을 수 없습니다.'); return; }

    const printContent = el.innerHTML;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) { alert('팝업 차단을 해제해주세요.'); return; }

    printWindow.document.write(`
    <html>
    <head>
        <title>인쇄</title>
        <style>
            body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { border: 1px solid #ccc; padding: 8px; text-align: center; background: #eee; }
            td { border: 1px solid #ccc; padding: 8px; text-align: center; }
        </style>
    </head>
    <body onload="window.print(); window.close();">
        ${printContent}
    </body>
    </html>`);
    printWindow.document.close();
};



window.handleQtyKeydown = function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const allInputs = Array.from(document.querySelectorAll('.inv-qty'));
        const currentIndex = allInputs.indexOf(e.target);
        if (allInputs[currentIndex + 1]) {
            allInputs[currentIndex + 1].focus();
            // 모바일에서 select()가 씹히는 현상 방지를 위해 setTimeout 사용
            setTimeout(() => allInputs[currentIndex + 1].select(), 10);
        } else {
            document.getElementById('btnSaveInvoice').focus();
        }
    }
};

window.updateTrendChartOnly = async function() {

  // 6개월 추이 데이터 준비
  const base = new Date(curMonth + "-01");
  for(let i=5; i>=0; i--) {
      const d = new Date(base); d.setMonth(d.getMonth() - i);
      monthlyTrend[d.toISOString().substring(0, 7)] = 0;
  }

  (f.history || []).forEach(inv => {
      const isFiltered = (filterId === 'all' || inv.hotelId === filterId);
      const hotelInfo = f.hotels[inv.hotelId];
      // If hotelInfo is missing, we assume it's not fixed-rate, but for revenue reporting, it should probably be excluded?
      // Actually, if hotelInfo is missing, the invoice data might be stale. Let's just skip it if hotelInfo is null.
      if (!hotelInfo) return;

      const isFixed = (hotelInfo.contractType && hotelInfo.contractType.trim() === 'fixed');
      if (inv.hotelName.includes('준모텔')) console.log('DEBUG 준모텔:', inv.hotelName, 'isFixed=', isFixed, 'contractType=', hotelInfo.contractType);

      // 정액제 거래처인 경우, 발생한 명세서 합계는 매출 통계에서 제외 (기록만 남김)
      if (isFixed) return;

      // Today's Revenue (Contextual)
      if(inv.date === today && isFiltered) todayRevFiltered += inv.total;

      // Overall Monthly Sales (For Ranking & Cards) - Only sum if NOT fixed-rate
      if(inv.date.startsWith(curMonth) && !isFixed) {
          const key = hotelInfo.name;
          allSalesForRanking[key] = (allSalesForRanking[key] || 0) + inv.total;
          monthlyRevTotal += inv.total;
      }

      // Filtered Monthly Sales & Trend (For Chart)
      if(inv.date.startsWith(curMonth) && isFiltered) {
          monthlyRevFiltered += inv.total;
          hotelSalesFiltered[inv.hotelName] = (hotelSalesFiltered[inv.hotelName] || 0) + inv.total;
      }

      // Monthly Trend aggregation
      const m = inv.date.substring(0, 7);
      if(monthlyTrend[m] !== undefined) monthlyTrend[m] += isFiltered ? inv.total : 0;
  });

  // [정액제 매출 반영 로직] - 모든 정액제 거래처의 계약 금액을 무조건 매출에 포함
  for (const hId in (f.hotels || {})) {
      const h = f.hotels[hId];
      if (h.contractType === 'fixed') {
          const fixedAmt = Number(h.fixedAmount || 0);
          
          // Use createdAt to determine when this hotel started
          const createdMonth = h.createdAt ? h.createdAt.substring(0, 7) : '2000-01';
          
          if (curMonth >= createdMonth) {
              monthlyRevTotal += fixedAmt;
              allSalesForRanking[h.name] = fixedAmt;
          }

          // 월별 매출 추이에도 반영
          const isFiltered = (filterId === 'all' || filterId === hId);
          if (isFiltered) {
              for (const m in monthlyTrend) {
                  if (m >= createdMonth) {
                      monthlyTrend[m] += fixedAmt;
                  }
              }
          }
      }
      
      // 특정 거래처 필터링 시 과거 데이터 지우기 (단가/정액 모두 적용)
      if (filterId !== 'all' && filterId === hId) {
          const createdMonth = h.createdAt ? h.createdAt.substring(0, 7) : '2000-01';
          for (const m in monthlyTrend) {
              if (m < createdMonth) {
                  monthlyTrend[m] = null;
              }
          }
      }
  }

  if(document.getElementById('adminTodayRevenue')) document.getElementById('adminTodayRevenue').innerText = todayRevFiltered.toLocaleString() + '원';
  if(document.getElementById('adminMonthlyRevenue')) document.getElementById('adminMonthlyRevenue').innerText = monthlyRevTotal.toLocaleString() + '원'; // Use Total
  if(document.getElementById('adminSummaryCount')) document.getElementById('adminSummaryCount').innerText = `${Object.keys(f.hotels || {}).length} / ${Object.keys(f.staffAccounts || {}).length}`;

  // --- 성장률 계산 (전월 대비) ---
  const prevMonth = new Date(base.getFullYear(), base.getMonth() - 1, 1).toISOString().substring(0, 7);
  let prevMonthRev = 0;

  // 전월 매출은 필터와 관계없이 전체 합계로 계산해야 함
  (f.history || []).filter(inv => inv.date.startsWith(prevMonth)).forEach(inv => {
      prevMonthRev += inv.total;
  });

  let growthRate = 0;
  if (prevMonthRev > 0) {
      growthRate = ((monthlyRevTotal - prevMonthRev) / prevMonthRev) * 100; // Use Total
  } else if (monthlyRevTotal > 0 && prevMonthRev === 0) {
      growthRate = 100;
  }

  if(document.getElementById('adminGrowthRate')) {
      let displayRate = growthRate.toFixed(1) + '%';
      if (growthRate >= 0) {
          document.getElementById('adminGrowthRate').innerHTML = `<span style="color:var(--success);">&#9650; ${displayRate}</span>`; // Upward triangle (Green/Primary)
      } else {
          document.getElementById('adminGrowthRate').innerHTML = `<span style="color:var(--danger);">&#9660; ${Math.abs(growthRate).toFixed(1)}%</span>`; // Downward triangle (Red)
      }
  }
  // -----------------------------

  // Populate dropdowns
  ['adminStatsHotelFilter', 'adminTrendHotelFilter'].forEach(id => {
      const select = document.getElementById(id);
      if(select) {
          const currentVal = select.value;
          select.innerHTML = '<option value="all">전체 거래처</option>';
          for(const hId in f.hotels) select.innerHTML += `<option value="${hId}">${f.hotels[hId].name}</option>`;
          select.value = currentVal || 'all';
      }
  });

  // [복구] 만료 15일 전 경고 모달 로직
  console.log("DEBUG: Checking payment modal. f.planExpiry =", f.planExpiry);
  if (f.planExpiry) {
      const expiryDate = new Date(f.planExpiry);
      const today = new Date();
      const diffTime = expiryDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      console.log("DEBUG: diffDays =", diffDays);
      
      // [v38 SQL-First] pending_payments 테이블에서 직접 확인
      const { data: pendingPayData } = await window.mySupabase.from('pending_payments').select('id').eq('factory_id', currentFactoryId).maybeSingle();
      const isPending = !!pendingPayData;
      console.log("DEBUG: isPending =", isPending);
      
      if (isPending) {
          if (!sessionStorage.getItem('paymentChecked')) {
              alert('입금 내역을 관리자가 확인중입니다.');
              sessionStorage.setItem('paymentChecked', 'true');
              showView('adminView', f.name + ' - 대표');
          }
      } else if (diffDays <= 15) {
          const msg = diffDays < 0 ? `이용 기간이 만료되었습니다. 결제를 진행해주세요.` : `이용 기간이 ${diffDays}일 남았습니다. 결제를 진행해주세요.`;
          const paymentMsgEl = document.getElementById('paymentMsg');
          if(paymentMsgEl) {
              paymentMsgEl.innerText = msg;
              console.log("DEBUG: Showing paymentModal with msg:", msg);
              openModal('paymentModal');
          } else {
              console.error("DEBUG: paymentMsg element not found!");
          }
      }
  } else {
      console.log("DEBUG: f.planExpiry is missing");
  }

  // Update Ranking Title dynamically
  const rankingTitle = document.getElementById('rankingTitle');
  if(rankingTitle) rankingTitle.innerText = `${curMonth.replace('-', '-')} 거래처 매출 TOP`;

  // **FIX APPLIED HERE: Ranking uses allSalesForRanking, independent of filterId**
  const rankingArea = document.getElementById('adminTopRankingArea');
  if(rankingArea) {
      rankingArea.innerHTML = '';
      const rankingSorted = Object.entries(allSalesForRanking).sort((a,b) => b[1]-a[1]);
      rankingArea.innerHTML = '<table class="admin-table"><thead><tr><th>순위</th><th>공장명</th><th>이번 달 매출</th></tr></thead><tbody>' +
      rankingSorted.map((f, i) => `
          <tr><td>${i+1}위</td><td>${f[0]}</td><td style="text-align:right; font-weight:700; color:var(--primary);">${f[1].toLocaleString()}원</td></tr>
      `).join('') + '</tbody></table>';
      // 스크롤은 HTML에서 고정 처리 (max-height:320px, overflow-y:auto)
  }

  window.updateRevenueTrendChart(monthlyTrend, filterId === 'all' ? '전체' : (f.hotels[filterId] ? f.hotels[filterId].name : '선택 거래처'));
  window.loadAdminRecentInvoices();
};

window.updateRevenueTrendChart = function(data, lab) {
  const canvas = document.getElementById('revenueTrendChart');
  if(!canvas) return;
  if(revenueTrendChart) revenueTrendChart.destroy();
  revenueTrendChart = new Chart(canvas, {
      type: 'line',
      data: {
          labels: Object.keys(data).map(m => m.substring(5) + '월'),
          datasets: [{ label: lab + ' 매출', data: Object.values(data), borderColor: '#005b9f', backgroundColor: 'rgba(0, 91, 159, 0.1)', fill: true, tension: 0.3 }]
      },
      options: { responsive: true, plugins: { legend: { display: true } } }
  });
};


window.changePage = function(delta) {
    currentPage += delta;
    window.loadAdminRecentInvoices();
};

window.deleteInvoice = async function(invId) {
    if(!confirm('정말 이 명세서를 삭제하시겠습니까?')) return;
    // [v38 SQL-First] DB에서 직접 삭제
    const { error: itemErr } = await window.mySupabase.from('invoice_items').delete().eq('invoice_id', invId);
    if(itemErr) { alert('명세서 항목 삭제 실패: ' + itemErr.message); return; }
    const { error: invErr } = await window.mySupabase.from('invoices').delete().eq('id', invId);
    if(invErr) { alert('명세서 삭제 실패: ' + invErr.message); return; }
    alert('삭제되었습니다.');
    if(typeof loadAdminRecentInvoices === 'function') loadAdminRecentInvoices();
    if(typeof loadAdminDashboard === 'function') loadAdminDashboard();
};

window.checkInvoiceFilters = function() {
    const hotelFilter = document.getElementById('adminStatsHotelFilter');
    const sDate = document.getElementById('adminStatsStartDate');
    const eDate = document.getElementById('adminStatsEndDate');
    let isValid = true;
    [hotelFilter, sDate, eDate].forEach(el => {
        if(!el.value || el.value === 'all') { el.style.borderColor = 'red'; isValid = false; }
        else { el.style.borderColor = 'var(--border)'; }
    });
    return isValid;
};
window.exportInvoicesToPDF = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    // [v38 SQL-First] 거래처 정보를 DB에서 직접 조회
    const { data: hotelData } = await window.mySupabase.from('hotels').select('hotel_type').eq('id', hotelFilter).maybeSingle();
    const isSpecial = hotelData && hotelData.hotel_type === 'special';

    const list = window.loadAdminRecentInvoices(true).filter(inv => inv.date >= sDate && inv.date <= eDate);
    if(list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    // 일자별/품목별 데이터 집계
    const dailyData = {};
    const itemInfoMap = {}; // {name: {price, unit, category}}

    list.forEach(inv => {
        if (!inv.items) return; // defensive
        inv.items.forEach(it => {
            if (!it || !it.name) return; // defensive
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + it.qty;
            itemInfoMap[it.name] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    let reportHtml = '';

    if (isSpecial) {
        // [특수거래처] 카테고리별 2단 구성
        const grouped = {};
        Object.keys(itemInfoMap).forEach(name => {
            const cat = itemInfoMap[name].category;
            if(!grouped[cat]) grouped[cat] = [];

            // 일자별 수량 합계 계산
            let totalQty = 0;
            dateSequence.forEach(d => {
                if (dailyData[d] && dailyData[d][name]) totalQty += dailyData[d][name];
            });

            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:3px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:10px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.price.toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
        <html><head><style>@page { size: A4; margin: 15mm; } body { font-family: 'Malgun Gothic', sans-serif; }</style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${totalAmount.toLocaleString()}
            </div>
        </body></html>`;

    } else {
        // [일반거래처] 매트릭스 방식 디자인
        reportHtml = `
        <html><head><style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Malgun Gothic', sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; }
            th { background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; font-weight: 700; }
            td { padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; }
            .total-qty { background: #e2e8f0; font-weight: 700; }
            .total-amount { background: #fef3c7; font-weight: 700; }
        </style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <table>
                <thead>
                    <tr>
                        <th>일자</th>
                        ${Object.keys(itemInfoMap).map(name => `<th>${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => `
                        <tr>
                            <td style="background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${Object.keys(itemInfoMap).map(name => `<td>${(dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0'}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-qty">
                        <td>수량 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr class="total-unit">
                        <td>단가</td>
                        ${Object.keys(itemInfoMap).map(name => `<td>${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr class="total-amount">
                        <td>항목 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
        </body></html>`;
    }

    const win = window.open('', '_blank');
    if (win) {
        win.document.write(reportHtml);
        win.document.close();
        setTimeout(() => win.print(), 500);
    }
};


window.checkSpecialHotelAccess = async function(value) {
    if (value === 'special') {
        const { data: f } = await window.mySupabase.from('factories').select('*').eq('id', currentFactoryId).maybeSingle();
        if (!await window.checkAccess('SPECIAL_HOTEL', f, '특수거래처는 엔터프라이즈 요금제 전용 기능입니다. [요금제 업그레이드] 해주세요')) {
            // 제한에 걸렸으므로 다시 일반으로 돌려놓는다
            document.querySelector('input[name="h_type"][value="general"]').checked = true;
        }
    }
};

let _hotelSubmitLock = false;
function _unlockHotelSubmit() {
    _hotelSubmitLock = false;
    const btn = document.querySelector('button[onclick="saveNewHotel()"]');
    if (btn) { btn.disabled = false; btn.innerText = editingHotelIdForInfo ? '거래처 수정' : '거래처 등록'; }
}
window.saveNewHotel = async function() {
    // 이중 클릭 방지
    if (_hotelSubmitLock) return;
    _hotelSubmitLock = true;
    const btn = document.querySelector('button[onclick="saveNewHotel()"]');
    if (btn) { btn.disabled = true; btn.innerText = '처리 중...'; }

    // [v38 SQL-First] platformData/saveData 제거 - DB 직접 CRUD
    const hName = document.getElementById('h_name').value.trim(),
          lId = document.getElementById('h_loginId').value.trim(),
          lPw = document.getElementById('h_loginPw').value.trim();

    // [추가] 라이트 요금제(레벨 1)일 경우 거래처 등록 제한
    const { data: factoryInfo } = await window.mySupabase.from('factories').select('*').eq('id', currentFactoryId).maybeSingle();
    if (!factoryInfo) { alert('공장 정보를 불러올 수 없습니다.'); _unlockHotelSubmit(); return; }
    if (getFactoryPlanLevel(factoryInfo) === 1 && !editingHotelIdForInfo) {
        if (!await window.checkHotelLimit(factoryInfo)) { _unlockHotelSubmit(); return; }
    }

    let isValid = true;
    const requiredFields = ['h_name', 'h_address', 'h_loginId', 'h_loginPw'];

    requiredFields.forEach(id => {
        const el = document.getElementById(id);
        const err = document.getElementById('err_' + id);
        if (!el.value.trim()) {
            el.style.borderColor = 'red'; // Apply red border immediately
            if(err) { err.innerText = "필수 항목입니다."; err.style.display = 'block'; }
            isValid = false;
        } else {
            el.style.borderColor = 'var(--border)'; // Reset border color
            if(err) err.style.display = 'none';
        }
    });

    if (document.getElementById('h_contractType').value === 'fixed' && !document.getElementById('h_fixedAmount').value.trim()) {
        document.getElementById('err_h_fixedAmount').style.display = 'block';
        document.getElementById('h_fixedAmount').style.borderColor = 'red';
        isValid = false;
    } else {
        document.getElementById('err_h_fixedAmount').style.display = 'none';
        document.getElementById('h_fixedAmount').style.borderColor = 'var(--border)';
    }

    if (!isValid) { _unlockHotelSubmit(); return; }

    // 중복 거래처명 체크 (같은 공장 내)
    const nameDupQuery = window.mySupabase.from('hotels').select('id').eq('factory_id', currentFactoryId).eq('name', hName);
    if (editingHotelIdForInfo) nameDupQuery.neq('id', editingHotelIdForInfo);
    const { data: dupName } = await nameDupQuery.maybeSingle();
    if (dupName) { alert('같은 이름의 거래처가 이미 존재합니다.'); _unlockHotelSubmit(); return; }

    // [v38 SQL-First] ID 중복 체크 - DB에서 직접 조회
    const { data: dupFactory } = await window.mySupabase.from('factories').select('id').eq('admin_id', lId).maybeSingle();
    if (dupFactory) { alert('중복 ID!'); _unlockHotelSubmit(); return; }
    const dupHotelQuery = window.mySupabase.from('hotels').select('id').eq('login_id', lId);
    if (editingHotelIdForInfo) dupHotelQuery.neq('id', editingHotelIdForInfo);
    const { data: dupHotel } = await dupHotelQuery.maybeSingle();
    if (dupHotel) { alert('중복 호텔 ID!'); _unlockHotelSubmit(); return; }

    // [추가] 라디오 버튼 값
    const selectedType = document.querySelector('input[name="h_type"]:checked').value;

    // [추가] 특수거래처 제한 (엔터프라이즈 전용)
    if (selectedType === 'special') {
        if (!await window.checkAccess('SPECIAL_HOTEL', factoryInfo, '특수거래처는 엔터프라이즈 요금제 전용 기능입니다. [요금제 업그레이드] 해주세요')) { _unlockHotelSubmit(); return; }
    }

    if (editingHotelIdForInfo) {
        // 수정 - DB 업데이트
        const updateData = {
            name: hName,
            ceo: document.getElementById('h_ceo').value.trim(),
            phone: document.getElementById('h_phone').value.trim(),
            biz_no: document.getElementById('h_bizNo').value.trim(),
            address: document.getElementById('h_address').value.trim(),
            contract_type: document.getElementById('h_contractType').value,
            fixed_amount: document.getElementById('h_fixedAmount').value,
            login_id: lId,
            login_pw: lPw,
            hotel_type: selectedType
        };
        const { error: updateErr } = await window.mySupabase.from('hotels').update(updateData).eq('id', editingHotelIdForInfo);
        if (updateErr) { alert('수정 실패: ' + updateErr.message); _unlockHotelSubmit(); return; }
    } else {
        // 신규 등록 - DB 삽입
        const hId = 'h_' + Date.now();
        const insertData = {
            id: hId,
            factory_id: currentFactoryId,
            name: hName,
            ceo: document.getElementById('h_ceo').value.trim(),
            phone: document.getElementById('h_phone').value.trim(),
            biz_no: document.getElementById('h_bizNo').value.trim(),
            address: document.getElementById('h_address').value.trim(),
            contract_type: document.getElementById('h_contractType').value,
            fixed_amount: document.getElementById('h_fixedAmount').value,
            login_id: lId,
            login_pw: lPw,
            hotel_type: selectedType
        };
        const { error: insertErr } = await window.mySupabase.from('hotels').insert([insertData]);
        if (insertErr) {
            const msg = (insertErr.code === '23505' || insertErr.message?.includes('duplicate'))
                ? '이미 동일한 정보로 등록된 거래처가 있습니다.'
                : '등록 실패: ' + insertErr.message;
            alert(msg);
            _unlockHotelSubmit(); return;
        }
    }
    closeModal('hotelModal');
    loadAdminDashboard();
    loadAdminHotelList();
    editingHotelIdForInfo = null;
    alert('저장 완료!');
    _unlockHotelSubmit();
};

// 기존 함수 삭제 (아래의 async 버전으로 통합)

/*
window.loadHotelCategoryList = function() {
    // ...
};
*/

window.addHotelCategory = async function() {
    // [v38 SQL-First] hotel_categories 테이블에 직접 저장
    const input = document.getElementById('new_h_cat_name');
    const cat = input.value.trim();
    if (!cat) return;

    // 중복 체크
    const { data: existing } = await window.mySupabase.from('hotel_categories').select('id').eq('hotel_id', editingHotelId).eq('name', cat).maybeSingle();
    if (existing) { alert('이미 존재하는 카테고리입니다.'); return; }

    const { error } = await window.mySupabase.from('hotel_categories').insert([{ hotel_id: editingHotelId, name: cat }]);
    if (error) { alert('카테고리 추가 실패: ' + error.message); return; }

    input.value = '';
    loadHotelCategoryList();
};

window.deleteHotelCategory = async function(cat) {
    if (!confirm('삭제하시겠습니까? 이 카테고리의 품목이 초기화될 수 있습니다.')) return;
    // [v38 SQL-First] hotel_categories 테이블에서 직접 삭제
    const { error } = await window.mySupabase.from('hotel_categories').delete().eq('hotel_id', editingHotelId).eq('name', cat);
    if (error) { alert('카테고리 삭제 실패: ' + error.message); return; }
    loadHotelCategoryList();
    loadHotelPriceList();
};

// [Removed legacy addHotelCustomItem]

// 기존 함수들 삭제 (아래에 최신 async 버전이 존재함)

window.deleteSimpleItem = async function(name) {
    // [v38 SQL-First] hotel_item_prices 테이블에서 직접 삭제
    const { error } = await window.mySupabase.from('hotel_item_prices').delete().eq('hotel_id', editingHotelId).eq('name', name);
    if (error) { alert('품목 삭제 실패: ' + error.message); return; }
    loadSimplePriceList();
};

// 기존 함수 삭제 (아래에 최신 async 버전이 존재함)

/*
window.loadHotelPriceList = function() {
    // ... (기존 레거시 코드)
};
*/

window.updateHotelItemPrice = async function(id, newPrice) {
    console.log("DEBUG: Updating hotel item price, ID:", id, "Price:", newPrice);
    
    // [Task 3] 정액제 거래처 확인
    const { data: item, error: itemErr } = await window.mySupabase.from('hotel_item_prices').select('hotel_id').eq('id', id).single();
    if (!itemErr && item) {
        const { data: hotel } = await window.mySupabase.from('hotels').select('contract_type').eq('id', item.hotel_id).single();
        if (hotel && hotel.contract_type === 'fixed') {
            if (!confirm('정액제 거래처입니다. 정말 단가를 수정하시겠습니까?')) {
                // 수정 취소 시 UI를 원래대로 되돌리는 처리가 필요할 수 있음
                window.loadHotelPriceList(); // 목록 새로고침
                return;
            }
        }
    }

    const { error } = await window.mySupabase.from('hotel_item_prices')
        .update({ price: Number(newPrice) || 0 })
        .eq('id', id);
        
    if (error) {
        alert('단가 수정 실패: ' + error.message);
        return;
    }
    
    console.log("DEBUG: Price updated successfully");
};

window.deleteHotelPrice = async function(itemName) {
    // [v38 SQL-First] hotel_item_prices 테이블에서 직접 삭제
    if(!confirm('정말 삭제하시겠습니까?')) return;
    const { error } = await window.mySupabase.from('hotel_item_prices').delete().eq('hotel_id', editingHotelId).eq('name', itemName);
    if (error) { alert('단가 삭제 실패: ' + error.message); return; }
    loadHotelPriceList();
};
window.loadAdminHotelList = async function() {
  // [v38 SQL-First] DB에서 직접 조회
  const tbody = document.getElementById('adminHotelList');
  if(!tbody || !currentFactoryId) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">거래처 목록 불러오는 중...</td></tr>';

  const { data: hotels, error } = await window.mySupabase
      .from('hotels')
      .select('id, name, ceo, phone, login_id, contract_type, status')
      .eq('factory_id', currentFactoryId)
      .order('name');

  if (error) { tbody.innerHTML = `<tr><td colspan="5" style="color:red;">에러: ${error.message}</td></tr>`; return; }
  if (!hotels || hotels.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">등록된 거래처가 없습니다.</td></tr>'; return; }

  tbody.innerHTML = '';
  // 상단 안내 문구
  tbody.innerHTML += `<tr><td colspan="5" style="padding:6px 10px; background:#fff5f5; color:#dc2626; font-size:12px; border-bottom:1px solid #fecaca;">
      💡 거래처명 옆 <strong style="color:#16a34a;">[운영중]</strong> 클릭 시 <strong style="color:#dc2626;">[거래종료]</strong>로, <strong style="color:#dc2626;">[거래종료]</strong> 클릭 시 <strong style="color:#16a34a;">[운영중]</strong>으로 변경됩니다. 거래종료된 거래처는 명세서 작성 화면에 표시되지 않습니다.
  </td></tr>`;
  hotels.forEach(h => {
      const badgeClass = h.contract_type === 'fixed' ? 'badge-fixed' : 'badge-unit';
      const badgeText = h.contract_type === 'fixed' ? '정액제' : '단가제';
      const isActive = (h.status || 'active') === 'active';
      const statusBadge = isActive
          ? `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#dcfce7;color:#16a34a;cursor:pointer;" onclick="toggleHotelStatus('${h.id}','inactive')">운영중</span>`
          : `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:#fee2e2;color:#dc2626;cursor:pointer;" onclick="toggleHotelStatus('${h.id}','active')">거래종료</span>`;
      tbody.innerHTML += `<tr style="${isActive ? '' : 'opacity:0.5;'}">
          <td><strong>${h.name}</strong> ${statusBadge}</td>
          <td style="font-size:13px; color:var(--secondary);">${h.ceo || '-'}<br>${h.phone || '-'}</td>
          <td style="font-size:13px; color:var(--secondary);">${h.login_id}<br>****</td>
          <td><span class="badge ${badgeClass}">${badgeText}</span></td>
          <td>
              <button class="btn-mng btn-info" onclick="openHotelModal('${h.id}')">정보수정</button>
              <button class="btn-mng btn-price" onclick="openPriceSetting('${h.id}')">단가수정</button>
              <button class="btn-mng btn-del" onclick="deleteHotel('${h.id}')">삭제</button>
          </td>
      </tr>`;
  });
};

window.toggleHotelStatus = async function(hId, newStatus) {
    const label = newStatus === 'inactive' ? '거래종료' : '운영중';
    if (!confirm(`이 거래처를 "${label}" 상태로 변경하시겠습니까?`)) return;
    const { error } = await window.mySupabase.from('hotels').update({ status: newStatus }).eq('id', hId);
    if (error) { alert('상태 변경 실패: ' + error.message); return; }
    if (typeof window.loadAdminHotelList === 'function') window.loadAdminHotelList();
};
window.deleteHotel = async function(hId) {
    if(!confirm('삭제?')) return;
    // [v38 SQL-First] DB에서 직접 삭제
    const { error } = await window.mySupabase.from('hotels').delete().eq('id', hId);
    if(error) { alert('거래처 삭제 실패: ' + error.message); return; }
    if(typeof window.loadAdminHotelList === 'function') window.loadAdminHotelList();
};
window.loadAdminStaffList = async function() {
    const tbody = document.getElementById('adminStaffList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">직원 목록을 불러오는 중...</td></tr>';

    const { data: staffList, error: sErr } = await window.mySupabase.from('staff').select('*').eq('factory_id', currentFactoryId).order('created_at', { ascending: false });

    if(sErr) { tbody.innerHTML = `<tr><td colspan="3" style="color:red;">에러: ${sErr.message}</td></tr>`; }
    else if(!staffList || staffList.length === 0) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">등록된 직원이 없습니다.</td></tr>'; }
    else {
        tbody.innerHTML = '';
        staffList.forEach(s => {
            tbody.innerHTML += `<tr>
                <td><strong>${s.name}</strong></td>
                <td style="font-size:13px;">${s.login_id}<br><small style="color:var(--secondary)">PW: ${s.login_pw}</small></td>
                <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteStaff('${s.id}')">삭제</button></td>
            </tr>`;
        });
    }

    // Load recent invoices (직원/발행 화면 하단 발행 현황 목록)
    const activityBody = document.getElementById('adminStaffActivityList');
    if(!activityBody) return;

    const STAFF_ACTIVITY_PAGE_SIZE = 50;
    window.currentStaffPage = 1; // 매번 첫 페이지부터

    // 전체 데이터 로드 후 프론트 페이징
    const { data: invoices, error: iErr } = await window.mySupabase.from('invoices')
        .select('id, date, total_amount, staff_name, created_at, hotels(name)')
        .eq('factory_id', currentFactoryId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

    if(iErr) {
        activityBody.innerHTML = `<tr><td colspan="4" style="color:red;">에러: ${iErr.message}</td></tr>`;
        return;
    }

    const filteredInvoices = invoices
        ? invoices.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)')))
        : [];

    window._staffActivityAllData = filteredInvoices;

    window.renderStaffActivityPage = function() {
        const total = window._staffActivityAllData.length;
        const totalPages = Math.ceil(total / STAFF_ACTIVITY_PAGE_SIZE);
        const start = (window.currentStaffPage - 1) * STAFF_ACTIVITY_PAGE_SIZE;
        const pageData = window._staffActivityAllData.slice(start, start + STAFF_ACTIVITY_PAGE_SIZE);

        if (pageData.length === 0) {
            activityBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">발행된 명세서가 없습니다.</td></tr>';
        } else {
            activityBody.innerHTML = '';
            pageData.forEach(inv => {
                const displaySum = inv.total_amount || 0;
                const hName = (inv.hotels && inv.hotels.name) ? inv.hotels.name : '알수없음';
                    const createdAt = inv.created_at ? new Date(inv.created_at) : null;
                let timeStr = inv.date;
                if (createdAt) {
                    const kst = new Date(createdAt.getTime() + 9 * 60 * 60 * 1000);
                    const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
                    const dd = String(kst.getUTCDate()).padStart(2, '0');
                    const hh = String(kst.getUTCHours()).padStart(2, '0');
                    const min = String(kst.getUTCMinutes()).padStart(2, '0');
                    timeStr = `${mm}-${dd} ${hh}:${min}`;
                }
                activityBody.innerHTML += `<tr>
                    <td style="font-size:12px;">${timeStr}</td>
                    <td>${inv.staff_name || '직원'}</td>
                    <td><strong>${hName}</strong></td>
                    <td style="text-align:right;">${displaySum.toLocaleString()}원</td>
                </tr>`;
            });
        }

        const paginationDiv = document.getElementById('adminStaffPagination');
        if (paginationDiv) {
            if (totalPages <= 1) { paginationDiv.innerHTML = ''; return; }
            paginationDiv.innerHTML = `
            <div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-top:10px; flex-wrap:wrap;">
                <button class="btn btn-neutral" style="padding:6px 14px; font-size:13px;" onclick="window.currentStaffPage=Math.max(1,window.currentStaffPage-1); window.renderStaffActivityPage();" ${window.currentStaffPage <= 1 ? 'disabled' : ''}>◀ 이전</button>
                <span style="font-size:13px; color:#555;">${window.currentStaffPage} / ${totalPages} 페이지 (총 ${total}건)</span>
                <button class="btn btn-neutral" style="padding:6px 14px; font-size:13px;" onclick="window.currentStaffPage=Math.min(${totalPages},window.currentStaffPage+1); window.renderStaffActivityPage();" ${window.currentStaffPage >= totalPages ? 'disabled' : ''}>다음 ▶</button>
            </div>`;
        }
    };

    window.renderStaffActivityPage();
};

window.changeStaffPage = function(delta) {
    currentStaffPage += delta;
    window.loadAdminStaffList();
};
window.deleteStaff = async function(sId) {
    if(!confirm('삭제?')) return;
    // [v38 SQL-First] DB에서 직접 삭제
    const { error } = await window.mySupabase.from('staff').delete().eq('id', sId);
    if(error) { alert('직원 삭제 실패: ' + error.message); return; }
    if(typeof window.loadAdminStaffList === 'function') window.loadAdminStaffList();
};
window.openStaffModal = async function() {
  // [추가] 라이트 요금제(레벨 1)일 경우 직원 관리 제한 (비즈니스 이상 필요)
  if (!await window.checkAccess('STAFF_MANAGEMENT', null, '라이트 요금제에서 직원등록은 1명 입니다. [요금제 업그레이드] 해주세요')) return;

  ['st_name', 'st_loginId', 'st_loginPw'].forEach(id => {
      const el = document.getElementById(id);
      if(el) { el.value = ''; el.style.borderColor = 'var(--border)'; }
      const err = document.getElementById('err_' + id);
      if(err) err.style.display = 'none';
  });
  openModal('staffModal');
};
window.saveNewStaff = async function() {
    // [추가] 요금제 제한 확인
    const { data: f } = await window.mySupabase.from('factories').select('plan').eq('id', currentFactoryId).single();
    if (!await window.checkStaffLimit(f)) return;

    const nameInput = document.getElementById('st_name');
    const idInput = document.getElementById('st_loginId');
    const pwInput = document.getElementById('st_loginPw');

    const name = nameInput.value.trim();
    const lId = idInput.value.trim();
    const lPw = pwInput.value.trim();

    let isValid = true;
    if (!name) { nameInput.style.borderColor = 'var(--danger)'; document.getElementById('err_st_name').style.display = 'block'; isValid = false; }
    else { nameInput.style.borderColor = 'var(--border)'; document.getElementById('err_st_name').style.display = 'none'; }
    if (!lId) { idInput.style.borderColor = 'var(--danger)'; document.getElementById('err_st_loginId').innerText = 'ID를 입력해주세요.'; document.getElementById('err_st_loginId').style.display = 'block'; isValid = false; }
    else { idInput.style.borderColor = 'var(--border)'; document.getElementById('err_st_loginId').style.display = 'none'; }
    if (!lPw) { pwInput.style.borderColor = 'var(--danger)'; document.getElementById('err_st_loginPw').style.display = 'block'; isValid = false; }
    else { pwInput.style.borderColor = 'var(--border)'; document.getElementById('err_st_loginPw').style.display = 'none'; }
    if (!isValid) return;

    // ID 중복 체크 (DB)
    const { data: exist } = await window.mySupabase.from('staff').select('id').eq('factory_id', currentFactoryId).eq('login_id', lId).maybeSingle();
    if (exist) {
        idInput.style.borderColor = 'var(--danger)';
        document.getElementById('err_st_loginId').innerText = '이미 존재하는 ID입니다.';
        document.getElementById('err_st_loginId').style.display = 'block';
        return;
    }

    const { error } = await window.mySupabase.from('staff').insert([{
        id: 'st_' + Date.now(),
        factory_id: currentFactoryId,
        name: name,
        login_id: lId,
        login_pw: lPw
    }]);

    if (error) {
        alert('등록 실패: ' + error.message);
    } else {
        closeModal('staffModal');
        window.loadAdminStaffList();
        alert('직원 등록이 완료되었습니다.');
    }
};
window.openDefaultPriceSetting = function() { openModal('defaultPriceModal'); window.loadAdminDefaultPriceList(); };
window.loadAdminDefaultPriceList = async function() {
  // [v38 SQL-First] factory_default_prices 테이블에서 직접 조회
  const tbody = document.getElementById('adminDefaultPriceList');
  if(!tbody || !currentFactoryId) return;
  tbody.innerHTML = '';
  const { data: items, error } = await window.mySupabase.from('factory_default_prices')
      .select('*')
      .eq('factory_id', currentFactoryId)
      .order('sort_order', { ascending: true });
  if(error) { tbody.innerHTML = `<tr><td colspan="4" style="color:red;">에러: ${error.message}</td></tr>`; return; }
  (items || []).forEach((item) => tbody.innerHTML += `<tr style="height:35px;"><td style="padding:4px 8px;">${item.name}</td><td style="padding:4px 8px;">${Number(item.price || 0).toLocaleString()}원</td><td style="padding:4px 8px;">${item.unit || '개'}</td><td style="padding:4px 8px;"><button class="btn btn-danger" style="padding:2px 6px; font-size:11px;" onclick="deleteDefaultPrice('${item.id}')">삭제</button></td></tr>`);
};
window.saveDefaultPrice = async function() {
  // [v38 SQL-First] factory_default_prices 테이블에 직접 저장
  console.log('단가 저장 시도');
  const nameEl = document.getElementById('dp_name');
  const priceEl = document.getElementById('dp_price');
  const unitEl = document.getElementById('dp_unit');

  const name = nameEl.value.trim();
  const price = Number(priceEl.value) || 0;
  const unit = unitEl.value.trim() || '개';

  console.log('입력값:', name, price, unit);

  if(!name) { alert('품목명 입력!'); return; }

  const { error } = await window.mySupabase.from('factory_default_prices').insert([{
      factory_id: currentFactoryId,
      name: name,
      price: price,
      unit: unit,
      sort_order: 0
  }]);
  if(error) { alert('저장 실패: ' + error.message); return; }

  window.loadAdminDefaultPriceList();

  // 입력창 초기화
  nameEl.value = '';
  priceEl.value = '0';
  unitEl.value = '개';
  nameEl.focus();
  console.log('저장 완료');
};
window.deleteDefaultPrice = async function(itemId) {
    // [v38 SQL-First] factory_default_prices 테이블에서 직접 삭제
    const { error } = await window.mySupabase.from('factory_default_prices').delete().eq('id', itemId);
    if(error) { alert('삭제 실패: ' + error.message); return; }
    window.loadAdminDefaultPriceList();
};

// --- Super Admin ---
/* cleaned up old super admin code */
window.loadPendingFactories = async function() {
    const tbody = document.getElementById('pendingFactoryList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">데이터를 불러오는 중...</td></tr>';
    
    const { data: pending, error } = await window.mySupabase.from('pending_factories').select('*');
    if (error) {
        console.error("DEBUG: loadPendingFactories error:", error);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">에러: ${error.message}</td></tr>`;
        return;
    }
    
    if (!pending || pending.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">신청된 데이터가 없습니다.</td></tr>';
    } else {
        tbody.innerHTML = '';
        pending.forEach(p => {
            tbody.innerHTML += `<tr><td>${p.name}</td><td>${p.biz_no}</td><td>${p.phone}</td><td>${p.address}</td><td><button class="btn btn-save" style="padding:3px; font-size:12px; border-radius:4px; border:none;" onclick="approveFactory('${p.id}')">승인</button><button class="btn btn-danger" style="padding:3px; font-size:12px; border-radius:4px; border:none; margin-left:5px;" onclick="rejectFactory('${p.id}')">반려</button></td></tr>`;
        });
    }
};

window.approveFactory = async function(reqId) {
    const { data: p, error: pErr } = await window.mySupabase.from('pending_factories').select('*').eq('id', reqId).maybeSingle();
    if (pErr || !p) { alert('신청 데이터를 찾을 수 없습니다.'); return; }
    
    // Supabase DB에 직접 삽입 전 중복 ID 체크
    const { data: existing, error: checkErr } = await window.mySupabase.from('factories').select('id').eq('admin_id', p.admin_id).maybeSingle();
    if (checkErr) { alert('중복 체크 중 오류 발생: ' + checkErr.message); return; }
    if (existing) { alert('이미 같은 관리자 ID(' + p.admin_id + ')를 사용하는 공장이 있습니다.'); return; }

    const fId = 'f_' + Date.now();
    const expiryDate = new Date(p.date || new Date());
    expiryDate.setMonth(expiryDate.getMonth() + 5);
    const planExpiry = expiryDate.toISOString().split('T')[0];

    const { error } = await window.mySupabase.from('factories').insert([{
        id: fId,
        name: p.name,
        admin_id: p.admin_id,
        admin_pw: p.admin_pw,
        ceo: p.name + ' 대표',
        phone: p.phone,
        address: p.address,
        status: 'operating',
        created_at: p.date || getTodayString(),
        sub_status: 'trial', 
        plan: '무료요금제',
        plan_expiry: planExpiry
    }]);

    if (error) {
        alert('승인 중 오류 발생: ' + error.message);
        return;
    }

    // pending_factories에서 삭제
    await window.mySupabase.from('pending_factories').delete().eq('id', reqId);

    // 가입 승인 카카오 알림톡 → 공장 대표에게 발송
    try {
        if (p.phone) {
            await fetch('https://tphagookafjldzvxaxui.supabase.co/functions/v1/send-kakao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'join',
                    to: p.phone.replace(/-/g, ''),
                    factoryName: p.name,
                    representativeName: p.representative || p.name
                })
            });
        }
    } catch(e) { console.warn('[공장 승인 알림톡 발송 실패]', e); }

    window.loadSuperAdminDashboard();
    alert('성공적으로 승인되었습니다.');
};

window.rejectFactory = async function(reqId) {
    if(confirm('정말 반려(삭제)하시겠습니까?')) {
        const { error } = await window.mySupabase.from('pending_factories').delete().eq('id', reqId);
        if (error) { alert('삭제 실패: ' + error.message); return; }
        window.loadSuperAdminDashboard();
    }
};
window.updateFactoryStatus = async function(fId, s) {
    // [v38 SQL-First] DB에서 직접 상태 업데이트
    const { error } = await window.mySupabase.from('factories').update({ status: s }).eq('id', fId);
    if(error) { alert('상태 변경 실패: ' + error.message); return; }
    loadSuperAdminDashboard();
};
window.deleteFactory = async function(fId) {
    if(confirm('정말 이 세탁공장을 삭제하시겠습니까? 관련된 모든 데이터(거래처, 명세서)가 연쇄적으로 영구 삭제됩니다!')) {
        const { error } = await window.mySupabase.from('factories').delete().eq('id', fId);
        if (error) { alert('삭제 중 오류가 발생했습니다: ' + error.message); return; }
        
        window.loadSuperAdminDashboard();
        alert('공장이 성공적으로 삭제되었습니다.');
    }
};

window.openFactoryAdminView = function(fId) {
    localStorage.setItem('adminAccessFactoryId', fId);
    let currentPath = window.location.pathname.split('/').pop();
    if (!currentPath || currentPath === '') currentPath = 'index.html'; // [수정] v37 하드코딩 제거, 기본 index.html
    window.open(currentPath, '_blank');
};

window.viewFactoryDetails = async function(fId, isSuperAdmin = false) {
    editingFactoryId = fId;
    const { data: f, error } = await window.mySupabase.from('factories').select('*').eq('id', fId).single();
    if(error || !f) { alert('데이터를 불러올 수 없습니다.'); return; }
    document.getElementById('s_factoryName').value = f.name;
    document.getElementById('s_adminId').value = f.admin_id;
    document.getElementById('s_adminPw').value = f.admin_pw;
    document.getElementById('s_ceo').value = f.ceo || '';
    document.getElementById('s_phone').value = f.phone || '';
    document.getElementById('s_address').value = f.address || '';
    document.getElementById('s_bankInfo').value = f.bank_info || '';
    document.getElementById('s_memo').value = f.memo || '';
    document.getElementById('s_plan').value = f.plan || '라이트';
    document.getElementById('s_planExpiry').value = f.plan_expiry || '';
    document.getElementById('s_subStatus').value = f.sub_status || 'active';
    document.getElementById('s_status').value = f.status || 'operating';
    document.getElementById('admin-only-settings').style.display = isSuperAdmin ? 'block' : 'none';
    openModal('factoryModal');
};
window.openFactoryModal = function(isSuperAdmin = false) {
  editingFactoryId = null;
  ['s_factoryName', 's_adminId', 's_adminPw', 's_ceo', 's_phone', 's_address', 's_bankInfo', 's_memo', 's_plan', 's_planExpiry', 's_status'].forEach(f => {
      const el = document.getElementById(f);
      if(el) { el.value = ''; el.classList.remove('error'); }
      const err = document.getElementById('err_' + f);
      if(err) err.style.display = 'none';
  });
  document.getElementById('s_plan').value = '무료요금제';
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + 5);
  document.getElementById('s_planExpiry').value = expiryDate.toISOString().split('T')[0];
  document.getElementById('s_subStatus').value = 'trial';
  document.getElementById('s_status').value = 'operating';
  document.getElementById('admin-only-settings').style.display = isSuperAdmin ? 'block' : 'none';
  openModal('factoryModal');
};

window.saveNewFactory = async function() {
  const fields = [{ id: 's_factoryName', err: 'err_s_factoryName' }, { id: 's_adminId', err: 'err_s_adminId' }, { id: 's_adminPw', err: 'err_s_adminPw' }];
  let isValid = true;
  fields.forEach(f => {
      const el = document.getElementById(f.id);
      const err = document.getElementById(f.err);
      if (!el.value.trim()) { el.classList.add('error'); if(err) err.style.display = 'block'; isValid = false; } else { el.classList.remove('error'); if(err) err.style.display = 'none'; }
  });
  if (!isValid) return;

  const newId = document.getElementById('s_adminId').value.trim();
  const { data: existing } = await window.mySupabase.from('factories').select('id').eq('admin_id', newId).maybeSingle();

  if (existing && existing.id !== editingFactoryId) {
      alert('이미 사용 중인 ID입니다. 다른 ID를 입력해주세요.');
      return;
  }

  const factoryData = {
      name: document.getElementById('s_factoryName').value.trim(),
      admin_id: document.getElementById('s_adminId').value.trim(),
      admin_pw: document.getElementById('s_adminPw').value.trim(),
      ceo: document.getElementById('s_ceo').value.trim(),
      phone: document.getElementById('s_phone').value.trim(),
      address: document.getElementById('s_address').value.trim(),
      bank_info: document.getElementById('s_bankInfo').value.trim(),
      memo: document.getElementById('s_memo').value.trim(),
      plan: document.getElementById('s_plan').value,
      plan_expiry: document.getElementById('s_planExpiry').value || null,
      sub_status: document.getElementById('s_subStatus').value,
      status: document.getElementById('s_status').value
  };

  // [v37 자동화] 만료일 기준 구독 상태 자동 결정
  // 사장님 요청: 플랫폼 관리자가 '무료체험'으로 '수동 지정'한 경우, 
  // 만료일 로직(active 덮어쓰기)을 무시하고 관리자의 선택(무료체험)을 최우선으로 존중해야 함.
  if (factoryData.plan_expiry) {
      if (!editingFactoryId) {
          // 신규 등록 시 무조건 무료체험
          factoryData.sub_status = 'trial';
      } else {
          // 기존 수정일 때
          const expiryDate = new Date(factoryData.plan_expiry);
          const today = new Date();
          today.setHours(0, 0, 0, 0); // 시간 제외

          if (expiryDate < today) {
              factoryData.sub_status = 'expired';
          } else {
              const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
              if (diffDays <= 15) {
                  // 임박한 경우, 선택한 것이 '무료체험'이든 뭐든 무조건 '만료임박'으로 덮어씀!
                  factoryData.sub_status = 'expiring';
              } else {
                  // 15일 이상 넉넉할 때 (결제 연장 등)
                  // 단, 관리자가 폼에서 'trial' (무료체험)을 명시적으로 골랐다면, 그걸 덮어쓰지 말고 존중한다.
                  if (factoryData.sub_status !== 'trial') {
                      factoryData.sub_status = 'active';
                  }
              }
          }
      }
  }

  let error;
  if (editingFactoryId) {
      const { error: err } = await window.mySupabase.from('factories').update(factoryData).eq('id', editingFactoryId);
      error = err;
  } else {
      factoryData.id = 'f_' + Date.now();
      factoryData.status = 'operating';
      factoryData.created_at = new Date().toISOString();
      const { error: err } = await window.mySupabase.from('factories').insert(factoryData);
      error = err;
  }

  if (error) { alert('저장 실패: ' + error.message); return; }
  await window.fetchFromSupabase(); // [v33 안전 동기화] 저장 후 최신 데이터 동기화
  alert('저장 완료!');
  closeModal('factoryModal');
  loadSuperAdminDashboard();
};

// [v38 SQL-First] 거래처 파트너 대시보드 - 레거시 platformData 완전 제거
// [v38 SQL-First] 거래처 파트너 대시보드
window.loadHotelDashboard = async function() {
    if (typeof window.loadGlobalNotice === 'function') window.loadGlobalNotice();
    const el = (id) => document.getElementById(id);



    // 1. 거래처 정보 조회 (공장 정보는 별도 조회 - FK join 의존 제거)
    const { data: hData, error: hErr } = await window.mySupabase
        .from('hotels')
        .select('*')
        .eq('id', currentHotelId)
        .single();

    if (!hData) return;

    // 공장 정보 별도 조회
    const { data: fData } = await window.mySupabase
        .from('factories')
        .select('name, phone, ceo')
        .eq('id', hData.factory_id)
        .single();

    // 헤더 세팅
    if (el('hotelNameTitle')) el('hotelNameTitle').innerText = hData.name;
    if (el('h_factoryPhone')) el('h_factoryPhone').innerText = fData?.phone || '-';
    if (el('h_factoryCeo')) el('h_factoryCeo').innerText = fData?.ceo || '-';
    const contractText = hData.contract_type === 'fixed'
        ? `정액제 (월 ${Number(hData.fixed_amount || 0).toLocaleString()}원)` : '단가제';
    if (el('hotelContractInfo')) el('hotelContractInfo').innerText = contractText;

    // 2. 조회 월 세팅
    const statsInp = el('hotelInvoiceMonth');
    const sMonth = statsInp?.value || getTodayString().substring(0, 7);
    if (statsInp) statsInp.value = sMonth;
    const sMonthStart = sMonth + '-01';
    // 월말 날짜 정확 계산 (4월=30일, 2월=28/29일 등 대응)
    const [sY, sM] = sMonth.split('-').map(Number);
    const lastDay = new Date(sY, sM, 0).getDate(); // 다음달 0일 = 이번달 말일
    const sMonthEnd = sMonth + '-' + String(lastDay).padStart(2, '0');

    // 3. 해당 월 invoices 조회 (금액 통계 + 목록용)
    const { data: invListRaw } = await window.mySupabase
        .from('invoices')
        .select('id, date, total_amount, staff_name')
        .eq('hotel_id', currentHotelId)
        .gte('date', sMonthStart)
        .lte('date', sMonthEnd)
        .order('date', { ascending: false });

    // [수정] 관리자(차감) 명세서는 파트너(거래처)의 최근 입고 현황에서 투명인간 처리!
    const invList = (invListRaw || []).filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)')));

    // 목록 렌더링 + 통계 집계
    const tbody = el('hotelInvoiceList');
    if (tbody) tbody.innerHTML = '';
    let total = 0, count = 0;

    invList.forEach(inv => {
        const invSum = Number(inv.total_amount || 0);
        total += invSum;
        count++;
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

    // 카드 업데이트
    if (el('hotelMonthlyTotal')) el('hotelMonthlyTotal').innerText = total.toLocaleString() + '원';
    if (el('hotelMonthlyCount')) el('hotelMonthlyCount').innerText = count + '회';

    // 4. 품목 통계 - invoice_items 별도 조회 (해당 월 invoice id 목록 기반)
    const invIds = (invList || []).map(inv => inv.id);
    const itemStats = {};
    if (invIds.length > 0) {
        const { data: itemRows } = await window.mySupabase
            .from('invoice_items')
            .select('name, qty')
            .in('invoice_id', invIds);
        (itemRows || []).forEach(it => {
            itemStats[it.name] = (itemStats[it.name] || 0) + Number(it.qty || 0);
        });
    }
    if (el('hotelTopItem')) {
        const top = Object.entries(itemStats).sort((a, b) => b[1] - a[1])[0];
        el('hotelTopItem').innerText = top ? `${top[0]} (${top[1]}개)` : '-';
    }

    // 5. 6개월 추이 - 독립 쿼리 (이중 계산 없음)
    const monthlyTrend = {};
    for (let i = 5; i >= 0; i--) {
        const d = new Date(sMonth + '-01');
        d.setMonth(d.getMonth() - i);
        monthlyTrend[d.toISOString().substring(0, 7)] = 0;
    }
    const trendStart = Object.keys(monthlyTrend)[0] + '-01';
    const { data: trendData } = await window.mySupabase
        .from('invoices')
        .select('date, total_amount')
        .eq('hotel_id', currentHotelId)
        .gte('date', trendStart)
        .lte('date', sMonthEnd);
    (trendData || []).forEach(inv => {
        const m = inv.date.substring(0, 7);
        if (monthlyTrend[m] !== undefined) monthlyTrend[m] += Number(inv.total_amount || 0);
    });

    updateHotelItemChart(itemStats);
    updateHotelTrendChart(monthlyTrend);

    // 6. 정산 리포트 수신함
    window.loadHotelReceivedInvoicesList();
};

window.updateHotelItemChart = function(stats) {
    const canvas = document.getElementById('hotelItemPieChart');
    const msg = document.getElementById('hotelNoChartMsg');
    if (!canvas || !msg) return; // 요소가 없으면 에러 없이 종료

    if(Object.keys(stats).length === 0) { canvas.style.display = 'none'; msg.style.display = 'block'; return; }
    canvas.style.display = 'block'; msg.style.display = 'none';
    if(hotelItemChart) hotelItemChart.destroy();
    hotelItemChart = new Chart(canvas, { type: 'doughnut', data: { labels: Object.keys(stats), datasets: [{ data: Object.values(stats), backgroundColor: ['#005b9f','#00a8e8','#8b5cf6','#10b981','#f59e0b','#ef4444','#64748b'] }] }, options: { responsive: true, plugins: { legend: { display: true, position: 'bottom' } } } });
};

// [v38 SQL-First] 첫 번째 레거시 loadHotelReceivedInvoicesList 제거됨

window.updateHotelTrendChart = function(data) {
    const canvas = document.getElementById('hotelTrendBarChart');
    if(!canvas) return;
    if(hotelTrendChart) hotelTrendChart.destroy();
    hotelTrendChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: Object.keys(data).map(m => m.substring(5) + '월'),
            datasets: [{ label: '월별 매출', data: Object.values(data), backgroundColor: '#005b9f' }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
};


window.toggleFixedAmountField = function() {
    const type = document.getElementById('h_contractType').value;
    const group = document.getElementById('h_fixedAmountGroup');
    if (group) group.style.display = (type === 'fixed' ? 'block' : 'none');
};

let selectedPlan = '', selectedPrice = 0;

window.selectPlan = function(name, price) {
    selectedPlan = name;
    selectedPrice = price;
    
    // 모든 결제 폼 내의 요금제 이름 업데이트
    const planNameEls = document.querySelectorAll('#selectedPlanName');
    planNameEls.forEach(el => el.innerText = name);
    
    const formArea = document.getElementById('paymentModalFormArea') || document.getElementById('paymentFormArea');
    if(formArea) formArea.style.display = 'block';
    calculatePaymentTotal();
};

window.calculatePaymentTotal = function() {
    // 화면에 보여지고 있는 폼의 입력값만 가져오기 (결제 모달 우선)
    const activeModal = document.querySelector('.modal-overlay[style*="display: flex"]');
    const monthsEl = activeModal ? activeModal.querySelector('#pay_months') : document.getElementById('pay_months');
    const taxEl = activeModal ? activeModal.querySelector('#pay_tax') : document.getElementById('pay_tax');
    const totalDisplay = activeModal ? activeModal.querySelector('#pay_total_display') : document.getElementById('pay_total_display');
    
    if(!monthsEl || !totalDisplay) {
        console.error("DEBUG: calculatePaymentTotal elements not found");
        return;
    }

    const months = parseInt(monthsEl.value);
    const taxChecked = taxEl ? taxEl.checked : false;
    
    let discount = 0;
    if (months === 3) discount = 0.05;
    else if (months === 6) discount = 0.10;
    else if (months === 12) discount = 0.20;
    
    let subtotal = Math.floor(selectedPrice * months * (1 - discount));
    let total = subtotal;
    
    if (taxChecked) {
        total = Math.floor(subtotal * 1.1);
    }
    
    totalDisplay.innerText = total.toLocaleString() + '원' + (taxChecked ? ' (VAT 포함)' : '');
};

window.submitPaymentRequest = async function() {
    await window.fetchFromSupabase(); // [v33 안전 동기화] 최신 데이터 먼저 로드

    // 활성화된 모달이나 탭 영역에서 요소 찾기
    const activeModal = document.querySelector('.modal-overlay[style*="display: flex"]');
    const depositorEl = activeModal ? activeModal.querySelector('#pay_depositor') : document.getElementById('pay_depositor');
    const monthsEl = activeModal ? activeModal.querySelector('#pay_months') : document.getElementById('pay_months');
    const taxEl = activeModal ? activeModal.querySelector('#pay_tax') : document.getElementById('pay_tax');
    
    const depositor = depositorEl ? depositorEl.value.trim() : '';
    const months = parseInt(monthsEl.value);
    const tax = taxEl ? taxEl.checked : false;
    
    if (!depositor) { alert('입금자명을 입력해주세요.'); return; }
    
    let discount = 0;
    if (months === 3) discount = 0.05;
    else if (months === 6) discount = 0.10;
    else if (months === 12) discount = 0.20;
    
    let subtotal = Math.floor(selectedPrice * months * (1 - discount));
    const total = tax ? Math.floor(subtotal * 1.1) : subtotal;
    
    // [v38 SQL-First] Supabase에 직접 삽입, factory_name은 DB에서 조회
    const { data: factoryForPayment } = await window.mySupabase.from('factories').select('name').eq('id', currentFactoryId).maybeSingle();
    const { error } = await window.mySupabase.from('pending_payments').insert([{
        id: 'pay_' + Date.now(),
        factory_id: currentFactoryId,
        factory_name: factoryForPayment ? factoryForPayment.name : '',
        plan: selectedPlan,
        months: months,
        total: total,
        request_tax_invoice: tax,
        depositor_name: depositor,
        date: getTodayString()
    }]);

    if (error) {
        alert('결제 신청 실패: ' + error.message);
        return;
    }
    
    // 로컬 데이터는 동기화용으로만 업데이트 (또는 fetch로 다시 불러오기)
    await window.fetchFromSupabase();
    alert('결제 신청이 완료되었습니다. 관리자 승인을 기다려주세요.');

    // 관리자에게 결제 신청 SMS 발송
    try {
        const { data: fInfo } = await window.mySupabase.from('factories').select('name').eq('id', currentFactoryId).maybeSingle();
        const factoryName = fInfo ? fInfo.name : '';
        const { data: mConfig } = await window.mySupabase
            .from('platform_settings')
            .select('admin_phone')
            .eq('id', 'master_config')
            .maybeSingle();
        if (mConfig && mConfig.admin_phone) {
            await fetch('https://tphagookafjldzvxaxui.supabase.co/functions/v1/send-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    receiver: mConfig.admin_phone.replace(/-/g, ''),
                    message: `[CEgo플랫폼] 결제신청: ${factoryName || currentFactoryId} ${depositor} ${total.toLocaleString()}원`
                })
            });
        }
    } catch(e) { console.warn('[결제신청 관리자 SMS 실패]', e); }
    
    // 모달과 탭 폼 모두 닫기
    const modalForm = document.getElementById('paymentModalFormArea');
    const tabForm = document.getElementById('paymentFormArea');
    if (modalForm) modalForm.style.display = 'none';
    if (tabForm) tabForm.style.display = 'none';
    
    closeModal('paymentDirectModal');
    
    // 결제 신청 후 메인 통계 탭으로 자동 전환
    const statsTabBtn = document.querySelector('.tab-item[onclick="switchTab(this, \'adminStats\')"]');
    if (statsTabBtn) {
        window.switchTab(statsTabBtn, 'adminStats');
    }
};

// [v38 SQL-First] 두 번째 레거시 loadHotelReceivedInvoicesList 제거됨

window.printReport = function(htmlContent) {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write('<html><head><style>body{font-family:sans-serif; padding:20px;} table{width:100%; border-collapse:collapse; margin-top:10px;} th,td{border:1px solid #ccc; padding:8px; text-align:center;} .total-row{font-weight:bold; background:#eee;}</style></head><body>' + htmlContent + '</body></html>');
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
};


window.viewSentReportByPeriod = async function(period, sentAt) {
    // [v38 SQL-First] sent_logs 테이블에서 직접 조회 후 viewSentDetail로 위임
    const { data: logEntry } = await window.mySupabase.from('sent_logs')
        .select('*, hotels(name)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', currentHotelId)
        .eq('period', period)
        .maybeSingle();

    if (!logEntry) { alert('발송 기록을 찾을 수 없습니다.'); return; }

    await window.viewSentDetail(
        logEntry.hotels ? logEntry.hotels.name : '',
        logEntry.period,
        logEntry.id,
        true,
        logEntry.hotel_id,
        !!logEntry.is_confirmed
    );
};


window.confirmSentReportByPeriod = async function(sentAt) {
    // [v38 SQL-First] sent_logs 테이블에서 is_confirmed 업데이트
    console.log("DEBUG: Confirming settlement for sentAt:", sentAt);

    const { data: logEntry } = await window.mySupabase.from('sent_logs')
        .select('id')
        .eq('sent_at', sentAt)
        .eq('factory_id', currentFactoryId)
        .maybeSingle();

    if (!logEntry) { alert('발송 기록을 찾을 수 없습니다.'); return; }

    const { error } = await window.mySupabase.from('sent_logs').update({ is_confirmed: true }).eq('id', logEntry.id);
    if (error) { alert('정산 확인 처리 실패: ' + error.message); return; }

    // 모달창 강제 닫기
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(m => m.style.display = 'none');

    loadHotelReceivedInvoicesList(); // 리스트 갱신
};

window.handleAdminFilterChange = function() {
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    if (hotelFilter === 'all') {
        document.getElementById('adminStatsStartDate').value = '';
        document.getElementById('adminStatsEndDate').value = '';
    }
    loadAdminRecentInvoices();
};

window.printReport = function(elementId) {
    const el = document.getElementById(elementId);
    if (!el) { alert('인쇄할 내용을 찾을 수 없습니다.'); return; }

    // 요소 복제
    const clone = el.cloneNode(true);

    // 인쇄 시 불필요한 요소 제거 (btn-send, no-print 클래스 모두 타겟팅)
    const toRemove = clone.querySelectorAll('.no-print, .btn-send, .btn-neutral');
    toRemove.forEach(node => node.remove());

    // 인쇄 창 생성
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) { alert('팝업 차단을 해제해주세요.'); return; }

    printWindow.document.write(`
    <html>
    <head>
        <title>인쇄</title>
        <style>
            body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: 700; }
            td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; }
            .total-row { font-weight: bold; background: #eee; }
            /* 사장님 요청에 따른 디자인 조정 */
            th:nth-child(2), td:nth-child(2),
            th:nth-child(3), td:nth-child(3),
            th:nth-child(4), td:nth-child(4) { text-align: right; }
            th:nth-child(1), td:nth-child(1) { text-align: left; }
        </style>
    </head>
    <body>
        ${clone.innerHTML}
    </body>
    </html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
};

// [v38 SQL-First] 거래처 파트너 - 정산 리포트 수신함 페이징 전역변수
let _hotelReceivedData = [];
let _hotelReceivedPage = 1;
const HOTEL_RECEIVED_PAGE_SIZE = 10;

// [v38 SQL-First] 거래처 파트너 - 정산 리포트 수신함 (sent_logs 테이블 기반)
window.loadHotelReceivedInvoicesList = async function() {
    const tbody = document.getElementById('hotelReceivedInvoicesList');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">불러오는 중...</td></tr>';

    const { data: logs, error } = await window.mySupabase
        .from('sent_logs')
        .select('id, period, total_amount, sent_at, is_confirmed')
        .eq('hotel_id', currentHotelId)
        .order('sent_at', { ascending: false });

    if (error || !logs) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--danger);">오류: ${error?.message || '알 수 없는 오류'}</td></tr>`;
        renderHotelReceivedPaging(0);
        return;
    }

    if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="padding:20px; text-align:center; color:gray;">수신된 정산 리포트가 없습니다.</td></tr>';
        renderHotelReceivedPaging(0);
        return;
    }

    _hotelReceivedData = logs;
    _hotelReceivedPage = 1;
    renderHotelReceivedPage();
};

function renderHotelReceivedPage() {
    const tbody = document.getElementById('hotelReceivedInvoicesList');
    if (!tbody) return;

    const total = _hotelReceivedData.length;
    const totalPages = Math.ceil(total / HOTEL_RECEIVED_PAGE_SIZE);
    const start = (_hotelReceivedPage - 1) * HOTEL_RECEIVED_PAGE_SIZE;
    const pageData = _hotelReceivedData.slice(start, start + HOTEL_RECEIVED_PAGE_SIZE);

    tbody.innerHTML = '';
    pageData.forEach(log => {
        const displayPeriod = log.period || '-';
        const confirmed = log.is_confirmed === true;
        const statusBadge = confirmed
            ? `<span class="badge" style="background:#16a34a; color:white; padding:2px 8px; border-radius:4px;">✅ 확인완료</span>`
            : `<span class="badge" style="background:var(--danger); color:white; padding:2px 8px; border-radius:4px;">🔴 수신완료</span>`;

        tbody.innerHTML += `<tr>
            <td style="text-align:left;">${displayPeriod}</td>
            <td style="text-align:right;">${Number(log.total_amount || 0).toLocaleString()}원</td>
            <td style="text-align:center;">${statusBadge}</td>
            <td style="text-align:center; white-space:nowrap;">
                <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; background:var(--primary); color:white; border:1px solid var(--primary); border-radius:4px; height:auto; display:inline-block;" onclick="viewHotelSentLogDetail('${log.id}')">상세</button>
                <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; background:#16a34a; color:white; border:1px solid #16a34a; border-radius:4px; margin-left:4px; height:auto; display:inline-block;" onclick="downloadSentLogExcel('${log.id}', '${displayPeriod}')">Excel</button>
            </td>
        </tr>`;
    });

    renderHotelReceivedPaging(totalPages);
}

function renderHotelReceivedPaging(totalPages) {
    const paging = document.getElementById('hotelReceivedPagination');
    if (!paging) return;
    paging.innerHTML = '';
    if (totalPages <= 1) return;

    const total = _hotelReceivedData.length;
    const btnStyle = (active) => `padding:6px 12px; border-radius:6px; border:1px solid #cbd5e1; cursor:pointer; font-size:13px; font-weight:${active?'700':'400'}; background:${active?'var(--primary)':'white'}; color:${active?'white':'#334155'}; min-width:36px; min-height:36px;`;

    // 이전 버튼
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '◀';
    prevBtn.style.cssText = btnStyle(false);
    prevBtn.disabled = _hotelReceivedPage === 1;
    prevBtn.style.opacity = _hotelReceivedPage === 1 ? '0.4' : '1';
    prevBtn.onclick = () => { _hotelReceivedPage--; renderHotelReceivedPage(); };
    paging.appendChild(prevBtn);

    // 페이지 번호 (최대 5개)
    const maxShow = 5;
    let pageStart = Math.max(1, _hotelReceivedPage - Math.floor(maxShow / 2));
    let pageEnd = Math.min(totalPages, pageStart + maxShow - 1);
    if (pageEnd - pageStart < maxShow - 1) pageStart = Math.max(1, pageEnd - maxShow + 1);

    for (let i = pageStart; i <= pageEnd; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.style.cssText = btnStyle(i === _hotelReceivedPage);
        btn.onclick = ((p) => () => { _hotelReceivedPage = p; renderHotelReceivedPage(); })(i);
        paging.appendChild(btn);
    }

    // 다음 버튼
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '▶';
    nextBtn.style.cssText = btnStyle(false);
    nextBtn.disabled = _hotelReceivedPage === totalPages;
    nextBtn.style.opacity = _hotelReceivedPage === totalPages ? '0.4' : '1';
    nextBtn.onclick = () => { _hotelReceivedPage++; renderHotelReceivedPage(); };
    paging.appendChild(nextBtn);

    // 안내 텍스트
    const info = document.createElement('span');
    info.style.cssText = 'font-size:12px; color:var(--secondary); margin-left:8px; display:inline-block;';
    info.textContent = `총 ${total}건 / ${_hotelReceivedPage}페이지`;
    paging.appendChild(info);
}

// [v38 SQL-First] 거래처 파트너 - 정산 리포트 상세보기 (sent_logs.id 기반)
window.viewHotelSentLogDetail = async function(logId) {
    const { data: log, error } = await window.mySupabase
        .from('sent_logs')
        .select('id, period, total_amount, sent_at, hotel_id, is_confirmed, hotels(name)')
        .eq('id', logId)
        .single();

    if (error || !log) { alert('상세 정보를 불러올 수 없습니다.'); return; }

    await window.viewSentDetail(
        log.hotels?.name || '',
        log.period,
        log.id,
        true,
        log.hotel_id,
        log.is_confirmed
    );
};

// [v38] 거래처 파트너 - 정산확인 처리
window.confirmHotelSettlement = async function(logId) {
    if (!confirm('정산을 확인하시겠습니까?\n확인 후에는 변경할 수 없습니다.')) return;
    const { error } = await window.mySupabase
        .from('sent_logs')
        .update({ is_confirmed: true })
        .eq('id', logId);
    if (error) { alert('처리 중 오류가 발생했습니다: ' + error.message); return; }
    closeModal('sendInvoiceModal');
    window.loadHotelReceivedInvoicesList();
};

// [v38] 정산 리포트 Excel 다운로드 - ExcelJS 색상 스타일 적용

window.confirmSendInvoice = async function(sDate, eDate, hotelId, totalAmount, supplyPrice, vat) {
    // [v38 SQL-First] sent_logs 테이블에 직접 저장
    const { data: hInfo } = await window.mySupabase.from('hotels').select('name').eq('id', hotelId).maybeSingle();
    const sentAtVal = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const { error: sentErr } = await window.mySupabase.from('sent_logs').insert([{
        factory_id: currentFactoryId,
        hotel_id: hotelId,
        period: sDate + ' ~ ' + eDate,
        total_amount: totalAmount,
        supply_price: supplyPrice,
        vat: vat,
        sent_at: sentAtVal,
        is_confirmed: false
    }]);
    if (sentErr) { alert('발송 저장 실패: ' + sentErr.message); return; }

    // invoices is_sent 플래그 DB 업데이트
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

    // 호텔 담당자에게 월정산 리포트 카카오 알림톡 발송 (if 블록 밖에서 항상 실행)
    try {
        const { data: hInfo } = await window.mySupabase
            .from('hotels')
            .select('name, phone')
            .eq('id', hotelId)
            .maybeSingle();
        if (hInfo && hInfo.phone) {
            const { data: fInfo } = await window.mySupabase
                .from('factories')
                .select('name')
                .eq('id', currentFactoryId)
                .maybeSingle();
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
    } catch(e) { console.warn('[월정산 알림톡 발송 실패]', e); }
};


window.togglePlatformDropdown = function() {
    const menu = document.getElementById('dropdownMenu');
    if (menu) menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
};

// 로그인 인라인 에러 메시지 + 빨간 테두리 + 필드 하단 힌트 헬퍼
window.LOGIN_HINTS = window.LOGIN_HINTS || {
    role:  '위 목록에서 본인의 역할을 선택해 주세요.',
    id:    '관리자로부터 발급받은 ID를 입력해 주세요.',
    pw:    '발급받은 비밀번호를 입력해 주세요.',
    idpw:  { id: 'ID를 확인해 주세요.', pw: '비밀번호를 확인해 주세요.' }
};

window.showLoginError = function(msg, focusTargets) {
    const dropBtn = document.getElementById('dropdownBtn');
    const idEl   = document.getElementById('loginId');
    const pwEl   = document.getElementById('loginPw');
    const hintRole = document.getElementById('hintRole');
    const hintId   = document.getElementById('hintId');
    const hintPw   = document.getElementById('hintPw');

    // 초기화
    [dropBtn, idEl, pwEl].forEach(el => { if(el) el.style.outline = ''; });
    [hintRole, hintId, hintPw].forEach(el => { if(el) el.style.display = 'none'; });



    const applyHighlight = function() {
        if (focusTargets === 'role') {
            if(dropBtn) { dropBtn.style.outline = '2px solid #dc2626'; dropBtn.focus(); }
            if(hintRole) { hintRole.textContent = window.LOGIN_HINTS.role; hintRole.style.display = 'block'; }
        } else if (focusTargets === 'id') {
            if(idEl) { idEl.style.outline = '2px solid #dc2626'; idEl.focus(); }
            if(hintId) { hintId.textContent = window.LOGIN_HINTS.id; hintId.style.display = 'block'; }
        } else if (focusTargets === 'pw') {
            if(pwEl) { pwEl.style.outline = '2px solid #dc2626'; pwEl.focus(); }
            if(hintPw) { hintPw.textContent = window.LOGIN_HINTS.pw; hintPw.style.display = 'block'; }
        } else if (focusTargets === 'idpw') {
            if(idEl) { idEl.style.outline = '2px solid #dc2626'; }
            if(pwEl) { pwEl.style.outline = '2px solid #dc2626'; }
            if(hintId) { hintId.textContent = window.window.LOGIN_HINTS.idpw.id; hintId.style.display = 'block'; }
            if(hintPw) { hintPw.textContent = window.window.LOGIN_HINTS.idpw.pw; hintPw.style.display = 'block'; }
            if(idEl) idEl.focus();
        }
        // 4초 후 자동 정리
        setTimeout(() => window.clearLoginError(), 4000);
    };

    applyHighlight();
};

window.clearLoginError = function() {
    const dropBtn = document.getElementById('dropdownBtn');
    const idEl = document.getElementById('loginId');
    const pwEl = document.getElementById('loginPw');
    [dropBtn, idEl, pwEl].forEach(el => { if(el) el.style.outline = ''; });
    ['hintRole','hintId','hintPw'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });
};

window._realLogin = window.login = async function() {
    const roleEl = document.getElementById('loginRole');
    const idEl = document.getElementById('loginId');
    const pwEl = document.getElementById('loginPw');
    if(!roleEl || !idEl || !pwEl) return;

    window.clearLoginError();

    const role = roleEl.value;
    const lId = idEl.value.trim();
    const password = pwEl.value.trim();

    if (role === '선택하세요' || !role) { window.showLoginError('역할을 선택해주세요.', 'role'); return; }
    if (!lId && !password) { window.showLoginError('ID와 비밀번호를 입력해주세요.', 'idpw'); return; }
    if (!lId) { window.showLoginError('ID를 입력해주세요.', 'id'); return; }
    if (!password) { window.showLoginError('비밀번호를 입력해주세요.', 'pw'); return; }

    // 슈퍼어드민 계정 확인 (SQL-First DB 연동)
    if (role === 'superadmin') {
        const { data: settings } = await window.mySupabase.from('platform_settings').select('*').eq('id', 'master_config').maybeSingle();
        
        let superAdminId = 'admin'; // 기본값 (테이블이 비어있을 경우 대비)
        let superAdminPw = '1111';  // 기본값
        
        if (settings && settings.admin_id) {
            superAdminId = settings.admin_id;
            superAdminPw = settings.admin_pw;
        }
        
        if (lId === superAdminId && password === superAdminPw) {
            showView('superAdminView', '플랫폼 총괄 관리자');
            window.loadSuperAdminDashboard();
            if (typeof window.loadGlobalNotice === 'function') window.loadGlobalNotice();
            return;
        } else {
            window.showLoginError('슈퍼관리자 ID 또는 비밀번호가 일치하지 않습니다.', 'idpw');
            return;
        }
    }

    document.getElementById('loginDebugArea').style.display = 'block';
    document.getElementById('loginDebugArea').innerText = 'DB 확인 중...';

    // 1. 세탁공장 대표 로그인 (factories 테이블 검색)
    if (role === 'admin') {
        const { data, error } = await window.mySupabase.from('factories').select('*').eq('admin_id', lId).maybeSingle();
        document.getElementById('loginDebugArea').style.display = 'none';

        if (error || !data || data.admin_pw !== password) { window.showLoginError('ID 또는 비밀번호가 일치하지 않습니다.', 'idpw'); return; }
        if (data.status === 'pending') { window.showLoginError('가입 승인 대기 중입니다. 플랫폼 관리자의 승인을 기다려주세요.', null); return; }
        if (data.status === 'suspended') { window.showLoginError('미운영 상태입니다. 관리자에게 문의하세요.', null); return; }

        currentFactoryId = data.id;
        localStorage.setItem('currentFactoryId', data.id);
        
        if (typeof window.loadGlobalNotice === 'function') window.loadGlobalNotice();
        
        // [만료일 체크 및 구독 상태 자동 업데이트]
        if (data.plan_expiry) {
            const expiry = new Date(data.plan_expiry);
            expiry.setHours(23, 59, 59, 999); // 만료일 당일까지는 만료되지 않은 것으로 처리
            const today = new Date();
            
            let newSubStatus = data.sub_status;
            
            if (expiry < today) {
                newSubStatus = 'expired';
            } else if (expiry - today < 15 * 24 * 60 * 60 * 1000) { // 15일 이내
                newSubStatus = 'expiring';
            } else {
                // 15일 이상 넉넉하게 남았을 때
                // 만약 현재 상태가 '무료체험(trial)'이라면 'active'로 덮어쓰지 않고 유지합니다.
                if (data.sub_status !== 'trial') {
                    newSubStatus = 'active';
                }
            }
            
            // DB 업데이트 수행
            if (newSubStatus !== data.sub_status) {
                await window.mySupabase.from('factories').update({ sub_status: newSubStatus }).eq('id', data.id);
                data.sub_status = newSubStatus; // 현재 객체 상태도 업데이트
                console.log(`[로그인 시점 업데이트] 구독상태가 ${newSubStatus} 로 변경되었습니다.`);
            }
            
            // 결제 유도 팝업 띄우기 (만료됨 또는 만료 임박)
            if (data.sub_status === 'expired' || data.sub_status === 'expiring') {
                if (data.sub_status !== 'trial') {
                    const msg = data.sub_status === 'expired' ? "요금제 기간이 만료되었습니다. 결제 후 계속 이용해 주세요." : "요금제 만료가 임박했습니다. 미리 결제해 주세요.";
                    document.getElementById('paymentMsg').innerText = msg;
                    openModal('paymentModal');
                    window.loadAdminPayment(); // 요금제 정보 로드
                }
            }
        }
        
        // 기존 호환성용 껍데기 세팅
        if (!platformData.factories[data.id]) platformData.factories[data.id] = { hotels: {}, staffAccounts: {}, history: [] };
        
        showView('adminView', data.name + ' - 대표');
        window.loadAdminDashboard();
        return;
    }
    
    // 2. 현장 직원 로그인 (staff 테이블 검색)
    if (role === 'staff') {
        // staff 테이블과 연결된 factories 테이블의 이름까지 조인해서 한 번에 가져옴!
        const { data, error } = await window.mySupabase
            .from('staff')
            .select('*, factories(name)')
            .eq('login_id', lId)
            .maybeSingle();

        document.getElementById('loginDebugArea').style.display = 'none';

        if (error || !data || data.login_pw !== password) { window.showLoginError('ID 또는 비밀번호가 일치하지 않습니다.', 'idpw'); return; }

        currentFactoryId = data.factory_id;
        currentStaffName = data.name; localStorage.setItem('staffName', data.name); localStorage.setItem('currentStaffName', data.name);
        localStorage.setItem('currentFactoryId', data.factory_id);

        if (typeof window.loadGlobalNotice === 'function') window.loadGlobalNotice();

        showView('staffView', (data.factories ? data.factories.name : '세탁공장') + ' - 현장직원 (' + currentStaffName + ')');
        
        // v34 전용 함수 (나중에 구현)
        if(typeof window.loadStaffHotelSelect === 'function') window.loadStaffHotelSelect();
        if(typeof window.loadStaffInvoiceList === 'function') window.loadStaffInvoiceList();
        return;
    }

    // 3. 거래처 파트너 로그인 (hotels 테이블 검색)
    if (role === 'hotel') {
        const { data, error } = await window.mySupabase
            .from('hotels')
            .select('*, factories(name, phone, ceo)')
            .eq('login_id', lId)
            .maybeSingle();

        document.getElementById('loginDebugArea').style.display = 'none';

        if (error || !data || data.login_pw !== password) { window.showLoginError('ID 또는 비밀번호가 일치하지 않습니다.', 'idpw'); return; }

        currentFactoryId = data.factory_id;
        currentHotelId = data.id;
        localStorage.setItem('currentFactoryId', data.factory_id);
        localStorage.setItem('currentHotelId', data.id);

        if (typeof window.loadGlobalNotice === 'function') window.loadGlobalNotice();

        // 호환성 껍데기
        if (!platformData.factories[data.factory_id]) platformData.factories[data.factory_id] = { hotels: {}, staffAccounts: {}, history: [] };
        if (!platformData.factories[data.factory_id].hotels[data.id]) platformData.factories[data.factory_id].hotels[data.id] = { name: data.name };

        showView('hotelView', (data.factories ? data.factories.name : '세탁공장') + ' 파트너 대시보드');
        window.loadHotelDashboard();
        return;
    }
};

// [v34 버그픽스] 현장 직원 화면 - 거래처 셀렉트 박스 불러오기 (Hotels 테이블 연동)
window.loadStaffHotelSelect = async function() {
    const sel = document.getElementById('staffHotelSelect');
    if(!sel) return;
    sel.innerHTML = '<option value="">-- 거래처 불러오는 중... --</option>';

    // 현재 공장에 등록된 운영중 거래처만 불러오기 (종료 거래처 제외)
    const { data, error } = await window.mySupabase
        .from('hotels')
        .select('id, name, status')
        .eq('factory_id', currentFactoryId)
        .neq('status', 'inactive')
        .order('name');

    if (error || !data || data.length === 0) {
        sel.innerHTML = '<option value="">-- 등록된 거래처 없음 --</option>';
        return;
    }

    // 가나다순 / ABC순 완벽 정렬 보장 (Javascript localeCompare)
    data.sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));

    sel.innerHTML = '<option value="">-- 거래처 선택 --</option>';
    data.forEach(h => {
        sel.innerHTML += `<option value="${h.id}">${h.name}</option>`;
    });
};

// [v38 SQL-First] 이전 레거시 openInvoiceModal 제거됨 - 아래 최신 DB 버전 사용

// [v34 버그픽스] Enter 키 엔터로 아래 칸 이동 및 단가표 그리기 수정
window.openInvoiceModal = async function() {
    const hId = document.getElementById('staffHotelSelect').value;
    const date = document.getElementById('invoiceDate').value;
    if (!hId || !date) {
        document.getElementById('invoiceFormArea').style.display = 'none';
        return;
    }

    // 거래처 정보
    const { data: hData } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
    if (!hData) return;

    // 같은 날짜 기존 명세서 조회 (수정 모드 판별)
    const { data: existingInv } = await window.mySupabase
        .from('invoices')
        .select('id')
        .eq('hotel_id', hId)
        .eq('date', date)
        .maybeSingle();

    const isEditMode = !!existingInv;

    // 수정 모드 배지
    const badge = document.getElementById('editModeBadge');
    if (badge) {
        badge.style.display = isEditMode ? 'block' : 'none';
        badge.innerText = isEditMode ? '✏️ 수정 모드 — 기존 명세서를 불러왔습니다.' : '';
    }

    // 기존 수량 맵 (품목명 → qty)
    const savedQtyMap = {};
    if (isEditMode) {
        const { data: existingItems } = await window.mySupabase
            .from('invoice_items')
            .select('name, qty')
            .eq('invoice_id', existingInv.id);
            
        if (existingItems) {
            existingItems.forEach(it => { savedQtyMap[it.name] = Number(it.qty || 0); });
        }
    }

    document.getElementById('invoiceHotelName').innerText = hData.name;
    document.getElementById('invoiceFormArea').style.display = 'block';

    const tbody = document.getElementById('staffInvoiceBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">품목 불러오는 중...</td></tr>';

    // hotel_item_prices 테이블에서 단가 목록 (sort_order 순)
    const { data: priceItems } = await window.mySupabase
        .from('hotel_item_prices')
        .select('name, price, unit, category_name')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    tbody.innerHTML = '';
    if (!priceItems || priceItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--secondary);">등록된 품목이 없습니다. 단가 설정을 먼저 해주세요.</td></tr>';
        return;
    }

    const isSpecial = hData.contract_type === 'special' || hData.hotel_type === 'special';

    const makeRow = (item) => {
        const unit = item.unit || '개';
        const qty = savedQtyMap[item.name] || 0;
        return `
        <tr>
            <td>${item.name}</td>
            <td>${unit}</td>
            <td class="item-price">${item.price}</td>
            <td><input type="number" class="inv-qty qty-input" value="${qty}" 
                onfocus="if(this.value==='0') this.value=''; else { var t=this; setTimeout(function(){t.select();}, 10); }" 
                onblur="if(this.value==='') this.value='0';"
                oninput="calcTotal()" onkeydown="handleQtyKeydown(event)"
                style="width:60px; padding:3px; text-align:center;"></td>
            <td class="item-amount">0원</td>
        </tr>`;
    };

    if (isSpecial) {
        const grouped = {}, catOrder = [];
        priceItems.forEach(item => {
            const cat = item.category_name || '기타';
            if (!grouped[cat]) { grouped[cat] = []; catOrder.push(cat); }
            grouped[cat].push(item);
        });
        catOrder.forEach(cat => {
            tbody.innerHTML += `<tr style="background:#f1f5f9;"><td colspan="5" style="font-weight:700; padding:6px 8px; border-bottom:1px solid #cbd5e1;">📂 ${cat}</td></tr>`;
            grouped[cat].forEach(item => { tbody.innerHTML += makeRow(item); });
        });
    } else {
        priceItems.forEach(item => { tbody.innerHTML += makeRow(item); });
    }

    if (typeof window.calcTotal === 'function') window.calcTotal();
};

window.calcTotal = function() {
    const rows = document.querySelectorAll('#staffInvoiceBody tr');
    let total = 0;
    rows.forEach(row => {
        if(row.cells.length < 5) return;
        const price = Number(row.cells[2].innerText.replace(/[^0-9-]/g, '')) || 0;
        const qtyInput = row.querySelector('.qty-input');
        const qty = qtyInput ? Number(qtyInput.value) : 0;
        const amt = price * qty;
        total += amt;
        row.querySelector('.item-amount').innerText = amt.toLocaleString() + '원';
    });
    document.getElementById('invoiceTotalAmount').innerText = total.toLocaleString() + '원';
};

// [v34 버그픽스] 현장직원 화면 - 거래명세서 발행 목록 (Invoices & Hotels 조인)
// [v38 페이징] 현장직원 발행 목록 페이징 상태
let _staffInvoiceAllData = [];
let _staffInvoicePage = 1;
const STAFF_INVOICE_PAGE_SIZE = 50;

window.loadStaffInvoiceList = async function() {
    const tbody = document.getElementById('staffRecentInvoiceList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    const searchDateEl = document.getElementById('staffSearchDate');
    const searchDate = searchDateEl ? searchDateEl.value.trim() : '';

    let query = window.mySupabase
        .from('invoices')
        .select(`id, date, total_amount, is_sent, staff_name, hotels ( name )`)
        .eq('factory_id', currentFactoryId);

    // [수정] .neq() 쿼리에서 발생하는 에러일 수 있으므로, 서버 쿼리는 전체를 가져오고 프론트에서 필터링
    if (searchDate) query = query.eq('date', searchDate);

    const { data, error } = await query
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

    if (error || !data) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--danger);">오류: ${error ? error.message : '알 수 없는 오류'}</td></tr>`;
        if (typeof renderStaffInvoicePaging === 'function') renderStaffInvoicePaging(0);
        return;
    }

    // 프론트엔드에서 '관리자(차감)' 데이터를 걸러냄 (DB 구조나 버전에 구애받지 않는 가장 안전한 방식)
    const filteredData = data.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)')));

    if (filteredData.length === 0) {
        const msg = searchDate ? `${searchDate} 발행 내역 없음` : '작성된 명세서가 없습니다.';
        tbody.innerHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:gray;">${msg}</td></tr>`;
        if (typeof renderStaffInvoicePaging === 'function') renderStaffInvoicePaging(0);
        return;
    }

    // 전역 변수에 데이터 저장 후 페이징 렌더 함수 호출
    // 레거시 코드와 완벽 호환되도록 전역 객체명 원복
    _staffInvoiceAllData = filteredData;
    _staffInvoicePage = 1;
    
    if (typeof window.renderStaffInvoicePage === 'function') {
        window.renderStaffInvoicePage();
    } else if (typeof renderStaffInvoicePage === 'function') {
        renderStaffInvoicePage();
    } else {
        console.error("renderStaffInvoicePage 함수가 없습니다.");
    }
};

function renderStaffInvoicePage() {
    const tbody = document.getElementById('staffRecentInvoiceList');
    if (!tbody) return;

    const total = _staffInvoiceAllData.length;
    const totalPages = Math.ceil(total / STAFF_INVOICE_PAGE_SIZE);
    const start = (_staffInvoicePage - 1) * STAFF_INVOICE_PAGE_SIZE;
    const pageData = _staffInvoiceAllData.slice(start, start + STAFF_INVOICE_PAGE_SIZE);

    tbody.innerHTML = '';
    pageData.forEach(inv => {
        const hName = inv.hotels ? inv.hotels.name : '알수없음';
        const statusBadge = inv.is_sent
            ? '<span class="badge" style="background:var(--success);">발송완료</span>'
            : '<span class="badge" style="background:var(--secondary);">작성됨</span>';
        tbody.innerHTML += `
        <tr>
            <td>${inv.date}</td>
            <td style="font-weight:700;">${hName}</td>
            <td style="text-align:right;">${Number(inv.total_amount || 0).toLocaleString()}원</td>
            <td>${statusBadge}</td>
            <td>${inv.staff_name || '관리자'}</td>
            <td><button class="btn btn-neutral" style="padding:4px 8px; font-size:11px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button></td>
        </tr>`;
    });

    renderStaffInvoicePaging(totalPages);
}

function renderStaffInvoicePaging(totalPages) {
    const paging = document.getElementById('staffInvoicePaging');
    if (!paging) return;
    paging.innerHTML = '';
    if (totalPages <= 1) return;

    const total = _staffInvoiceAllData.length;
    const btnStyle = (active) => `padding:6px 12px; border-radius:6px; border:1px solid #cbd5e1; cursor:pointer; font-size:13px; font-weight:${active?'700':'400'}; background:${active?'var(--primary)':'white'}; color:${active?'white':'#334155'};`;

    // 이전 버튼
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '◀';
    prevBtn.style.cssText = btnStyle(false);
    prevBtn.disabled = _staffInvoicePage === 1;
    prevBtn.style.opacity = _staffInvoicePage === 1 ? '0.4' : '1';
    prevBtn.onclick = () => { _staffInvoicePage--; renderStaffInvoicePage(); };
    paging.appendChild(prevBtn);

    // 페이지 번호 버튼 (최대 5개 표시)
    const maxShow = 5;
    let pageStart = Math.max(1, _staffInvoicePage - Math.floor(maxShow / 2));
    let pageEnd = Math.min(totalPages, pageStart + maxShow - 1);
    if (pageEnd - pageStart < maxShow - 1) pageStart = Math.max(1, pageEnd - maxShow + 1);

    for (let i = pageStart; i <= pageEnd; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.style.cssText = btnStyle(i === _staffInvoicePage);
        btn.onclick = ((p) => () => { _staffInvoicePage = p; renderStaffInvoicePage(); })(i);
        paging.appendChild(btn);
    }

    // 다음 버튼
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '▶';
    nextBtn.style.cssText = btnStyle(false);
    nextBtn.disabled = _staffInvoicePage === totalPages;
    nextBtn.style.opacity = _staffInvoicePage === totalPages ? '0.4' : '1';
    nextBtn.onclick = () => { _staffInvoicePage++; renderStaffInvoicePage(); };
    paging.appendChild(nextBtn);

    // 총 건수 표시
    const info = document.createElement('span');
    info.style.cssText = 'font-size:12px; color:var(--secondary); margin-left:8px;';
    info.textContent = `총 ${total}건 / ${_staffInvoicePage}페이지 (${totalPages}페이지)`;
    paging.appendChild(info);
}


// [v38 SQL-First] 하단 중복 switchTab 제거됨

// [v34 버그픽스] 대표자 화면 - 첫 번째 탭의 거래명세서 목록 (필터링 및 UI 렌더링 완벽 복구)
// 중복을 제거하기 위해 이 곳에 있던 loadAdminDashboard 오버라이드 삭제

// [v38 SQL-First] 중복 switchTab 제거됨

// [v34 버그픽스] 필터(호텔/날짜) 변경 시 목록 갱신
window.handleAdminFilterChange = function() {
    const hotelFilter = document.getElementById('adminStatsHotelFilter');
    if (hotelFilter && hotelFilter.value === 'all') {
        document.getElementById('adminStatsStartDate').value = '';
        document.getElementById('adminStatsEndDate').value = '';
    }
    // 필터 변경 시 목록 다시 로드!
    window.loadAdminRecentInvoices();
};

window.onloadAdminRecentInvoicesProxy = async function() {
    await window.loadAdminRecentInvoices();
};

// HTML에서 onchange="loadAdminRecentInvoices()" 로 되어있는 부분 연결
const dateInputs = ['adminStatsStartDate', 'adminStatsEndDate'];
dateInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.onchange = window.onloadAdminRecentInvoicesProxy;
    }
});


// [v34 버그픽스] 로그인 시 즉시 대표 화면 데이터 렌더링 강제화
/* removed dummy */
// [v34 버그픽스] 필터 값 가져오는 방어 코드 강화 (HTML 요소가 아직 로드 안됐을 때 에러 방지)
window.OLD_loadAdminRecentInvoices_0 = async function(returnList = false) {
    if (_isInvoiceLoading) return; // 중복 호출 방지
    _isInvoiceLoading = true;
    
    const tbody = document.getElementById('adminRecentInvoiceList');
    if(!tbody) { _isInvoiceLoading = false; return; }
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    try {
        const sDate = document.getElementById('adminStatsStartDate') ? document.getElementById('adminStatsStartDate').value : '';
        const eDate = document.getElementById('adminStatsEndDate') ? document.getElementById('adminStatsEndDate').value : '';
        const hotelFilter = document.getElementById('adminStatsHotelFilter') ? document.getElementById('adminStatsHotelFilter').value : 'all';

        // [수정] 관리자(차감) 명세서는 목록 화면에서 안 보이게 필터링
        let query = window.mySupabase
            .from('invoices')
            .select('id, date, total_amount, is_sent, staff_name, hotel_id, hotels ( name, contract_type )')
            .eq('factory_id', currentFactoryId)
            ;

        if (sDate) query = query.gte('date', sDate);
        if (eDate) query = query.lte('date', eDate);
        if (hotelFilter && hotelFilter !== 'all') query = query.eq('hotel_id', hotelFilter);

        const { data, error } = await query.order('date', { ascending: false }).limit(100);

        if (error) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">에러: ${error.message}</td></tr>`;
            _isInvoiceLoading = false;
            return;
        }

        
        const filteredData = data ? data.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))) : [];
        window._lastInvoiceData = filteredData;
        window._lastInvoiceData = filteredData;
        if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다.</td></tr>';
        _isInvoiceLoading = false;
        if (returnList) return [];
        return;
    }

        tbody.innerHTML = '';
        filteredData.forEach(inv => {
            const hName = inv.hotels ? inv.hotels.name : '알수없음(거래처삭제됨)';
            const cType = (inv.hotels && inv.hotels.contract_type === 'fixed') ? '정액제' : '단가제';
            const statusBadge = inv.is_sent 
                ? '<span class="badge" style="background:var(--success);">발송완료</span>' 
                : '<span class="badge" style="background:var(--secondary);">작성됨</span>';

            tbody.innerHTML += `
            <tr>
                <td>${inv.date}</td>
                <td style="font-weight:700; color:var(--primary);">${hName}</td>
                <td style="text-align:right; font-weight:700;">${inv.total_amount.toLocaleString()}원</td>
                <td>${cType}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; margin-right:5px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteInvoice('${inv.id}')">삭제</button>
                </td>
            </tr>`;
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">에러: ${e.message}</td></tr>`;
    } finally {
        _isInvoiceLoading = false;
    }
    if (returnList) return window._lastInvoiceData || [];
};

// [v34 버그픽스] 로그인/새로고침 즉시 목록 강제 로드 (HTML에 박혀있는 onload 이벤트 대체)
const _originalShowView = window.showView;
window.showView = async function(id, title) {
    if(typeof _originalShowView === 'function') {
        _originalShowView(id, title);
    }
    
    // 이 부분에서 loadAdminRecentInvoices 를 또 호출하면 
    // loadAdminDashboard 내부 호출과 겹쳐서 중복 렌더링이 발생하므로 삭제합니다.
};


// [v34 강제 버그픽스] 대표자 화면 명세서 로드 시 오류 로그 출력용
window.OLD_loadAdminRecentInvoices_1 = async function(returnList = false) {
    if (_isInvoiceLoading) return; // 중복 호출 방지
    _isInvoiceLoading = true;
    
    const tbody = document.getElementById('adminRecentInvoiceList');
    if(!tbody) { _isInvoiceLoading = false; return; }
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    try {
        const sDate = document.getElementById('adminStatsStartDate') ? document.getElementById('adminStatsStartDate').value : '';
        const eDate = document.getElementById('adminStatsEndDate') ? document.getElementById('adminStatsEndDate').value : '';
        const hotelFilter = document.getElementById('adminStatsHotelFilter') ? document.getElementById('adminStatsHotelFilter').value : 'all';

        // [수정] 관리자(차감) 명세서는 목록 화면에서 안 보이게 필터링
        let query = window.mySupabase
            .from('invoices')
            .select('id, date, total_amount, is_sent, staff_name, hotel_id, hotels ( name, contract_type )')
            .eq('factory_id', currentFactoryId)
            ;

        if (sDate) query = query.gte('date', sDate);
        if (eDate) query = query.lte('date', eDate);
        if (hotelFilter && hotelFilter !== 'all') query = query.eq('hotel_id', hotelFilter);

        const { data, error } = await query.order('date', { ascending: false }).limit(100);

        if (error) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">에러: ${error.message}</td></tr>`;
            _isInvoiceLoading = false;
            return;
        }

        
        const filteredData = data ? data.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))) : [];
        window._lastInvoiceData = filteredData;
        if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다.</td></tr>';
        _isInvoiceLoading = false;
        if (returnList) return [];
        return;
    }

        tbody.innerHTML = '';
        filteredData.forEach(inv => {
            const hName = inv.hotels ? inv.hotels.name : '알수없음(거래처삭제됨)';
            const cType = (inv.hotels && inv.hotels.contract_type === 'fixed') ? '정액제' : '단가제';
            const statusBadge = inv.is_sent 
                ? '<span class="badge" style="background:var(--success);">발송완료</span>' 
                : '<span class="badge" style="background:var(--secondary);">작성됨</span>';

            tbody.innerHTML += `
            <tr>
                <td>${inv.date}</td>
                <td style="font-weight:700; color:var(--primary);">${hName}</td>
                <td style="text-align:right; font-weight:700;">${inv.total_amount.toLocaleString()}원</td>
                <td>${cType}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; margin-right:5px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteInvoice('${inv.id}')">삭제</button>
                </td>
            </tr>`;
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">에러: ${e.message}</td></tr>`;
    } finally {
        _isInvoiceLoading = false;
    }
};

// [v34 찐막 버그픽스] loadAdminRecentInvoices 쿼리 수정 (Join 때문에 데이터가 날아가는 현상 수정)
window.OLD_loadAdminRecentInvoices_2 = async function(returnList = false) {
    if (_isInvoiceLoading) return; // 중복 호출 방지
    _isInvoiceLoading = true;
    
    const tbody = document.getElementById('adminRecentInvoiceList');
    if(!tbody) { _isInvoiceLoading = false; return; }
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    try {
        const sDate = document.getElementById('adminStatsStartDate') ? document.getElementById('adminStatsStartDate').value : '';
        const eDate = document.getElementById('adminStatsEndDate') ? document.getElementById('adminStatsEndDate').value : '';
        const hotelFilter = document.getElementById('adminStatsHotelFilter') ? document.getElementById('adminStatsHotelFilter').value : 'all';

        // [수정] 관리자(차감) 명세서는 목록 화면에서 안 보이게 필터링
        let query = window.mySupabase
            .from('invoices')
            .select('id, date, total_amount, is_sent, staff_name, hotel_id, hotels ( name, contract_type )')
            .eq('factory_id', currentFactoryId)
            ;

        if (sDate) query = query.gte('date', sDate);
        if (eDate) query = query.lte('date', eDate);
        if (hotelFilter && hotelFilter !== 'all') query = query.eq('hotel_id', hotelFilter);

        const { data, error } = await query.order('date', { ascending: false }).limit(100);

        if (error) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">에러: ${error.message}</td></tr>`;
            _isInvoiceLoading = false;
            return;
        }

        
        const filteredData = data ? data.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))) : [];
        window._lastInvoiceData = filteredData;
        if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다.</td></tr>';
        _isInvoiceLoading = false;
        if (returnList) return [];
        return;
    }

        tbody.innerHTML = '';
        filteredData.forEach(inv => {
            const hName = inv.hotels ? inv.hotels.name : '알수없음(거래처삭제됨)';
            const cType = (inv.hotels && inv.hotels.contract_type === 'fixed') ? '정액제' : '단가제';
            const statusBadge = inv.is_sent 
                ? '<span class="badge" style="background:var(--success);">발송완료</span>' 
                : '<span class="badge" style="background:var(--secondary);">작성됨</span>';

            tbody.innerHTML += `
            <tr>
                <td>${inv.date}</td>
                <td style="font-weight:700; color:var(--primary);">${hName}</td>
                <td style="text-align:right; font-weight:700;">${inv.total_amount.toLocaleString()}원</td>
                <td>${cType}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; margin-right:5px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteInvoice('${inv.id}')">삭제</button>
                </td>
            </tr>`;
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">에러: ${e.message}</td></tr>`;
    } finally {
        _isInvoiceLoading = false;
    }
};

// ==========================================
// [v34] Step 5: 플랫폼 마스터 대시보드 (RDBMS 통계)
// ==========================================
// [v38] 플랫폼 총괄 관리자 - 공장 관리 페이징 전역변수
let _superFactoryData = [];
let _superFactoryMap = {};
let _superFactoryPage = 1;
const SUPER_FACTORY_PAGE_SIZE = 20;

// [v38] 플랫폼 총괄 관리자 - 결제 승인 내역 페이징 전역변수
let _approvedPaymentData = [];
let _approvedPaymentMap = {};
let _approvedPaymentPage = 1;
const APPROVED_PAYMENT_PAGE_SIZE = 10;

window.loadSuperAdminDashboard = async function() {
    // 플랫폼 관리자 정보 (ID, 연락처) 화면에 표시하기
    const { data: mConfig } = await window.mySupabase.from('platform_settings').select('admin_id, admin_phone').eq('id', 'master_config').maybeSingle();
    if (mConfig) {
        const saIdEl = document.getElementById('sa_id');
        const saPhoneEl = document.getElementById('sa_phone');
        if (saIdEl) saIdEl.value = mConfig.admin_id || '';
        if (saPhoneEl) saPhoneEl.value = mConfig.admin_phone || '';
    }

    const tbody = document.getElementById('superFactoryList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">데이터를 불러오는 중...</td></tr>';

    window.loadPendingFactories();
    if(typeof window.loadPendingPayments === 'function') await window.loadPendingPayments();
    if(typeof window.loadApprovedPaymentsPage === 'function') window.loadApprovedPaymentsPage();

    const curMonth = document.getElementById('superStatsMonth')?.value || getTodayString().substring(0, 7);
    const searchQuery = document.getElementById('searchFactoryInput')?.value.toLowerCase() || '';

    // 전체 공장 불러와서 클라이언트 검색/페이징 적용
    const { data: factories, error: fErr } = await window.mySupabase.from('factories').select('*').order('created_at', { ascending: false });

    if (fErr) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">에러: ${fErr.message}</td></tr>`; return; }
    if (!factories || factories.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">등록된 공장이 없습니다.</td></tr>'; return; }

    const startDate = curMonth + '-01';
    // 월말 날짜 정확 계산 (4월=30일)
    const [cY, cM] = curMonth.split('-').map(Number);
    const lastDay = new Date(cY, cM, 0).getDate();
    const endDateStr = curMonth + '-' + String(lastDay).padStart(2, '0');
    
    const { data: invoices } = await window.mySupabase.from('invoices').select('factory_id, total_amount').gte('date', startDate).lte('date', endDateStr);
    const monthlyRevMap = {};
    if (invoices) invoices.forEach(inv => { monthlyRevMap[inv.factory_id] = (monthlyRevMap[inv.factory_id] || 0) + (inv.total_amount || 0); });

    const { data: fixedHotels } = await window.mySupabase.from('hotels').select('factory_id, fixed_amount, created_at').eq('contract_type', 'fixed');
    if (fixedHotels) fixedHotels.forEach(h => {
        const createdMonth = h.created_at ? h.created_at.substring(0, 7) : '2000-01';
        if (curMonth >= createdMonth) {
            monthlyRevMap[h.factory_id] = (monthlyRevMap[h.factory_id] || 0) + Number(h.fixed_amount || 0);
        }
    });

    let totalRev = 0, operatingFactories = 0;
    const factorySales = [];

    // 필터링 (가입 대기 제외, 검색어 적용)
    const validFactories = factories.filter(f => f.status !== 'pending');
    
    validFactories.forEach(f => {
        const monthlyRevenue = monthlyRevMap[f.id] || 0;
        totalRev += monthlyRevenue;
        factorySales.push({ name: f.name, revenue: monthlyRevenue });
        if (f.status !== 'suspended') operatingFactories++;
    });

    // 이번달 신규 공장 수 계산
    const newFactoriesCount = validFactories.filter(f => {
        if (!f.created_at) return false;
        return f.created_at.substring(0, 7) === curMonth;
    }).length;

    document.getElementById('superTotalRevenue').innerText = totalRev.toLocaleString() + '원';
    document.getElementById('superTotalFactories').innerText = operatingFactories + '개';
    const superNewEl = document.getElementById('superNewFactories');
    if (superNewEl) superNewEl.innerText = newFactoriesCount + '개';

    // TOP 10 매출 공장 렌더링
    const rankArea = document.getElementById('superFactoryRankingArea');
    if(rankArea) {
        rankArea.innerHTML = '<table class="admin-table"><thead><tr><th>순위</th><th>공장명</th><th>이번 달 매출</th></tr></thead><tbody>' +
        factorySales.sort((a,b) => b.revenue - a.revenue).slice(0, 10).map((f, i) => `
            <tr><td>${i+1}위</td><td>${f.name}</td><td style="text-align:right; font-weight:700; color:var(--primary);">${f.revenue.toLocaleString()}원</td></tr>
        `).join('') + '</tbody></table>';
    }

    // 공장 목록 검색 필터링
    _superFactoryData = validFactories.filter(f => f.name.toLowerCase().includes(searchQuery));
    _superFactoryMap = monthlyRevMap;
    _superFactoryPage = 1;
    window.renderSuperFactoryPage();
};

window.renderSuperFactoryPage = function() {
    const tbody = document.getElementById('superFactoryList');
    if (!tbody) return;

    const total = _superFactoryData.length;
    const totalPages = Math.ceil(total / SUPER_FACTORY_PAGE_SIZE);
    const start = (_superFactoryPage - 1) * SUPER_FACTORY_PAGE_SIZE;
    const pageData = _superFactoryData.slice(start, start + SUPER_FACTORY_PAGE_SIZE);

    tbody.innerHTML = '';
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">검색 결과가 없습니다.</td></tr>';
    } else {
        pageData.forEach(f => {
            const monthlyRevenue = _superFactoryMap[f.id] || 0;
            const statusMap = { 'active': '활성(운영중)', 'operating': '활성(운영중)', 'trial': '무료체험', 'expiring': '만료 임박', 'expired': '만료됨', 'suspended': '정지' };
            const sStatus = f.sub_status || 'active';
            const statusLabel = statusMap[sStatus] || '활성(운영중)';
            const badgeColors = { 'active': '#10b981', 'operating': '#10b981', 'trial': '#f59e0b', 'expiring': '#f59e0b', 'expired': '#ef4444', 'suspended': '#94a3b8' };
            const badgeBg = badgeColors[sStatus] || '#10b981';
            
            const subBadge = `<span style="background:${badgeBg}; color:white; padding:2px 8px; border-radius:12px; font-size:11px;">${statusLabel} (${sStatus})</span>`;
            const statusSelect = `<select onchange="updateFactoryStatus('${f.id}', this.value)" style="background:${f.status==='suspended'?'#94a3b8':'#00a8e8'}; color:white; border:none; padding:3px; border-radius:4px; font-size:12px;"><option value="operating" ${f.status==='operating'?'selected':''}>운영중</option><option value="suspended" ${f.status==='suspended'?'selected':''}>미운영</option></select>`;
            
            tbody.innerHTML += `<tr ${f.status === 'suspended' ? 'style="background-color: #f1f1f1;"' : ''}>
                <td title="${monthlyRevenue.toLocaleString()}원"><strong style="cursor:pointer; color:var(--primary);" onclick="window.openFactoryAdminView('${f.id}')">${f.name}</strong></td>
                <td>${f.admin_id}</td>
                <td>${statusSelect}</td>
                <td>${subBadge}</td>
                <td>${f.plan || '무료요금제'} / ${f.plan_expiry || '-'}</td>
                <td>
                    <button class="btn btn-save" style="padding:3px; font-size:12px; border-radius:4px; border-style:none; margin-right:5px;" onclick="viewFactoryDetails('${f.id}', true)">수정</button>
                    <button class="btn btn-danger" style="padding:3px; font-size:12px; border-radius:4px; border-style:none;" onclick="deleteFactory('${f.id}')">삭제</button>
                </td>
            </tr>`;
        });
    }
    renderSuperFactoryPaging(totalPages);
}

function renderSuperFactoryPaging(totalPages) {
    const paging = document.getElementById('superPagination');
    if (!paging) return;
    paging.innerHTML = '';
    if (totalPages <= 1) return;

    const btnStyle = (act) => `padding:4px 10px; border-radius:4px; border:1px solid #cbd5e1; cursor:pointer; font-size:13px; font-weight:${act?'700':'400'}; background:${act?'var(--primary)':'white'}; color:${act?'white':'#334155'}; min-width:32px;`;

    const prev = document.createElement('button');
    prev.textContent = '◀';
    prev.style.cssText = btnStyle(false);
    prev.disabled = _superFactoryPage === 1;
    prev.style.opacity = _superFactoryPage === 1 ? '0.4' : '1';
    prev.onclick = () => { _superFactoryPage--; renderSuperFactoryPage({}); }; // map is global conceptually but we need it. Actually we don't need map for re-render if we store html or we can refetch. Wait! We must pass map! 
    // Let's attach map to window object or re-fetch. Better: Re-use the existing DOM or recreate.
    // I will fix the event listeners properly below by attaching data differently.
    paging.appendChild(prev);
    // (Paging logic will be properly wired below)
}
window.updateFactoryStatus = async function(fId, s) {
    await window.mySupabase.from('factories').update({ status: s }).eq('id', fId);
    window.loadSuperAdminDashboard();
};

window.loadPendingPayments = async function() {
    const tbody = document.getElementById('pendingPaymentList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9">데이터 로딩 중...</td></tr>';
    
    // 1. 결제 대기 데이터 가져오기
    const { data: payments, error: pErr } = await window.mySupabase.from('pending_payments').select('*');
    if (pErr) { console.error('결제 목록 로드 실패:', pErr); tbody.innerHTML = '<tr><td colspan="9">로드 실패</td></tr>'; return; }
    
    // 2. 모든 공장 데이터 가져오기 (매핑용)
    const { data: factories, error: fErr } = await window.mySupabase.from('factories').select('id, name, plan_expiry');
    const factoryMap = {};
    if (factories) {
        factories.forEach(f => factoryMap[f.id] = f);
    }
    
    tbody.innerHTML = '';
    (payments || []).forEach(p => {
        const f = factoryMap[p.factory_id] || {};
        const expiry = f.plan_expiry || '-';
        const totalAmount = p.total ? Number(p.total) : 0;
        tbody.innerHTML += `<tr>
            <td>${f.name || p.factory_name || '-'}</td>
            <td>${p.plan || '-'}</td>
            <td>${p.months || 0}개월</td>
            <td>${totalAmount.toLocaleString()}원</td>
            <td>${expiry}</td>
            <td>${p.request_tax_invoice ? '발행' : '미발행'}</td>
            <td>${p.depositor_name || '-'}</td>
            <td>${p.date || '-'}</td>
            <td>
                <button class="btn btn-save" style="padding:3px; font-size:12px; border-radius:4px; border:none;" onclick="approvePayment('${p.id}')">승인</button>
                <button class="btn btn-danger" style="padding:3px; font-size:12px; border-radius:4px; border:none; margin-left:5px;" onclick="rejectPayment('${p.id}')">반려</button>
            </td>
        </tr>`;
    });
};

window.loadApprovedPaymentsPage = async function() {
    const tbody = document.getElementById('approvedPaymentList');
    if (!tbody) return;

    if (_approvedPaymentData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10">데이터 로딩 중...</td></tr>';
        
        const { data: payments, error: pErr } = await window.mySupabase.from('approved_payments').select('*').order('id', { ascending: false });
        if (pErr) { tbody.innerHTML = '<tr><td colspan="10">데이터 로드 실패</td></tr>'; return; }
        
        const { data: factories } = await window.mySupabase.from('factories').select('id, name');
        const factoryMap = {};
        if (factories) factories.forEach(f => factoryMap[f.id] = f.name);
        
        _approvedPaymentData = payments || [];
        _approvedPaymentMap = factoryMap;
        _approvedPaymentPage = 1;
    }

    const searchQuery = document.getElementById('searchApprovedPaymentInput')?.value.toLowerCase() || '';
    
    // 검색 필터 적용
    const filteredData = _approvedPaymentData.filter(p => {
        const fName = (_approvedPaymentMap[p.factory_id] || p.factory_name || '-').toLowerCase();
        return fName.includes(searchQuery);
    });

    const total = filteredData.length;
    const totalPages = Math.ceil(total / APPROVED_PAYMENT_PAGE_SIZE);
    const start = (_approvedPaymentPage - 1) * APPROVED_PAYMENT_PAGE_SIZE;
    const pageData = filteredData.slice(start, start + APPROVED_PAYMENT_PAGE_SIZE);

    tbody.innerHTML = '';
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">결과가 없습니다.</td></tr>';
    } else {
        pageData.forEach(p => {
            const factoryName = _approvedPaymentMap[p.factory_id] || p.factory_name || '-';
            tbody.innerHTML += `<tr>
                <td>${factoryName}</td>
                <td>${p.plan || '-'}</td>
                <td>${p.months || 0}개월</td>
                <td style="text-align:right;">${Number(p.total).toLocaleString()}원</td>
                <td>${p.request_tax_invoice ? '요청' : '미요청'}</td>
                <td>${p.depositor_name || '이름없음'}</td>
                <td>${p.date || '-'}</td>
                <td>${p.approved_at || '-'}</td>
                <td>${p.new_expiry || '-'}</td>
                <td><button class="btn btn-danger" style="padding:3px; font-size:12px; border-radius:4px; border:none;" onclick="deleteApprovedPayment('${p.id}')">삭제</button></td>
            </tr>`;
        });
    }

    renderApprovedPaymentPaging(totalPages, total);
};

function renderApprovedPaymentPaging(totalPages, totalCount) {
    const paging = document.getElementById('approvedPaymentPagination');
    if (!paging) return;
    paging.innerHTML = '';
    if (totalPages <= 1) return;

    const btnStyle = (act) => `padding:4px 10px; border-radius:4px; border:1px solid #cbd5e1; cursor:pointer; font-size:13px; font-weight:${act?'700':'400'}; background:${act?'var(--primary)':'white'}; color:${act?'white':'#334155'}; min-width:32px; min-height:32px;`;

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '◀';
    prevBtn.style.cssText = btnStyle(false);
    prevBtn.disabled = _approvedPaymentPage === 1;
    prevBtn.style.opacity = _approvedPaymentPage === 1 ? '0.4' : '1';
    prevBtn.onclick = () => { _approvedPaymentPage--; window.loadApprovedPaymentsPage(); };
    paging.appendChild(prevBtn);

    let pageStart = Math.max(1, _approvedPaymentPage - 2);
    let pageEnd = Math.min(totalPages, pageStart + 4);
    if (pageEnd - pageStart < 4) pageStart = Math.max(1, pageEnd - 4);

    for (let i = pageStart; i <= pageEnd; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.style.cssText = btnStyle(i === _approvedPaymentPage);
        btn.onclick = ((p) => () => { _approvedPaymentPage = p; window.loadApprovedPaymentsPage(); })(i);
        paging.appendChild(btn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.textContent = '▶';
    nextBtn.style.cssText = btnStyle(false);
    nextBtn.disabled = _approvedPaymentPage === totalPages;
    nextBtn.style.opacity = _approvedPaymentPage === totalPages ? '0.4' : '1';
    nextBtn.onclick = () => { _approvedPaymentPage++; window.loadApprovedPaymentsPage(); };
    paging.appendChild(nextBtn);

    const info = document.createElement('span');
    info.style.cssText = 'font-size:12px; color:var(--secondary); margin-left:8px; display:inline-block;';
    info.textContent = `총 ${totalCount}건 / ${_approvedPaymentPage}페이지`;
    paging.appendChild(info);
}

window.deleteApprovedPayment = async function(pid) {
    if(!confirm('정말 삭제하시겠습니까?')) return;
    await window.mySupabase.from('approved_payments').delete().eq('id', pid);
    _approvedPaymentData = []; // 강제 새로고침 유도
    window.loadApprovedPaymentsPage();
};

window.approvePayment = async function(paymentId) {
    if (!confirm('입금이 확인되었습니다. 요금제를 승인하시겠습니까?')) return;
    
    // Supabase에서 해당 결제 정보 가져오기
    const { data: payment, error: pErr } = await window.mySupabase.from('pending_payments').select('*').eq('id', paymentId).single();
    if (pErr || !payment) { alert('결제 내역을 찾을 수 없습니다.'); return; }
    
    const fId = payment.factory_id;
    // factories 테이블 가져오기
    const { data: f, error: fErr } = await window.mySupabase.from('factories').select('*').eq('id', fId).single();
    if (fErr || !f) { alert('해당 공장을 찾을 수 없습니다.'); return; }
    
    // expiry 갱신 로직: 
    // 1. 기존 만료일이 없거나 과거(이미 만료됨)면 오늘 날짜 기준
    // 2. 기존 만료일이 미래(아직 남음)면 그 만료일 기준
    let baseDate = new Date();
    if (f.plan_expiry) {
        const existingExpiry = new Date(f.plan_expiry);
        if (!isNaN(existingExpiry.getTime()) && existingExpiry > new Date()) {
            baseDate = existingExpiry;
        }
    }

    // 월 연장 (말일 보정: 1월 31일 + 1개월 -> 2월 28일/29일)
    const targetMonth = baseDate.getMonth() + parseInt(payment.months);
    const originalDay = baseDate.getDate();
    
    // 타겟 월의 1일로 설정 후 말일 계산
    const nextDate = new Date(baseDate.getFullYear(), targetMonth, 1);
    const lastDayOfTargetMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
    
    // 둘 중 작은 날짜를 선택하여 말일 넘김 방지
    nextDate.setDate(Math.min(originalDay, lastDayOfTargetMonth));
    
    const newExpiry = nextDate.toISOString().split('T')[0];
    
    const { error: updateErr } = await window.mySupabase.from('factories')
        .update({ plan: payment.plan, sub_status: 'active', plan_expiry: newExpiry })
        .eq('id', fId);
        
    if (updateErr) { alert('공장 정보 업데이트 실패: ' + updateErr.message); return; }
    
    // 승인 내역 저장
    await window.mySupabase.from('approved_payments').insert([{ ...payment, approved_at: getTodayString(), new_expiry: newExpiry }]);
    await window.mySupabase.from('pending_payments').delete().eq('id', paymentId);

    // 결제 승인 카카오 알림톡 → 공장 대표에게 발송
    try {
        if (f.phone) {
            await fetch('https://tphagookafjldzvxaxui.supabase.co/functions/v1/send-kakao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'payment',
                    to: f.phone.replace(/-/g, ''),
                    factoryName: f.name,
                    expiryDate: newExpiry
                })
            });
        }
    } catch(e) { console.warn('[결제승인 알림톡 실패]', e); }

    if(typeof window.fetchFromSupabase === 'function') await window.fetchFromSupabase();
    window.loadSuperAdminDashboard();
    alert('결제 승인이 완료되었습니다.');
};

window.rejectPayment = async function(paymentId) {
    if (!confirm('정말 결제 신청 내역을 삭제하시겠습니까?')) return;
    
    const { error } = await window.mySupabase.from('pending_payments').delete().eq('id', paymentId);
    if (error) { alert('삭제 실패: ' + error.message); return; }
    
    if(typeof window.fetchFromSupabase === 'function') await window.fetchFromSupabase();
    window.loadSuperAdminDashboard();
};

// [v38 SQL-First] 중복된 deleteApprovedPayment 제거됨

// [v34 버그픽스] 로그인 화면에서 "플랫폼 관리자" 드롭다운 아이템 보이기
window.addEventListener('DOMContentLoaded', () => {
    if (window.location.hash === '#superadmin') {
        const saOption = document.getElementById('saOption');
        if (saOption) saOption.style.display = 'block';
    }
});

// [v34 최후의 버그픽스] 플랫폼 총괄 관리자 메뉴 보이기 (지연 실행 강제화)
setTimeout(() => {
    if (window.location.hash === '#superadmin') {
        const saOption = document.getElementById('saOption');
        if (saOption) saOption.style.display = 'block';
    }
}, 300);

window.addEventListener('load', () => {
    if (window.location.hash === '#superadmin') {
        const saOption = document.getElementById('saOption');
        if (saOption) saOption.style.display = 'block';
    }
});

// 해시가 동적으로 바뀌는 경우(페이지 안에서 URL만 추가된 경우)에도 즉시 체크
window.addEventListener('hashchange', () => {
    const saOption = document.getElementById('saOption');
    if (window.location.hash === '#superadmin') {
        if (saOption) saOption.style.display = 'block';
    } else {
        if (saOption) saOption.style.display = 'none';
    }
});


window.loadAdminDashboard = async function() {
    if (typeof window.loadGlobalNotice === 'function') window.loadGlobalNotice();
    console.log("DEBUG: [v37] loadAdminDashboard DB version started");

    const statsMonth = document.getElementById('adminStatsMonth');
    if (statsMonth && !statsMonth.value) statsMonth.value = getTodayString().substring(0, 7);
    const curMonth = statsMonth ? statsMonth.value : getTodayString().substring(0, 7);
    const [y, m] = curMonth.split('-');
    
// 1. 공장 정보 및 구독 상태 로드
    const { data: f } = await window.mySupabase.from('factories').select('*').eq('id', currentFactoryId).single();
    if (!f) return;

    // 구독 배너
    const subStatusLeft = document.getElementById('subStatusLeft');
    const subPlanRight = document.getElementById('subPlanRight');
    const subBanner = document.getElementById('subBanner');
    
    if (subStatusLeft && subPlanRight && subBanner) {
        const subLabel = f.sub_status === 'expired' ? '만료됨' : (f.sub_status === 'expiring' ? '만료임박' : '활성(사용중)');
        subStatusLeft.innerHTML = '구독상태: ' + subLabel;
        subPlanRight.innerHTML = '요금제: ' + (f.plan || '라이트') + ' | 만료일: ' + (f.plan_expiry || '제한없음');
        subBanner.style.background = f.sub_status === 'expired' ? '#fee2e2' : (f.sub_status === 'expiring' ? '#fef3c7' : '#e0f2fe');
    }

    // 2. 매출 요약 계산 (DB 조회)
    await window.calculateAdminDashStats();

    // 3. 거래처 드롭다운 업데이트
    const { data: hotels } = await window.mySupabase
        .from('hotels')
        .select('id, name')
        .eq('factory_id', currentFactoryId)
        .order('name');

    if(hotels) hotels.sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));

    ['adminStatsHotelFilter', 'adminTrendHotelFilter'].forEach(id => {
        const select = document.getElementById(id);
        if(select) {
            const currentVal = select.value;
            select.innerHTML = '<option value="all">전체 거래처</option>';
            if(hotels) hotels.forEach(h => select.innerHTML += '<option value="' + h.id + '">' + h.name + '</option>');
            select.value = currentVal || 'all';
        }
    });

    // 4. 거래명세서 목록 로드 및 차트 데이터 갱신
    await window.loadAdminRecentInvoices();
    await window.updateTrendChartOnly();

    // 5. 첫 접속 시 가이드 투어 자동 시작
    if (!localStorage.getItem('tour_completed_' + currentFactoryId)) {
        setTimeout(window.startAdminTour, 500);
    }
};

window.startAdminTour = function() {
    const driverObj = window.driver.js.driver({
        showProgress: true,
        allowClose: false,
        doneBtnText: '완료',
        nextBtnText: '다음 ▶',
        prevBtnText: '◀ 이전',
        progressText: '{{current}} / {{total}}',
        steps: [
            { 
                element: '#tour-step-1', 
                popover: { 
                    title: '1. 기본 단가 설정', 
                    description: '환영합니다! 가장 먼저 우리 공장의 세탁물 기본 단가를 설정해주세요. 이 단가가 모든 거래처의 기본값이 됩니다.', 
                    side: 'bottom', align: 'start' 
                } 
            },
            { 
                element: '#tour-tab-hotel', 
                popover: { 
                    title: '2. 거래처 메뉴 이동', 
                    description: '기본 단가를 설정하셨다면, 거래처를 등록하러 가볼까요?',
                    onNextClick: () => { 
                        document.getElementById('tour-tab-hotel').click(); 
                        setTimeout(() => driverObj.moveNext(), 300);
                    } 
                } 
            },
            { 
                element: '#tour-btn-hotel', 
                popover: { 
                    title: '3. 거래처 등록', 
                    description: '여기를 눌러 거래처를 등록하세요. 거래처마다 개별 단가를 다르게 설정할 수도 있습니다.' 
                } 
            },
            { 
                element: '#tour-tab-staff', 
                popover: { 
                    title: '4. 직원 메뉴 이동', 
                    description: '명세서를 발행할 현장 직원을 등록해야 합니다. 이 탭을 클릭하세요.',
                    onNextClick: () => { 
                        document.getElementById('tour-tab-staff').click(); 
                        setTimeout(() => driverObj.moveNext(), 300);
                    } 
                } 
            },
            { 
                element: '#tour-btn-staff', 
                popover: { 
                    title: '5. 직원 등록', 
                    description: '직원 계정을 생성하면, 해당 아이디로 현장직원 화면에 로그인하여 명세서를 발행할 수 있습니다! 이제 준비가 완료되었습니다 🎉' 
                } 
            }
        ],
        onDestroyStarted: () => {
            if (!driverObj.hasNextStep() || confirm("튜토리얼을 종료하시겠습니까?")) {
                localStorage.setItem('tour_completed_' + currentFactoryId, 'true');
                driverObj.destroy();
                // 튜토리얼 종료 후 다시 현황 탭으로 복귀
                document.querySelector('.tab-item[onclick*="adminStats"]').click();
            }
        }
    });
    driverObj.drive();
};

window.updateTrendChartOnly = async function() {
    const curMonth = document.getElementById('adminStatsMonth')?.value || getTodayString().substring(0, 7);
    const [y, m] = curMonth.split('-');
    
    const monthlyTrend = {};
    const baseDate = new Date(y, m - 1, 1);
    for(let i=5; i>=0; i--) {
        const d = new Date(baseDate); 
        d.setMonth(d.getMonth() - i);
        const mKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        monthlyTrend[mKey] = 0;
    }
    
    const hotelFilter = document.getElementById('adminTrendHotelFilter')?.value || 'all';
    
    // [Fix] Fetch hotel created_at first if filtered to exclude old invoices
    let hotelCreatedDate = null;
    if (hotelFilter !== 'all') {
        const { data: h } = await window.mySupabase.from('hotels').select('created_at').eq('id', hotelFilter).single();
        if (h) hotelCreatedDate = h.created_at.substring(0, 10);
    }
    
    let invQuery = window.mySupabase.from('invoices').select('date, total_amount').eq('factory_id', currentFactoryId);
    if (hotelFilter !== 'all') {
        invQuery = invQuery.eq('hotel_id', hotelFilter);
        if (hotelCreatedDate) invQuery = invQuery.gte('date', hotelCreatedDate);
    }
    console.log("DEBUG: invQuery params - factoryId:", currentFactoryId, "filter:", hotelFilter, "createdDate:", hotelCreatedDate);
    const { data: invData, error: invErr } = await invQuery;
    console.log("DEBUG: invData:", invData, "error:", invErr);
    
    if(invData) {
        invData.forEach(inv => {
            // [수정] 대시보드 통계 계산 시 차감 명세서는 완전히 제외하여 매출 합계를 왜곡하지 않게 함
            if (inv.staff_name && inv.staff_name.startsWith('관리자(차감)')) return;
            const mKey = inv.date.substring(0, 7);
            if(monthlyTrend[mKey] !== undefined) {
                monthlyTrend[mKey] += inv.total_amount;
            }
        });
    }
    
    let hotelQuery = window.mySupabase.from('hotels').select('id, name, contract_type, fixed_amount, created_at').eq('factory_id', currentFactoryId);
    // Remove the filter here so we load all hotels to aggregate total fixed amounts
    const { data: hotelData } = await hotelQuery;
    
    if(hotelData) {
        hotelData.forEach(h => {
            const createdMonth = h.created_at ? h.created_at.substring(0, 7) : '2000-01';
            console.log("DEBUG: Processing hotel", h.name, "createdMonth", createdMonth, "filter", hotelFilter);
            
            // If viewing a specific hotel, only add its fixed amount
            if (hotelFilter !== 'all' && h.id !== hotelFilter) return;

            if(h.contract_type === 'fixed') {
                for (const mKey in monthlyTrend) {
                    if (mKey >= createdMonth) {
                        monthlyTrend[mKey] += Number(h.fixed_amount || 0);
                    }
                }
            }
            
            // For specific hotel, clear months before creation
            if (hotelFilter !== 'all' && h.id === hotelFilter) {
                for (const mKey in monthlyTrend) {
                    if (mKey < createdMonth) {
                        monthlyTrend[mKey] = 0;
                    }
                }
            }
        });
    }

    const hotelName = (hotelFilter === 'all') ? '전체' : (hotelData && hotelData.length > 0 ? (hotelData.find(h => h.id === hotelFilter)?.name || '선택 거래처') : '선택 거래처');
    window.updateRevenueTrendChart(monthlyTrend, hotelName);
};
console.log("DEBUG: APP V38 LOADED");
window.OLD_loadAdminRecentInvoices_3 = async function(returnList = false) {
    if (_isInvoiceLoading) return; // 중복 호출 방지
    _isInvoiceLoading = true;
    
    const tbody = document.getElementById('adminRecentInvoiceList');
    if(!tbody) { _isInvoiceLoading = false; return; }
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    try {
        const sDate = document.getElementById('adminStatsStartDate') ? document.getElementById('adminStatsStartDate').value : '';
        const eDate = document.getElementById('adminStatsEndDate') ? document.getElementById('adminStatsEndDate').value : '';
        const hotelFilter = document.getElementById('adminStatsHotelFilter') ? document.getElementById('adminStatsHotelFilter').value : 'all';

        // [수정] 관리자(차감) 명세서는 목록 화면에서 안 보이게 필터링
        let query = window.mySupabase
            .from('invoices')
            .select('id, date, total_amount, is_sent, staff_name, hotel_id, hotels ( name, contract_type )')
            .eq('factory_id', currentFactoryId)
            ;

        if (sDate) query = query.gte('date', sDate);
        if (eDate) query = query.lte('date', eDate);
        if (hotelFilter && hotelFilter !== 'all') query = query.eq('hotel_id', hotelFilter);

        const { data, error } = await query.order('date', { ascending: false }).limit(100);

        if (error) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">에러: ${error.message}</td></tr>`;
            _isInvoiceLoading = false;
            return;
        }

        
        const filteredData = data ? data.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))) : [];
        window._lastInvoiceData = filteredData;
        if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다.</td></tr>';
        _isInvoiceLoading = false;
        if (returnList) return [];
        return;
    }

        tbody.innerHTML = '';
        filteredData.forEach(inv => {
            const hName = inv.hotels ? inv.hotels.name : '알수없음(거래처삭제됨)';
            const cType = (inv.hotels && inv.hotels.contract_type === 'fixed') ? '정액제' : '단가제';
            const statusBadge = inv.is_sent 
                ? '<span class="badge" style="background:var(--success);">발송완료</span>' 
                : '<span class="badge" style="background:var(--secondary);">작성됨</span>';

            tbody.innerHTML += `
            <tr>
                <td>${inv.date}</td>
                <td style="font-weight:700; color:var(--primary);">${hName}</td>
                <td style="text-align:right; font-weight:700;">${inv.total_amount.toLocaleString()}원</td>
                <td>${cType}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; margin-right:5px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteInvoice('${inv.id}')">삭제</button>
                </td>
            </tr>`;
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">에러: ${e.message}</td></tr>`;
    } finally {
        _isInvoiceLoading = false;
    }
};
window.exportInvoicesToPDF = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('인쇄할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }
    
    // contract_type === 'special' 로 간주할지, hotelType 필드가 따로 있는지 확인. 여기서는 임의로 호환.
    const isSpecial = h.contract_type === 'special' || h.hotelType === 'special';

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('date, items')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error) { alert('데이터를 불러오는데 실패했습니다.'); return; }
    if(!list || list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};

    list.forEach(inv => {
        if (!inv.items) return; 
        inv.items.forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + it.qty;
            itemInfoMap[it.name] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        Object.keys(itemInfoMap).forEach(name => {
            const cat = itemInfoMap[name].category;
            if(!grouped[cat]) grouped[cat] = [];

            let totalQty = 0;
            dateSequence.forEach(d => {
                if (dailyData[d] && dailyData[d][name]) totalQty += dailyData[d][name];
            });

            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:3px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:10px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.price.toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
        <html><head><style>@page { size: A4; margin: 15mm; } body { font-family: 'Malgun Gothic', sans-serif; }</style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${totalAmount.toLocaleString()}
            </div>
        </body></html>`;

    } else {
        reportHtml = `
        <html><head><style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Malgun Gothic', sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; }
            th { background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; font-weight: 700; }
            td { padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; }
            .total-qty { background: #e2e8f0; font-weight: 700; }
            .total-amount { background: #fef3c7; font-weight: 700; }
        </style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <table>
                <thead>
                    <tr>
                        <th>일자</th>
                        ${Object.keys(itemInfoMap).map(name => `<th>${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => `
                        <tr>
                            <td style="background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${Object.keys(itemInfoMap).map(name => `<td>${(dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0'}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-qty">
                        <td>수량 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr class="total-unit">
                        <td>단가</td>
                        ${Object.keys(itemInfoMap).map(name => `<td>${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr class="total-amount">
                        <td>항목 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
        </body></html>`;
    }

    const printWin = window.open('', '', 'width=800,height=900');
    printWin.document.write(reportHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
};

window.OLD_sendInvoicesToClient_0 = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const negativeDailyData = {}; 
    const itemInfoMap = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name || it.name.trim() === '') return;
            
            let isMonthlyDeduction = it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true; 
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:10px; display:flex; justify-content:center; gap:8px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 8px 14px; font-size: 13px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:6px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 8px 20px; font-size: 14px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:6px;">✈️ 거래처로 발송하기</button><button onclick="printSendInvoice()" style="padding: 8px 14px; font-size: 13px; cursor:pointer; background:#64748b; color:white; border:none; border-radius:6px;">🖨️ 인쇄하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = dateSequence.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:6px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:3px 5px; font-weight:700; text-align:center; font-size:10px; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:10px; border-collapse:collapse; line-height:1.2;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:2px 3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:2px 3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:2px 3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:2px 3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:2px 3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:2px 3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:2px 3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:2px 3px; text-align:right;">${it.posQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:2px 3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:2px 3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 4px; border: 1px solid #cbd5e1; font-size: 10px; line-height: 1.2;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 3px 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 3px 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 2px 4px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 2px 4px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 3px 4px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 3px 4px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 3px 4px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 3px 4px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 3px 4px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 3px 4px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 3px 4px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 3px 4px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = function() {
        if(typeof window.confirmSendInvoice === 'function') {
            window.confirmSendInvoice(sDate, eDate, hotelFilter, totalAmount, supplyPrice, vat);
        } else {
            alert('발송 기능에 접근할 수 없습니다. 관리자에게 문의하세요.');
        }
    };
    
    window.openSendInvoiceModal();
};
let isInvoiceLoading = false;
// [v38 페이징] 관리자 명세서 목록 페이징 상태
let _adminInvoiceAllData = [];
let _adminInvoicePage = 1;
const ADMIN_INVOICE_PAGE_SIZE = 50;

window.loadAdminRecentInvoices = async function(returnList = false) {
    if (_isInvoiceLoading) return; // 중복 호출 방지
    _isInvoiceLoading = true;
    _adminInvoicePage = 1; // 필터 변경 시 첫 페이지로

    const tbody = document.getElementById('adminRecentInvoiceList');
    if(!tbody) { _isInvoiceLoading = false; return; }
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">명세서를 불러오는 중...</td></tr>';

    try {
        const sDate = document.getElementById('adminStatsStartDate') ? document.getElementById('adminStatsStartDate').value : '';
        const eDate = document.getElementById('adminStatsEndDate') ? document.getElementById('adminStatsEndDate').value : '';
        const hotelFilter = document.getElementById('adminStatsHotelFilter') ? document.getElementById('adminStatsHotelFilter').value : 'all';

        let query = window.mySupabase
            .from('invoices')
            .select('id, date, created_at, total_amount, is_sent, staff_name, hotel_id, hotels ( name, contract_type )')
            .eq('factory_id', currentFactoryId);

        if (sDate) query = query.gte('date', sDate);
        if (eDate) query = query.lte('date', eDate);
        if (hotelFilter && hotelFilter !== 'all') query = query.eq('hotel_id', hotelFilter);

        const { data, error } = await query
            .order('date', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">에러: ${error.message}</td></tr>`;
            _isInvoiceLoading = false;
            return;
        }

        const filteredData = data ? data.filter(inv => !(inv.staff_name && inv.staff_name.startsWith('관리자(차감)'))) : [];
        window._lastInvoiceData = filteredData;
        _adminInvoiceAllData = filteredData;

        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">작성된 명세서가 없습니다.</td></tr>';
            const pg = document.getElementById('adminPagination');
            if (pg) pg.innerHTML = '';
            _isInvoiceLoading = false;
            if (returnList) return [];
            return;
        }

        window.renderAdminInvoicePage();

    } catch (e) {
        console.error(e);
        const tbody2 = document.getElementById('adminRecentInvoiceList');
        if (tbody2) tbody2.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">에러: ${e.message}</td></tr>`;
    } finally {
        _isInvoiceLoading = false;
    }
    if (returnList) return window._lastInvoiceData;
};

window.renderAdminInvoicePage = function() {
    const tbody = document.getElementById('adminRecentInvoiceList');
    if (!tbody) return;

    const total = _adminInvoiceAllData.length;
    const totalPages = Math.ceil(total / ADMIN_INVOICE_PAGE_SIZE);
    const start = (_adminInvoicePage - 1) * ADMIN_INVOICE_PAGE_SIZE;
    const pageData = _adminInvoiceAllData.slice(start, start + ADMIN_INVOICE_PAGE_SIZE);

    tbody.innerHTML = '';
    pageData.forEach(inv => {
        const hName = inv.hotels ? inv.hotels.name : '알수없음(거래처삭제됨)';
        const cType = (inv.hotels && inv.hotels.contract_type === 'fixed') ? '정액제' : '단가제';
        const statusBadge = inv.is_sent
            ? '<span class="badge" style="background:var(--success);">발송완료</span>'
            : '<span class="badge" style="background:var(--secondary);">작성됨</span>';
        let invTimeStr = inv.date;
        if (inv.created_at) {
            const kst = new Date(new Date(inv.created_at).getTime() + 9 * 60 * 60 * 1000);
            const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(kst.getUTCDate()).padStart(2, '0');
            const hh = String(kst.getUTCHours()).padStart(2, '0');
            const min = String(kst.getUTCMinutes()).padStart(2, '0');
            invTimeStr = `${mm}-${dd} ${hh}:${min}`;
        }
        tbody.innerHTML += `
        <tr>
            <td>${invTimeStr}</td>
            <td style="font-weight:700; color:var(--primary);">${hName}</td>
            <td style="text-align:right; font-weight:700;">${inv.total_amount.toLocaleString()}원</td>
            <td>${cType}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-neutral" style="padding:4px 8px; font-size:11px; margin-right:5px;" onclick="viewInvoiceDetail('${inv.id}')">보기</button>
                <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteInvoice('${inv.id}')">삭제</button>
            </td>
        </tr>`;
    });

    // 페이징 버튼 렌더
    const pg = document.getElementById('adminPagination');
    if (pg) {
        if (totalPages <= 1) { pg.innerHTML = ''; return; }
        pg.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-top:10px; flex-wrap:wrap;">
            <button class="btn btn-neutral" style="padding:6px 14px; font-size:13px;" onclick="window.changeAdminInvoicePage(-1)" ${_adminInvoicePage <= 1 ? 'disabled' : ''}>◀ 이전</button>
            <span style="font-size:13px; color:#555;">${_adminInvoicePage} / ${totalPages} 페이지 (총 ${total}건)</span>
            <button class="btn btn-neutral" style="padding:6px 14px; font-size:13px;" onclick="window.changeAdminInvoicePage(1)" ${_adminInvoicePage >= totalPages ? 'disabled' : ''}>다음 ▶</button>
        </div>`;
    }
};

window.changeAdminInvoicePage = function(delta) {
    const totalPages = Math.ceil(_adminInvoiceAllData.length / ADMIN_INVOICE_PAGE_SIZE);
    _adminInvoicePage = Math.max(1, Math.min(totalPages, _adminInvoicePage + delta));
    window.renderAdminInvoicePage();
    document.getElementById('adminRecentInvoiceList')?.closest('.chart-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.exportInvoicesToPDF = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('인쇄할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }
    
    const isSpecial = h.contract_type === 'special' || h.hotelType === 'special';

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('date, items')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error) { alert('데이터를 불러오는데 실패했습니다.'); return; }
    if(!list || list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};

    list.forEach(inv => {
        if (!inv.items) return; 
        inv.items.forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + it.qty;
            itemInfoMap[it.name] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        Object.keys(itemInfoMap).forEach(name => {
            const cat = itemInfoMap[name].category;
            if(!grouped[cat]) grouped[cat] = [];

            let totalQty = 0;
            dateSequence.forEach(d => {
                if (dailyData[d] && dailyData[d][name]) totalQty += dailyData[d][name];
            });

            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:3px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:10px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.price.toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
        <html><head><style>@page { size: A4; margin: 15mm; } body { font-family: 'Malgun Gothic', sans-serif; }</style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${totalAmount.toLocaleString()}
            </div>
        </body></html>`;

    } else {
        reportHtml = `
        <html><head><style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Malgun Gothic', sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; }
            th { background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; font-weight: 700; }
            td { padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; }
            .total-qty { background: #e2e8f0; font-weight: 700; }
            .total-amount { background: #fef3c7; font-weight: 700; }
        </style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <table>
                <thead>
                    <tr>
                        <th>일자</th>
                        ${Object.keys(itemInfoMap).map(name => `<th>${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => `
                        <tr>
                            <td style="background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${Object.keys(itemInfoMap).map(name => `<td>${(dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0'}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-qty">
                        <td>수량 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr class="total-unit">
                        <td>단가</td>
                        ${Object.keys(itemInfoMap).map(name => `<td>${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr class="total-amount">
                        <td>항목 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
        </body></html>`;
    }

    const printWin = window.open('', '', 'width=800,height=900');
    printWin.document.write(reportHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
};

window.OLD_sendInvoicesToClient_1 = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const negativeDailyData = {}; 
    const itemInfoMap = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name || it.name.trim() === '') return;
            
            let isMonthlyDeduction = it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true; 
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:20px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:8px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button><button onclick="printSendInvoice()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#64748b; color:white; border:none; border-radius:8px;">🖨️ 인쇄하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = dateSequence.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.posQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 2px 3px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 2px 3px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 2px 3px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
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
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 2px 3px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = function() {
        if(typeof window.confirmSendInvoice === 'function') {
            window.confirmSendInvoice(sDate, eDate, hotelFilter, totalAmount, supplyPrice, vat);
        } else {
            alert('발송 기능에 접근할 수 없습니다. 관리자에게 문의하세요.');
        }
    };
    
    window.openSendInvoiceModal();
};

window.exportInvoicesToPDF = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }
    
    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('인쇄할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }
    
    const isSpecial = h.contract_type === 'special' || h.hotelType === 'special';

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('*') // items 포함 전체 컬럼
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error) { alert('에러: ' + error.message); console.error(error); return; }
    if(!list || list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};

    list.forEach(inv => {
        if (!inv.items) return; 
        inv.items.forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + Number(it.qty||0);
            itemInfoMap[it.name] = { price: Number(it.price) || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    let reportHtml = '';

    if (isSpecial) {
        const grouped = {};
        Object.keys(itemInfoMap).forEach(name => {
            const cat = itemInfoMap[name].category;
            if(!grouped[cat]) grouped[cat] = [];

            let totalQty = 0;
            dateSequence.forEach(d => {
                if (dailyData[d] && dailyData[d][name]) totalQty += dailyData[d][name];
            });

            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        Object.keys(grouped).forEach(cat => {
            categoriesHtml += `
            <div style="break-inside: avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:3px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:10px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;"><th style="border-right:1px solid #cbd5e1; padding:2px;">품목</th><th style="border-right:1px solid #cbd5e1; padding:2px;">단가</th><th style="border-right:1px solid #cbd5e1; padding:2px;">수량</th><th style="padding:2px;">금액</th></tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border-right:1px solid #cbd5e1; padding:2px;">${it.name}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.price.toLocaleString()}</td>
                            <td style="border-right:1px solid #cbd5e1; padding:2px; text-align:center;">${it.qty}</td>
                            <td style="padding:2px; text-align:right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
        <html><head><style>@page { size: A4; margin: 15mm; } body { font-family: 'Malgun Gothic', sans-serif; }</style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #000; text-align:right; font-weight:700; font-size:16px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()} | 총 합계: ₩ ${totalAmount.toLocaleString()}
            </div>
        </body></html>`;

    } else {
        reportHtml = `
        <html><head><style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Malgun Gothic', sans-serif; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; }
            th { background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; font-weight: 700; }
            td { padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-size: 11px; }
            .total-qty { background: #e2e8f0; font-weight: 700; }
            .total-amount { background: #fef3c7; font-weight: 700; }
        </style></head>
        <body>
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px;">세탁 거래명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size:14px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <table>
                <thead>
                    <tr>
                        <th>일자</th>
                        ${Object.keys(itemInfoMap).map(name => `<th>${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => `
                        <tr>
                            <td style="background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${Object.keys(itemInfoMap).map(name => `<td>${(dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0'}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr class="total-qty">
                        <td>수량 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>${totalQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr class="total-unit">
                        <td>단가</td>
                        ${Object.keys(itemInfoMap).map(name => `<td>${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr class="total-amount">
                        <td>항목 합계</td>
                        ${Object.keys(itemInfoMap).map(name => {
                            const totalQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            return `<td>₩ ${(totalQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size: 14px; font-weight: 700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
                <div style="font-weight: 700; font-size: 16px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
            </div>
        </body></html>`;
    }

    const printWin = window.open('', '', 'width=800,height=900');
    printWin.document.write(reportHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
};



window.OLD_sendInvoicesToClient_2 = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const negativeDailyData = {}; 
    const itemInfoMap = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name || it.name.trim() === '') return;
            
            let isMonthlyDeduction = it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true; 
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:20px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:8px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button><button onclick="printSendInvoice()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#64748b; color:white; border:none; border-radius:8px;">🖨️ 인쇄하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = dateSequence.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.posQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = function() {
        if(typeof window.confirmSendInvoice === 'function') {
            window.confirmSendInvoice(sDate, eDate, hotelFilter, totalAmount, supplyPrice, vat);
        } else {
            alert('발송 기능에 접근할 수 없습니다. 관리자에게 문의하세요.');
        }
    };
    
    window.openSendInvoiceModal();
};
window.exportInvoicesToPDF = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('인쇄할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    // 세탁공장 계좌 정보 조회
    const { data: fInfo } = await window.mySupabase.from('factories').select('bank_info').eq('id', currentFactoryId).maybeSingle();
    const bankInfoHtml = (fInfo && fInfo.bank_info)
        ? `<div style="margin-top:20px; padding:14px 18px; background:#f0fdf4; border:1.5px solid #86efac; border-radius:8px; font-size:14px; color:#166534;"><span style="font-weight:700;">💳 입금 계좌 정보: </span><span>${fInfo.bank_info}</span></div>`
        : '';

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, total_amount, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error) { alert('데이터를 불러오는데 실패했습니다.'); console.error(error); return; }
    if(!list || list.length === 0) { alert('해당 조건의 데이터가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const itemInfoMap = {};

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name) return;
            if(!dailyData[inv.date]) dailyData[inv.date] = {};
            dailyData[inv.date][it.name] = (dailyData[inv.date][it.name] || 0) + it.qty;
            itemInfoMap[it.name] = { price: it.price || 0, unit: it.unit || '개', category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    // 품목 순서: hotel_item_prices 저장 순서 기준
    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        // category_name도 보완
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let bodyHtml = '';

    if (isSpecial) {
        // 특수거래처: 카테고리별 2단 그리드 (합계 기준)
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const totalQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, qty: totalQty, price: itemInfoMap[name].price });
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
                        <th style="border:1px solid #cbd5e1; padding:2px 3px;">수량</th>
                        <th style="border:1px solid #cbd5e1; padding:2px 3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => `<tr>
                            <td style="border:1px solid #cbd5e1; padding:1px 3px;">${it.name}</td>
                            <td style="border:1px solid #cbd5e1; padding:1px 3px; text-align:center;">${Number(it.price).toLocaleString()}</td>
                            <td style="border:1px solid #cbd5e1; padding:1px 3px; text-align:center;">${it.qty}</td>
                            <td style="border:1px solid #cbd5e1; padding:1px 3px; text-align:right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        bodyHtml = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; align-items:start;">${categoriesHtml}</div>`;

    } else {
        // 일반거래처: 날짜×품목 매트릭스
        const itemTotals = {};
        itemNames.forEach(name => {
            itemTotals[name] = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
        });

        bodyHtml = `
        <table style="width:100%; border-collapse:collapse; border:1px solid #cbd5e1; font-size:10px; line-height:1.1;">
            <thead><tr style="background:#f1f5f9;">
                <th style="padding:2px 3px; border:1px solid #cbd5e1; text-align:center;">일자</th>
                ${itemNames.map(n => `<th style="padding:2px 3px; border:1px solid #cbd5e1; text-align:center;">${n}</th>`).join('')}
            </tr></thead>
            <tbody>
                ${dateSequence.map(d => `
                <tr>
                    <td style="padding:1px 3px; border:1px solid #cbd5e1; text-align:center; font-weight:700; background:#f8fafc;">${d.slice(8)}</td>
                    ${itemNames.map(name => `<td style="padding:1px 3px; border:1px solid #cbd5e1; text-align:center;">${(dailyData[d] && dailyData[d][name]) || 0}</td>`).join('')}
                </tr>`).join('')}
                <tr style="background:#e2e8f0; font-weight:700;">
                    <td style="padding:2px 3px; border:1px solid #cbd5e1; text-align:center;">수량 합계</td>
                    ${itemNames.map(name => `<td style="padding:2px 3px; border:1px solid #cbd5e1; text-align:center;">${itemTotals[name]}</td>`).join('')}
                </tr>
                <tr style="background:#f8fafc;">
                    <td style="padding:2px 3px; border:1px solid #cbd5e1; text-align:center; font-weight:700;">단가</td>
                    ${itemNames.map(name => `<td style="padding:2px 3px; border:1px solid #cbd5e1; text-align:center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                </tr>
                <tr style="background:#e0f2fe; font-weight:700; color:#0369a1;">
                    <td style="padding:2px 3px; border:1px solid #cbd5e1; text-align:center;">항목 합계</td>
                    ${itemNames.map(name => `<td style="padding:2px 3px; border:1px solid #cbd5e1; text-align:center;">₩ ${(itemTotals[name] * Number(itemInfoMap[name].price)).toLocaleString()}</td>`).join('')}
                </tr>
            </tbody>
        </table>`;
    }

    const reportHtml = `
    <html><head><meta charset="UTF-8">
    <style>
        @page { size: A4 portrait; margin: 8mm; }
        body { font-family: 'Malgun Gothic', sans-serif; margin:0; padding:0; }
        table { page-break-inside: avoid; }
    </style></head>
    <body>
        <h2 style="text-align:center; border-bottom:2px solid #0f172a; padding-bottom:5px; margin-bottom:5px; font-size:15px;">세탁 거래명세서 (${h.name})</h2>
        <div style="text-align:right; margin-bottom:5px; font-size:11px; color:#64748b;">조회 기간: ${sDate} ~ ${eDate}</div>
        ${bodyHtml}
        <div style="margin-top:8px; padding:8px 12px; border:2px solid #005b9f; border-radius:6px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:12px; font-weight:700;">공급가: ₩ ${supplyPrice.toLocaleString()} | 부가세: ₩ ${vat.toLocaleString()}</div>
            <div style="font-weight:700; font-size:14px;">총 합계: ₩ ${totalAmount.toLocaleString()}</div>
        </div>
        ${bankInfoHtml}
    </body></html>`;

    const printWin = window.open('', '', 'width=1000,height=900');
    if (!printWin) { alert('팝업 차단을 해제해주세요.'); return; }
    printWin.document.write(reportHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); printWin.close(); }, 500);
};

window.OLD_sendInvoicesToClient_3 = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const negativeDailyData = {}; 
    const itemInfoMap = {};
    let globalHasDeduction = false;

    list.forEach(inv => {
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name || it.name.trim() === '') return;
            
            let isMonthlyDeduction = it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true; 
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const supplyPrice = list.reduce((sum, inv) => sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price || 0) * Number(it.qty || 0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:20px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:8px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button><button onclick="printSendInvoice()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#64748b; color:white; border:none; border-radius:8px;">🖨️ 인쇄하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = dateSequence.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.posQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">거래처 발송용 명세서 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h1 style="text-align:center; font-size: 20px;">세탁 거래명세서 발송 미리보기 (${h.name})</h1>
            <div style="text-align:right; margin-bottom:10px; font-size: 13px;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; border: 1px solid #cbd5e1; font-size: 11px;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:20px; padding:15px; border:2px solid #005b9f; font-weight:700; font-size:16px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between;">
                <span>공급가액: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = function() {
        if(typeof window.confirmSendInvoice === 'function') {
            window.confirmSendInvoice(sDate, eDate, hotelFilter, totalAmount, supplyPrice, vat);
        } else {
            alert('발송 기능에 접근할 수 없습니다. 관리자에게 문의하세요.');
        }
    };
    
    window.openSendInvoiceModal();
};



// [중복 정의 제거 - line 1643의 최신 버전 사용]

window.openHotelModal = async function(hId = null) {
    window.editingHotelIdForInfo = hId;
    editingHotelId = hId; // 동기화
    const modal = document.getElementById('hotelModal');
    const title = modal.querySelector('h3');
    const btn = modal.querySelector('.btn-save');
    document.getElementById('h_fixedAmountGroup').style.display = 'none';
    const genRadio = document.querySelector('input[name="h_type"][value="general"]');
    if (genRadio) genRadio.checked = true;

    if (hId) {
        title.innerText = '🤝 거래처 정보 수정';
        btn.innerText = '수정 완료';
        const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
        if(h) {
            document.getElementById('h_name').value = h.name;
            document.getElementById('h_ceo').value = h.ceo || '';
            document.getElementById('h_phone').value = h.phone || '';
            document.getElementById('h_bizNo').value = h.biz_no || '';
            document.getElementById('h_address').value = h.address || '';
            document.getElementById('h_contractType').value = h.contract_type;
            document.getElementById('h_fixedAmount').value = h.fixed_amount || '0';
            document.getElementById('h_loginId').value = h.login_id || '';
            document.getElementById('h_loginPw').value = h.login_pw || '';
            if(h.hotel_type) {
                const rb = document.querySelector(`input[name="h_type"][value="${h.hotel_type}"]`);
                if(rb) rb.checked = true;
            }
            if(typeof toggleFixedAmountField === 'function') toggleFixedAmountField();
        }
    } else {
        title.innerText = '🤝 신규 거래처 등록';
        btn.innerText = '거래처 등록';
        
        // 🚀 신규 등록 시 모든 입력 폼 초기화 (리셋)
        document.getElementById('h_name').value = '';
        document.getElementById('h_ceo').value = '';
        document.getElementById('h_phone').value = '';
        document.getElementById('h_bizNo').value = '';
        document.getElementById('h_address').value = '';
        document.getElementById('h_contractType').value = 'unit';
        document.getElementById('h_fixedAmount').value = '0';
        document.getElementById('h_loginId').value = '';
        document.getElementById('h_loginPw').value = '';
        
        const errEls = ['err_h_name', 'err_h_address', 'err_h_loginId', 'err_h_loginPw'];
        errEls.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.style.display = 'none';
        });

        if(typeof toggleFixedAmountField === 'function') toggleFixedAmountField();
        
        // 신규 등록 시 공장 기본 단가 불러오기
        window.mySupabase.from('factory_default_prices').select('*').eq('factory_id', currentFactoryId).then(({data}) => {
            window.tempDefaultItems = data || [];
        });
    }
    openModal('hotelModal');
};

window.saveNewHotel = async function() {
    // [추가] 요금제 제한 확인 (비즈니스 미만일 경우 제한)
    const { data: f } = await window.mySupabase.from('factories').select('plan').eq('id', currentFactoryId).single();
    if (!await window.checkHotelLimit(f)) return;

    let isValid = true;
    const requiredFields = ['h_name', 'h_address', 'h_loginId', 'h_loginPw'];

    requiredFields.forEach(id => {
        const el = document.getElementById(id);
        const err = document.getElementById('err_' + id);
        if (!el.value.trim()) {
            el.style.borderColor = 'red';
            if(err) { err.innerText = "필수 항목입니다."; err.style.display = 'block'; }
            isValid = false;
        } else {
            el.style.borderColor = 'var(--border)';
            if(err) err.style.display = 'none';
        }
    });

    if (!isValid) return;

    // 아이디 중복 체크 로직
    const targetLoginId = document.getElementById('h_loginId').value.trim();
    
    // 수정 시에는 자기 자신을 제외하고 중복 체크
    const query = window.mySupabase.from('hotels').select('id').eq('login_id', targetLoginId);
    if (editingHotelId) {
        query.neq('id', editingHotelId);
    }
    
    const { data: duplicate } = await query.maybeSingle();
    if (duplicate) { alert('이미 사용 중인 거래처 ID입니다. 다른 ID를 입력해주세요.'); return; }

    const payload = {
        factory_id: currentFactoryId,
        hotel_type: document.querySelector('input[name="h_type"]:checked').value,
        name: document.getElementById('h_name').value.trim(),
        ceo: document.getElementById('h_ceo').value.trim(),
        phone: document.getElementById('h_phone').value.trim(),
        biz_no: document.getElementById('h_bizNo').value.trim(),
        address: document.getElementById('h_address').value.trim(),
        contract_type: document.getElementById('h_contractType').value,
        fixed_amount: Number(document.getElementById('h_fixedAmount').value) || 0,
        login_id: document.getElementById('h_loginId').value.trim(),
        login_pw: document.getElementById('h_loginPw').value.trim()
    };

    if(window.editingHotelIdForInfo) {
        await window.mySupabase.from('hotels').update(payload).eq('id', window.editingHotelIdForInfo);
        alert('거래처 정보가 수정되었습니다.');
    } else {
        payload.id = 'h_' + Date.now();
        const { data: insertedHotel } = await window.mySupabase.from('hotels').insert([payload]).select().single();
        
        // [신규 등록 후 기본 단가 자동 적용]
        console.log("DEBUG: tempDefaultItems:", window.tempDefaultItems);
        if (window.tempDefaultItems && window.tempDefaultItems.length > 0 && insertedHotel) {
            console.log("DEBUG: Inserting default prices for hotel:", insertedHotel.id);
            // "기본" 카테고리 확인/생성
            let { data: cat } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', insertedHotel.id).eq('name', '기본').maybeSingle();
            if (!cat) {
                const res = await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: insertedHotel.id, name: '기본' }]).select().single();
                if (res.data) cat = res.data;
            }
            
            if (cat) {
                const inserts = window.tempDefaultItems.map((d, i) => ({
                    factory_id: currentFactoryId,
                    hotel_id: insertedHotel.id,
                    category_id: cat.id,
                    category_name: '기본',
                    name: d.name,
                    price: d.price,
                    unit: d.unit,
                    sort_order: d.sort_order || i // [수정] 기본 단가표의 sort_order를 우선 사용하고 없으면 i 사용
                }));
                const { error: insertErr } = await window.mySupabase.from('hotel_item_prices').insert(inserts);
                if (insertErr) console.error("DEBUG: Insert items error:", insertErr);
                else console.log("DEBUG: Default items inserted successfully");
            }
            window.tempDefaultItems = [];
        }
        
        alert('신규 거래처가 등록되었습니다.');
    }
    closeModal('hotelModal');
    window.loadAdminHotelList();
};

window.deleteHotel = async function(hId) {
    if(confirm('정말 이 거래처를 삭제하시겠습니까? 관련된 명세서도 표시되지 않을 수 있습니다.')) {
        await window.mySupabase.from('hotels').delete().eq('id', hId);
        window.loadAdminHotelList();
    }
};

window.openPriceSetting = async function(hId) {
    window.editingHotelIdForPrice = hId;
    editingHotelId = hId;
    
    // 1. 거래처 타입 확인
    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hId).single();
    if(!h) return;
    
    // [경고] 정액제 거래처 경고창 활성화
    if (h.contract_type === 'fixed' || h.contract_type === '정액제') {
        alert('⚠️ 정액제 거래처의 거래명세서는 매출에 영향을 주지 않습니다!');
    }
    
    const isSpecial = h.hotel_type === 'special' || h.contract_type === 'special';

    // 2. 데이터 초기화 및 로드
    if (isSpecial) {
        document.getElementById('targetHotelNameSpecial').innerText = h.name;
        await window.loadHotelCategoryList();
        await window.loadHotelPriceList(); 
        openModal('priceSettingModal');
    } else {
        document.getElementById('targetHotelNameSimple').innerText = h.name;
        await window.loadSimplePriceList();
        openModal('simplePriceModal');
    }
};

window.loadHotelCategoryList = async function() {
    const hId = window.editingHotelIdForPrice;
    
    const { data: hotel } = await window.mySupabase.from('hotels').select('contract_type, hotel_type').eq('id', hId).single();
    const isSpecial = hotel && (hotel.contract_type === 'special' || hotel.hotel_type === 'special');

    const { data: cats } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hId).order('created_at');
    
    // [FORCE DELETE] If special, delete '기타', '삭제', '기본' categories
    if (isSpecial && cats) {
        const toDelete = cats.filter(c => c.name === '기타' || c.name === '삭제' || c.name === '기본');
        if (toDelete.length > 0) {
            for (const cat of toDelete) {
                await window.mySupabase.from('hotel_categories').delete().eq('id', cat.id);
            }
            return window.loadHotelCategoryList(); // reload
        }
    }
    
    const tagContainer = document.getElementById('h_category_tags');
    const select = document.getElementById('hp_cat');
    const prevCatId = select ? select.value : ''; // 기존 선택값 보존

    if (cats) {
        const filtered = cats.filter(c => {
            if (c.name === '삭제') return false;
            if (isSpecial && c.name === '기타') return false;
            return true;
        });
        if (tagContainer) {
            tagContainer.innerHTML = filtered.map(c => `<span class="badge" style="background:#e2e8f0; color:#334155; display:inline-flex; align-items:center; padding:4px 8px; border-radius:12px;">
                    ${c.name} <button onclick="deleteHotelCategory('${c.id}')" style="border:none; background:none; color:red; cursor:pointer; margin-left:5px; font-weight:bold;">×</button>
                </span>`).join('');
        }
        if (select) {
            // onchange 트리거 방지: 이벤트 리스너 일시 제거 후 innerHTML 교체
            const oldOnchange = select.onchange;
            select.onchange = null;
            select.innerHTML = '<option value="">선택하세요</option>' + filtered.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            // 기존 선택값 복원
            if (prevCatId) select.value = prevCatId;
            select.onchange = oldOnchange;
        }
    }
};

    // Task 1: 품목 추가 로직 (addSimpleItem) 에서 이미 category_id 추가함.
    // Task 3: 정액제 거래처 경고 완료.
    // Task 2: '삭제' 카테고리 디폴트 추가 방지 로직 (예상되는 곳: 카테고리 생성 시)
    // 아래는 addHotelCategory 수정 (카테고리 생성 시 '삭제'라는 이름이면 차단)
    window.addHotelCategory = async function() {
        const input = document.getElementById('new_h_cat_name');
        const catName = input.value.trim();
        if(!catName || catName === '삭제') { alert('올바른 카테고리명을 입력하세요.'); return; }
        const hId = window.editingHotelIdForPrice;
        
        const { data: exist } = await window.mySupabase.from('hotel_categories').select('id').eq('hotel_id', hId).eq('name', catName).single();
        if(exist) { alert('이미 존재하는 카테고리입니다.'); input.focus(); return; }
        
        await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: hId, name: catName }]);
        input.value = '';
        await window.loadHotelCategoryList();
        input.focus(); // [수정] 카테고리명 입력창으로 커서 복귀
    };

window.deleteHotelCategory = async function(catId) {
    if(!confirm('삭제하시겠습니까? 이 카테고리에 속한 품목도 모두 함께 삭제됩니다.')) return;
    await window.mySupabase.from('hotel_categories').delete().eq('id', catId);
    await window.loadHotelCategoryList();
    await window.loadHotelPriceList();
};

window.addHotelCustomItem = async function() {
    // [강제 캐시 갱신] Supabase가 최신 테이블 구조를 인식하게 함 ( category_id, category_name 인식용 )
    await window.mySupabase.from('hotel_item_prices').select('category_id, category_name').limit(1);

    const hId = window.editingHotelIdForPrice;
    const name = document.getElementById('hp_name').value.trim();
    const price = Number(document.getElementById('hp_price').value) || 0;
    const unit = document.getElementById('hp_unit').value.trim() || '개';
    
    const selectEl = document.getElementById('hp_cat');
    const catId = selectEl.value;
    
    if(!name) { alert('품목명을 입력해주세요.'); return; }
    if(!catId) { alert('카테고리를 선택해주세요.'); return; }
    
    // [보안] catId로 카테고리 이름을 확실히 조회!
    const { data: catData } = await window.mySupabase.from('hotel_categories').select('name').eq('id', catId).single();
    const finalCatName = catData ? catData.name : '기본';

    // [정렬] 가장 하단으로 추가 (Timestamp 기반, Integer 범위 초과 방지)
    const nextOrder = Math.floor(Date.now() / 1000);

    const payload = {
        factory_id: String(currentFactoryId),
        hotel_id: String(hId),
        name: String(name),
        price: Number(price),
        unit: String(unit),
        category_id: String(catId),
        category_name: String(finalCatName),
        sort_order: nextOrder
    };
    
    // upsert: 같은 hotel_id + name이면 업데이트, 없으면 삽입
    const { error: upsertError } = await window.mySupabase.from('hotel_item_prices')
        .upsert([payload], { onConflict: 'hotel_id,name' });

    if (upsertError) {
        console.error("DEBUG: Upsert Error details:", upsertError);
        alert('품목 추가 실패: ' + upsertError.message);
        return;
    }

    document.getElementById('hp_name').value = '';
    document.getElementById('hp_price').value = '0';
    document.getElementById('hp_name').focus();
    await window.loadHotelPriceList();
};

window.deleteHotelPrice = async function(itemId) {
    if(!confirm('정말 삭제하시겠습니까?')) return;
    await window.mySupabase.from('hotel_item_prices').delete().eq('id', itemId);
    await window.loadHotelPriceList();
};
window.loadAdminDefaultPriceList = async function() {
    const tbody = document.getElementById('adminDefaultPriceList');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">기본 품목을 불러오는 중...</td></tr>';

    const { data: items, error } = await window.mySupabase.from('factory_default_prices')
        .select('*')
        .eq('factory_id', currentFactoryId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

    if(error) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:red; text-align:center;">조회 에러: ${error.message}</td></tr>`;
        return;
    }
    console.log("DEBUG: Admin Default Prices:", items);
    console.log("DEBUG: Admin Default Prices Names:", items ? items.map(i => i.name) : 'None');
    console.log("DEBUG: Admin Default Prices SortOrder:", items ? items.map(i => i.sort_order) : 'None');

    if(!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">등록된 기본 품목이 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    items.forEach(item => {
        tbody.innerHTML += `
        <tr style="height:35px;">
            <td style="padding:4px 8px;"><input type="number" value="${item.sort_order || 0}" style="width:40px;" onchange="updateDefaultPriceOrder('${item.id}', this.value)"></td>
            <td style="padding:4px 8px;">${item.name}</td>
            <td style="padding:4px 8px;">${item.price.toLocaleString()}원</td>
            <td style="padding:4px 8px;">${item.unit}</td>
            <td style="padding:4px 8px;">
                <button class="btn btn-danger" style="padding:2px 6px; font-size:11px;" onclick="deleteDefaultPrice('${item.id}')">삭제</button>
            </td>
        </tr>`;
    });
};

window.updateDefaultPriceOrder = async function(id, newOrder) {
    console.log("DEBUG: Updating sort_order to:", newOrder, "for ID:", id);
    const { error } = await window.mySupabase.from('factory_default_prices').update({ sort_order: Number(newOrder) || 0 }).eq('id', id);
    if(error) {
        console.error("DEBUG: Update order error:", error);
    }
    await window.loadAdminDefaultPriceList();
};

window.saveDefaultPrice = async function() {
    const nameEl = document.getElementById('dp_name');
    const priceEl = document.getElementById('dp_price');
    const unitEl = document.getElementById('dp_unit');

    const name = nameEl.value.trim();
    const price = Number(priceEl.value) || 0;
    const unit = unitEl.value.trim() || '개';

    if(!name) { alert('품목명을 입력해주세요.'); return; }

    // 기존 품목 개수 확인하여 다음 순서 할당
    const { data: existingItems } = await window.mySupabase.from('factory_default_prices')
        .select('sort_order')
        .eq('factory_id', currentFactoryId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();

    const nextOrder = existingItems ? (existingItems.sort_order + 1) : 1;

    const payload = {
        factory_id: currentFactoryId,
        name: name,
        price: price,
        unit: unit,
        sort_order: nextOrder
    };

    const { error } = await window.mySupabase.from('factory_default_prices')
        .upsert(payload, { onConflict: 'factory_id, name' });

    if(error) {
        alert('저장에 실패했습니다: ' + error.message);
        return;
    }

    // 입력창 초기화 및 목록 갱신
    nameEl.value = '';
    priceEl.value = '0';
    unitEl.value = '개';
    nameEl.focus();
    
    await window.loadAdminDefaultPriceList();
};

window.deleteDefaultPrice = async function(id) {
    if(!confirm('해당 기본 품목을 삭제하시겠습니까?')) return;

    const { error } = await window.mySupabase.from('factory_default_prices')
        .delete()
        .eq('id', id);

    if(error) {
        alert('삭제에 실패했습니다: ' + error.message);
        return;
    }

    await window.loadAdminDefaultPriceList();
};

window.openDefaultPriceSetting = function() { 
    openModal('defaultPriceModal'); 
    window.loadAdminDefaultPriceList(); 
};

// ... 로직 통합 완료 ...

window.loadHotelPriceList = async function() {
    console.log("DEBUG: 최신 loadHotelPriceList 호출");
    const hId = window.editingHotelIdForPrice;
    
    // 선택된 카테고리
    const catSelect = document.getElementById('hp_cat');
    const selectedCatId = catSelect ? catSelect.value : '';
    
    // 모든 품목 조회 (sort_order 기반 정렬)
    let query = window.mySupabase.from('hotel_item_prices')
        .select('id, name, price, unit, sort_order, category_name, category_id')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: true });
    
    const { data: items, error } = await query;
    
    const tbody = document.getElementById('hotelPriceList');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">등록된 품목이 없습니다.</td></tr>';
        return;
    }
    
    // 카테고리 필터링 적용
    const filteredItems = items.filter(it => {
        if (selectedCatId && selectedCatId !== '' && selectedCatId !== 'all') {
            return it.category_id === selectedCatId;
        }
        return it.category_name !== '삭제';
    });
    
    tbody.innerHTML = filteredItems.map(it => `<tr>
            <td style="background:#f8fafc;"><span class="badge" style="background:#e2e8f0; color:#334155;">${it.category_name}</span></td>
            <td><strong>${it.name}</strong></td>
            <td><input type="number" value="${it.price}" onchange="updateHotelItemPrice('${it.id}', this.value)" style="width:100px; padding:4px;">원</td>
            <td>${it.unit}</td>
            <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteHotelPrice('${it.id}')">삭제</button></td>
        </tr>`).join('');
};

window.loadSimplePriceList = async function() {
    const hId = window.editingHotelIdForPrice;
    console.log("DEBUG: loadSimplePriceList for hotel:", hId);
    // [수정] select('*')를 명시적인 컬럼 지정으로 변경하여 정확하게 데이터 가져오기!
    const { data: items, error } = await window.mySupabase.from('hotel_item_prices')
        .select('id, name, price, unit, sort_order, created_at')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
    console.log("DEBUG: Final Sorted Items:", items ? items.map(i => ({name: i.name, sort_order: i.sort_order})) : 'None');
    console.log("DEBUG: Hotel Items Info Detail:", JSON.stringify(items.map(i => ({name: i.name, sort_order: i.sort_order}))));
    
    const tbody = document.getElementById('simplePriceList');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if(!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">등록된 품목이 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = items.map(it => `<tr>
            <td><strong>${it.name}</strong></td>
            <td><input type="number" value="${it.price}" onchange="updateHotelItemPrice('${it.id}', this.value)" style="width:100px; padding:4px;">원</td>
            <td>${it.unit}</td>
            <td><button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteSimpleItem('${it.id}')">삭제</button></td>
        </tr>`).join('');
};

window.addSimpleItem = async function() {
    const hId = window.editingHotelIdForPrice;
    const name = document.getElementById('simp_name').value.trim();
    const price = Number(document.getElementById('simp_price').value) || 0;
    const unit = document.getElementById('simp_unit').value.trim() || '개';

    if (!name) { alert('품목명을 입력해주세요.'); return; }

    // [v38 Fix] Find category ID correctly
    let { data: cat } = await window.mySupabase.from('hotel_categories').select('*').eq('hotel_id', hId).eq('name', '기본').maybeSingle();
    
    // If no category found at all, create '기본'
    if (!cat) {
        const { data: newCat, error: catError } = await window.mySupabase.from('hotel_categories').insert([{ factory_id: currentFactoryId, hotel_id: hId, name: '기본' }]).select().single();
        cat = newCat;
    }

    // [정렬] 가장 하단으로 추가 (Repair Nulls first)
    const { data: allItems } = await window.mySupabase.from('hotel_item_prices')
        .select('id, sort_order')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: false });

    let maxS = 0;
    if (allItems) {
        allItems.forEach(it => {
            if(it.sort_order != null && it.sort_order > maxS) maxS = it.sort_order;
        });
        
        // Repair nulls
        for (const it of allItems) {
            if (it.sort_order == null) {
                maxS++;
                await window.mySupabase.from('hotel_item_prices').update({ sort_order: maxS }).eq('id', it.id);
            }
        }
    }
    const nextOrder = maxS + 1;

    const payload = {
        factory_id: currentFactoryId,
        hotel_id: hId,
        name: name,
        price: price,
        unit: unit,
        category_id: cat ? cat.id : null,
        category_name: (cat && cat.name) ? cat.name : '기본',
        sort_order: nextOrder
    };
    
    // Explicitly casting values
    const finalPayload = {
        factory_id: payload.factory_id,
        hotel_id: payload.hotel_id,
        name: String(payload.name),
        price: Number(payload.price),
        unit: String(payload.unit),
        category_id: payload.category_id ? String(payload.category_id) : null,
        category_name: String(payload.category_name),
        sort_order: Number(payload.sort_order)
    };
    
    console.log("DEBUG: Final Payload:", JSON.stringify(finalPayload));
    
    const { error: insertError } = await window.mySupabase.from('hotel_item_prices')
        .upsert([finalPayload], { onConflict: 'hotel_id,name' });
    
    if (insertError) {
        console.error("DEBUG: Insert failed:", insertError);
        alert('품목 추가 실패: ' + insertError.message);
        return;
    }
    
    document.getElementById('simp_name').value = '';
    document.getElementById('simp_price').value = '0';
    document.getElementById('simp_name').focus();
    await window.loadSimplePriceList();
};

window.deleteSimpleItem = async function(id) {
    if(!confirm('삭제하시겠습니까?')) return;
    await window.mySupabase.from('hotel_item_prices').delete().eq('id', id);
    await window.loadSimplePriceList();
};

window.viewInvoiceDetail = async function(id) {
    const { data: inv, error } = await window.mySupabase.from('invoices')
        .select('*, hotels(name, contract_type, hotel_type), invoice_items(name, qty, price, unit)')
        .eq('id', id)
        .single();
        
    if (error || !inv) { 
        alert('데이터를 찾을 수 없습니다.'); return; 
    }

    const isSpecial = inv.hotels && (inv.hotels.contract_type === 'special' || inv.hotels.hotel_type === 'special');
    
    // 명세서에 실제 저장된 항목들 맵으로 캐싱
    const savedItemsMap = {};
    (inv.invoice_items || []).forEach(it => { savedItemsMap[it.name] = Number(it.qty || 0); });

    // 단가표 전체 불러오기 (수량 0인 것도 보여주기 위함)
    let { data: priceList } = await window.mySupabase.from('hotel_item_prices')
        .select('name, price, unit, sort_order, category_name')
        .eq('hotel_id', inv.hotel_id)
        .order('sort_order', { ascending: true, nullsFirst: false });

    // 거래처 개별 단가표가 없으면 공장 기본 단가표 가져오기
    if (!priceList || priceList.length === 0) {
        const { data: defaultList } = await window.mySupabase.from('factory_default_prices')
            .select('name, price, unit, sort_order')
            .eq('factory_id', inv.factory_id)
            .order('sort_order', { ascending: true, nullsFirst: false });
        
        if (defaultList && defaultList.length > 0) {
            priceList = defaultList.map(p => ({
                ...p,
                category_name: '기본'
            }));
        }
    }

    // 단가표와 저장된 데이터 병합
    const mergedItems = [];
    if (priceList && priceList.length > 0) {
        priceList.forEach(p => {
            mergedItems.push({
                name: p.name,
                price: Number(p.price || 0),
                qty: savedItemsMap[p.name] || 0,
                category: p.category_name || '기타'
            });
        });
    } else {
        // 둘 다 없는 경우(예외 처리) 그냥 저장된 것만 띄움
        (inv.invoice_items || []).forEach(it => {
            mergedItems.push({
                name: it.name,
                price: Number(it.price || 0),
                qty: Number(it.qty || 0),
                category: '기타'
            });
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
            <h1 style="text-align:center; border-bottom:2px solid #000; padding-bottom:5px; margin-bottom:5px; font-size:18px;">거래명세서 상세 (${inv.hotels?inv.hotels.name:''})</h1>
            <div style="text-align:right; margin-bottom:5px; font-size:12px;">발행 일자: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
            <div style="display:grid !important; grid-template-columns: repeat(2, 1fr) !important; gap:6px !important; align-items:start !important; padding:3px !important; width: 100% !important;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:10px; padding:10px; border:2px solid #000; text-align:right; font-weight:700; font-size:13px; border-radius:8px;">
                공급가: ₩ ${supplyPrice.toLocaleString()}
            </div>
        `;
    } else {
        reportHtml = `
        <div id="report-to-print" style="padding:10px; font-family:'Malgun Gothic', sans-serif;">
            <h1 style="text-align:center; color:#0f172a; border-bottom:3px solid #005b9f; padding-bottom:5px; margin-bottom:10px; font-size:18px;">세탁 명세서 (${inv.hotels?inv.hotels.name:''})</h1>
            <div style="text-align: left; margin-bottom: 5px; color: #0f172a; font-size: 12px; font-weight: 700;">발행일: ${inv.date} | 담당자: ${inv.staff_name||''}</div>
            <table style="width: 100%; border-collapse: collapse; margin-top: 5px; font-size:12px; border: 1px solid #cbd5e1;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: left;">품목</th>
                        <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">단가</th>
                        <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">수량</th>
                        <th style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">금액</th>
                    </tr>
                </thead>
                <tbody>
                    ${mergedItems.map(it => `
                        <tr>
                            <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: left;">${it.name || '알수없음'}</td>
                            <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">${it.price.toLocaleString()}</td>
                            <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">${it.qty}</td>
                            <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">₩ ${(it.price * it.qty).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="font-weight: 700; background: #e2e8f0;">
                        <td colspan="3" style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">공급가</td>
                        <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: right;">₩ ${supplyPrice.toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table>
        </div>`;
    }

    reportHtml += `
    <div style="text-align:center; margin-top:10px;">
        <button class="btn btn-neutral" onclick="printInvoiceDetail()" style="padding:10px 30px;">🖨️ 영수증 인쇄</button>
    </div>`;

    document.getElementById('invoiceDetailArea').innerHTML = reportHtml;
    openModal('invoiceDetailModal');
};window.calculateAdminDashStats = async function() {
    console.log("DEBUG: Final unified calculateAdminDashStats started");
    const curMonth = document.getElementById('adminStatsMonth')?.value || getTodayString().substring(0, 7);
    const todayStr = getTodayString();
    
    // YYYY-MM
    const parts = curMonth.split('-');
    let prevMonthD = new Date(parseInt(parts[0]), parseInt(parts[1]) - 2, 1);
    let pM = prevMonthD.getMonth() + 1;
    let pY = prevMonthD.getFullYear();
    const prevMonthStr = pY + '-' + (pM < 10 ? '0' + pM : pM);

    let todayRev = 0, monthRev = 0, prevMonthRev = 0;
    const hotelSales = {};

    // 1. 단가제 매출 (invoices)
    const { data: invData } = await window.mySupabase.from('invoices')
        .select('date, total_amount, hotel_id, staff_name, hotels(name, contract_type)')
        .eq('factory_id', currentFactoryId);
    
    if(invData) {
        invData.forEach(inv => {
            // [수정] 대시보드 통계 계산 시 차감 명세서는 완전히 제외하여 매출 합계를 왜곡하지 않게 함
            if (inv.staff_name && inv.staff_name.startsWith('관리자(차감)')) return;
            if (inv.hotels && inv.hotels.contract_type === 'fixed') return;
            const hName = inv.hotels ? inv.hotels.name : '알수없음';
            const supplyPrice = inv.total_amount;
            if(inv.date === todayStr) todayRev += supplyPrice;
            if(inv.date.startsWith(curMonth)) {
                monthRev += supplyPrice;
                hotelSales[hName] = (hotelSales[hName] || 0) + supplyPrice;
            }
            if(inv.date.startsWith(prevMonthStr)) prevMonthRev += supplyPrice;
        });
    }

    // 2. 정액제 매출 합산
    const { data: hotelData } = await window.mySupabase.from('hotels')
        .select('name, contract_type, fixed_amount, created_at')
        .eq('factory_id', currentFactoryId);
        
    let activeHotels = 0;
    if(hotelData) {
        hotelData.forEach(h => {
            activeHotels++;
            if(h.contract_type === 'fixed') {
                const fixAmt = Number(h.fixed_amount || 0);
                const createdMonth = h.created_at ? h.created_at.substring(0, 7) : '2000-01';
                
                if (curMonth >= createdMonth) {
                    monthRev += fixAmt;
                    hotelSales[h.name] = (hotelSales[h.name] || 0) + fixAmt;
                }
                if (prevMonthStr >= createdMonth) {
                    prevMonthRev += fixAmt;
                }
            }
        });
    }

    // UI 업데이트
    const el1 = document.getElementById('adminTodayRevenue');
    const el2 = document.getElementById('adminMonthlyRevenue');
    if(el1) el1.innerText = todayRev.toLocaleString() + '원';
    if(el2) el2.innerText = monthRev.toLocaleString() + '원';
    
    const el3 = document.getElementById('adminGrowthRate');
    if(el3) {
        let growthHtml = '';
        if (prevMonthRev === 0 && monthRev > 0) {
            // 전월 0원 → 이번달 매출 있음 = 100% 성장
            growthHtml = `<span style="color:var(--success);">&#9650; 100.0%</span>`;
        } else if (prevMonthRev > 0) {
            const growth = ((monthRev - prevMonthRev) / prevMonthRev) * 100;
            growthHtml = growth >= 0
                ? `<span style="color:var(--success);">&#9650; ${growth.toFixed(1)}%</span>`
                : `<span style="color:var(--danger);">&#9660; ${Math.abs(growth).toFixed(1)}%</span>`;
        } else {
            growthHtml = `<span style="color:var(--secondary);">- 0.0%</span>`;
        }
        el3.innerHTML = growthHtml;
    }
    
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
            // 스크롤은 HTML에서 고정 처리 (max-height:320px, overflow-y:auto, -webkit-overflow-scrolling:touch)
        }
    }
    console.log("DEBUG: Final hotelSales after render:", hotelSales);
};

window.updateTrendChartOnly = async function() {
    const curMonth = document.getElementById('adminStatsMonth')?.value || getTodayString().substring(0, 7);
    const [y, m] = curMonth.split('-');
    
    const monthlyTrend = {};
    const baseDate = new Date(y, m - 1, 1);
    for(let i=5; i>=0; i--) {
        const d = new Date(baseDate); 
        d.setMonth(d.getMonth() - i);
        const mKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        monthlyTrend[mKey] = 0;
    }
    
    const hotelFilter = document.getElementById('adminTrendHotelFilter')?.value || 'all';
    
    // 1. 단가제 매출
    let invQuery = window.mySupabase.from('invoices').select('date, total_amount, hotel_id, hotels!inner(contract_type)').eq('factory_id', currentFactoryId).eq('hotels.contract_type', 'unit');
    if (hotelFilter !== 'all') invQuery = invQuery.eq('hotel_id', hotelFilter);
    const { data: invData } = await invQuery;
    
    if(invData) {
        invData.forEach(inv => {
            // [수정] 대시보드 통계 계산 시 차감 명세서는 완전히 제외하여 매출 합계를 왜곡하지 않게 함
            if (inv.staff_name && inv.staff_name.startsWith('관리자(차감)')) return;
            const mKey = inv.date.substring(0, 7);
            if(monthlyTrend[mKey] !== undefined) monthlyTrend[mKey] += inv.total_amount;
        });
    }
    
    // 2. 정액제 매출
    let hotelQuery = window.mySupabase.from('hotels').select('id, name, contract_type, fixed_amount, created_at').eq('factory_id', currentFactoryId);
    if (hotelFilter !== 'all') hotelQuery = hotelQuery.eq('id', hotelFilter);
    const { data: hotelData } = await hotelQuery;
    
    if(hotelData) {
        hotelData.forEach(h => {
            const createdMonth = h.created_at ? h.created_at.substring(0, 7) : '2000-01';
            
            if(h.contract_type === 'fixed') {
                for (const mKey in monthlyTrend) {
                    if (mKey >= createdMonth) monthlyTrend[mKey] += Number(h.fixed_amount || 0);
                }
            }
            
            if (hotelFilter !== 'all' && h.id === hotelFilter) {
                for (const mKey in monthlyTrend) {
                    if (mKey < createdMonth) monthlyTrend[mKey] = 0;
                }
            }
        });
    }

    const hotelName = (hotelFilter === 'all') ? '전체' : (hotelData && hotelData.length > 0 ? hotelData[0].name : '선택 거래처');
    window.updateRevenueTrendChart(monthlyTrend, hotelName);
};



// [전역 강제 연결] login() 함수 전역 스코프 노출
window.login = window.login || function() {};

window._currentDeductions = [];
window.openDeductionModal = async function() {
    const hotelFilter = document.getElementById('adminStatsHotelFilter');
    if (!hotelFilter || hotelFilter.value === 'all') {
        alert('먼저 상단의 거래처 필터에서 특정 거래처를 선택해주세요.');
        return;
    }
    const hId = hotelFilter.value;
    const hName = hotelFilter.options[hotelFilter.selectedIndex].text;
    
    document.getElementById('deductHotelName').innerText = hName;
    document.getElementById('deductHotelId').value = hId;
    
    const { data: prices, error } = await window.mySupabase
        .from('hotel_item_prices')
        .select('name, price, unit')
        .eq('hotel_id', hId)
        .order('sort_order', { ascending: true, nullsFirst: false });
        
    const tbody = document.getElementById('deductItemList');
    tbody.innerHTML = '';
    
    if (prices && prices.length > 0) {
        prices.forEach((p, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; font-size:13px;">${p.name}</td>
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; font-size:13px;" class="deduct-item-price" data-price="${p.price}">${Number(p.price).toLocaleString()}원</td>
                <td style="padding:8px; border-bottom:1px solid #cbd5e1; text-align:right;">
                    <input type="tel" inputmode="numeric" pattern="[0-9\-]*" class="deduct-qty-input" data-name="${p.name}" placeholder="-0" 
                        oninput="let v=this.value.replace(/[^0-9]/g,''); this.value = v ? '-'+v : '';"
                        onkeydown="if(event.key==='Enter') { 
                            event.preventDefault(); 
                            const inputs = Array.from(document.querySelectorAll('.deduct-qty-input')); 
                            const idx = inputs.indexOf(this); 
                            if(idx > -1 && idx < inputs.length - 1) {
                                inputs[idx+1].focus(); 
                            } else {
                                document.getElementById('btnSaveDeduction').focus();
                            }
                        }"
                        style="width:70px; padding:6px; border:1px solid #cbd5e1; border-radius:4px; text-align:center; color:#dc2626; font-weight:bold;">
                </td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:15px; font-size:13px; color:#64748b;">등록된 품목이 없습니다.</td></tr>';
    }
    
    openModal('deductionModal');
};

window.saveDeduction = function() {
    const hId = document.getElementById('deductHotelId').value;
    if (!hId) return;

    const itemsToDeduct = [];
    document.querySelectorAll('.deduct-qty-input').forEach(input => {
        const qty = Number(input.value); 
        if (qty < 0) {
            const name = input.getAttribute('data-name');
            const price = Number(input.closest('tr').querySelector('.deduct-item-price').getAttribute('data-price'));
            itemsToDeduct.push({ name: name + ' (차감)', price, qty });
        }
    });

    if (itemsToDeduct.length === 0) {
        alert('차감할 수량을 입력해주세요.');
        return;
    }

    // 인메모리에 저장
    window._currentDeductions = itemsToDeduct;

    closeModal('deductionModal');
    
    // 발송 팝업 리렌더링 (DB 저장 없이 화면만 갱신)
    if (typeof window.sendInvoicesToClient === 'function') {
        window._isReRenderingPopup = true;
        window.sendInvoicesToClient(); 
    }
};

window.sendInvoicesToClient = async function() {
    if(!window.checkInvoiceFilters()) { alert('필수 항목을 모두 선택해주세요.'); return; }

    const hotelFilter = document.getElementById('adminStatsHotelFilter').value;
    const sDate = document.getElementById('adminStatsStartDate').value;
    const eDate = document.getElementById('adminStatsEndDate').value;

    if (hotelFilter === 'all') { alert('발송할 특정 거래처를 선택해주세요.'); return; }

    if (!window._isReRenderingPopup) {
        window._currentDeductions = [];
    }
    window._isReRenderingPopup = false;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelFilter).single();
    if(!h) { alert('거래처 정보가 없습니다.'); return; }

    const { data: list, error } = await window.mySupabase.from('invoices')
        .select('id, date, is_sent, staff_name, invoice_items(name, qty, price, unit)')
        .eq('factory_id', currentFactoryId)
        .eq('hotel_id', hotelFilter)
        .gte('date', sDate)
        .lte('date', eDate)
        .order('date', { ascending: true });

    if(error || !list || list.length === 0) { alert('해당 조건의 명세서가 없습니다.'); return; }

    const dateSequence = [];
    let curDate = new Date(sDate);
    while (curDate <= new Date(eDate)) {
        dateSequence.push(curDate.toISOString().split('T')[0]);
        curDate.setDate(curDate.getDate() + 1);
    }

    const dailyData = {};
    const negativeDailyData = {}; 
    const itemInfoMap = {};
    let globalHasDeduction = false;
    let baseSupplyPrice = 0;

    list.forEach(inv => {
        if (inv.staff_name && inv.staff_name.startsWith('관리자(차감)')) return; 
        
        const items = inv.invoice_items || [];
        items.forEach(it => {
            if (!it || !it.name || it.name.trim() === '') return;
            
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            baseSupplyPrice += (Number(it.price || 0) * Number(it.qty || 0));
            
            if (it.qty < 0) {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const deductionDate = eDate; 
    let deductionAmount = 0;
    
    if (window._currentDeductions.length > 0) {
        globalHasDeduction = true;
        window._currentDeductions.forEach(ded => {
            let cleanName = ded.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            deductionAmount += (Number(ded.price || 0) * Number(ded.qty || 0));
            
            if(!negativeDailyData[deductionDate]) negativeDailyData[deductionDate] = {};
            negativeDailyData[deductionDate][cleanName] = (negativeDailyData[deductionDate][cleanName] || 0) + ded.qty;
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(ded.price||0), category: '기타' };
        });
    }

    const supplyPrice = baseSupplyPrice + deductionAmount;
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelFilter)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let itemNames;
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    let reportHtml = '';

    const btnHtml = `
        <div style="text-align:center; margin-top:20px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button onclick="openDeductionModal()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#ef4444; color:white; border:none; border-radius:8px;">➖ 월말 차감 내역 추가</button>
            <button id="sendInvBtn" style="padding: 15px 30px; font-size: 18px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:8px;">✈️ 거래처로 발송하기</button><button onclick="printSendInvoice()" style="padding: 15px 20px; font-size: 16px; cursor:pointer; background:#64748b; color:white; border:none; border-radius:8px;">🖨️ 인쇄하기</button>
        </div>
    `;

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelFilter).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = dateSequence.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = dateSequence.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name].price });
        });

        let categoriesHtml = '';
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;
            categoriesHtml += `
            <div style="break-inside:avoid; margin-bottom:10px; border:1px solid #cbd5e1;">
                <div style="background:#f1f5f9; padding:5px; font-weight:700; text-align:center; border-bottom:1px solid #cbd5e1;">${cat}</div>
                <table style="width:100%; font-size:11px; border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="border:1px solid #cbd5e1; padding:3px;">품목</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">단가</th>
                        <th style="border:1px solid #cbd5e1; padding:3px;">수량(합계)</th>
                        ${globalHasDeduction ? `<th style="border:1px solid #cbd5e1; padding:3px; color:#dc2626;">차감</th>` : ''}
                        <th style="border:1px solid #cbd5e1; padding:3px;">금액</th>
                    </tr></thead>
                    <tbody>
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">${it.posQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        });

        reportHtml = `
            <h2 style="text-align:center; font-size:16px; margin:0 0 8px 0; padding-bottom:8px; border-bottom:2px solid #005b9f; color:#0f172a;">거래처 발송용 명세서 — ${h.name}</h2>
            <div style="text-align:right; margin-bottom:8px; font-size:12px; color:#64748b;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:5px; align-items:start;">
                ${categoriesHtml}
            </div>
            <div style="margin-top:12px; padding:10px 14px; border:2px solid #005b9f; font-weight:700; font-size:14px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:13px;">공급가: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;

    } else {
        reportHtml = `
            <h2 style="text-align:center; font-size:15px; margin:0 0 5px 0; padding-bottom:6px; border-bottom:2px solid #005b9f; color:#0f172a;">세탁 거래명세서 발송 미리보기 — ${h.name}</h2>
            <div style="text-align:right; margin-bottom:5px; font-size:11px; color:#64748b;">조회 기간: ${sDate} ~ ${eDate}</div>
            <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 3px; border: 1px solid #cbd5e1; font-size: 10px; line-height: 1.1;">
                <thead>
                    <tr>
                        <th style="background: #f1f5f9; padding: 2px 3px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">일자</th>
                        ${itemNames.map(name => `<th style="background: #f1f5f9; padding: 2px 3px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">${name}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${dateSequence.map(d => {
                        return `<tr>
                            <td style="padding: 1px 3px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 1px 3px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = dateSequence.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${negQty < 0 ? negQty : '0'}</td>`;
                        }).join('')}
                    </tr>` : ''}
                    <tr style="background: #e2e8f0; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">수량 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${posQty + negQty}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="background: #f1f5f9; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">단가</td>
                        ${itemNames.map(name => `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">${Number(itemInfoMap[name].price).toLocaleString()}</td>`).join('')}
                    </tr>
                    <tr style="background: #fef3c7; font-weight: 700;">
                        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">항목 합계</td>
                        ${itemNames.map(name => {
                            const posQty = dateSequence.reduce((sum, d) => sum + ((dailyData[d] && dailyData[d][name]) || 0), 0);
                            const negQty = dateSequence.reduce((sum, d) => sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
                            const netQty = posQty + negQty;
                            return `<td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">₩ ${(netQty * itemInfoMap[name].price).toLocaleString()}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
            </div>
            
            <div style="margin-top:12px; padding:10px 14px; border:2px solid #005b9f; font-weight:700; font-size:14px; border-radius:8px; background:#eff6ff; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:13px;">공급가: ₩ ${supplyPrice.toLocaleString()} + VAT: ₩ ${vat.toLocaleString()}</span>
                <span>총합계: ₩ ${totalAmount.toLocaleString()}</span>
            </div>
            ${btnHtml}
        `;
    }

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    
    document.getElementById('sendInvBtn').onclick = async function() {
        if(!confirm(`[${h.name}] 거래처로 명세서를 발송하시겠습니까? 호텔 담당자에게 문자가 발송됩니다.`)) return;
        this.innerText = '발송 중...';
        this.disabled = true;
        
        try {
            const logPayload = {
                factory_id: currentFactoryId,
                hotel_id: hotelFilter,
                period: sDate + ' ~ ' + eDate,
                total_amount: totalAmount,
                sent_at: new Date().toISOString()
            };
            
            const { data: newLog, error: logErr } = await window.mySupabase.from('sent_logs').insert([logPayload]).select().single();
            if (logErr) throw new Error("발송 로그 저장 실패: " + logErr.message);

            if (window._currentDeductions.length > 0) {
                const invoiceId = 'inv_' + Date.now() + '_' + newLog.id; 
                const { error: invErr } = await window.mySupabase.from('invoices').insert([{
                    id: invoiceId,
                    factory_id: currentFactoryId,
                    hotel_id: hotelFilter,
                    date: eDate, 
                    total_amount: deductionAmount,
                    staff_name: '관리자(차감)_' + newLog.id,
                    is_sent: true
                }]);
                
                if(invErr) {
                    console.error("차감 명세서 생성 에러:", invErr);
                    throw new Error("차감 명세서 생성 실패: " + invErr.message);
                }
                if(!invErr) {
                    const insertPayloads = window._currentDeductions.map(it => ({
                        invoice_id: invoiceId,
                        name: it.name,
                        price: it.price,
                        qty: it.qty
                    }));
                    await window.mySupabase.from('invoice_items').insert(insertPayloads);
                }
            }
            
            const ids = list.map(inv => inv.id);
            await window.mySupabase.from('invoices').update({ is_sent: true }).in('id', ids);
            
            if(typeof window.sendKakaoOrMessage === 'function') {
                await window.sendKakaoOrMessage(hotelFilter, sDate, eDate, supplyPrice, totalAmount);
            }
            
            alert('발송이 완료되었습니다.');
            closeModal('sendInvoiceModal');
            if(typeof loadAdminRecentInvoices === 'function') loadAdminRecentInvoices();
            if(typeof window.loadAdminSentList === 'function') window.loadAdminSentList();
            
        } catch (e) {
            alert('발송 중 오류가 발생했습니다: ' + e.message);
            this.innerText = '✈️ 거래처로 발송하기';
            this.disabled = false;
        }
    };
    
    window.openSendInvoiceModal();
};

// 호텔 담당자에게 월정산 카카오 알림톡 발송
window.sendKakaoOrMessage = async function(hotelId, sDate, eDate, supplyPrice, totalAmount) {
    try {
        const { data: hInfo } = await window.mySupabase
            .from('hotels')
            .select('name, phone')
            .eq('id', hotelId)
            .maybeSingle();
        if (!hInfo || !hInfo.phone) return;

        const { data: fInfo } = await window.mySupabase
            .from('factories')
            .select('name')
            .eq('id', currentFactoryId)
            .maybeSingle();

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
    } catch(e) { console.warn('[월정산 알림톡 발송 실패]', e); }
};

// 2. 내역확인 팝업 수정
window.viewSentDetail = async function(hotelName, period, sentLogId, isPartnerView, hotelId, isConfirmed) {
    if (!hotelId) { alert('거래처 정보가 없습니다.'); return; }

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보가 없습니다.'); return; }

    const [sDate, eDate] = period.split(' ~ ');

    // [중요 변경] DB에 없는 memo 필드 조회 제거
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

    if (list.length === 0) {
        alert('조회된 데이터가 없습니다.');
        return;
    }

    // [중요 필터링] staff_name에 발송 로그 ID 꼬리표가 붙어있는지만 확인!
    const filteredList = list.filter(inv => {
        if (!inv.staff_name || !inv.staff_name.startsWith('관리자(차감)')) return true; // 일반 명세서는 무조건 포함
        return inv.staff_name === '관리자(차감)_' + sentLogId; // 내 발송건에 속한 차감 명세서만 포함
    });

    const supplyPrice = filteredList.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);
    const vat = Math.floor(supplyPrice * 0.1);
    const totalAmount = supplyPrice + vat;

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';
    const itemInfoMap = {}; 
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    filteredList.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            let isMonthlyDeduction = (inv.staff_name && inv.staff_name.startsWith('관리자(차감)')) || it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }

            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    let reportHtml = '';

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const { data: priceData } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name')
        .eq('hotel_id', hotelId)
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

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
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
                        ${grouped[cat].map(it => {
                            return `<tr>
                                <td style="border:1px solid #cbd5e1; padding:1px 3px;">${it.name}</td>
                                <td style="border:1px solid #cbd5e1; padding:1px 3px; text-align:right;">${Number(it.price).toLocaleString()}</td>
                                <td style="border:1px solid #cbd5e1; padding:1px 3px; text-align:right;">${it.posQty}</td>
                                ${globalHasDeduction ? `<td style="border:1px solid #cbd5e1; padding:1px 3px; text-align:right; color:#dc2626; font-weight:bold;">${it.negQty < 0 ? it.negQty : '0'}</td>` : ''}
                                <td style="border:1px solid #cbd5e1; padding:1px 3px; text-align:right;">₩ ${(it.netQty * it.price).toLocaleString()}</td>
                            </tr>`;
                        }).join('')}
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
            </div>
        `;

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
                    ${allDates.map(d => {
                        return `<tr>
                            <td style="padding: 1px 3px; border: 1px solid #cbd5e1; text-align: center; background: #f8fafc; font-weight: 600;">${parseInt(d.substring(8))}</td>
                            ${itemNames.map(name => {
                                const val = (dailyData[d] && dailyData[d][name]) ? dailyData[d][name] : '0';
                                const colorStr = val < 0 ? 'color:#dc2626; font-weight:bold;' : '';
                                return `<td style="padding: 1px 3px; border: 1px solid #cbd5e1; text-align: center; ${colorStr}">${val}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    ${globalHasDeduction ? `
                    <tr style="background: #fee2e2; font-weight: 700; color: #dc2626;">
                        <td style="padding: 2px 3px; border: 1px solid #cbd5e1; text-align: center;">월말 차감</td>
                        ${itemNames.map(name => {
                            const negQty = allDates.reduce((sum, d) => {
                                return sum + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0);
                            }, 0);
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
            </div>
        `;
    }

    let confirmBtnHtml = '';
    if (isPartnerView && sentLogId) {
        confirmBtnHtml = isConfirmed
            ? `<div style="padding:8px 20px; background:#dcfce7; color:#16a34a; font-weight:700; border-radius:8px; font-size:14px;">✅ 정산 확인 완료</div>`
            : `<button onclick="confirmHotelSettlement('${sentLogId}')" style="padding:10px 24px; cursor:pointer; font-size:14px; font-weight:700; background:#16a34a; color:white; border:none; border-radius:8px;">✅ 정산확인</button>`;
    }

    reportHtml += `
    <div class="no-print" style="display:flex; gap:10px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
        ${confirmBtnHtml}
        <button onclick="printReport('send-report-print-area')" style="padding:10px 30px; cursor:pointer; font-size:14px; font-weight:700; background:#64748b; color:white; border:none; border-radius:8px;">🖨️ 인쇄하기</button>
        <button onclick="closeModal('sendInvoiceModal')" style="padding:10px 20px; cursor:pointer; font-size:14px; font-weight:700; background:#e2e8f0; color:#374151; border:none; border-radius:8px;">닫기</button>
    </div>`;

    document.getElementById('sendInvoiceArea').innerHTML = reportHtml;
    window.openSendInvoiceModal();
};

// 3. 엑셀 다운로드 수정 
window.downloadSentLogExcel = async function(logId, displayPeriod) {
    const { data: log } = await window.mySupabase
        .from('sent_logs').select('id, period, total_amount, hotel_id, hotels(name)').eq('id', logId).single();
    if (!log || !log.period) { alert('데이터를 불러올 수 없습니다.'); return; }

    const [sDate, eDate] = log.period.split(' ~ ').map(s => s.trim());
    const hotelName = log.hotels?.name || '거래처';
    const hotelId = log.hotel_id;

    const { data: h } = await window.mySupabase.from('hotels').select('*').eq('id', hotelId).single();
    if (!h) { alert('거래처 정보를 불러올 수 없습니다.'); return; }

    const { data: invData } = await window.mySupabase
        .from('invoices').select('id, date, invoice_items(name, qty, price), staff_name')
        .eq('hotel_id', hotelId).gte('date', sDate).lte('date', eDate).order('date', { ascending: true });

    const list = invData || [];
    if (list.length === 0) { alert('해당 기간에 명세서 데이터가 없습니다.'); return; }

    const filteredList = list.filter(inv => {
        if (!inv.staff_name || !inv.staff_name.startsWith('관리자(차감)')) return true;
        return inv.staff_name === '관리자(차감)_' + logId;
    });

    const supplyPrice = filteredList.reduce((sum, inv) =>
        sum + (inv.invoice_items || []).reduce((s, it) => s + (Number(it.price||0) * Number(it.qty||0)), 0), 0);

    const itemInfoMap = {};
    const dailyData = {};
    const negativeDailyData = {};
    let globalHasDeduction = false;

    filteredList.forEach(inv => {
        (inv.invoice_items || []).forEach(it => {
            if (!it.name || it.name.trim() === '') return;
            let isMonthlyDeduction = (inv.staff_name && inv.staff_name.startsWith('관리자(차감)')) || it.name.includes('(차감)') || it.name.includes('(클레임차감)');
            let cleanName = it.name.replace(' (차감)', '').replace(' (클레임차감)', '').trim();
            
            if (isMonthlyDeduction) {
                globalHasDeduction = true;
                if(!negativeDailyData[inv.date]) negativeDailyData[inv.date] = {};
                negativeDailyData[inv.date][cleanName] = (negativeDailyData[inv.date][cleanName] || 0) + it.qty;
            } else {
                if(!dailyData[inv.date]) dailyData[inv.date] = {};
                dailyData[inv.date][cleanName] = (dailyData[inv.date][cleanName] || 0) + it.qty;
            }
            
            if (!itemInfoMap[cleanName]) itemInfoMap[cleanName] = { price: Number(it.price||0), category: it.category || '기타' };
        });
    });

    const isSpecial = h.contract_type === 'special' || h.hotel_type === 'special';

    const { data: priceOrder } = await window.mySupabase.from('hotel_item_prices')
        .select('name, category_name').eq('hotel_id', hotelId)
        .order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });

    let itemNames = [];
    if (priceOrder && priceOrder.length > 0) {
        const orderedNames = priceOrder.map(p => p.name).filter(n => itemInfoMap[n]);
        const extraNames = Object.keys(itemInfoMap).filter(n => !orderedNames.includes(n));
        itemNames = [...orderedNames, ...extraNames];
        priceOrder.forEach(p => {
            if (itemInfoMap[p.name]) itemInfoMap[p.name].category = p.category_name || '기타';
        });
    } else {
        itemNames = Object.keys(itemInfoMap);
    }

    const allDates = [];
    for (let d = new Date(sDate); d <= new Date(eDate); d.setDate(d.getDate()+1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }

    const C = {
        primary:  { argb: 'FF005B9F' },
        accent:   { argb: 'FF00A8E8' },
        header:   { argb: 'FFF1F5F9' },
        catBg:    { argb: 'FFE0F2FE' },
        sumBg:    { argb: 'FFFEF3C7' },
        deductBg: { argb: 'FFFEE2E2' },
        amtBg:    { argb: 'FFE0F2FE' },
        totalBg:  { argb: 'FFEFF6FF' },
        white:    { argb: 'FFFFFFFF' },
        dark:     { argb: 'FF0F172A' },
        red:      { argb: 'FFDC2626' }
    };
    const border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };

    const styleCell = (cell, { bg, fontColor, isBold, align, numFmt } = {}) => {
        if (bg) cell.fill = { type:'pattern', pattern:'solid', fgColor: bg };
        cell.font = { bold: !!isBold, color: fontColor || C.dark, size: 10 };
        cell.border = border;
        cell.alignment = { vertical:'middle', horizontal: align || 'center', wrapText: true };
        if (numFmt) cell.numFmt = numFmt;
    };

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('정산내역');
    ws.views = [{ showGridLines: false }];

    if (isSpecial) {
        const { data: catData } = await window.mySupabase.from('hotel_categories')
            .select('name').eq('hotel_id', hotelId).order('created_at');
        const orderedCats = catData ? catData.map(c => c.name) : [];
        if (!orderedCats.includes('기타')) orderedCats.push('기타');

        const grouped = {};
        orderedCats.forEach(c => grouped[c] = []);
        itemNames.forEach(name => {
            const cat = itemInfoMap[name].category || '기타';
            if (!grouped[cat]) grouped[cat] = [];
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][name]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][name]) || 0), 0);
            grouped[cat].push({ name, posQty, negQty, netQty: posQty + negQty, price: itemInfoMap[name]?.price || 0 });
        });

        if (globalHasDeduction) {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 10 }, { width: 12 }, { width: 16 }];
        } else {
            ws.columns = [{ width: 22 }, { width: 13 }, { width: 12 }, { width: 16 }];
        }

        const maxCol = globalHasDeduction ? 5 : 4;
        const colLetter = String.fromCharCode(64 + maxCol);

        ws.mergeCells(`A1:${colLetter}1`);
        const titleCell = ws.getCell('A1');
        titleCell.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(titleCell, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        titleCell.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(1, i).border = border; }

        ws.mergeCells(`A2:${colLetter}2`);
        const periodCell = ws.getCell('A2');
        periodCell.value = `조회 기간: ${log.period}`;
        styleCell(periodCell, { bg: C.header, align: 'center' });
        for (let i = 2; i <= maxCol; i++) { ws.getCell(2, i).border = border; }

        let rowNum = 3;
        orderedCats.forEach(cat => {
            if (!grouped[cat] || grouped[cat].length === 0) return;

            ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
            const catCell = ws.getCell(`A${rowNum}`);
            catCell.value = `📂 ${cat}`;
            styleCell(catCell, { bg: C.catBg, isBold: true, align: 'left' });
            for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
            ws.getRow(rowNum).height = 20;
            rowNum++;

            const headers = globalHasDeduction ? ['품목', '단가(원)', '수량(합계)', '차감', '금액(원)'] : ['품목', '단가(원)', '수량(합계)', '금액(원)'];
            headers.forEach((v, i) => {
                const c = ws.getCell(rowNum, i + 1);
                c.value = v;
                styleCell(c, { bg: C.accent, fontColor: C.white, isBold: true });
                if (v === '차감') c.font.color = C.red;
            });
            ws.getRow(rowNum).height = 18;
            rowNum++;

            grouped[cat].forEach(it => {
                const vals = globalHasDeduction 
                    ? [it.name, it.price, it.posQty, it.negQty !== 0 ? it.negQty : '0', it.price * it.netQty]
                    : [it.name, it.price, it.posQty, it.price * it.netQty];
                
                vals.forEach((v, i) => {
                    const c = ws.getCell(rowNum, i + 1);
                    c.value = v;
                    styleCell(c, { align: i === 0 ? 'left' : 'right', numFmt: i > 0 && typeof v === 'number' ? '#,##0' : undefined });
                    if (globalHasDeduction && i === 3 && v < 0) c.font.color = C.red;
                });
                rowNum++;
            });
            rowNum++; 
        });

        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${rowNum}:B${rowNum}`);
        const sc = ws.getCell(`A${rowNum}`);
        sc.value = `공급가: ₩ ${supplyPrice.toLocaleString()}`;
        styleCell(sc, { bg: C.totalBg, isBold: true, align: 'center' });
        sc.font = { bold: true, color: C.primary, size: 11 };
        ws.getCell(`B${rowNum}`).border = border;

        const mergeC = globalHasDeduction ? `C${rowNum}:E${rowNum}` : `C${rowNum}:D${rowNum}`;
        ws.mergeCells(mergeC);
        const vc = ws.getCell(`C${rowNum}`);
        vc.value = `부가세: ₩ ${vat.toLocaleString()}`;
        styleCell(vc, { bg: C.totalBg, isBold: true, align: 'center' });
        vc.font = { bold: true, color: { argb: 'FF64748B' }, size: 11 };

        rowNum++;
        ws.mergeCells(`A${rowNum}:${colLetter}${rowNum}`);
        const tc = ws.getCell(`A${rowNum}`);
        tc.value = `총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(tc, { bg: C.primary, isBold: true, align: 'center' });
        tc.font = { bold: true, color: C.white, size: 13 };
        for (let i = 2; i <= maxCol; i++) { ws.getCell(rowNum, i).border = border; }
        ws.getRow(rowNum).height = 24;

        ws.pageSetup.printArea = `A1:${colLetter}${rowNum}`;

    } else {
        ws.columns = [{ width: 10 }, ...itemNames.map(() => ({ width: 10 }))];
        
        const maxCol = 1 + itemNames.length;
        let colLetter = 'A';
        if (maxCol <= 26) {
            colLetter = String.fromCharCode(64 + maxCol);
        } else {
            const first = String.fromCharCode(64 + Math.floor((maxCol - 1) / 26));
            const second = String.fromCharCode(65 + ((maxCol - 1) % 26));
            colLetter = first + second;
        }

        ws.mergeCells(`A1:${colLetter}1`);
        const t = ws.getCell('A1');
        t.value = `세탁 거래명세서 (${hotelName})`;
        styleCell(t, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        t.font = { bold: true, color: C.white, size: 13 };
        ws.getRow(1).height = 24;

        ws.mergeCells(`A2:${colLetter}2`);
        const p = ws.getCell('A2');
        p.value = `조회 기간: ${log.period}`;
        styleCell(p, { bg: C.header, align: 'right' });
        p.font = { color: { argb: 'FF64748B' }, size: 11 };

        const dH = ws.getCell('A3');
        dH.value = '일자';
        styleCell(dH, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(3, i + 2);
            c.value = n;
            styleCell(c, { bg: C.header, isBold: true });
        });

        let r = 4;
        allDates.forEach(d => {
            const dr = ws.getCell(r, 1);
            dr.value = d.slice(8) + '일';
            styleCell(dr, { isBold: true, bg: C.white });

            itemNames.forEach((n, i) => {
                const c = ws.getCell(r, i + 2);
                const val = (dailyData[d] && dailyData[d][n]) ? dailyData[d][n] : 0;
                c.value = val;
                styleCell(c, { numFmt: '#,##0' });
                if (val < 0) c.font.color = C.red;
            });
            r++;
        });

        if (globalHasDeduction) {
            const sumR = ws.getCell(r, 1);
            sumR.value = '월말 차감';
            styleCell(sumR, { bg: C.deductBg, fontColor: C.red, isBold: true });
            
            itemNames.forEach((n, i) => {
                const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
                const c = ws.getCell(r, i + 2);
                c.value = negQty < 0 ? negQty : 0;
                styleCell(c, { bg: C.deductBg, fontColor: C.red, isBold: true, numFmt: '#,##0' });
            });
            r++;
        }

        const sumR = ws.getCell(r, 1);
        sumR.value = '수량 합계';
        styleCell(sumR, { bg: C.header, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty;
            styleCell(c, { bg: C.header, isBold: true, numFmt: '#,##0' });
        });
        r++;

        const prR = ws.getCell(r, 1);
        prR.value = '단가';
        styleCell(prR, { bg: C.white, isBold: true });
        
        itemNames.forEach((n, i) => {
            const c = ws.getCell(r, i + 2);
            c.value = itemInfoMap[n]?.price || 0;
            styleCell(c, { isBold: true, numFmt: '#,##0' });
        });
        r++;

        const trR = ws.getCell(r, 1);
        trR.value = '항목 합계';
        styleCell(trR, { bg: C.sumBg, fontColor: C.primary, isBold: true });
        
        itemNames.forEach((n, i) => {
            const posQty = allDates.reduce((s, d) => s + ((dailyData[d] && dailyData[d][n]) || 0), 0);
            const negQty = allDates.reduce((s, d) => s + ((negativeDailyData[d] && negativeDailyData[d][n]) || 0), 0);
            const netQty = posQty + negQty;
            const c = ws.getCell(r, i + 2);
            c.value = netQty * (itemInfoMap[n]?.price || 0);
            styleCell(c, { bg: C.sumBg, fontColor: C.primary, isBold: true, numFmt: '#,##0' });
        });
        
        r++;
        const vat = Math.floor(supplyPrice * 0.1);
        const totalAmt = supplyPrice + vat;
        
        ws.mergeCells(`A${r}:${colLetter}${r}`);
        const totalRow = ws.getCell(`A${r}`);
        totalRow.value = `공급가액: ₩ ${supplyPrice.toLocaleString()}  |  부가세: ₩ ${vat.toLocaleString()}  |  총 합계: ₩ ${totalAmt.toLocaleString()}`;
        styleCell(totalRow, { bg: C.primary, fontColor: C.white, isBold: true, align: 'center' });
        ws.getRow(r).height = 24;
    }

    // 입금 계좌 정보 행 추가
    try {
        const { data: fInfo } = await window.mySupabase
            .from('factories').select('bank_info').eq('id', currentFactoryId).maybeSingle();
        if (fInfo && fInfo.bank_info) {
            r++;
            const colLetter2 = String.fromCharCode(64 + itemNames.length + 1);
            ws.mergeCells(`A${r}:${colLetter2}${r}`);
            const bankRow = ws.getCell(`A${r}`);
            bankRow.value = `💳 입금 계좌 정보: ${fInfo.bank_info}`;
            styleCell(bankRow, { bg: { argb: 'FFF0FDF4' }, fontColor: { argb: 'FF166534' }, isBold: true, align: 'left' });
            ws.getRow(r).height = 20;
        }
    } catch(e) { console.warn('[엑셀 계좌 정보 추가 실패]', e); }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safePeriod = log.period.replace(/\s+/g, '').replace(/~/g, '_');
    a.download = `${hotelName}_${safePeriod}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
};


// [전역 강제 연결] login() 함수 전역 스코프 노출
window.login = window.login || function() {};
