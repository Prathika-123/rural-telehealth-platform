/* Page shell: emergency bar, header with navigation and language selector, footer, and RHP.boot() for every page. */
(function () {
  'use strict';
  var RHP = (window.RHP = window.RHP || {});
  var ui = RHP.ui, h = ui.h;
  function t(k, p) { return window.I18n.t(k, p); }

  var NAV = [
    { page: 'medicine', href: 'medicine-search.html', key: 'nav.findMedicine', icon: '\uD83D\uDC8A' },
    { page: 'doctors', href: 'doctors.html', key: 'nav.findDoctor', icon: '\uD83E\uDE7A' },
    { page: 'centres', href: 'centres.html', key: 'nav.nearbyCentres', icon: '\uD83C\uDFE5' },
    { page: 'symptoms', href: 'symptoms.html', key: 'nav.healthInfo', icon: '\uD83D\uDCD6' },
    { page: 'voice', href: 'voice.html', key: 'nav.voiceSearch', icon: '\uD83C\uDFA4' }
  ];

  function navLink(item, current) {
    return h('a', { href: item.href, 'aria-current': item.page === current ? 'page' : null },
      h('span', { 'aria-hidden': 'true' }, item.icon + '\u00A0'), h('span', { 'data-i18n': item.key }, t(item.key)));
  }

  function buildHeader(current) {
    var user = RHP.auth.isLoggedIn() ? RHP.auth.getUser() : null;
    var nav = h('nav', { class: 'nav', id: 'main-nav', 'aria-label': 'Main' }, NAV.map(function (i) { return navLink(i, current); }));
    if (user) {
      nav.appendChild(h('a', { href: RHP.auth.homeFor(user.role), 'aria-current': current === 'home' ? 'page' : null, 'data-i18n': 'nav.dashboard' }, t('nav.dashboard')));
      nav.appendChild(h('a', { href: 'profile.html', 'aria-current': current === 'profile' ? 'page' : null, 'data-i18n': 'nav.profile' }, t('nav.profile')));
      nav.appendChild(h('a', { href: '#', 'data-i18n': 'nav.logout', onClick: function (e) { e.preventDefault(); RHP.auth.logout(); } }, t('nav.logout')));
    } else {
      nav.appendChild(h('a', { href: 'login.html', 'aria-current': current === 'login' ? 'page' : null, 'data-i18n': 'nav.login' }, t('nav.login')));
      nav.appendChild(h('a', { href: 'register.html', 'aria-current': current === 'register' ? 'page' : null, 'data-i18n': 'nav.register' }, t('nav.register')));
    }
    var select = h('select', { class: 'lang-select', 'data-i18n-aria-label': 'nav.language', 'aria-label': t('nav.language') });
    window.I18n.mountSelector(select);
    var toggle = h('button', { class: 'btn secondary small menu-toggle', type: 'button', 'aria-controls': 'main-nav', 'aria-expanded': 'false',
      'data-i18n-aria-label': 'nav.menu', 'aria-label': t('nav.menu'),
      onClick: function () { var open = nav.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(open)); } }, '\u2630');

    return h('div', null,
      h('div', { class: 'emergency-bar' }, h('span', { 'data-i18n': 'layout.emergency' }, t('layout.emergency')), ' ',
        h('a', { href: 'tel:112' }, '112'), ' \u00B7 ', h('a', { href: 'tel:108' }, '108')),
      h('header', { class: 'site-header' }, h('div', { class: 'bar' },
        h('a', { class: 'brand', href: 'index.html' }, h('span', { 'aria-hidden': 'true' }, '\uD83C\uDFE5'), h('span', { 'data-i18n': 'app.short' }, t('app.short'))),
        select, toggle, nav)));
  }

  function buildFooter() {
    var demo = window.RHP_CONFIG && window.RHP_CONFIG.demoMode;
    return h('footer', { class: 'site-footer' }, h('div', { class: 'inner stack' },
      h('p', { 'data-i18n': 'footer.disclaimer' }, t('footer.disclaimer')),
      demo ? h('p', { 'data-i18n': 'footer.demo' }, t('footer.demo')) : null));
  }

  RHP.layout = {
    render: function (current) {
      var head = document.getElementById('site-header'), foot = document.getElementById('site-footer');
      if (head) ui.replace(head, buildHeader(current));
      if (foot) ui.replace(foot, buildFooter());
    }
  };

  function currentPage() { return window.location.pathname.split('/').pop() + window.location.search; }

  /**
   * Every page calls RHP.boot({page, roles}, init). It loads translations, draws the shell, enforces login and role
   * (the server enforces them too), then runs init({main, user}). Errors are shown on the page, never swallowed.
   */
  RHP.boot = function (opts, init) {
    return window.I18n.init({ basePath: 'js/i18n/' }).catch(function () { /* stay usable in English keys */ }).then(function () {
      RHP.layout.render(opts.page);
      var main = document.getElementById('main');
      if (opts.roles) {
        if (!RHP.auth.isLoggedIn()) { RHP.nav.replace('login.html?next=' + encodeURIComponent(currentPage())); return null; }
        if (!RHP.auth.hasRole(opts.roles)) { ui.replace(main, ui.alert('error', t('error.FORBIDDEN'))); return null; }
      }
      window.I18n.applyToDom();
      // keep the saved language in step with the account (language is not location, so this is fine to store)
      window.I18n.onChange(function (lang) {
        var u = RHP.auth.isLoggedIn() ? RHP.auth.getUser() : null;
        if (u && u.language !== lang) {
          RHP.api.put('/users/me/language', { language: lang }).then(function (nu) { RHP.auth.updateStoredUser(nu); }, function () { /* ignore */ });
        }
      });
      return Promise.resolve(init({ main: main, user: RHP.auth.getUser() })).catch(function (err) {
        if (window.console) console.error(err);
        // show the problem under the page heading instead of wiping the whole page
        var box = ui.alert('error', ui.errorText(err)), anchor = main.querySelector('h1');
        while (anchor && anchor.parentNode !== main) anchor = anchor.parentNode;   // the h1 may sit inside a wrapper
        main.insertBefore(box, anchor ? anchor.nextSibling : main.firstChild);
      });
    });
  };
})();
