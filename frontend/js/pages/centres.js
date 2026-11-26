RHP.boot({ page: 'centres' }, function () {
  var ui = RHP.ui, h = ui.h, t = window.I18n.t;
  var results = document.getElementById('results');
  var TYPES = ['', 'HOSPITAL', 'PHC', 'CHC', 'CLINIC'];
  var type = new URLSearchParams(window.location.search).get('type') || '';
  if (TYPES.indexOf(type) < 0) type = '';
  var data = null, map = null, lastLoc = null;

  var panel = RHP.components.locationPanel(document.getElementById('location-panel'), {
    withRadius: true, radius: 25, onChange: function () { load(0); }, onRadius: function () { load(0); }
  });

  var chipBox = document.getElementById('type-chips');
  function renderChips() {
    ui.replace(chipBox, TYPES.map(function (v) {
      return h('button', { class: 'chip', type: 'button', 'aria-pressed': String(v === type), onClick: function () { type = v; renderChips(); load(0); } },
        v ? t('centre.type.' + v) : t('centre.all'));
    }));
  }
  renderChips();

  function load(page) {
    var loc = panel.getLocation();
    if (!loc) { ui.replace(results, ui.alert('info', t('centres.setLocation'))); return; }
    lastLoc = loc;
    ui.replace(results, ui.spinner());
    RHP.api.get('/centres/nearby', { lat: loc.lat, lng: loc.lng, radiusKm: panel.getRadius(), type: type, page: page, size: 10 })
      .then(function (d) { data = d; render(); }, function (err) { data = null; ui.showError(results, err); });
  }

  function card(c) {
    return h('article', { class: 'card stack' },
      h('div', { class: 'row between' }, h('h3', null, c.name, ' ', ui.sampleBadge(c.name)), ui.badge(t('centre.type.' + c.type), 'info')),
      c.emergencyAvailable ? h('p', null, ui.badge('\u26A0 ' + t('centre.emergency'), 'danger')) : null,
      h('p', { class: 'muted' }, [c.address, c.taluk, c.district].filter(Boolean).join(', ')),
      h('p', null, h('strong', null, ui.formatDistance(c.distanceKm))),
      c.services && c.services.length ? h('p', null, c.services.map(function (s) { return [ui.badge(s), ' ']; })) : null,
      h('p', { class: 'muted' }, t('common.coordinates', { lat: Number(c.latitude).toFixed(5), lng: Number(c.longitude).toFixed(5) })),
      var Icons = RHP.Icons;
      h('div', { class: 'row' }, ui.telLink(c.phone),
        h('a', { class: 'btn secondary small', href: RHP.geo.directionsUrl({ lat: c.latitude, lng: c.longitude }, lastLoc), target: '_blank', rel: 'noopener' }, Icons ? Icons.wrap(Icons.directions) : '\uD83E\uDDED', ' ', t('common.directions')),
        h('a', { class: 'btn secondary small', href: 'doctors.html?centreId=' + c.id }, Icons ? Icons.wrap(Icons.doctor) : '\uD83E\uDE7A', ' ', t('centre.doctorsHere'))));
  }

  function render() {
    if (!data) return;
    if (map) { map.destroy(); map = null; }
    if (!data.content.length) { ui.replace(results, ui.alert('warn', t('centres.none', { radius: panel.getRadius() }))); return; }
    var mapDiv = h('div');
    ui.replace(results, h('p', { class: 'muted' }, t('centres.count', { count: data.totalElements })), mapDiv,
      h('div', { class: 'stack mt-4' }, data.content.map(card)),
      ui.pager({ page: data.page, totalPages: data.totalPages, onChange: load }));
    var Icons = RHP.Icons;
    map = new RHP.RuralMap(mapDiv, { lat: lastLoc.lat, lng: lastLoc.lng, zoom: 12, label: t('nav.nearbyCentres') });
    map.setUser(lastLoc.lat, lastLoc.lng);
    map.setMarkers(data.content.map(function (c) {
      return { lat: Number(c.latitude), lng: Number(c.longitude), icon: Icons ? Icons.wrap(Icons.centre) : '\uD83C\uDFE5', label: c.name, popup: c.name + ' \u00B7 ' + ui.formatDistance(c.distanceKm) };
    }));
    map.fitToMarkers();
  }

  window.I18n.onChange(function () { renderChips(); render(); });
  load(0);
});
