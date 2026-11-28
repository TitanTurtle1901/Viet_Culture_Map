/* =========================================================
   favorites.js – Danh sách địa phương đã lưu (bản demo trình duyệt)
   Phụ thuộc: jQuery, data.js, community.js, main.js
   ========================================================= */
(function (global, $) {
  'use strict';

  var D = global.VCM.data, U = global.VCM.ui, C = global.VCM.community;
  var $status = $('#favorites-status'), $grid = $('#favorites-grid');

  function render(ctx) {
    var ids = C.favoriteIds();
    var units = ids.map(function (id) { return ctx.byId[id]; }).filter(Boolean);
    if (!units.length) {
      $grid.empty();
      $status.html('<p class="community-empty">Bạn chưa lưu địa phương nào. Mở hồ sơ một tỉnh/thành và nhấn “Lưu yêu thích”.</p>');
      return;
    }
    $status.text('Bạn đã lưu ' + units.length + ' địa phương.');
    $grid.html(units.map(function (unit) { return U.provinceCard(unit, ctx, { cta: 'Xem hồ sơ' }); }).join(''));
    U.hydrateSilhouettes($grid);
    $grid.find('[data-province-card]').each(function () {
      var id = String($(this).attr('data-province-card'));
      $(this).find('.p-4').append('<button type="button" class="btn-secondary favorite-remove" data-province-id="' + D.escapeHtml(id) + '">Xóa khỏi danh sách</button>');
    });
  }

  $(function () {
    if (!D.session.get()) {
      $status.html('<div class="community-login-note"><p>Đăng nhập để xem danh sách địa phương bạn đã lưu.</p><a class="btn-forest mt-3" href="' +
        D.escapeHtml(C.loginHref('favorites.html')) + '">Đăng nhập</a></div>');
      return;
    }
    $grid.on('click', '.favorite-remove', function () {
      C.removeFavorite(String($(this).data('province-id')));
      D.loadContext().then(render).catch(function () { $status.text('Chưa tải được danh sách địa phương. Hãy tải lại trang.'); });
    });
    D.loadContext().then(render).catch(function () {
      $status.text('Chưa tải được danh sách địa phương. Hãy chạy dự án bằng VS Code Live Server.');
    });
  });
})(window, jQuery);
