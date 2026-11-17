RHP.boot({ page: 'login' }, function () {
  var ui = RHP.ui, auth = RHP.auth;
  var params = new URLSearchParams(window.location.search);
  if (auth.isLoggedIn()) { RHP.nav.replace(auth.homeFor(auth.getUser().role)); return; }

  var email = ui.field({ id: 'email', name: 'email', labelKey: 'auth.email', type: 'email', autocomplete: 'username', inputmode: 'email',
    required: true, rules: [ui.rules.required, ui.rules.email] });
  var password = ui.field({ id: 'password', name: 'password', labelKey: 'auth.password', type: 'password', autocomplete: 'current-password',
    required: true, trim: false, rules: [ui.rules.required] });
  ui.replace(document.getElementById('login-fields'), email.el, password.el);

  var form = document.getElementById('login-form'), btn = document.getElementById('login-btn'), box = document.getElementById('form-error');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    ui.clear(box);
    if (!ui.validateFields([email, password])) return;
    ui.setBusy(btn, true);
    auth.login(email.value(), password.input.value).then(function (user) {
      RHP.nav.go(auth.safeNext(params.get('next'), auth.homeFor(user.role)));
    }, function (err) {
      ui.showError(box, err);
      ui.setBusy(btn, false);
    });
  });
});
