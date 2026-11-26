/* UI helpers. Elements are built with h() and textContent, never innerHTML with data, so server text cannot inject markup. */
(function () {
  'use strict';
  var RHP = (window.RHP = window.RHP || {});
  // All redirects go through here so tests (and future SPA routing) can intercept them.
  RHP.nav = RHP.nav || {
    go: function (url) { window.location.href = url; },
    replace: function (url) { window.location.replace(url); }
  };
  var ui = (RHP.ui = {});

  function t(key, params) { return window.I18n.t(key, params); }

  function appendAll(el, list) {
    list.forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) appendAll(el, c);
      else el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
    });
  }

  /** h('div', {class:'x', onClick: fn, 'aria-label': '...'}, child, 'text', [more]) */
  ui.h = function (tag, attrs) {
    var el = document.createElement(tag);
    var children = Array.prototype.slice.call(arguments, 2);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
        else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      });
    }
    appendAll(el, children);
    return el;
  };
  var h = ui.h;

  ui.$ = function (sel, root) { return (root || document).querySelector(sel); };
  ui.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  ui.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  ui.replace = function (el) { ui.clear(el); appendAll(el, Array.prototype.slice.call(arguments, 1)); return el; };

  ui.debounce = function (fn, ms) {
    var timer;
    return function () {
      var args = arguments, self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  };

  // ---------- messages ----------
  ui.alert = function (kind, message) { return h('div', { class: 'alert ' + kind, role: kind === 'error' ? 'alert' : 'status' }, message); };
  ui.errorText = function (err) {
    if (err && err.code) return window.I18n.error(err.code, err.message);
    return window.I18n.error('INTERNAL_ERROR');
  };
  ui.showError = function (container, err) { ui.replace(container, ui.alert('error', ui.errorText(err))); };
  ui.spinner = function () { return h('div', { class: 'spinner', role: 'status', 'aria-label': t('common.loading') }); };
  ui.badge = function (text, kind) { return h('span', { class: 'badge' + (kind ? ' ' + kind : '') }, text); };

  ui.toast = function (message, kind) {
    var box = ui.$('.toasts');
    if (!box) { box = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(box); }
    var el = h('div', { class: 'toast' + (kind === 'error' ? ' error' : '') }, message);
    box.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 4500);
  };

  // ---------- dialogs ----------
  function openDialog(dlg) {
    document.body.appendChild(dlg);
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }
  function closeDialog(dlg) {
    if (typeof dlg.close === 'function') { try { dlg.close(); } catch (e) { /* already closed */ } }
    dlg.removeAttribute('open');
    if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
  }
  /** Generic modal. Returns {el, close}. The caller puts a form or content in `body`. */
  ui.dialog = function (title, body) {
    var dlg = h('dialog', { 'aria-label': title }, h('h2', null, title), body);
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); closeDialog(dlg); });
    openDialog(dlg);
    return { el: dlg, close: function () { closeDialog(dlg); } };
  };
  /** Yes/No confirmation. Resolves true or false. */
  ui.confirm = function (message, confirmLabel) {
    return new Promise(function (resolve) {
      var d;
      function done(v) { d.close(); resolve(v); }
      d = ui.dialog(message, h('div', { class: 'row' },
        h('button', { class: 'btn danger', type: 'button', onClick: function () { done(true); } }, confirmLabel || t('common.delete')),
        h('button', { class: 'btn secondary', type: 'button', onClick: function () { done(false); } }, t('common.cancel'))));
    });
  };

  // ---------- forms ----------
  /**
   * Builds one labelled form field. Native browser validation is not used (it shows English messages),
   * so forms set `novalidate` and call setError() with translated text.
   */
  ui.field = function (o) {
    var id = o.id, input;
    if (o.type === 'select') {
      input = h('select', { id: id, name: o.name || id });
      (o.options || []).forEach(function (opt) {
        input.appendChild(h('option', { value: opt.value, selected: String(opt.value) === String(o.value), 'data-i18n': opt.labelKey },
          opt.labelKey ? t(opt.labelKey) : opt.label));
      });
    } else if (o.type === 'textarea') {
      input = h('textarea', { id: id, name: o.name || id, maxlength: o.maxlength }, o.value || '');
    } else {
      input = h('input', { id: id, name: o.name || id, type: o.type || 'text', value: o.value !== undefined && o.value !== null ? o.value : '',
        autocomplete: o.autocomplete, inputmode: o.inputmode, min: o.min, max: o.max, step: o.step,
        maxlength: o.maxlength, list: o.list, placeholder: o.placeholderKey ? t(o.placeholderKey) : o.placeholder,
        'data-i18n-placeholder': o.placeholderKey, readonly: o.readonly });
    }
    if (o.required) input.setAttribute('aria-required', 'true');
    var err = h('div', { class: 'error-text', id: id + '-err', role: 'alert' });
    var describedBy = id + '-err';
    var hint = null;
    if (o.hint || o.hintKey) {
      hint = h('div', { class: 'hint', id: id + '-hint', 'data-i18n': o.hintKey }, o.hintKey ? t(o.hintKey) : o.hint);
      describedBy = id + '-hint ' + describedBy;
    }
    input.setAttribute('aria-describedby', describedBy);
    var wrap = h('div', { class: 'field' }, h('label', { for: id, 'data-i18n': o.labelKey }, o.labelKey ? t(o.labelKey) : o.label), hint, input, err);
    return {
      el: wrap, input: input, rules: o.rules || [],
      value: function () { return o.trim === false ? input.value : input.value.trim(); },
      setError: function (msg) {
        err.textContent = msg || '';
        if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
      }
    };
  };

  /** Rules return '' when fine, or a translated message. */
  ui.rules = {
    required: function (v) { return v ? '' : t('validation.required'); },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : t('validation.email'); },
    password: function (v) { return v.length >= 8 && v.length <= 72 && /[A-Za-z]/.test(v) && /\d/.test(v) ? '' : t('validation.password'); },
    phoneOptional: function (v) { return !v || /^\+?[0-9]{10,13}$/.test(v) ? '' : t('validation.phone'); },
    nonNegInt: function (v) { return /^\d{1,7}$/.test(v) ? '' : t('validation.quantity'); },
    priceOptional: function (v) { return v === '' || /^\d{1,8}(\.\d{1,2})?$/.test(v) ? '' : t('validation.price'); },
    number: function (v) { return v !== '' && !isNaN(Number(v)) ? '' : t('validation.number'); },
    lat: function (v) { return !isNaN(Number(v)) && v !== '' && Number(v) >= -90 && Number(v) <= 90 ? '' : t('validation.coordinate'); },
    lng: function (v) { return !isNaN(Number(v)) && v !== '' && Number(v) >= -180 && Number(v) <= 180 ? '' : t('validation.coordinate'); }
  };

  /** Runs every field's rules in order; shows the first failing message; focuses the first invalid input. */
  ui.validateFields = function (fields) {
    var firstBad = null;
    fields.forEach(function (f) {
      var msg = '';
      for (var i = 0; i < f.rules.length && !msg; i++) msg = f.rules[i](f.value());
      f.setError(msg);
      if (msg && !firstBad) firstBad = f;
    });
    if (firstBad) firstBad.input.focus();
    return !firstBad;
  };

  /** Puts the server's per-field messages next to the matching inputs (fallback after client validation). */
  ui.applyServerFieldErrors = function (fields, fieldErrors) {
    if (!fieldErrors) return false;
    var shown = false;
    fields.forEach(function (f) {
      var name = f.input.getAttribute('name');
      if (fieldErrors[name]) { f.setError(fieldErrors[name]); shown = true; }
    });
    return shown;
  };

  ui.setBusy = function (btn, busy) {
    if (busy) { btn.setAttribute('aria-busy', 'true'); btn.setAttribute('disabled', ''); }
    else { btn.removeAttribute('aria-busy'); btn.removeAttribute('disabled'); }
  };

  // ---------- formatting ----------
  function locale() { return { en: 'en-IN', kn: 'kn-IN', hi: 'hi-IN' }[window.I18n.getLanguage()] || 'en-IN'; }
  function tz() { return (window.RHP_CONFIG && window.RHP_CONFIG.timeZone) || 'Asia/Kolkata'; }

  ui.formatDateTime = function (iso) {
    try { return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: tz() }).format(new Date(iso)); }
    catch (e) { return String(iso); }
  };
  ui.formatDate = function (iso) {
    try { return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeZone: tz() }).format(new Date(iso + (String(iso).length === 10 ? 'T00:00:00' : ''))); }
    catch (e) { return String(iso); }
  };
  /** "09:00:00" -> "9:00 am" in the user's language. */
  ui.formatTime = function (hhmmss) {
    try {
      var p = String(hhmmss).split(':');
      return new Intl.DateTimeFormat(locale(), { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, Number(p[0]), Number(p[1])));
    } catch (e) { return String(hhmmss); }
  };
  ui.relativeTime = function (iso) {
    var seconds = (new Date(iso).getTime() - Date.now()) / 1000;
    try {
      var rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
      var abs = Math.abs(seconds);
      if (abs < 60) return rtf.format(0, 'second');
      if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
      if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
      return rtf.format(Math.round(seconds / 86400), 'day');
    } catch (e) { return ui.formatDateTime(iso); }
  };
  /** An instant as a clock time in the configured time zone, e.g. "1:00 pm". */
  ui.formatClock = function (iso) {
    try { return new Intl.DateTimeFormat(locale(), { hour: 'numeric', minute: '2-digit', timeZone: tz() }).format(new Date(iso)); }
    catch (e) { return String(iso); }
  };
  ui.formatDistance = function (km) { return t('common.kmAway', { distance: Number(km).toFixed(1) }); };
  ui.formatPrice = function (p) { return p === null || p === undefined ? '' : '\u20B9' + Number(p).toFixed(2); };
  /** Demo records are named "Sample ..." / "Dr. Sample ..."; they must never be mistaken for real establishments. */
  ui.isSample = function (name) { return /^(Dr\.\s+)?Sample\b/i.test(String(name || '')); };
  ui.sampleBadge = function (name) { return ui.isSample(name) ? ui.badge(t('common.sample'), 'sample') : null; };
  ui.stockBadge = function (status) {
    var kind = { IN_STOCK: 'ok', LOW_STOCK: 'warn', OUT_OF_STOCK: 'danger', UNAVAILABLE: 'danger' }[status] || '';
    return ui.badge(t('stock.' + status), kind);
  };
  ui.statusBadge = function (status) {
    var kind = { VERIFIED: 'ok', PENDING: 'warn', REJECTED: 'danger' }[status] || '';
    return ui.badge(t('status.' + status), kind);
  };

  ui.pager = function (o) {
    if (!o || !o.totalPages || o.totalPages <= 1) return null;
    return h('nav', { class: 'pager', 'aria-label': t('common.page', { page: o.page + 1, total: o.totalPages }) },
      h('button', { class: 'btn secondary small', type: 'button', disabled: o.page <= 0, onClick: function () { o.onChange(o.page - 1); } }, t('common.previous')),
      h('span', null, t('common.page', { page: o.page + 1, total: o.totalPages })),
      h('button', { class: 'btn secondary small', type: 'button', disabled: o.page >= o.totalPages - 1, onClick: function () { o.onChange(o.page + 1); } }, t('common.next')));
  };

  ui.telLink = function (phone) {
    var Icons = RHP.Icons;
    var icon = Icons ? Icons.wrap(Icons.phone) : '\uD83D\uDCDE';
    return phone ? h('a', { class: 'btn secondary small', href: 'tel:' + String(phone).replace(/[^+0-9]/g, '') }, icon, ' ', t('common.call'), ' ', phone) : null;
  };
})();
