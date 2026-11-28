/* =========================================================
   community.js – Lưu yêu thích và bình luận (bản demo trình duyệt)
   Dữ liệu dùng localStorage; chưa đồng bộ với máy chủ hoặc thiết bị khác.
   Phụ thuộc: data.js
   ========================================================= */
(function (global) {
  'use strict';

  var D = global.VCM.data;
  var FAVORITES_PREFIX = 'vcm_favorites:';
  var COMMENTS_KEY = 'vcm_comments';

  function parse(value, fallback) {
    try {
      var result = JSON.parse(value);
      return result == null ? fallback : result;
    } catch (e) {
      return fallback;
    }
  }

  function accountId() {
    var user = D.session.get();
    return user && user.username ? String(user.username).toLowerCase() : '';
  }

  function loginHref(next) {
    var destination = next || (global.location.pathname + global.location.search + global.location.hash);
    return 'login.html?next=' + encodeURIComponent(destination);
  }

  function favoritesKey() {
    var id = accountId();
    return id ? FAVORITES_PREFIX + encodeURIComponent(id) : '';
  }

  function favoriteIds() {
    var key = favoritesKey();
    if (!key) { return []; }
    var stored = parse(global.localStorage.getItem(key), []);
    return Array.isArray(stored) ? stored.filter(function (id) { return typeof id === 'string'; }) : [];
  }

  function saveFavoriteIds(ids) {
    var key = favoritesKey();
    if (!key) { return false; }
    global.localStorage.setItem(key, JSON.stringify(ids));
    return true;
  }

  function readComments() {
    var stored = parse(global.localStorage.getItem(COMMENTS_KEY), {});
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  }

  function writeComments(comments) {
    global.localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments));
  }

  function listComments(provinceId) {
    var comments = readComments()[provinceId];
    return Array.isArray(comments) ? comments.slice().sort(function (a, b) {
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    }) : [];
  }

  function addComment(provinceId, content) {
    var user = D.session.get();
    if (!user || !user.username) { throw new Error('Hãy đăng nhập để bình luận.'); }
    var text = String(content || '').trim();
    if (text.length < 2) { throw new Error('Bình luận cần có ít nhất 2 ký tự.'); }
    if (text.length > 600) { throw new Error('Bình luận không được vượt quá 600 ký tự.'); }

    var comments = readComments();
    if (!Array.isArray(comments[provinceId])) { comments[provinceId] = []; }
    var record = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      provinceId: provinceId,
      userId: String(user.username).toLowerCase(),
      displayName: String(user.fullName || user.username),
      content: text,
      createdAt: new Date().toISOString()
    };
    comments[provinceId].push(record);
    writeComments(comments);
    return record;
  }

  function deleteComment(provinceId, commentId) {
    var currentUserId = accountId();
    if (!currentUserId) { return false; }
    var comments = readComments();
    var list = Array.isArray(comments[provinceId]) ? comments[provinceId] : [];
    var index = list.findIndex(function (comment) {
      return comment.id === commentId && comment.userId === currentUserId;
    });
    if (index < 0) { return false; }
    list.splice(index, 1);
    comments[provinceId] = list;
    writeComments(comments);
    return true;
  }

  global.VCM = global.VCM || {};
  global.VCM.community = {
    favoriteIds: favoriteIds,
    isFavorite: function (provinceId) { return favoriteIds().indexOf(provinceId) >= 0; },
    toggleFavorite: function (provinceId) {
      var ids = favoriteIds(), index = ids.indexOf(provinceId);
      if (index >= 0) { ids.splice(index, 1); saveFavoriteIds(ids); return false; }
      ids.push(provinceId); saveFavoriteIds(ids); return true;
    },
    removeFavorite: function (provinceId) {
      var ids = favoriteIds(), next = ids.filter(function (id) { return id !== provinceId; });
      saveFavoriteIds(next);
      return next.length !== ids.length;
    },
    listComments: listComments,
    addComment: addComment,
    deleteComment: deleteComment,
    accountId: accountId,
    loginHref: loginHref
  };
})(window);
