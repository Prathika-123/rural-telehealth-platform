RHP.boot({ page: 'medicine' }, function () {
  var ui = RHP.ui, h = ui.h, t = window.I18n.t;
  var box = document.getElementById('details');
  var id = new URLSearchParams(window.location.search).get('id');
  var pharmacy = null, stock = null, map = null;
  if (!id) { ui.showError(box, { code: 'PHARMACY_NOT_FOUND' }); return; }
  ui.replace(box, ui.spinner());

  function load(page) {
    return Promise.all([pharmacy ? Promise.resolve(pharmacy) : RHP.api.get('/pharmacies/' + encodeURIComponent(id)),
      RHP.api.get('/pharmacies/' + encodeURIComponent(id) + '/medicines', { page: page, size: 10 })])
      .then(function (r) { pharmacy = r[0]; stock = r[1]; render(); }, function (err) { ui.showError(box, err); });
  }

  function render() {
    if (map) { map.destroy(); map = null; }
    var loc = RHP.geo.get(), mapDiv = h('div');
    var rows = stock.content.map(function (s) {
      var m = s.medicine;
      return h('tr', null,
        h('td', null, m.brandName, h('div', { class: 'muted' }, m.genericName + ' ' + m.strength + ', ' + m.dosageForm)),
        h('td', null, ui.formatPrice(s.price)),
        h('td', null, ui.stockBadge(s.stockStatus)),
        h('td', null, ui.relativeTime(s.lastUpdatedAt), ' ', s.stale ? ui.badge(t('medicine.staleShort'), 'warn') : null));
    });
    ui.replace(box, h('div', { class: 'stack' },
      h('div', { class: 'card stack' },
        h('h2', null, pharmacy.name, ' ', ui.sampleBadge(pharmacy.name)),
        h('p', { class: 'muted' }, [pharmacy.address, pharmacy.taluk, pharmacy.district].filter(Boolean).join(', ')),
        h('p', { class: 'muted' }, t('common.coordinates', { lat: Number(pharmacy.latitude).toFixed(5), lng: Number(pharmacy.longitude).toFixed(5) })),
        var Icons = RHP.Icons;
      h('div', { class: 'row' }, ui.telLink(pharmacy.phone),
        h('a', { class: 'btn secondary small', href: RHP.geo.directionsUrl({ lat: pharmacy.latitude, lng: pharmacy.longitude }, loc), target: '_blank', rel: 'noopener' }, Icons ? Icons.wrap(Icons.directions) : '\uD83E\uDDED', ' ', t('common.directions')))),
      mapDiv,
      ui.alert('info', t('medicine.disclaimer')),
      h('h2', null, t('pharmacy.medicinesHere')),
      rows.length ? h('div', { class: 'table-wrap' }, h('table', null,
        h('thead', null, h('tr', null, h('th', null, t('pharmacy.colMedicine')), h('th', null, t('medicine.price')), h('th', null, t('pharmacy.colStock')), h('th', null, t('pharmacy.colUpdated')))),
        h('tbody', null, rows))) : h('p', { class: 'muted' }, t('pharmacy.noStock')),
      ui.pager({ page: stock.page, totalPages: stock.totalPages, onChange: load })));
    var Icons = RHP.Icons;
    map = new RHP.RuralMap(mapDiv, { lat: Number(pharmacy.latitude), lng: Number(pharmacy.longitude), zoom: 15, label: pharmacy.name });
    map.setMarkers([{ lat: Number(pharmacy.latitude), lng: Number(pharmacy.longitude), icon: Icons ? Icons.wrap(Icons.medicine) : '\uD83D\uDC8A', label: pharmacy.name, popup: pharmacy.name }]);
    if (loc) map.setUser(loc.lat, loc.lng);
  }

  window.I18n.onChange(function () { if (pharmacy && stock) render(); });
  load(0);
});
