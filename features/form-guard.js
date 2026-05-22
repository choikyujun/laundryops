// features/form-guard.js
// 버튼 연속 클릭으로 인한 중복 INSERT 방지

(function() {
    'use strict';

    // 공통 래퍼: fn 실행 동안 selector에 해당하는 모든 버튼 비활성화
    function withButtonGuard(selector, fn, loadingText) {
        return async function(...args) {
            const btns = document.querySelectorAll(selector);
            const origTexts = [];

            btns.forEach((btn, i) => {
                if (btn.disabled) {
                    // 이미 처리 중인 버튼이 있으면 호출 자체를 무시
                    throw '__guarded__';
                }
                origTexts[i] = btn.textContent;
                btn.disabled = true;
                if (loadingText) btn.textContent = loadingText;
            });

            try {
                await fn.apply(this, args);
            } finally {
                btns.forEach((btn, i) => {
                    btn.disabled = false;
                    if (loadingText) btn.textContent = origTexts[i];
                });
            }
        };
    }

    function patch(fnName, selector, loadingText) {
        function tryPatch() {
            const orig = window[fnName];
            if (!orig || orig.__guarded) return false;

            const guarded = withButtonGuard(selector, orig, loadingText);
            window[fnName] = async function(...args) {
                try {
                    await guarded.apply(this, args);
                } catch(e) {
                    if (e !== '__guarded__') throw e;
                }
            };
            window[fnName].__guarded = true;
            return true;
        }

        // app_v38.js가 로드된 뒤에 패치 (DOMContentLoaded 이후 시도)
        if (!tryPatch()) {
            document.addEventListener('DOMContentLoaded', tryPatch);
        }
    }

    // submitPaymentRequest: 두 모달에 버튼이 각각 있어 selector로 모두 잡음
    patch(
        'submitPaymentRequest',
        'button[onclick="submitPaymentRequest()"]',
        '처리 중...'
    );

    patch(
        'saveNewStaff',
        'button[onclick="saveNewStaff()"]',
        '등록 중...'
    );

    patch(
        'saveNewHotel',
        'button[onclick="saveNewHotel()"]',
        '등록 중...'
    );

    patch(
        'addHotelCategory',
        'button[onclick="addHotelCategory()"]',
        null  // 추가 버튼은 텍스트 변경 없이 disabled만
    );

    patch(
        'saveNewFactory',
        'button[onclick="saveNewFactory()"]',
        '저장 중...'
    );

})();
