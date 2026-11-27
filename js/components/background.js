/* =========================================================
   background.js – GLOBAL BACKGROUND SLIDESHOW (JS thuần, không phụ thuộc jQuery)
   Một nền slideshow dùng chung cho mọi trang: "One Background – One Experience".
   - Danh sách ảnh + thời gian: data/background-images.json (không hardcode ở đây)
   - Lưu trạng thái (ảnh đang hiện, thứ tự, thời điểm đổi) trong sessionStorage
     -> chuyển trang không reset về ảnh đầu, đồng hồ đổi ảnh chạy tiếp.
   - Chỉ giữ tối đa 2 ảnh trong DOM (ảnh hiện tại + ảnh đang chuyển), preload đúng 1 ảnh kế tiếp.
   - Ảnh lỗi bị loại khỏi vòng lặp; hết ảnh -> giữ nền gradient dự phòng (CSS).
   - Tôn trọng prefers-reduced-motion và Save-Data (chỉ 1 ảnh tĩnh); tạm dừng khi tab bị ẩn.
   Markup (đã có sẵn trong mỗi trang, nếu thiếu script tự tạo):
     <div id="global-background" aria-hidden="true">
       <div class="background-slides"></div><div class="background-overlay"></div></div>
   ========================================================= */
(function (global) {
  'use strict';

  var CONFIG_URL = 'data/background-images.json';
  var STATE_KEY = 'vcm_bg_state';
  var DEFAULTS = { intervalMs: 9000, fadeMs: 1600 };

  var doc = global.document;
  var cfg = { intervalMs: DEFAULTS.intervalMs, fadeMs: DEFAULTS.fadeMs };
  var pool = [];          // [{id, src, alt, focus}] – ảnh đang hoạt động và chưa bị lỗi
  var state = null;       // {order:[id], pos:n, shownAt:ms, cur:{id,src,focus}}
  var host = null;        // .background-slides
  var timer = null;
  var busy = false;
  var auto = true;
  var preloaded = {};     // src -> true (đã preload xong)

  /* ---------- Tiện ích ---------- */
  function readState() {
    try { var s = JSON.parse(global.sessionStorage.getItem(STATE_KEY)); return s && typeof s === 'object' ? s : null; }
    catch (e) { return null; }
  }
  function saveState() {
    try { global.sessionStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) { /* bỏ qua */ }
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function byId(id) {
    for (var i = 0; i < pool.length; i++) { if (pool[i].id === id) { return pool[i]; } }
    return null;
  }
  function warn(msg, extra) { if (global.console && global.console.warn) { global.console.warn('[Background] ' + msg, extra || ''); } }

  function prefersStatic() {
    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var conn = global.navigator && global.navigator.connection;
    return !!(reduce || (conn && conn.saveData));
  }

  /* ---------- DOM ---------- */
  function ensureHost() {
    var root = doc.getElementById('global-background');
    if (!root) {
      root = doc.createElement('div');
      root.id = 'global-background';
      root.setAttribute('aria-hidden', 'true');
      root.innerHTML = '<div class="background-slides"></div><div class="background-overlay"></div>';
      doc.body.insertBefore(root, doc.body.firstChild);
    }
    host = root.querySelector('.background-slides');
    return host;
  }

  function preload(item) {
    return new Promise(function (resolve, reject) {
      var img = new global.Image();
      img.className = 'background-slide';
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      img.style.objectPosition = item.focus || 'center';
      img.onload = function () { preloaded[item.src] = true; resolve(img); };
      img.onerror = function () { reject(item); };
      img.src = item.src;
    });
  }

  /** Hiện ảnh. instant=true: không fade (dùng khi khôi phục trạng thái giữa các trang). */
  function display(item, instant) {
    return preload(item).then(function (img) {
      var slides = host.querySelectorAll('.background-slide');
      for (var k = 0; k < slides.length; k++) { // tránh chồng 2 lần cùng một ảnh (khôi phục sớm + start)
        if (slides[k].getAttribute('src') === img.getAttribute('src')) { return; }
      }
      var prev = host.querySelector('.background-slide.is-active');
      if (instant) { img.style.transition = 'none'; }
      host.appendChild(img);
      global.requestAnimationFrame(function () {
        global.requestAnimationFrame(function () {
          img.classList.add('is-active');
          if (prev) {
            prev.classList.remove('is-active');
            global.setTimeout(function () { if (prev.parentNode) { prev.parentNode.removeChild(prev); } }, cfg.fadeMs + 300);
          }
          if (instant) { global.requestAnimationFrame(function () { img.style.transition = ''; }); }
        });
      });
    });
  }

  /* ---------- Thứ tự & trạng thái ---------- */
  function buildOrder(firstId) {
    var ids = shuffle(pool.map(function (p) { return p.id; }));
    if (firstId) { ids = [firstId].concat(ids.filter(function (id) { return id !== firstId; })); }
    return ids;
  }

  function validateState() {
    // Đồng bộ thứ tự đã lưu với danh sách ảnh hiện tại (ảnh bị tắt/xóa/lỗi, hoặc thêm ảnh mới)
    var ids = pool.map(function (p) { return p.id; });
    var order = (state.order || []).filter(function (id) { return ids.indexOf(id) >= 0; });
    ids.forEach(function (id) { if (order.indexOf(id) < 0) { order.push(id); } });
    state.order = order;
    var curId = state.cur && state.cur.id;
    var at = order.indexOf(curId);
    state.pos = at >= 0 ? at : -1;
  }

  function nextItem() {
    if (!pool.length) { return null; }
    var n = state.order.length;
    state.pos = (state.pos + 1) % n;
    return byId(state.order[state.pos]);
  }

  function peekNext() {
    if (pool.length < 2) { return null; }
    return byId(state.order[(state.pos + 1) % state.order.length]);
  }

  function preloadNext() { // chỉ tải sẵn đúng 1 ảnh kế tiếp để chuyển cảnh không bị giật/trắng
    var nxt = peekNext();
    if (nxt && !preloaded[nxt.src]) { preload(nxt).catch(function () { /* lỗi sẽ được xử lý khi tới lượt */ }); }
  }

  function drop(item) {
    pool = pool.filter(function (p) { return p.id !== item.id; });
    state.order = state.order.filter(function (id) { return id !== item.id; });
    warn('Không tải được ảnh nền, đã loại khỏi vòng lặp:', item.src);
  }

  /* ---------- Chuyển ảnh ---------- */
  function advance() {
    if (busy || !pool.length) { return Promise.resolve(); }
    busy = true;
    function attempt() {
      if (!pool.length) { return Promise.resolve(); }
      var item = nextItem();
      return display(item, false).then(function () {
        state.cur = { id: item.id, src: item.src, focus: item.focus };
        state.shownAt = Date.now();
        saveState();
        preloadNext();
      }, function (bad) {
        drop(bad);
        state.pos = Math.max(state.pos - 1, -1);
        return attempt();
      });
    }
    return attempt().then(function () { busy = false; }, function () { busy = false; });
  }

  function schedule() {
    global.clearTimeout(timer);
    if (!auto || pool.length < 2 || doc.hidden) { return; }
    var elapsed = Date.now() - (state.shownAt || Date.now());
    var wait = Math.max(cfg.intervalMs - elapsed, 800); // đồng hồ chạy tiếp qua các trang
    timer = global.setTimeout(function () { advance().then(schedule); }, wait);
  }

  /* ---------- Khởi tạo ---------- */
  function applyCss() {
    doc.documentElement.style.setProperty('--bg-fade', cfg.fadeMs + 'ms');
  }

  function start(images) {
    pool = images.filter(function (i) { return i && i.src && i.active !== false; }).map(function (i) {
      return { id: i.id || i.src, src: i.src, alt: i.alt || '', focus: i.focus || 'center' };
    });
    if (!pool.length) { return; } // không có ảnh -> giữ gradient dự phòng

    auto = !prefersStatic() && pool.length > 1;
    state = readState() || {};
    var restoring = !!(state.cur && byId(state.cur.id));
    if (!state.order) { state.order = []; }
    validateState();

    if (restoring) {
      // Đã hiện sẵn ảnh đã lưu từ lúc tải trang (xem restoreEarly) -> chỉ cần xác nhận và chạy tiếp đồng hồ
      var cur = byId(state.cur.id);
      if (!host.querySelector('.background-slide')) { display(cur, true).catch(function () { /* xử lý ở lần chuyển kế */ }); }
      preloadNext();
      schedule();
      return;
    }

    // Lần đầu trong phiên: thứ tự ngẫu nhiên, ảnh đầu tiên fade-in từ nền gradient
    state.order = buildOrder();
    state.pos = -1;
    advance().then(schedule);
  }

  // Hiện NGAY ảnh đã lưu (không chờ tải JSON) để chuyển trang không bị chớp nền gradient
  function restoreEarly() {
    var s = readState();
    if (s && s.cur && s.cur.src) {
      preload({ src: s.cur.src, focus: s.cur.focus }).then(function () {
        return display({ src: s.cur.src, focus: s.cur.focus }, true);
      }).catch(function () { /* ảnh lỗi: start() sẽ chọn ảnh khác */ });
    }
  }

  function init() {
    if (!ensureHost()) { return; }
    applyCss();
    restoreEarly();

    var done = false;
    function boot(images) { if (!done) { done = true; start(images); } }
    global.fetch(CONFIG_URL, { cache: 'default' })
      .then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); })
      .then(function (data) {
        if (data && +data.intervalMs >= 3000) { cfg.intervalMs = +data.intervalMs; }
        if (data && +data.fadeMs >= 0) { cfg.fadeMs = +data.fadeMs; }
        applyCss();
        boot(Array.isArray(data && data.images) ? data.images : []);
      })
      .catch(function (e) { warn('Không đọc được ' + CONFIG_URL + ' – dùng nền dự phòng.', e && e.message); });

    // Tạm dừng khi tab bị ẩn; quay lại thì chạy tiếp theo đúng đồng hồ đã lưu
    doc.addEventListener('visibilitychange', function () {
      if (!state) { return; }
      if (doc.hidden) { global.clearTimeout(timer); } else { schedule(); }
    });
  }

  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', init); } else { init(); }

  global.VCM = global.VCM || {};
  global.VCM.background = { advance: function () { return advance().then(schedule); } };
})(window);
