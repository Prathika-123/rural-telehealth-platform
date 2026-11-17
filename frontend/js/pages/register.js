RHP.boot({ page: 'register' }, function () {
  var ui = RHP.ui, auth = RHP.auth;
  if (auth.isLoggedIn()) { RHP.nav.replace(auth.homeFor(auth.getUser().role)); return; }

  var name = ui.field({ id: 'name', name: 'name', labelKey: 'auth.name', autocomplete: 'name', required: true, maxlength: 100, rules: [ui.rules.required] });
  var email = ui.field({ id: 'email', name: 'email', labelKey: 'auth.email', type: 'email', autocomplete: 'email', inputmode: 'email',
    required: true, rules: [ui.rules.required, ui.rules.email] });
  var phone = ui.field({ id: 'phone', name: 'phone', labelKey: 'auth.phone', type: 'tel', autocomplete: 'tel', inputmode: 'tel', rules: [ui.rules.phoneOptional] });
  var password = ui.field({ id: 'password', name: 'password', labelKey: 'auth.password', hintKey: 'auth.passwordHint', type: 'password',
    autocomplete: 'new-password', required: true, trim: false, rules: [ui.rules.password] });
  var role = ui.field({ id: 'role', name: 'role', labelKey: 'auth.role', type: 'select', value: 'USER', options: [
    { value: 'USER', labelKey: 'role.USER' }, { value: 'PHARMACY', labelKey: 'role.PHARMACY' },
    { value: 'HEALTHCARE_PROVIDER', labelKey: 'role.HEALTHCARE_PROVIDER' }] });
  var fields = [name, email, phone, password, role];
  ui.replace(document.getElementById('register-fields'), fields.map(function (f) { return f.el; }));

  var form = document.getElementById('register-form'), btn = document.getElementById('register-btn'), box = document.getElementById('form-error');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    ui.clear(box);
    if (!ui.validateFields(fields)) return;
    ui.setBusy(btn, true);
    auth.register({ name: name.value(), email: email.value(), phone: phone.value() || null, password: password.input.value,
      role: role.value(), language: window.I18n.getLanguage() }).then(function (user) {
      RHP.nav.go(auth.homeFor(user.role));
    }, function (err) {
      if (!ui.applyServerFieldErrors(fields, err.fieldErrors)) ui.showError(box, err);
      ui.setBusy(btn, false);
    });
  });
});
