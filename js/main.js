/* =========================================================
   main.js – THÀNH PHẦN DÙNG CHUNG (jQuery)
   Header, Footer, menu di động, tìm kiếm nhanh, nút lên đầu trang,
   hiệu ứng cuộn, thẻ địa phương, ảnh giữ chỗ, thông báo.
   Phụ thuộc: jQuery, data.js
   ========================================================= */
(function (global, $) {
  'use strict';

  var D = global.VCM.data;
  var esc = D.escapeHtml;

  /* ---------- Biểu tượng SVG nội tuyến ---------- */
  var ICON = {
    search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    menu: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    arrow: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    up: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.6"/></svg>',
    bowl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M8 20h8M9 4c0 2 2 2 2 4M14 4c0 2 2 2 2 4"/></svg>',
    music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>'
  };

  var KIND_ICON = { destination: ICON.pin, specialty: ICON.bowl, art: ICON.music };
  var quickSearchRecords = null;
  var quickSearchLoad = null;

  /* ---------- Ảnh đại diện / ảnh giữ chỗ ---------- */
  var silhouettes = null; // Promise<{id: {d, vb}}>

  function loadSilhouettes() {
    if (!silhouettes) {
      silhouettes = D.getText(D.PATHS.mapSvg).then(function (text) {
        var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        var out = {};
        $(doc).find('path.province').each(function () {
          var id = this.getAttribute('data-province-id');
          if (this.getAttribute('id') === 'province-' + id + '-islands') { return; }
          var d = this.getAttribute('d'), re = /[ML]\s*(-?[\d.]+),(-?[\d.]+)/g, m;
          var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          while ((m = re.exec(d))) {
            var x = +m[1], y = +m[2];
            if (x < x0) { x0 = x; } if (x > x1) { x1 = x; }
            if (y < y0) { y0 = y; } if (y > y1) { y1 = y; }
          }
          out[id] = { d: d, vb: [x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4].join(' ') };
        });
        return out;
      });
      silhouettes.catch(function () { silhouettes = null; });
    }
    return silhouettes;
  }

  /** Đổ hình tỉnh (từ dữ liệu bản đồ) vào thẻ vùng miền ở trang chủ */
  function hydrateSilhouettes($root) {
    var $targets = $root.find('[data-silhouette]:not([data-hydrated])');
    if (!$targets.length) { return; }
    loadSilhouettes().then(function (map) {
      $targets.each(function () {
        var s = map[this.getAttribute('data-silhouette')];
        if (!s) { return; }
        $(this).attr('data-hydrated', '1').html('<svg viewBox="' + s.vb + '" aria-hidden="true"><path d="' + s.d + '"/></svg>');
      });
    });
  }

  /**
   * Ảnh bìa địa phương (thẻ, popup bản đồ). Luôn là ảnh thật <img>, phủ kín, object-fit: cover.
   * Chưa có file hoặc ảnh tải lỗi -> ảnh giữ chỗ (nền theo miền + biểu tượng), không dùng mảnh bản đồ.
   */
  function provinceThumbFallback(unit, macro, className) {
    return '<div class="thumb ' + (className || '') + '" data-region="' + macro + '" role="img" aria-label="' + esc(unit.name) + ' – chưa có ảnh bìa">' +
           '<div class="thumb-icon">' + ICON.pin + '</div>' +
           '<span class="thumb-note">Chưa có ảnh bìa</span></div>';
  }

  function provinceThumb(unit, className) {
    var img = unit.summary && unit.summary.image;
    var macro = unit.macro || '';
    if (img && img.file) {
      return '<div class="thumb ' + (className || '') + '" data-region="' + macro + '">' +
             '<img loading="lazy" src="' + esc(img.file) + '" alt="' + esc(img.alt || unit.name) + '" onerror="this.onerror=null;this.parentNode.classList.add(\'is-img-error\');this.remove();">' +
             '<div class="thumb-icon">' + ICON.pin + '</div></div>';
    }
    return provinceThumbFallback(unit, macro, className);
  }

  /** Ảnh giữ chỗ cho địa điểm / đặc sản / nghệ thuật: dùng ảnh nếu có file, nếu không dùng biểu tượng theo loại */
  function itemThumb(item, kind, macro, className) {
    var img = item.image;
    if (img && img.file) {
      return '<div class="thumb ' + (className || '') + '" data-region="' + (macro || '') + '"><img loading="lazy" src="' + esc(img.file) + '" alt="' + esc(img.alt || item.name) + '"></div>';
    }
    return '<div class="thumb ' + (className || '') + '" data-region="' + (macro || '') + '" role="img" aria-label="' + esc(item.name) + ' – chưa có ảnh được cấp phép">' +
           '<div class="thumb-icon">' + (KIND_ICON[kind] || ICON.pin) + '</div>' +
           '<span class="thumb-note">Chưa có ảnh được cấp phép</span></div>';
  }

  function macroBadge(ctx, macroId) {
    var r = ctx.macroById[macroId];
    return r ? '<span class="badge badge-region-' + macroId + '">' + esc(r.label) + '</span>' : '';
  }

  /** Thẻ địa phương (trang chủ, khám phá, trang chi tiết – địa phương liên quan) */
  function provinceCard(unit, ctx, opts) {
    opts = opts || {};
    var url = D.detailUrl(unit.id);
    var s = unit.summary;
    var dests = s.featuredDestinations.map(function (x) { return esc(x.name); }).slice(0, 2).join(', ');
    var specs = s.featuredSpecialties.map(function (x) { return esc(x.name); }).slice(0, 2).join(', ');
    var former = unit.formerUnits.length > 1
      ? '<p class="text-xs text-deep-600 mt-1">Hợp nhất từ ' + unit.formerUnits.map(function (u) { return esc(u.name); }).join(' · ') + '</p>' : '';
    var match = opts.matchNote ? '<p class="text-xs mt-1"><span class="badge badge-origin">Khớp tìm kiếm</span> ' + opts.matchNote + '</p>' : '';
    return '' +
      '<article class="card-hover bg-white rounded-2xl overflow-hidden shadow-card flex flex-col h-full" data-province-card="' + esc(unit.id) + '">' +
        '<a href="' + url + '" class="block" tabindex="-1" aria-hidden="true">' + provinceThumb(unit, 'h-44') + '</a>' +
        '<div class="p-4 flex flex-col gap-2 flex-1">' +
          '<div class="flex items-center gap-2 flex-wrap">' + macroBadge(ctx, unit.macro) +
            '<span class="text-xs text-gray-500">' + esc(unit.administrativeType) + '</span></div>' +
          '<h3 class="font-display text-xl font-bold text-deep-700 leading-snug"><a href="' + url + '" class="hover:text-crimson-600 focus-visible:text-crimson-600">' + esc(unit.name) + '</a></h3>' +
          '<p class="text-sm text-gray-700 line-clamp-3">' + esc(D.firstSentences(s.shortIntroduction, 2)) + '</p>' +
          former +
          '<dl class="text-sm mt-1 space-y-1">' +
            (dests ? '<div><dt class="inline font-semibold text-forest-700">Địa điểm:</dt> <dd class="inline">' + dests + '</dd></div>' : '') +
            (specs ? '<div><dt class="inline font-semibold text-ochre-600">Đặc sản:</dt> <dd class="inline">' + specs + '</dd></div>' : '') +
          '</dl>' + match +
          '<a href="' + url + '" class="btn-forest mt-auto self-start" style="margin-top:.75rem">' + (opts.cta || 'Khám phá') + ' ' + ICON.arrow + '</a>' +
        '</div>' +
      '</article>';
  }

  /* ---------- Thông báo nhỏ ---------- */
  function toast(message) {
    var $t = $('<div class="toast" role="status"></div>').text(message).appendTo('body');
    setTimeout(function () { $t.fadeOut(250, function () { $t.remove(); }); }, 3200);
  }

  /* ---------- Header ---------- */
  function renderHeader() {
    var $host = $('#site-header');
    if (!$host.length) { return; }
    var page = $('body').data('page');
    // Mọi trang đều dùng Global Background: header trong suốt (chữ trắng) ở đầu trang, đổi sang nền kính mờ khi cuộn
    var onHero = true;
    var user = D.session.get();
    var hash = global.location.hash;
    function cls(active) { return 'nav-link hdr-text' + (active ? ' is-active' : ''); }

    var account = user
      ? '<span class="hdr-text text-sm hidden xl:inline">Xin chào, <strong>' + esc(user.fullName || user.username) + '</strong></span>' +
        '<button type="button" id="logout-btn" class="btn-secondary !min-h-[2.5rem] !py-1.5 !px-4 text-sm">Đăng xuất</button>'
      : '<a href="login.html" class="hdr-text font-semibold px-3 py-2 rounded-lg hover:bg-white/10">Đăng nhập</a>' +
        '<a href="login.html#register" class="btn-primary !min-h-[2.5rem] !py-1.5 !px-4 text-sm">Đăng ký</a>';

    var accountMobile = user
      ? '<button type="button" id="logout-btn-m" class="btn-secondary w-full">Đăng xuất (' + esc(user.username) + ')</button>'
      : '<div class="flex gap-2"><a href="login.html" class="btn-secondary flex-1">Đăng nhập</a><a href="login.html#register" class="btn-primary flex-1">Đăng ký</a></div>';

    $host.html(
      '<header class="site-header ' + (onHero ? 'on-hero ' : '') + 'fixed top-0 inset-x-0 z-40">' +
        '<div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">' +
          '<a href="index.html" class="flex items-center gap-2.5 shrink-0" aria-label="Viet Culture Map – Trang chủ">' +
            '<img src="assets/icons/vietnam-silhouette.svg" alt="" class="h-10 w-auto">' +
            '<span class="leading-tight"><span class="hdr-text font-display font-bold text-lg block">Viet Culture Map</span>' +
            '<span class="hdr-text text-[11px] opacity-80 block -mt-0.5">Bản đồ văn hóa Việt Nam</span></span></a>' +
          '<nav class="hidden lg:flex items-center gap-7" aria-label="Điều hướng chính">' +
            '<a href="index.html" class="' + cls(page === 'home' && hash !== '#ban-do') + '">Trang chủ</a>' +
            '<a href="explore.html" class="' + cls(page === 'explore' || page === 'detail') + '">Khám phá</a>' +
            '<a href="index.html#ban-do" class="' + cls(page === 'home' && hash === '#ban-do') + '">Bản đồ</a>' +
            '<a href="about.html" class="' + cls(page === 'about') + '">Giới thiệu</a>' +
          '</nav>' +
          '<div class="flex items-center gap-1.5 sm:gap-2">' +
            '<button type="button" id="search-toggle" class="hdr-text w-11 h-11 rounded-full hover:bg-white/10 flex items-center justify-center" aria-label="Tìm kiếm" aria-expanded="false" aria-controls="search-panel">' + ICON.search + '</button>' +
            '<div class="hidden lg:flex items-center gap-2">' + account + '</div>' +
            '<button type="button" id="menu-toggle" class="lg:hidden hdr-text w-11 h-11 rounded-full hover:bg-white/10 flex items-center justify-center" aria-label="Mở menu" aria-expanded="false" aria-controls="mobile-menu">' + ICON.menu + '</button>' +
          '</div>' +
        '</div>' +
        '<div id="search-panel" class="hidden bg-cream border-t border-cream-200 shadow-lg">' +
          '<form id="header-search-form" class="max-w-3xl mx-auto px-4 py-3 flex gap-2" role="search" action="explore.html" method="get">' +
            '<label for="header-search-input" class="sr-only">Tìm kiếm</label>' +
            '<input id="header-search-input" name="q" type="search" class="field flex-1" placeholder="Tìm kiếm tỉnh thành, địa điểm hoặc đặc sản..." autocomplete="off">' +
            '<button type="submit" class="btn-primary">Tìm</button>' +
          '</form></div>' +
        '<div id="mobile-menu" class="mobile-menu lg:hidden bg-cream border-t border-cream-200">' +
          '<nav class="px-4 py-3 flex flex-col" aria-label="Điều hướng di động">' +
            '<a href="index.html" class="py-3 font-medium text-deep-700 border-b border-cream-200">Trang chủ</a>' +
            '<a href="explore.html" class="py-3 font-medium text-deep-700 border-b border-cream-200">Khám phá</a>' +
            '<a href="index.html#ban-do" class="py-3 font-medium text-deep-700 border-b border-cream-200">Bản đồ</a>' +
            '<a href="about.html" class="py-3 font-medium text-deep-700 mb-3">Giới thiệu</a>' +
            accountMobile +
          '</nav></div>' +
      '</header>'
    );
    enhanceQuickSearchForms();
  }

  function enhanceQuickSearchForms() {
    var $headerForm = $('#header-search-form');
    if ($headerForm.length && !$headerForm.find('input[type="search"]').hasClass('quick-search-input')) {
      $headerForm.wrap('<div class="quick-search-wrap quick-search-wrap-header"></div>');
      $headerForm.find('input[type="search"]').addClass('quick-search-input').attr({ 'aria-controls': 'header-search-results', 'aria-expanded': 'false', 'aria-autocomplete': 'list' });
      $headerForm.after('<div id="header-search-results" class="search-results hidden" role="listbox" aria-label="Kết quả tìm kiếm"></div>');
    }
    var $heroForm = $('#hero-search-form');
    if ($heroForm.length && !$heroForm.find('input[type="search"]').hasClass('quick-search-input')) {
      $heroForm.wrap('<div class="quick-search-wrap quick-search-wrap-hero"></div>');
      $heroForm.find('input[type="search"]').addClass('quick-search-input').attr({ 'aria-controls': 'hero-search-results', 'aria-expanded': 'false', 'aria-autocomplete': 'list' });
      $heroForm.after('<div id="hero-search-results" class="search-results hidden" role="listbox" aria-label="Kết quả tìm kiếm"></div>');
    }
    var $exploreInput = $('#q');
    if ($exploreInput.length && !$('#explore-search-results').length) {
      $exploreInput.addClass('quick-search-input').attr({ 'aria-controls': 'explore-search-results', 'aria-expanded': 'false', 'aria-autocomplete': 'list' });
      $exploreInput.parent().addClass('quick-search-wrap').append('<div id="explore-search-results" class="search-results hidden" role="listbox" aria-label="Kết quả tìm kiếm"></div>');
    }
  }

  /* ---------- Quick search ---------- */
  function loadQuickSearchRecords() {
    if (!quickSearchLoad) {
      quickSearchLoad = D.loadContext().then(function (ctx) {
        var rows = [], seen = {};
        ctx.units.forEach(function (unit) {
          var province = { kind: 'province', label: D.shortName(unit.name), unit: unit };
          province.normalized = D.normalize(province.label);
          rows.push(province);
          (unit.formerUnits || []).forEach(function (former) {
            rows.push({ kind: 'former', label: former.name, unit: unit, normalized: D.normalize(former.name) });
          });
          ['destinations', 'specialties', 'arts'].forEach(function (field) {
            (unit.searchNames[field] || []).forEach(function (label) {
              var kind = field === 'specialties' ? 'specialty' : field === 'arts' ? 'art' : 'destination';
              var key = kind + '|' + unit.id + '|' + D.normalize(label);
              if (seen[key]) { return; }
              seen[key] = true;
              rows.push({ kind: kind, label: label, unit: unit, normalized: D.normalize(label) });
            });
          });
        });
        quickSearchRecords = rows;
        return rows;
      }).catch(function (err) { quickSearchLoad = null; throw err; });
    }
    return quickSearchLoad;
  }

  function quickSearchMatches(query) {
    if (!quickSearchRecords) { return []; }
    var normalized = D.normalize(query), tokens = normalized.split(' ').filter(Boolean);
    if (!tokens.length) { return []; }
    return quickSearchRecords.map(function (row) {
      if (!tokens.every(function (token) { return row.normalized.indexOf(token) >= 0; })) { return null; }
      var rank = row.normalized === normalized ? 0 : row.normalized.indexOf(normalized) === 0 ? 1 : 2;
      var kindRank = row.kind === 'specialty' ? 0 : row.kind === 'destination' ? 1 : row.kind === 'art' ? 2 : row.kind === 'province' ? 3 : 4;
      return { row: row, rank: rank, kindRank: kindRank };
    }).filter(Boolean).sort(function (a, b) {
      return a.rank - b.rank || a.kindRank - b.kindRank || a.row.label.localeCompare(b.row.label, 'vi') ||
        D.shortName(a.row.unit.name).localeCompare(D.shortName(b.row.unit.name), 'vi');
    }).map(function (entry) { return entry.row; });
  }

  /** Khoảng cách chỉnh sửa (có hoán vị kề nhau) – chỉ giữ 3 hàng thay vì cả ma trận. */
  function editDistance(a, b) {
    var n = a.length, m = b.length;
    if (!n) { return m; }
    if (!m) { return n; }
    var prev2 = new Array(m + 1), prev = new Array(m + 1), cur = new Array(m + 1), tmp, c, r, v;
    for (c = 0; c <= m; c++) { prev[c] = c; }
    for (r = 1; r <= n; r++) {
      cur[0] = r;
      for (c = 1; c <= m; c++) {
        v = Math.min(prev[c] + 1, cur[c - 1] + 1, prev[c - 1] + (a.charAt(r - 1) === b.charAt(c - 1) ? 0 : 1));
        if (r > 1 && c > 1 && a.charAt(r - 1) === b.charAt(c - 2) && a.charAt(r - 2) === b.charAt(c - 1)) {
          v = Math.min(v, prev2[c - 2] + 1);
        }
        cur[c] = v;
      }
      tmp = prev2; prev2 = prev; prev = cur; cur = tmp;
    }
    return prev[m];
  }

  function fuzzyQuickSearchMatches(query) {
    if (!quickSearchRecords) { return []; }
    var tokens = D.normalize(query).split(' ').filter(Boolean);
    var letterCount = tokens.join('').length;
    if (letterCount < 3) { return []; }
    var maxTotal = Math.max(1, Math.floor(letterCount * 0.22));
    var ranked = quickSearchRecords.map(function (row) {
      var words = row.normalized.split(' '), score = 0;
      for (var i = 0; i < tokens.length; i++) {
        var best = Infinity, token = tokens[i];
        var tokenLimit = token.length >= 8 ? 2 : 1;
        words.forEach(function (word) {
          if (word.indexOf(token) >= 0 || token.indexOf(word) >= 0) { best = 0; return; }
          // Chênh lệch độ dài lớn hơn giới hạn thì chắc chắn vượt giới hạn: bỏ qua, kết quả không đổi.
          if (best === 0 || Math.abs(word.length - token.length) > tokenLimit) { return; }
          var distance = editDistance(token, word);
          if (distance < best) { best = distance; }
        });
        if (best > tokenLimit) { return null; }
        score += best;
      }
      return score <= maxTotal ? { row: row, score: score } : null;
    }).filter(Boolean);
    ranked.sort(function (a, b) {
      return a.score - b.score || a.row.label.localeCompare(b.row.label, 'vi') ||
        D.shortName(a.row.unit.name).localeCompare(D.shortName(b.row.unit.name), 'vi');
    });
    return ranked.map(function (entry) { return entry.row; });
  }

  function quickSearchUrl(row) {
    var url = 'detail.html?id=' + encodeURIComponent(row.unit.id);
    if (row.kind === 'specialty' || row.kind === 'destination' || row.kind === 'art') {
      url += '&itemKind=' + encodeURIComponent(row.kind) + '&itemName=' + encodeURIComponent(row.label);
      url += row.kind === 'specialty' ? '#dac-san' : row.kind === 'art' ? '#nghe-thuat' : '#dia-diem';
    }
    return url;
  }

  function renderQuickSearch(input) {
    var $input = $(input), resultsId = $input.attr('aria-controls'), $results = resultsId ? $('#' + resultsId) : $();
    var query = String($input.val() || '').trim();
    if (!$results.length) { return; }
    if (!query) { $results.addClass('hidden').empty(); $input.attr('aria-expanded', 'false'); return; }
    if (!quickSearchRecords) {
      $results.removeClass('hidden').html('<p class="search-results-note">\u0110ang t\u00ecm...</p>');
      loadQuickSearchRecords().then(function () {
        if (String($input.val() || '').trim() === query) { renderQuickSearch(input); scheduleExactOpen(input); }
      }).catch(function () { $results.html('<p class="search-results-note">Ch\u01b0a t\u1ea3i đ\u01b0\u1ee3c d\u1eef li\u1ec7u t\u00ecm ki\u1ebfm.</p>'); });
      return;
    }
    var matches = quickSearchMatches(query), fuzzy = false;
    if (!matches.length) { matches = fuzzyQuickSearchMatches(query); fuzzy = matches.length > 0; }
    var html = matches.map(function (row) {
      var context = row.kind === 'province' ? 'Hồ sơ địa phương' : D.shortName(row.unit.name);
      return '<a class="search-result" role="option" href="' + esc(quickSearchUrl(row)) + '">' +
        '<span class="search-result-copy"><span class="search-result-name">' + esc(row.label) + '</span>' +
        '<span class="search-result-meta">' + esc(context) + '</span></span>' +
        '<span class="search-result-action">Mở trang <span aria-hidden="true">→</span></span></a>';
    }).join('');
    var note = fuzzy ? '<p class="search-results-note">Kh\u00f4ng t\u00ecm th\u1ea5y ch\u00ednh x\u00e1c. G\u1ee3i ý g\u1ea7n đ\u00fang:</p>' : '';
    $results.html(note + (html || '<p class="search-results-note">Kh\u00f4ng t\u00ecm th\u1ea5y m\u1ee5c ph\u00f9 h\u1ee3p.</p>')).removeClass('hidden');
    $input.attr('aria-expanded', 'true');
  }

  function scheduleExactOpen(input) {
    global.clearTimeout(input._quickSearchTimer);
    if (!quickSearchRecords) { return; }
    var query = D.normalize($(input).val());
    if (!query) { return; }
    var exact = quickSearchRecords.filter(function (row) { return row.normalized === query; });
    if (exact.length !== 1) { return; }
    input._quickSearchTimer = global.setTimeout(function () {
      if (D.normalize($(input).val()) === query) { global.location.href = quickSearchUrl(exact[0]); }
    }, 650);
  }

  function openQuickSearch(input) {
    if (!input) { return; }
    var query = String($(input).val() || '').trim();
    if (!query) { return; }
    global.clearTimeout(input._quickSearchTimer);
    if (!quickSearchRecords) { loadQuickSearchRecords().then(function () { openQuickSearch(input); }); return; }
    var normalized = D.normalize(query), exact = quickSearchRecords.filter(function (row) { return row.normalized === normalized; });
    var matches = quickSearchMatches(query);
    if (exact.length === 1) { global.location.href = quickSearchUrl(exact[0]); }
    else if (matches.length === 1) { global.location.href = quickSearchUrl(matches[0]); }
    else { renderQuickSearch(input); }
  }

  function bindQuickSearch() {
    enhanceQuickSearchForms();
    $(document).on('input', '.quick-search-input', function () { renderQuickSearch(this); scheduleExactOpen(this); });
    $(document).on('keydown', '.quick-search-input', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); openQuickSearch(this); }
      else if (e.key === 'Escape') { global.clearTimeout(this._quickSearchTimer); $(this).val('').trigger('input'); }
    });
    $(document).on('submit', '#header-search-form, #hero-search-form', function (e) {
      e.preventDefault();
      openQuickSearch($(this).find('.quick-search-input')[0]);
    });
    $(document).on('click', 'a[href^="explore.html?q="]', function (e) {
      var input = $('#hero-search-input')[0];
      if (!input) { return; }
      var query = new global.URL(this.href, global.location.href).searchParams.get('q');
      if (query) { e.preventDefault(); $(input).val(query).trigger('input').trigger('focus'); }
    });
    loadQuickSearchRecords().catch(function () {});
  }

  /* ---------- Footer ---------- */
  function renderFooter() {
    var $host = $('#site-footer');
    if (!$host.length) { return; }
    $host.html(
      '<footer class="site-footer text-cream-200 mt-20">' +
        '<div class="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-2 lg:grid-cols-4">' +
          '<div>' +
            '<div class="flex items-center gap-2.5 mb-3"><img src="assets/icons/vietnam-silhouette.svg" alt="" class="h-10 w-auto">' +
            '<span class="font-display font-bold text-xl text-white">Viet Culture Map</span></div>' +
            '<p class="text-sm leading-relaxed opacity-90">Nền tảng bản đồ tương tác giúp khám phá văn hóa, lịch sử, ẩm thực và di sản của 34 đơn vị hành chính cấp tỉnh, kế thừa giá trị của mọi đơn vị tiền thân.</p>' +
          '</div>' +
          '<div><h2 class="font-semibold text-white mb-3">Điều hướng</h2><ul class="space-y-2 text-sm">' +
            '<li><a class="hover:text-ochre-400" href="index.html">Trang chủ</a></li>' +
            '<li><a class="hover:text-ochre-400" href="explore.html">Khám phá</a></li>' +
            '<li><a class="hover:text-ochre-400" href="index.html#ban-do">Bản đồ</a></li>' +
            '<li><a class="hover:text-ochre-400" href="about.html">Giới thiệu</a></li>' +
            '<li><a class="hover:text-ochre-400" href="login.html">Đăng nhập / Đăng ký</a></li></ul></div>' +
          '<div><h2 class="font-semibold text-white mb-3">Nguồn dữ liệu</h2><ul class="space-y-2 text-sm">' +
            '<li>Hồ sơ nội dung: <a class="underline hover:text-ochre-400" href="data/sources.json" target="_blank" rel="noopener">354 nguồn tham khảo</a> (Nghị quyết 202/2025/QH15, Cục Thống kê, cổng thông tin địa phương…)</li>' +
            '<li>Ranh giới hành chính: <a class="underline hover:text-ochre-400" href="https://github.com/nguyenduy1133/Free-GIS-Data" target="_blank" rel="noopener">Free-GIS-Data (Nguyễn Duy Liêm)</a>, đã làm mịn đường biên.</li>' +
            '<li>Ảnh: chưa dùng ảnh chưa xác minh giấy phép.</li></ul></div>' +
          '<div><h2 class="font-semibold text-white mb-3">Liên hệ</h2>' +
            '<p class="text-sm opacity-90" id="footer-contact">Kênh liên hệ chưa được cấu hình cho bản này.</p>' +
            '<p class="text-xs opacity-70 mt-3">Đăng nhập/đăng ký trên website là mô phỏng phía trình duyệt, không có xác thực tài khoản thực tế.</p></div>' +
        '</div>' +
        '<div class="border-t border-white/10"><p class="max-w-7xl mx-auto px-4 sm:px-6 py-5 text-xs opacity-70">© ' + new Date().getFullYear() + ' Viet Culture Map. Nội dung hồ sơ ở trạng thái “cần rà soát” cho đến khi được xác minh; xem ghi chú dữ liệu trong từng trang địa phương.</p></div>' +
      '</footer>'
    );
  }

  /* ---------- Hành vi dùng chung ---------- */
  function bindShell() {
    function $hdr() { return $('.site-header'); }

    function onScroll() {
      var y = $(global).scrollTop();
      $hdr().toggleClass('is-scrolled', y > 24);
      $('#back-to-top').toggleClass('is-visible', y > 600);
    }

    $('body').append('<button type="button" id="back-to-top" class="back-to-top" aria-label="Về đầu trang">' + ICON.up + '</button>');
    $(document).on('click', '#back-to-top', function () { global.scrollTo({ top: 0, behavior: 'smooth' }); });
    $(global).on('scroll', onScroll);
    onScroll();

    // Menu hamburger
    $(document).on('click', '#menu-toggle', function () {
      var open = !$('#mobile-menu').hasClass('is-open');
      $('#mobile-menu').toggleClass('is-open', open);
      $(this).attr({ 'aria-expanded': open, 'aria-label': open ? 'Đóng menu' : 'Mở menu' }).html(open ? ICON.close : ICON.menu);
      if (open) { $hdr().addClass('is-scrolled'); } else { onScroll(); }
    });
    $(document).on('click', '#mobile-menu a', function () { $('#menu-toggle').trigger('click'); });

    // Ô tìm kiếm nhanh
    $(document).on('click', '#search-toggle', function () {
      var $panel = $('#search-panel');
      var show = $panel.hasClass('hidden');
      $panel.toggleClass('hidden', !show);
      $(this).attr('aria-expanded', show);
      if (show) { $hdr().addClass('is-scrolled'); $('#header-search-input').trigger('focus'); } else { onScroll(); }
    });
    $(document).on('keydown', function (e) {
      if (e.key === 'Escape' && !$('#search-panel').hasClass('hidden')) { $('#search-toggle').trigger('click').trigger('focus'); }
    });

    // Đăng xuất (mô phỏng)
    $(document).on('click', '#logout-btn, #logout-btn-m', function () {
      D.session.clear();
      toast('Đã đăng xuất.');
      setTimeout(function () { global.location.reload(); }, 500);
    });

    // Cập nhật trạng thái active khi đổi hash (Bản đồ)
    $(global).on('hashchange', function () { renderHeader(); onScroll(); });

    // Hiệu ứng xuất hiện khi cuộn
    if ('IntersectionObserver' in global) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) { return; }
          var el = en.target;
          el.classList.add('is-in'); io.unobserve(el);
          // Hiện xong thì bỏ độ trễ stagger (class .is-revealed) để hover/tương tác không bị trễ
          el.addEventListener('transitionend', function done(e) {
            if (e.target !== el || e.propertyName !== 'opacity') { return; }
            el.removeEventListener('transitionend', done); el.classList.add('is-revealed');
          });
        });
      }, { threshold: 0.12 });
      global.VCM.ui.observeReveal = function ($root) { ($root || $(document)).find('.reveal:not(.is-in)').each(function () { io.observe(this); }); };
    } else {
      global.VCM.ui.observeReveal = function ($root) { ($root || $(document)).find('.reveal').addClass('is-in'); };
    }
    global.VCM.ui.observeReveal();
  }

  global.VCM.ui = {
    ICON: ICON, provinceThumb: provinceThumb, itemThumb: itemThumb, macroBadge: macroBadge,
    provinceCard: provinceCard, hydrateSilhouettes: hydrateSilhouettes, toast: toast,
    loadSilhouettes: loadSilhouettes
  };

  $(function () {
    renderHeader();
    renderFooter();
    bindShell();
    bindQuickSearch();
  });
})(window, jQuery);
