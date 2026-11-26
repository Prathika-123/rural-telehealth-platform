/*
 * Minimal i18n engine for English, Kannada and Hindi. Plain JavaScript, no libraries.
 *
 * Usage in a page:
 *   <script src="js/i18n.js"></script>
 *   <h1 data-i18n="nav.findMedicine"></h1>
 *   <input data-i18n-placeholder="medicine.placeholder">
 *   I18n.init().then(function () { ... I18n.t('common.kmAway', {distance: 2.3}) ... });
 *
 * Translations live in js/i18n/{en,kn,hi}.json (flat "dotted.key": "text"). English is always loaded
 * as a fallback, so a missing key never shows blank text. The chosen language is remembered in localStorage.
 * Backend errors carry a stable "code"; I18n.error(code, serverMessage) turns it into the user's language.
 */
/*global fetch: false */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.I18n = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SUPPORTED = ['en', 'kn', 'hi'];
  var NATIVE_NAMES = { en: 'English', kn: 'ಕನ್ನಡ', hi: 'हिन्दी' };
  var SPEECH_LOCALES = { en: 'en-IN', kn: 'kn-IN', hi: 'hi-IN' };
  var STORAGE_KEY = 'rhp.lang';

  var state = { lang: 'en', dict: {}, fallback: {}, basePath: 'js/i18n/', listeners: [] };

  // ---------- pure helpers (unit tested in Node) ----------

  /** "kn-IN" -> "kn"; anything unsupported -> null. */
  function normalizeLang(value) {
    if (!value) return null;
    var code = String(value).toLowerCase().split(/[-_]/)[0];
    return SUPPORTED.indexOf(code) >= 0 ? code : null;
  }

  /** Replaces {name} placeholders. Unknown placeholders are left visible rather than erased. */
  function format(text, params) {
    return String(text).replace(/\{(\w+)\}/g, function (match, name) {
      return params && params[name] !== undefined && params[name] !== null ? String(params[name]) : match;
    });
  }

  /** Looks the key up in the language, then in English, then returns the key itself. */
  function translate(dict, fallback, key, params) {
    var value = dict[key];
    if (value === undefined) value = fallback[key];
    if (value === undefined) return key;
    return format(value, params);
  }

  /** Stored choice wins; otherwise the first supported browser language; otherwise English. */
  function chooseInitial(stored, browserLanguages) {
    var fromStore = normalizeLang(stored);
    if (fromStore) return fromStore;
    var list = browserLanguages || [];
    for (var i = 0; i < list.length; i++) {
      var n = normalizeLang(list[i]);
      if (n) return n;
    }
    return 'en';
  }

  /** Message for a backend error code; falls back to the server's own text, then to a generic message. */
  function errorMessage(dict, fallback, code, serverMessage) {
    var key = 'error.' + code;
    if (dict[key] !== undefined || fallback[key] !== undefined) return translate(dict, fallback, key);
    return serverMessage || translate(dict, fallback, 'error.INTERNAL_ERROR');
  }

  // ---------- browser side ----------

  function readStored() {
    try { return window.localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }   // private mode
  }
  function writeStored(lang) {
    try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
  }

  function load(lang) {
    return fetch(state.basePath + lang + '.json', { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('Cannot load translations for ' + lang);
      return res.json();
    });
  }

  function applyToDom(scope) {
    var rootEl = scope || document;
    document.documentElement.setAttribute('lang', state.lang);
    var map = [
      ['data-i18n', function (el, text) { el.textContent = text; }],
      ['data-i18n-placeholder', function (el, text) { el.setAttribute('placeholder', text); }],
      ['data-i18n-title', function (el, text) { el.setAttribute('title', text); }],
      ['data-i18n-aria-label', function (el, text) { el.setAttribute('aria-label', text); }]
    ];
    map.forEach(function (pair) {
      var nodes = rootEl.querySelectorAll('[' + pair[0] + ']');
      for (var i = 0; i < nodes.length; i++) {
        pair[1](nodes[i], t(nodes[i].getAttribute(pair[0])));
      }
    });
  }

  function t(key, params) {
    return translate(state.dict, state.fallback, key, params);
  }

  /** options.basePath: where the JSON files are served from. Resolves once translations are applied. */
  function init(options) {
    if (options && options.basePath) state.basePath = options.basePath;
    var wanted = chooseInitial(readStored(), (typeof navigator !== 'undefined' && navigator.languages) || []);
    return load('en').then(function (en) {
      state.fallback = en;
      return setLanguage(wanted, true);
    });
  }

  function setLanguage(lang, skipStore) {
    var target = normalizeLang(lang) || 'en';
    var ready = target === 'en' ? Promise.resolve(state.fallback) : load(target);
    return ready.then(function (dict) {
      state.dict = dict;
      state.lang = target;
      if (!skipStore) writeStored(target);
      applyToDom();
      state.listeners.forEach(function (fn) { try { fn(target); } catch (e) { /* ignore */ } });
      return target;
    }).catch(function () {
      // Could not load the chosen language (e.g. offline): stay usable in English.
      state.dict = state.fallback;
      state.lang = 'en';
      applyToDom();
      return 'en';
    });
  }

  /** Fills a <select> with the three languages and keeps it in sync. */
  function mountSelector(selectEl) {
    selectEl.innerHTML = '';
    SUPPORTED.forEach(function (code) {
      var opt = document.createElement('option');
      opt.value = code;
      opt.textContent = NATIVE_NAMES[code];
      selectEl.appendChild(opt);
    });
    selectEl.value = state.lang;
    selectEl.addEventListener('change', function () { setLanguage(selectEl.value); });
    state.listeners.push(function (lang) { selectEl.value = lang; });
  }

  return {
    SUPPORTED: SUPPORTED,
    init: init,
    t: t,
    error: function (code, serverMessage) { return errorMessage(state.dict, state.fallback, code, serverMessage); },
    setLanguage: setLanguage,
    getLanguage: function () { return state.lang; },
    speechLocale: function () { return SPEECH_LOCALES[state.lang]; },   // for the Web Speech API
    onChange: function (fn) { state.listeners.push(fn); },
    applyToDom: applyToDom,
    mountSelector: mountSelector,
    _internals: { normalizeLang: normalizeLang, format: format, translate: translate,
                  chooseInitial: chooseInitial, errorMessage: errorMessage }
  };
});