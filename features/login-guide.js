/* ============================================================
   features/login-guide.js — 로그인 화면 이용가이드
   2026-10-10 신규. 기준: assets/login-guide/login-guide-mockup.html
   (장면 5개 · 타이밍 · 동작은 시안 그대로, 문구/색만 실제 앱 기준)

   - 왼쪽 영상(27초 무음 반복)의 재생 시간이 오른쪽 장면 전환의 기준.
   - 1158px 미만에서는 <source>를 주입하지 않는다 → 모바일에서 영상 미로드.
   - prefers-reduced-motion이면 영상은 poster로 정지, 오른쪽은 장면 1 완성 상태 고정.
   - app_v38.js는 건드리지 않는다.
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

  function $(id)   { return document.getElementById(id); }
  function won(n)  { return Math.round(n).toLocaleString('ko-KR'); }
  function clamp(x){ return x < 0 ? 0 : x > 1 ? 1 : x; }
  function seg(p, a, b) { return clamp((p - a) / (b - a)); }
  function ease(x) { return 1 - Math.pow(1 - x, 3); }
  function mq(q)   { return window.matchMedia ? window.matchMedia(q) : null; }

  function init() {
    var right = $('lp-side-right');
    var vid   = $('lgVideo');
    var scenesWrap = $('lgScenes');
    if (!right || !vid || !scenesWrap) return;

    var scenes = scenesWrap.querySelectorAll('.lg-scene');
    var barFill = $('lgBar') ? $('lgBar').querySelectorAll('b') : [];
    if (scenes.length !== 5) return;

    /* ── 장면 데이터 (가상 데이터) ───────────────────────────── */
    var s2rows = [
      ['09:12', '씨고호텔 강남',       137400],
      ['09:40', '한강스테이',           88200],
      ['10:05', '서초 비즈니스호텔',    64500],
      ['10:31', '마포 게스트하우스',    21600]
    ];
    var s3rows = [
      ['씨고호텔 강남',      3812000],
      ['한강스테이',         2450300],
      ['서초 비즈니스호텔',  1903600],
      ['마포 게스트하우스',   612400]
    ];
    var prices = [1200, 2500, 350];
    var barH   = [6.1, 6.8, 7.2, 7.9, 8.4, 8.78];

    var s2list = $('lgS2list');
    s2rows.slice().reverse().forEach(function (r) {
      var d = document.createElement('div');
      d.className = 'lg-li';
      d.innerHTML = '<span class="t">' + r[0] + '</span><span class="n">' + r[1] +
                    '</span><span class="a lg-num">' + won(r[2]) + '</span>';
      s2list.appendChild(d);
    });
    var s2els = Array.prototype.slice.call(s2list.children).reverse();  // 시간순

    var s3list = $('lgS3list');
    s3rows.forEach(function (r) {
      var d = document.createElement('div');
      d.className = 'lg-mrow';
      d.innerHTML = '<span class="lg-chk">' + CHECK + '</span><span class="n">' + r[0] +
                    '</span><span class="lg-badge">발송</span><span class="lg-num">' + won(r[1]) + '</span>';
      s3list.appendChild(d);
    });
    var s3chk = s3list.querySelectorAll('.lg-chk');
    var s3bad = s3list.querySelectorAll('.lg-badge');

    var bars = $('lgS5chart').children;
    var qtys = scenes[0].querySelectorAll('.lg-qty');

    /* ── 장면별 렌더 (p = 0~1 진행도) ────────────────────────── */
    var render = [
      function (p) {                                      /* 1 발행 */
        var tot = 0;
        for (var i = 0; i < 3; i++) {
          var a = 0.08 + i * 0.17, k = seg(p, a, a + 0.13);
          var q = +qtys[i].dataset.q, v = Math.round(q * ease(k));
          qtys[i].textContent = v;
          qtys[i].className = 'lg-qty lg-num' + (k > 0 && k < 1 ? ' typing' : k >= 1 ? ' done' : '');
          tot += v * prices[i];
        }
        $('lgS1tot').textContent = won(tot) + '원';
        var b = $('lgS1btn');
        b.className = 'lg-btn' + (p > 0.66 && p < 0.7 ? ' press' : '') + (p >= 0.7 ? ' ok' : '');
        b.innerHTML = p >= 0.7 ? CHECK + '발행 완료' : '발행하기';
      },
      function (p) {                                      /* 2 목록 */
        var n = 0, sum = 0;
        s2els.forEach(function (el, i) {
          var at = 0.06 + i * 0.16, on = p >= at;
          el.classList.toggle('show', on);
          el.classList.toggle('fresh', on && p < at + 0.12);
          if (on) { n++; sum += s2rows[i][2]; }
        });
        $('lgS2sum').textContent = n + '건 · ' + won(sum) + '원';
      },
      function (p) {                                      /* 3 정산 발송 */
        for (var i = 0; i < 4; i++) {
          s3chk[i].classList.toggle('on', p >= 0.08 + i * 0.09);
          s3bad[i].classList.toggle('on', p >= 0.66);
        }
        var b = $('lgS3btn');
        b.className = 'lg-btn' + (p > 0.58 && p < 0.63 ? ' press' : '') + (p >= 0.63 ? ' ok' : '');
        b.innerHTML = p >= 0.63 ? CHECK + '발송 완료 · 4곳' : '4곳 발송';
      },
      function (p) {                                      /* 4 거래처 수신 */
        $('lgS4bub').classList.toggle('on', p >= 0.08);
        $('lgS4btn').classList.toggle('tap', p >= 0.48 && p < 0.58);
        var st = $('lgS4st'), ok = p >= 0.58;
        st.classList.toggle('ok', ok);
        st.textContent = ok ? '확인완료' : '수신완료';
      },
      function (p) {                                      /* 5 매출 */
        var k = ease(seg(p, 0.05, 0.5));
        $('lgS5big').innerHTML = won(8778300 * k) + '<small>원</small>';
        for (var i = 0; i < 6; i++) {
          bars[i].style.height = (ease(seg(p, 0.05 + i * 0.04, 0.4 + i * 0.04)) * barH[i] / 9 * 100) + '%';
        }
        $('lgS5d').classList.toggle('on', p >= 0.6);
      }
    ];

    /* ── 시계: 영상 시간을 따르고, 영상이 없으면 자체 타이머 ─── */
    var fallback = false, fbT = 0, fbLast = null, raf = null, running = false;
    var srcDone = false, hiddenPause = false, cur = -1;

    vid.addEventListener('error', function () { fallback = true; }, true);

    function injectSources() {
      if (srcDone) return;
      srcDone = true;
      SRCS.forEach(function (s) {
        var el = document.createElement('source');
        el.src = s[0]; el.type = s[1];
        vid.appendChild(el);
      });
      vid.load();
      setTimeout(function () { if (vid.readyState < 2) fallback = true; }, 4000);
    }

    function playVideo() {
      var pr = vid.play();
      if (pr && pr.catch) pr.catch(function () { fallback = true; });
    }

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
      render[i](p);
    }

    function frame(ts) {
      raf = requestAnimationFrame(frame);
      if (!right.offsetParent) {                 // 로그인 화면이 아니면 쉰다
        if (!vid.paused) { vid.pause(); hiddenPause = true; }
        return;
      }
      if (hiddenPause) { hiddenPause = false; fbLast = null; playVideo(); }
      var r = sceneAt(now(ts));
      apply(r[0], r[1]);
    }

    function start() {
      if (running) return;
      running = true;
      fbLast = null;
      injectSources();
      playVideo();
      if (raf === null) raf = requestAnimationFrame(frame);
    }

    function stop() {
      if (!running) return;
      running = false;
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      vid.pause();
    }

    /* ── 진입: 폭 조건 + 모션 최소화 ─────────────────────────── */
    var reduceMQ = mq('(prefers-reduced-motion: reduce)');
    var reduce = !!(reduceMQ && reduceMQ.matches);
    var staticDone = false;

    function setPoster() {                       // 패널이 보일 때만 포스터를 받는다
      if (vid.dataset.poster && !vid.getAttribute('poster')) vid.poster = vid.dataset.poster;
    }

    function activate() {
      setPoster();
      if (reduce) {                              // 영상은 poster로 정지, 오른쪽은 장면 1 완성 상태 고정
        if (staticDone) return;
        staticDone = true;
        var f = sceneAt(STARTS[0] + DUR * 0.92);
        apply(f[0], f[1]);
        return;
      }
      start();
    }

    function deactivate() { if (!reduce) stop(); }

    var wideMQ = mq('(min-width: ' + MIN_W + 'px)');
    if (!wideMQ) { activate(); return; }         // matchMedia 미지원 브라우저는 그대로 진행

    function onChange() { if (wideMQ.matches) activate(); else deactivate(); }
    if (wideMQ.addEventListener) wideMQ.addEventListener('change', onChange);
    else if (wideMQ.addListener) wideMQ.addListener(onChange);
    onChange();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
