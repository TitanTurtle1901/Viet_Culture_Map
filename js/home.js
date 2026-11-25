/* =========================================================
   home.js – CÁC KHU VỰC CỦA TRANG CHỦ (jQuery)
   Hero toàn màn hình (ảnh nền ngẫu nhiên / slideshow từ ảnh bìa các tỉnh),
   địa phương nổi bật, khám phá theo vùng miền, số liệu giới thiệu,
   ô tìm kiếm ở Hero. Phụ thuộc: jQuery, data.js, main.js
   ========================================================= */
(function (global, $) {
  'use strict';

  var D = global.VCM.data, U = global.VCM.ui, esc = D.escapeHtml;

  function regionCard(r, units) {
    var names = r.provinceIds.slice(0, 4).map(function (id) { return esc(D.shortName(units[id].name)); }).join(' · ');
    var url = D.exploreUrl({ region: r.id });
    return '<article class="reveal card-hover bg-white rounded-2xl overflow-hidden shadow-card flex flex-col">' +
      '<a href="' + url + '" tabindex="-1" aria-hidden="true" class="block">' +
        '<div class="thumb h-40" data-region="' + r.id + '"><div class="silhouette" data-region-silhouettes="' + r.id + '" style="gap:.25rem">' +
        r.provinceIds.slice(0, 3).map(function (id) { return '<div class="h-full" data-silhouette="' + esc(id) + '" style="height:100%;display:flex;align-items:center"></div>'; }).join('') +
        '</div></div></a>' +
      '<div class="p-5 flex flex-col gap-2 flex-1">' +
        '<h3 class="font-display text-2xl font-bold text-deep-700">' + esc(r.label) + '</h3>' +
        '<p class="text-sm text-gray-700 leading-relaxed">' + esc(r.description) + '</p>' +
        '<p class="text-xs text-gray-500">' + r.provinceIds.length + ' đơn vị cấp tỉnh · ' + names + '…</p>' +
        '<a href="' + url + '" class="btn-forest self-start mt-auto" style="margin-top:.75rem">Khám phá ' + esc(r.label.toLowerCase()) + ' ' + U.ICON.arrow + '</a>' +
      '</div></article>';
  }

  /* Hiệu ứng đếm số từ 0 khi cuộn tới (giống trang Giới thiệu) */
  function countUp(el) {
    var end = +el.getAttribute('data-count');
    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = D.formatNumber(end, 0); return; }
    var t0 = global.performance.now(), dur = 1200;
    function tick(t) {
      var p = Math.min((t - t0) / dur, 1);
      el.textContent = D.formatNumber(Math.round(end * (1 - Math.pow(1 - p, 3))), 0);
      if (p < 1) { global.requestAnimationFrame(tick); }
    }
    global.requestAnimationFrame(tick);
  }

  function observeCounters($root) {
    if (!('IntersectionObserver' in global)) { return; } // giữ nguyên số tĩnh
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) { return; }
        countUp(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.6 });
    $root.find('[data-count]').each(function () { io.observe(this); });
  }

  /* ---------- Hero: ảnh nền ngẫu nhiên / slideshow ----------
     Ảnh KHÔNG được tự đặt đường dẫn: chỉ lấy ảnh bìa (summary.image.file) của các tỉnh trong
     data/provinces/index.json. Danh sách dưới đây chỉ chọn những tỉnh có ảnh bìa phong cảnh
     ngang, đủ nét cho màn hình lớn (>= 900px) và không dính logo/watermark. Muốn thêm/bớt ảnh
     chỉ cần sửa danh sách; focus = vị trí cắt ảnh (object-position) cho từng ảnh. */
  var HERO_POOL = [
    { id: 'lang-son',  focus: 'center 40%' },
    { id: 'lao-cai',   focus: 'center 45%' },
    { id: 'hue',       focus: 'center 55%' },
    { id: 'ha-noi',    focus: 'center 60%' },
    { id: 'da-nang',   focus: 'center 55%' },
    { id: 'nghe-an',   focus: 'center 55%' },
    { id: 'bac-ninh',  focus: 'center 40%' },
    { id: 'dong-thap', focus: 'center 60%' }
  ];
  var HERO_INTERVAL = 7000;           // thời gian giữ mỗi ảnh (ms)
  var HERO_LAST_KEY = 'vcm_hero_last'; // nhớ ảnh vừa hiển thị để lần tải lại không lặp lại ngay

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function initHero(ctx) {
    var host = document.getElementById('hero-media');
    if (!host) { return; }

    // Chỉ giữ ảnh có trong dữ liệu; nếu ảnh nào lỗi lúc tải sẽ bị loại khỏi vòng lặp
    var pool = HERO_POOL.map(function (p) {
      var u = ctx.byId[p.id], img = u && u.summary && u.summary.image;
      return img && img.file ? { id: p.id, src: encodeURI(img.file), focus: p.focus } : null;
    }).filter(Boolean);
    if (!pool.length) { return; } // không có ảnh -> giữ nền gradient dự phòng

    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var saveData = global.navigator.connection && global.navigator.connection.saveData;
    var auto = !reduce && !saveData && pool.length > 1; // tiết kiệm dữ liệu / giảm chuyển động: chỉ 1 ảnh tĩnh

    var last = null;
    try { last = global.sessionStorage.getItem(HERO_LAST_KEY); } catch (e) { /* bỏ qua */ }

    // Thứ tự ngẫu nhiên; ảnh đầu tiên khác ảnh của lần tải trước
    var queue = shuffle(pool);
    if (queue.length > 1 && queue[0].id === last) { queue.push(queue.shift()); }

    var current = null, timer = null, busy = false;

    function load(item) { // preload từng ảnh một, tránh tải dồn nhiều ảnh cùng lúc
      return new Promise(function (resolve, reject) {
        var img = new global.Image();
        img.className = 'hero-slide';
        img.alt = '';
        img.decoding = 'async';
        img.style.objectPosition = item.focus;
        img.onload = function () { resolve(img); };
        img.onerror = function () { reject(item); };
        img.src = item.src;
      });
    }

    function nextItem() {
      if (!queue.length) { // hết một vòng: xáo lại, không để ảnh đầu vòng mới trùng ảnh đang hiện
        queue = shuffle(pool);
        if (queue.length > 1 && current && queue[0].id === current.id) { queue.push(queue.shift()); }
      }
      return queue.shift();
    }

    function drop(item) { // ảnh lỗi: bỏ khỏi vòng lặp
      pool = pool.filter(function (p) { return p.id !== item.id; });
      queue = queue.filter(function (p) { return p.id !== item.id; });
      if (global.console && global.console.warn) { global.console.warn('[Hero] Không tải được ảnh nền:', item.src); }
    }

    function show(item) {
      return load(item).then(function (img) {
        var prev = host.querySelector('.hero-slide.is-active');
        host.appendChild(img);
        global.requestAnimationFrame(function () { global.requestAnimationFrame(function () {
          img.classList.add('is-active');
          if (prev) {
            prev.classList.remove('is-active');
            global.setTimeout(function () { if (prev.parentNode) { prev.parentNode.removeChild(prev); } }, 1800);
          }
        }); });
        current = item;
        try { global.sessionStorage.setItem(HERO_LAST_KEY, item.id); } catch (e) { /* bỏ qua */ }
      }, function (bad) { drop(bad); throw bad; });
    }

    // Thử lần lượt cho tới khi có một ảnh tải được (hoặc hết ảnh -> giữ gradient dự phòng)
    function advance() {
      if (busy || !pool.length) { return Promise.resolve(); }
      busy = true;
      function attempt() {
        if (!pool.length) { return Promise.resolve(); }
        return show(nextItem()).catch(function () { return attempt(); });
      }
      return attempt().then(function () { busy = false; }, function () { busy = false; });
    }

    function schedule() {
      global.clearTimeout(timer);
      if (!auto || pool.length < 2) { return; }
      timer = global.setTimeout(function () { advance().then(schedule); }, HERO_INTERVAL);
    }

    advance().then(schedule);

    // Dừng slideshow khi tab bị ẩn để không tải/đổi ảnh vô ích
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { global.clearTimeout(timer); } else { schedule(); }
    });
  }

  function init() {
    // Hero độc lập với phần còn lại: lỗi dữ liệu không làm mất nội dung Hero (vẫn có nền gradient)
    D.loadContext().then(initHero).catch(function (e) { if (global.console) { global.console.error('[Hero] Không khởi tạo được ảnh nền:', e); } /* giữ nền dự phòng */ });

    D.loadContext().then(function (ctx) {
      // Địa phương nổi bật
      var html = ctx.featuredIds.map(function (id) { return ctx.byId[id]; }).filter(Boolean).map(function (u) {
        return '<div class="reveal">' + U.provinceCard(u, ctx) + '</div>';
      }).join('');
      $('#featured-grid').html(html);

      // Vùng miền
      $('#region-rule').text(ctx.regionRule);
      $('#region-grid').html(ctx.regions.map(function (r) { return regionCard(r, ctx.byId); }).join(''));

      // Số liệu giới thiệu – tính từ dữ liệu thật
      var former = 0, places = 0, specs = 0;
      ctx.units.forEach(function (u) {
        former += u.formerUnits.length;
        places += u.searchNames.destinations.length;
        specs += u.searchNames.specialties.length;
      });
      function stat(n, label) {
        return '<li class="bg-white/10 rounded-2xl p-5"><p class="font-display text-4xl font-bold text-ochre-400" data-count="' + n + '">' + D.formatNumber(n, 0) + '</p><p class="text-sm mt-1">' + label + '</p></li>';
      }
      $('#about-stats').html(stat(ctx.units.length, 'đơn vị cấp tỉnh hiện hành') + stat(former, 'đơn vị tiền thân được kế thừa') + stat(places, 'địa điểm trong hồ sơ') + stat(specs, 'đặc sản trong hồ sơ'));

      observeCounters($('#about-stats'));
      U.hydrateSilhouettes($('#featured-grid, #region-grid'));
      U.observeReveal($(document));
    }).catch(function (err) {
      $('#featured-grid').html('<p class="col-span-full text-center text-crimson-700" role="alert">Không tải được dữ liệu: ' + esc(err.message) + '. Hãy chạy dự án bằng VS Code Live Server.</p>');
    });
  }

  $(init);
})(window, jQuery);
