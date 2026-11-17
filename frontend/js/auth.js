/*
 * Session handling. The JWT and the safe user profile are kept in localStorage.
 * (localStorage is readable by any script on the page, which is why all rendering uses textContent only.)
 */
(function () {
  'use strict';
  var RHP = (window.RHP = window.RHP || {});
  var TOKEN = 'rhp.token', USER = 'rhp.user';

  function store() { try { return window.localStorage; } catch (e) { return null; } }
  function read(k) { var s = store(); return s ? s.getItem(k) : null; }
  function write(k, v) { var s = store(); if (s) s.setItem(k, v); }
  function remove(k) { var s = store(); if (s) s.removeItem(k); }

  /** True if the token's exp claim is in the past (the server still decides; this just avoids useless calls). */
  function tokenExpired(token) {
    try {
      var payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.exp ? payload.exp * 1000 <= Date.now() : false;
    } catch (e) { return true; }
  }

  var HOME = { USER: 'dashboard.html', PHARMACY: 'pharmacy-dashboard.html', HEALTHCARE_PROVIDER: 'provider-dashboard.html', ADMIN: 'admin.html' };

  var auth = (RHP.auth = {
    tokenExpired: tokenExpired,
    getToken: function () { var t = read(TOKEN); return t && !tokenExpired(t) ? t : null; },
    getUser: function () { try { return JSON.parse(read(USER)); } catch (e) { return null; } },
    isLoggedIn: function () { return !!auth.getToken() && !!auth.getUser(); },
    hasRole: function (roles) { var u = auth.getUser(); return !!u && roles.indexOf(u.role) >= 0; },
    homeFor: function (role) { return HOME[role] || 'index.html'; },
    setSession: function (resp) {
      write(TOKEN, resp.token);
      write(USER, JSON.stringify(resp.user));
      if (resp.user && resp.user.language && window.I18n) window.I18n.setLanguage(resp.user.language);
      return resp.user;
    },
    updateStoredUser: function (user) { write(USER, JSON.stringify(user)); },
    clear: function () { remove(TOKEN); remove(USER); },
    login: function (email, password) {
      return RHP.api.post('/auth/login', { email: email, password: password }, { auth: false }).then(auth.setSession);
    },
    register: function (body) {
      return RHP.api.post('/auth/register', body, { auth: false }).then(auth.setSession);
    },
    logout: function () { auth.clear(); RHP.nav.go('index.html'); },
    refreshUser: function () {
      return RHP.api.get('/users/me').then(function (u) { auth.updateStoredUser(u); return u; });
    },
    /** Called by the API client when a logged-in request gets 401 (expired or disabled). */
    handleExpired: function () {
      auth.clear();
      var here = window.location.pathname.split('/').pop() + window.location.search;
      RHP.nav.go('login.html?next=' + encodeURIComponent(here));
    },
    /** Only plain relative page names may be used as a post-login destination (blocks open redirects). */
    safeNext: function (next, fallback) {
      return typeof next === 'string' && /^[a-z0-9_-]+\.html(\?[A-Za-z0-9_=&%.-]*)?$/i.test(next) ? next : fallback;
    }
  });
})();
