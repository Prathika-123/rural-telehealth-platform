/* REST client for /api/v1. Every failure becomes an ApiError with the backend's stable "code". */
(function () {
  'use strict';
  var RHP = (window.RHP = window.RHP || {});

  function ApiError(status, code, message, fieldErrors) {
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.message = message;
    this.fieldErrors = fieldErrors || null;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  /** {a:1, b:'', c:null, d:'x y'} -> "?a=1&d=x%20y" (empty values are skipped) */
  function qs(obj) {
    var parts = [];
    Object.keys(obj || {}).forEach(function (k) {
      var v = obj[k];
      if (v === null || v === undefined || v === '') return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  function request(method, path, opts) {
    opts = opts || {};
    var headers = { Accept: 'application/json' };
    var token = RHP.auth ? RHP.auth.getToken() : null;
    var useAuth = opts.auth !== false && token;
    if (useAuth) headers.Authorization = 'Bearer ' + token;
    var init = { method: method, headers: headers };
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    var url = ((window.RHP_CONFIG && window.RHP_CONFIG.apiBase) || '') + '/api/v1' + path + qs(opts.query);

    return fetch(url, init).then(function (res) {
      if (res.status === 204) return null;
      return res.json().catch(function () { return null; }).then(function (data) {
        if (res.ok) return data;
        if (res.status === 401 && useAuth && RHP.auth) RHP.auth.handleExpired();
        throw new ApiError(res.status, (data && data.code) || 'INTERNAL_ERROR',
          (data && data.message) || 'Request failed', data && data.fieldErrors);
      });
    }, function () {
      throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.');
    });
  }

  RHP.api = {
    ApiError: ApiError,
    qs: qs,
    get: function (path, query, opts) { return request('GET', path, Object.assign({ query: query }, opts)); },
    post: function (path, body, opts) { return request('POST', path, Object.assign({ body: body === undefined ? {} : body }, opts)); },
    put: function (path, body) { return request('PUT', path, { body: body }); },
    patch: function (path, body) { return request('PATCH', path, { body: body === undefined ? {} : body }); },
    del: function (path) { return request('DELETE', path); }
  };
})();
