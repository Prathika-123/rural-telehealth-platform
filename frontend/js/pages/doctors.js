RHP.boot({ page: 'doctors' }, function () {
  var ui = RHP.ui, h = ui.h, t = window.I18n.t;
  var results = document.getElementById('results');
  var params = new URLSearchParams(window.location.search);
  var centreId = params.get('centreId') || '';
  var data = null, lastLoc = null;

  var nameField = ui.field({ id: 'name', name: 'name', labelKey: 'doctor.searchName', autocomplete: 'off' });
  var specField = ui.field({ id: 'spec', name: 'specialization', labelKey: 'doctor.specialization', autocomplete: 'off' });
  ui.replace(document.getElementById('name-field'), nameField.el);
  ui.replace(document.getElementById('spec-field'), specField.el);
  ui.replace(document.getElementById('mic-slot'), RHP.components.micButton({ input: nameField.input, onFinal: function () { search(0); } }));

  var availableNow = document.getElementById('available-now');
  var useLocation = document.getElementById('use-location');
  var panelBox = document.getElementById('location-panel');
  var panel = null;
  function ensurePanel() {
    if (!panel) panel = RHP.components.locationPanel(panelBox, { withRadius: true, onChange: function () { if (data) search(0); }, onRadius: function () { if (data) search(0); } });
    panelBox.classList.remove('hidden');
  }
  useLocation.checked = !!RHP.geo.get();
  if (useLocation.checked) ensurePanel();
  useLocation.addEventListener('change', function () {
    if (useLocation.checked) ensurePanel(); else panelBox.classList.add('hidden');
  });

  var filterBox = document.getElementById('centre-filter');
  function renderCentreFilter() {
    ui.replace(filterBox, centreId ? h('p', { class: 'row' }, ui.badge(t('doctors.oneCentre'), 'info'),
      h('button', { class: 'btn secondary small', type: 'button', onClick: function () { centreId = ''; renderCentreFilter(); search(0); } }, t('doctors.clearCentre'))) : null);
  }
  renderCentreFilter();

  document.getElementById('search-form').addEventListener('submit', function (e) { e.preventDefault(); search(0); });

  function search(page) {
    var query = { name: nameField.value(), specialization: specField.value(), centreId: centreId,
      availableNow: availableNow.checked ? 'true' : '', page: page, size: 10 };
    lastLoc = null;
    if (useLocation.checked) {
      ensurePanel();
      lastLoc = panel.getLocation();
      if (!lastLoc) { panel.needLocation(); return; }
      query.lat = lastLoc.lat; query.lng = lastLoc.lng; query.radiusKm = panel.getRadius();
    }
    ui.replace(results, ui.spinner());
    RHP.api.get('/doctors/search', query).then(function (d) { data = d; render(); }, function (err) { data = null; ui.showError(results, err); });
  }

  function card(d) {
    var Icons = RHP.Icons;
    return h('article', { class: 'card stack' },
      h('div', { class: 'row between' },
        h('h3', null, h('a', { href: 'doctor-details.html?id=' + d.id }, d.name), ' ', ui.sampleBadge(d.name)),
        ui.badge(d.specialization, 'info')),
      h('p', { class: 'muted' }, [d.qualification, d.experienceYears !== undefined && d.experienceYears !== null ? t('doctor.years', { years: d.experienceYears }) : null].filter(Boolean).join(' \u00B7 ')),
      h('p', null, Icons ? Icons.wrap(Icons.centre) : '\uD83C\uDFE5', ' ', d.centre.name + ' (' + t('centre.type.' + d.centre.type) + ')',
        d.distanceKm !== undefined && d.distanceKm !== null ? ' \u00B7 ' + ui.formatDistance(d.distanceKm) : ''),
      RHP.components.availabilityBlock(d.availability),
      h('div', { class: 'row' }, ui.telLink(d.phone || d.centre.phone),
        h('a', { class: 'btn secondary small', href: 'doctor-details.html?id=' + d.id }, t('doctor.viewDetails'))));
  }

  function render() {
    if (!data) return;
    if (!data.content.length) { ui.replace(results, ui.alert('warn', t('doctors.none'))); return; }
    ui.replace(results, ui.alert('info', t('doctor.disclaimer')),
      h('p', { class: 'muted' }, t('doctors.count', { count: data.totalElements })),
      h('div', { class: 'stack' }, data.content.map(card)),
      ui.pager({ page: data.page, totalPages: data.totalPages, onChange: search }));
  }

  window.I18n.onChange(render);
  if (params.get('name')) nameField.input.value = params.get('name');
  search(0);
});
