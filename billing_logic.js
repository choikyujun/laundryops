// 요금제별 기능 제한 로직 (기능명, 필요 요금제 레벨)
const PLAN_LIMITS = {
    'LIGHT': 1,
    'BUSINESS': 2,
    'ENTERPRISE': 3
};

const PLAN_FEATURES = {
    'UNLIMITED_ISSUANCE': 2,    // 비즈니스 이상
    'STAFF_MANAGEMENT': 2,     // 비즈니스 이상
    'ADVANCED_STATS': 3,       // 엔터프라이즈 전용
    'SPECIAL_HOTEL': 3,        // 엔터프라이즈 전용 (2단 명세서)
    'DATA_BACKUP': 3           // 엔터프라이즈 전용
};

// 현재 공장의 요금제 레벨을 반환
function getFactoryPlanLevel(factory) {
    if (!factory || !factory.plan) return 1; // 기본 라이트
    switch(factory.plan) {
        case '무료요금제': return 3; // 무료요금제도 엔터프라이즈(3)와 동일
        case '엔터프라이즈': return 3;
        case '비즈니스': return 2;
        case '라이트': return 1;
        default: return 1;
    }
}

// 기능 접근 제어 (checkAccess 호출부 - SQL-First 버전)
window.checkAccess = async function(featureKey, factory, customMessage) {
    let f = factory;
    if (!f || typeof f.plan === 'undefined') {
        const { data } = await window.mySupabase.from('factories').select('plan').eq('id', currentFactoryId).maybeSingle();
        f = data;
    }
    if (!f) return false;
    
    const currentLevel = getFactoryPlanLevel(f);
    const requiredLevel = PLAN_FEATURES[featureKey] || 1;
    
    if (currentLevel >= requiredLevel) {
        return true;
    } else {
        const msg = customMessage || '현재 요금제에서는 지원하지 않는 기능입니다. \n [요금제 업그레이드]를 확인해주세요.';
        alert(msg);
        openModal('paymentModal');
        if (typeof window.loadAdminPayment === 'function') window.loadAdminPayment();
        return false;
    }
}

// 건수 제한 체크 함수 (DB 기반)
window.checkIssuanceLimit = async function(factory) {
    let f = factory;
    if (!f || typeof f.plan === 'undefined') {
        const { data } = await window.mySupabase.from('factories').select('plan').eq('id', currentFactoryId).maybeSingle();
        f = data;
    }
    if (getFactoryPlanLevel(f) >= 2) return true; // 비즈니스 이상은 무제한
    
    const currentMonth = new Date().toISOString().substring(0, 7);
    const { count } = await window.mySupabase.from('invoices').select('id', { count: 'exact', head: true })
        .eq('factory_id', currentFactoryId).like('date', currentMonth + '%');
    
    // 월 300건 제한
    if ((count || 0) >= 300) {
        alert('라이트 요금제는 월 300건까지만 발행 가능합니다. \n [요금제 업그레이드] 해주세요');
        openModal('paymentModal');
        if (typeof window.loadAdminPayment === 'function') window.loadAdminPayment();
        return false;
    }
    return true;
}

// 거래처 등록 제한 체크 함수 (DB 기반)
window.checkHotelLimit = async function(factory) {
    let f = factory;
    if (!f || typeof f.plan === 'undefined') {
        const { data } = await window.mySupabase.from('factories').select('plan').eq('id', currentFactoryId).maybeSingle();
        f = data;
    }
    
    const planLevel = getFactoryPlanLevel(f);
    if (planLevel >= 3) return true; // 엔터프라이즈(3) 이상은 무제한
    
    const { count } = await window.mySupabase.from('hotels').select('id', { count: 'exact', head: true })
        .eq('factory_id', currentFactoryId);
    
    // 라이트 요금제 제한: 20개
    if (planLevel === 1 && (count || 0) >= 20) {
        alert('라이트 요금제는 거래처를 20개까지만 등록할 수 있습니다. \n [요금제 업그레이드] 해주세요');
        openModal('paymentModal');
        if (typeof window.loadAdminPayment === 'function') window.loadAdminPayment();
        return false;
    }
    
    // 비즈니스 요금제 제한: 50개
    if (planLevel === 2 && (count || 0) >= 50) {
        alert('비즈니스 요금제는 거래처를 50개까지만 등록할 수 있습니다. \n [요금제 업그레이드] 해주세요');
        openModal('paymentModal');
        if (typeof window.loadAdminPayment === 'function') window.loadAdminPayment();
        return false;
    }
    
    return true;
}

// 직원 등록 제한 체크 함수 (DB 기반)
window.checkStaffLimit = async function(factory) {
    let f = factory;
    if (!f || typeof f.plan === 'undefined') {
        const { data } = await window.mySupabase.from('factories').select('plan').eq('id', currentFactoryId).maybeSingle();
        f = data;
    }
    
    const planLevel = getFactoryPlanLevel(f);
    if (planLevel >= 3) return true; // 엔터프라이즈(3) 이상은 무제한
    
    const { count } = await window.mySupabase.from('staff').select('id', { count: 'exact', head: true })
        .eq('factory_id', currentFactoryId);
    
    // 라이트 요금제 제한: 1명
    if (planLevel === 1 && (count || 0) >= 1) {
        alert('라이트 요금제는 직원을 1명까지만 등록할 수 있습니다. \n [요금제 업그레이드] 해주세요');
        openModal('paymentModal');
        if (typeof window.loadAdminPayment === 'function') window.loadAdminPayment();
        return false;
    }
    
    // 비즈니스 요금제 제한: 3명
    if (planLevel === 2 && (count || 0) >= 3) {
        alert('비즈니스 요금제는 직원을 3명까지만 등록할 수 있습니다. \n [요금제 업그레이드] 해주세요');
        openModal('paymentModal');
        if (typeof window.loadAdminPayment === 'function') window.loadAdminPayment();
        return false;
    }
    
    return true;
}
window.checkHotelLimit = async function(factory) {
    let f = factory;
    if (!f || typeof f.plan === 'undefined') {
        const { data } = await window.mySupabase.from('factories').select('plan').eq('id', currentFactoryId).maybeSingle();
        f = data;
    }
    
    const planLevel = getFactoryPlanLevel(f);
    if (planLevel >= 3) return true; // 엔터프라이즈(3) 이상은 무제한
    
    const { count } = await window.mySupabase.from('hotels').select('id', { count: 'exact', head: true })
        .eq('factory_id', currentFactoryId);
    
    // 라이트 요금제 제한: 20개
    if (planLevel === 1 && (count || 0) >= 20) {
        alert('라이트 요금제는 거래처를 20개까지만 등록할 수 있습니다. \n [요금제 업그레이드] 해주세요');
        openModal('paymentModal');
        if (typeof window.loadAdminPayment === 'function') window.loadAdminPayment();
        return false;
    }
    
    // 비즈니스 요금제 제한: 50개
    if (planLevel === 2 && (count || 0) >= 50) {
        alert('비즈니스 요금제는 거래처를 50개까지만 등록할 수 있습니다. \n [요금제 업그레이드] 해주세요');
        openModal('paymentModal');
        if (typeof window.loadAdminPayment === 'function') window.loadAdminPayment();
        return false;
    }
    
    return true;
}
