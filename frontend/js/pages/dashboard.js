RHP.boot({ page: 'home', roles: ['USER', 'PHARMACY', 'HEALTHCARE_PROVIDER', 'ADMIN'] }, function (ctx) {
  var ui = RHP.ui;
  // other roles have their own dashboards
  if (ctx.user.role !== 'USER') { RHP.nav.replace(RHP.auth.homeFor(ctx.user.role)); return; }
  var welcome = document.getElementById('welcome');
  function renderWelcome() { welcome.textContent = window.I18n.t('dashboard.welcome', { name: ctx.user.name }); }
  renderWelcome();
  window.I18n.onChange(renderWelcome);
  RHP.components.renderTiles(document.getElementById('tiles'));
  RHP.components.locationPanel(document.getElementById('location-panel'), {});
});
