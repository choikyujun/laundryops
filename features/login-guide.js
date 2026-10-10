/* ============================================================
   features/login-guide.js — 로그인 화면 이용가이드
   2026-10-10 신규 / 2026-10-10 모바일 "1분 둘러보기" 추가
   기준: assets/login-guide/login-guide-mockup.html (데스크톱 좌·우 패널)
         assets/login-guide/mobile-mockup.html 1번 (모바일 스토리)

   - 데스크톱(1158px 이상): 좌측 영상 + 우측 패널 장면 5개 자동 전환
   - 1157px 이하: 로그인 버튼 아래 "1분 둘러보기" 버튼 → 전체화면 스토리
   - 장면 5개는 index.html의 #lgScenes 하나만 두고, 스토리는 그것을 복제해 쓴다
   - 영상은 데스크톱 패널이 보이거나 스토리를 열 때만 내려받는다
   - app_v38.js는 건드리지 않는다
   ============================================================ */
(function () {
  'use strict';

  var MIN_W  = 1158;                               // features/login-guide.css 브레이크포인트와 동일
  var LOOP   = 27;                                 // 영상 길이(초)
  var STARTS = [-0.3, 5.1, 10.5, 15.9, 21.3];      // 장면별 시작 시각
  var DUR    = 5.4;                                // 장면 1개 길이
  var SRCS   = [
    ['assets/login-guide/login-guide.webm', 'video/webm'],
    ['assets/login-guide/login-guide.mp4',  'video/mp4']
  ];
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  var XICON = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  var PRICES = [1200, 2500, 350];
  var BARH   = [6.1, 6.8, 7.2, 7.9, 8.4, 8.78];
  var S2ROWS = [
    ['09:12', '쎄고호텔 강남',       137400],
    ['09:40', '한강스테이',           88200],
    ['10:05', '서초 비즈니스호텔',    64500],
    ['10:31', '마포 게스트하우스',    21600]
  ];
  var S3ROWS = [
    ['쎄고호텔 강남',      3812000],
    ['한강스테이',         2450300],
    ['서초 비즈니스호텔',  1903600],
    ['마포 게스트하우스',   612400]
  ];

  /* 스토리가 떠 있는 동안 데스크톱 패널 영상을 쉬게 하는 플래그.
     window에 두면 id="lgTourOpen" 버튼의 전역 참조와 이름이 겹쳐 항상 truthy가 된다. */
  var tourOpen = false;

  function $(id)   { return document.getElementById(id); }
  function q(root, key) { return root.querySelector('[data-lg="' + key + '"]'); }
  function won(n)  { return Math.round(n).toLocaleString('ko-KR'); }
  function clamp(x){ return x < 0 ? 0 : x > 1 ? 1 : x; }
  function seg(p, a, b) { return clamp((p - a) / (b - a)); }
  function ease(x) { return 1 - Math.pow(1 - x, 3); }
  function mq(s)   { return window.matchMedia ? window.matchMedia(s) : null; }
  function reduceMotion() {
    var m = mq('(prefers-reduced-motion: reduce)');
    return !!(m && m.matches);
  }

  /* ── 장면 목록 채우기 (최초 1회) ───────────────────────────── */
  function fillLists(scenes) {
    var s2 = q(scenes[1], 's2list');
    S2ROWS.slice().reverse().forEach(function (r) {
      var d = document.createElement('div');
      d.className = 'lg-li';
      d.innerHTML = '<span class="t">' + r[0] + '</span><span class="n">' + r[1] +
                    '</span><span class="a lg-num">' + won(r[2]) + '</span>';
      s2.appendChild(d);
    });
    var s3 = q(scenes[2], 's3list');
    S3ROWS.forEach(function (r) {
      var d = document.createElement('div');
      d.className = 'lg-mrow';
      d.innerHTML = '<span class="lg-chk">' + CHECK + '</span><span class="n">' + r[0] +
                    '</span><span class="lg-badge">발송</span><span class="lg-num">' + won(r[1]) + '</span>';
      s3.appendChild(d);
    });
  }

  /* ── 장면별 렌더 (root = .lg-scene 요소, p = 0~1 진행도) ───── */
  var render = [
    function (root, p) {                                /* 1 발행 */
      var qtys = root.querySelectorAll('.lg-qty'), tot = 0;
      for (var i = 0; i < qtys.length; i++) {
        var a = 0.08 + i * 0.17, k = seg(p, a, a + 0.13);
        var n = +qtys[i].dataset.q, v = Math.round(n * ease(k));
        qtys[i].textContent = v;
        qtys[i].className = 'lg-qty lg-num' + (k > 0 && k < 1 ? ' typing' : k >= 1 ? ' done' : '');
        tot += v * PRICES[i];
      }
      q(root, 's1tot').textContent = won(tot) + '원';
      var b = q(root, 's1btn');
      b.className = 'lg-btn' + (p > 0.66 && p < 0.7 ? ' press' : '') + (p >= 0.7 ? ' ok' : '');
      b.innerHTML = p >= 0.7 ? CHECK + '발행 완료' : '발행하기';
    },
    function (root, p) {                                /* 2 목록 */
      var els = Array.prototype.slice.call(root.querySelectorAll('.lg-li')).reverse();  // 시간순
      var n = 0, sum = 0;
      els.forEach(function (el, i) {
        var at = 0.06 + i * 0.16, on = p >= at;
        el.classList.toggle('show', on);
        el.classList.toggle('fresh', on && p < at + 0.12);
        if (on) { n++; sum += S2ROWS[i][2]; }
      });
      q(root, 's2sum').textContent = n + '건 · ' + won(sum) + '원';
    },
    function (root, p) {                                /* 3 정산 발송 */
      var chk = root.querySelectorAll('.lg-chk'), bad = root.querySelectorAll('.lg-badge');
      for (var i = 0; i < chk.length; i++) {
        chk[i].classList.toggle('on', p >= 0.08 + i * 0.09);
        bad[i].classList.toggle('on', p >= 0.66);
      }
      var b = q(root, 's3btn');
      b.className = 'lg-btn' + (p > 0.58 && p < 0.63 ? ' press' : '') + (p >= 0.63 ? ' ok' : '');
      b.innerHTML = p >= 0.63 ? CHECK + '발송 완료 · 4곳' : '4곳 발송';
    },
    function (root, p) {                                /* 4 거래처 수신 */
      q(root, 's4bub').classList.toggle('on', p >= 0.08);
      q(root, 's4btn').classList.toggle('tap', p >= 0.48 && p < 0.58);
      var st = q(root, 's4st'), ok = p >= 0.58;
      st.classList.toggle('ok', ok);
      st.textContent = ok ? '확인완료' : '수신완료';
    },
    function (root, p) {                                /* 5 매출 */
      var k = ease(seg(p, 0.05, 0.5));
      q(root, 's5big').innerHTML = won(8778300 * k) + '<small>원</small>';
      var bars = q(root, 's5chart').children;
      for (var i = 0; i < bars.length; i++) {
        bars[i].style.height = (ease(seg(p, 0.05 + i * 0.04, 0.4 + i * 0.04)) * BARH[i] / 9 * 100) + '%';
      }
      q(root, 's5d').classList.toggle('on', p >= 0.6);
    }
  ];

  function injectSources(vid) {
    if (vid.dataset.lgSrc) return;
    vid.dataset.lgSrc = '1';
    SRCS.forEach(function (s) {
      var el = document.createElement('source');
      el.src = s[0]; el.type = s[1];
      vid.appendChild(el);
    });
    vid.load();
  }
  function play(vid) {
    var pr = vid.play();
    if (pr && pr.catch) pr.catch(function () {});
  }

  /* ══════════════════════════════════════════════════════════
     A. 데스크톱 좌·우 패널 (1158px 이상)
     ══════════════════════════════════════════════════════════ */
  function initDesktop(scenes) {
    var right = $('lp-side-right'), vid = $('lgVideo');
    if (!right || !vid) return;
    var barFill = $('lgBar') ? $('lgBar').querySelectorAll('b') : [];

    var fallback = false, fbT = 0, fbLast = null, raf = null, running = false;
    var hiddenPause = false, cur = -1, reduce = reduceMotion(), staticDone = false;

    vid.addEventListener('error', function () { fallback = true; }, true);

    function now(ts) {
      if (!fallback && vid.readyState >= 2) return vid.currentTime % LOOP;
      if (fbLast !== null) fbT = (fbT + (ts - fbLast) / 1000) % LOOP;
      fbLast = ts;
      return fbT;
    }
    function sceneAt(t) {
      var idx = 0;
      for (var i = 4; i >= 0; i--) { if (t >= STARTS[i] && i !== 0) { idx = i; break; } }
      if (t >= 26.7) idx = 0;
      var local = ((t - STARTS[idx]) % LOOP + LOOP) % LOOP;
      return [idx, clamp(local / DUR)];
    }
    function apply(i, p) {
      if (i !== cur) {
        for (var k = 0; k < 5; k++) scenes[k].classList.toggle('on', k === i);
        cur = i;
        if ($('lgStepNum')) $('lgStepNum').textContent = (i + 1) + ' / 5';
      }
      for (var k2 = 0; k2 < barFill.length; k2++) {
        barFill[k2].style.width = (k2 < i ? 100 : k2 === i ? p * 100 : 0) + '%';
      }
      render[i](scenes[i], p);
    }
    function frame(ts) {
      raf = requestAnimationFrame(frame);
      if (!right.offsetParent || tourOpen) {   // 로그인 화면이 아니거나 스토리가 떠 있으면 쉰다
        if (!vid.paused) { vid.pause(); hiddenPause = true; }
        return;
      }
      if (hiddenPause) { hiddenPause = false; fbLast = null; play(vid); }
      var r = sceneAt(now(ts));
      apply(r[0], r[1]);
    }
    function setPoster() {
      if (vid.dataset.poster && !vid.getAttribute('poster')) vid.poster = vid.dataset.poster;
    }
    function start() {
      if (running) return;
      running = true; fbLast = null;
      injectSources(vid); play(vid);
      if (raf === null) raf = requestAnimationFrame(frame);
    }
    function stop() {
      if (!running) return;
      running = false;
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      vid.pause();
    }
    function activate() {
      setPoster();
      if (reduce) {
        if (staticDone) return;
        staticDone = true;
        var f = sceneAt(STARTS[0] + DUR * 0.92);
        apply(f[0], f[1]);
        return;
      }
      start();
    }
    function deactivate() { if (!reduce) stop(); }

    var wide = mq('(min-width: ' + MIN_W + 'px)');
    if (!wide) { activate(); return; }
    function onChange() { if (wide.matches) activate(); else deactivate(); }
    if (wide.addEventListener) wide.addEventListener('change', onChange);
    else if (wide.addListener) wide.addListener(onChange);
    onChange();

    return { pause: function () { if (!vid.paused) vid.pause(); } };
  }

  /* ══════════════════════════════════════════════════════════
     B. 모바일 "1분 둘러보기" 스토리
     ══════════════════════════════════════════════════════════ */
  function initTour(scenesHost) {
    var btn = $('lgTourOpen');
    if (!btn || !scenesHost) return;

    var ov = null, mScenes = [], bars = [], vid = null, endEl = null, closeBtn = null;
    var idx = 0, t0 = 0, raf = null, isOpen = false, ended = false, pushed = false;
    var reduce = reduceMotion();

    function build() {
      if (ov) return;
      ov = document.createElement('div');
      ov.id = 'lgTour';
      ov.hidden = true;
      ov.setAttribute('role', 'dialog');
      ov.setAttribute('aria-modal', 'true');
      ov.setAttribute('aria-label', 'LaundryOps 1분 둘러보기');
      ov.innerHTML =
        '<div class="lgt-frame">' +
          '<video class="lgt-video" muted loop playsinline preload="none"></video>' +
          '<div class="lgt-shade"></div>' +
          '<div class="lgt-bars"><i><b></b></i><i><b></b></i><i><b></b></i><i><b></b></i><i><b></b></i></div>' +
          '<div class="lgt-who">LaundryOps 둘러보기</div>' +
          '<button type="button" class="lgt-close" aria-label="둘러보기 닫기">' + XICON + '</button>' +
          '<button type="button" class="lgt-zone lgt-prev" aria-label="이전 장면"></button>' +
          '<button type="button" class="lgt-zone lgt-next" aria-label="다음 장면"></button>' +
          '<div class="lgt-stack"></div>' +
          '<div class="lgt-end">' +
            '<h3>이 모든 게 앱 하나로</h3>' +
            '<p>지금 가입하면 3개월 동안 무료로 쓸 수 있습니다. 카드 등록 없이 시작하세요.</p>' +
            '<button type="button" class="lgt-go">3개월 무료로 시작하기</button>' +
            '<button type="button" class="lgt-replay">다시 보기</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(ov);

      vid      = ov.querySelector('.lgt-video');
      endEl    = ov.querySelector('.lgt-end');
      closeBtn = ov.querySelector('.lgt-close');
      bars     = ov.querySelectorAll('.lgt-bars b');

      // 데스크톱 패널의 장면 5개를 그대로 복제해 쓴다 (목록이 채워진 뒤이므로 내용 동일)
      var stack = ov.querySelector('.lgt-stack');
      var src = scenesHost.querySelectorAll('.lg-scene');
      for (var i = 0; i < src.length; i++) {
        var c = src[i].cloneNode(true);
        c.classList.remove('on');
        c.removeAttribute('id');
        stack.appendChild(c);
        mScenes.push(c);
        render[i](c, 0);
      }

      var posterSrc = $('lgVideo') ? $('lgVideo').dataset.poster : '';
      if (posterSrc) vid.poster = posterSrc;

      closeBtn.addEventListener('click', function () { close(false); });
      ov.querySelector('.lgt-next').addEventListener('click', function () { if (!ended) go(idx + 1); });
      ov.querySelector('.lgt-prev').addEventListener('click', function () { if (!ended) go(idx - 1); });
      ov.querySelector('.lgt-replay').addEventListener('click', function () { go(0); });
      ov.querySelector('.lgt-go').addEventListener('click', function () {
        close(false);
        if (typeof window.openRegisterModal === 'function') window.openRegisterModal();
      });
    }

    function paintBars(n, p) {
      for (var k = 0; k < bars.length; k++) {
        bars[k].style.width = (k < n ? 100 : k === n ? p * 100 : 0) + '%';
      }
    }

    function go(n) {
      if (n < 0) n = 0;
      if (n > 4) {                                   // 마지막 화면
        ended = true;
        endEl.classList.add('on');
        vid.pause();
        paintBars(5, 0);
        return;
      }
      ended = false;
      endEl.classList.remove('on');
      idx = n;
      t0 = (window.performance && performance.now) ? performance.now() : Date.now();
      for (var k = 0; k < mScenes.length; k++) mScenes[k].classList.toggle('on', k === n);
      var p = reduce ? 1 : 0;
      render[n](mScenes[n], p);
      paintBars(n, p);
      if (!reduce) {
        try { vid.currentTime = Math.max(0, STARTS[n] + 0.3); } catch (e) {}
        play(vid);
      }
    }

    function frame(ts) {
      raf = requestAnimationFrame(frame);
      if (!isOpen || ended || reduce) return;
      var p = clamp((ts - t0) / (DUR * 1000));
      paintBars(idx, p);
      render[idx](mScenes[idx], p);
      if (p >= 1) go(idx + 1);                       // 5.4초마다 자동으로 다음
    }

    function onKey(e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { close(false); }
      else if (e.key === 'ArrowRight') { if (!ended) go(idx + 1); }
      else if (e.key === 'ArrowLeft')  { if (!ended) go(idx - 1); }
    }

    function open(viaHistory) {
      if (isOpen) return;
      build();
      isOpen = true;
      tourOpen = true;                               // 데스크톱 패널 영상은 쉬게 한다
      if (!reduce) injectSources(vid);               // 이 시점에 처음 내려받는다
      ov.hidden = false;
      document.body.classList.add('lg-tour-open');   // 뒤 화면 스크롤 차단
      document.addEventListener('keydown', onKey);
      go(0);
      if (raf === null && !reduce) raf = requestAnimationFrame(frame);
      if (closeBtn) closeBtn.focus();
      if (!viaHistory) {                             // 뒤로가기로 닫히도록 기록을 남긴다
        try {
          history.pushState({ lgTour: 1 }, '', '#tour');
          pushed = true;
        } catch (e) { pushed = false; }
      }
    }

    function close(viaHistory) {
      if (!isOpen) return;
      isOpen = false;
      tourOpen = false;
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      if (vid) vid.pause();
      ov.hidden = true;
      ended = false;
      if (endEl) endEl.classList.remove('on');
      document.body.classList.remove('lg-tour-open');
      document.removeEventListener('keydown', onKey);
      if (btn) btn.focus();
      if (!viaHistory) {
        if (pushed) { pushed = false; try { history.back(); } catch (e) {} }
        else if (location.hash === '#tour') {
          try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        }
      } else {
        pushed = false;
      }
    }

    btn.addEventListener('click', function () { open(false); });
    window.addEventListener('popstate', function () { if (isOpen) close(true); });
    window.addEventListener('hashchange', function () {
      if (location.hash === '#tour' && !isOpen) open(true);
    });

    // 홍보 링크(/#tour)로 바로 열기
    if (location.hash === '#tour') open(false);
  }

  /* ══════════════════════════════════════════════════════════ */
  function init() {
    var host = $('lgScenes');
    if (!host) return;
    var scenes = host.querySelectorAll('.lg-scene');
    if (scenes.length !== 5) return;

    fillLists(scenes);        // 목록을 먼저 채운 뒤에 복제해야 스토리에도 행이 들어간다
    initDesktop(scenes);
    initTour(host);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
