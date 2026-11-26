RHP.boot({ page: 'profile', roles: ['USER', 'PHARMACY', 'HEALTHCARE_PROVIDER', 'ADMIN'] }, function () {
  var ui = RHP.ui, h = ui.h, t = window.I18n.t;
  var box = document.getElementById('form-error');
  return RHP.auth.refreshUser().then(function (user) {
    var name = ui.field({ id: 'name', name: 'name', labelKey: 'auth.name', value: user.name, autocomplete: 'name', required: true, maxlength: 100, rules: [ui.rules.required] });
    var phone = ui.field({ id: 'phone', name: 'phone', labelKey: 'auth.phone', value: user.phone || '', type: 'tel', autocomplete: 'tel', inputmode: 'tel', rules: [ui.rules.phoneOptional] });
    var language = ui.field({ id: 'language', name: 'language', labelKey: 'nav.language', type: 'select', value: user.language, options: [
      { value: 'en', label: 'English' }, { value: 'kn', label: '\u0C95\u0CA8\u0CCD\u0CA8\u0CA1' }, { value: 'hi', label: '\u0939\u093F\u0928\u094D\u0926\u0940' }] });
    var fields = [name, phone, language];
    ui.replace(document.getElementById('profile-fields'), fields.map(function (f) { return f.el; }));

    function info() {
      ui.replace(document.getElementById('account-info'),
        h('dt', { class: 'muted' }, t('auth.email')), h('dd', { class: 'mb-2' }, user.email),
        h('dt', { class: 'muted' }, t('auth.role')), h('dd', { class: 'mb-4' }, t('role.' + user.role)));
    }
    info();
    window.I18n.onChange(info);

    var btn = document.getElementById('save-btn');
    document.getElementById('profile-form').addEventListener('submit', function (e) {
      e.preventDefault();
      ui.clear(box);
      if (!ui.validateFields(fields)) return;
      ui.setBusy(btn, true);
      RHP.api.put('/users/me', { name: name.value(), phone: phone.value() || null, language: language.value() }).then(function (nu) {
        user = nu;
        RHP.auth.updateStoredUser(nu);
        window.I18n.setLanguage(nu.language);
        ui.toast(t('profile.saved'));
      }, function (err) {
        if (!ui.applyServerFieldErrors(fields, err.fieldErrors)) ui.showError(box, err);
      }).then(function () { ui.setBusy(btn, false); });
    });
    document.getElementById('logout-btn').addEventListener('click', RHP.auth.logout);
  });
});
