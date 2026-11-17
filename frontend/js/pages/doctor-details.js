RHP.boot({ page: 'doctors' }, function () {
  var ui = RHP.ui, h = ui.h, t = window.I18n.t;
  var box = document.getElementById('details');
  var id = new URLSearchParams(window.location.search).get('id');
  var doc = null, map = null;
  if (!id) { ui.showError(box, { code: 'DOCTOR_NOT_FOUND' }); return; }
  ui.replace(box, ui.spinner());
  var loc = RHP.geo.get();

  RHP.api.get('/doctors/' + encodeURIComponent(id), loc ? { lat: loc.lat, lng: loc.lng } : null)
    .then(function (d) { doc = d; render(); }, function (err) { ui.showError(box, err); });

  var DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

  function timetable() {
    if (!doc.schedule.length) return h('p', { class: 'muted' }, t('doctor.source.NO_SCHEDULE'));
    var rows = DAYS.map(function (day) {
      var slots = doc.schedule.filter(function (s) { return s.dayOfWeek === day; });
      if (!slots.length) return null;
      return h('tr', null, h('th', { scope: 'row' }, t('day.' + day)),
        h('td', null, slots.map(function (s) {
          return h('div', null, ui.formatTime(s.startTime) + ' \u2013 ' + ui.formatTime(s.endTime), h('span', { class: 'muted' }, ' \u00B7 ' + s.centreName));
        })));
    });
    return h('div', { class: 'table-wrap' }, h('table', null, h('tbody', null, rows)));
  }

  function render() {
    if (!doc) return;
    if (map) { map.destroy(); map = null; }
    var c = doc.centre, mapDiv = h('div');
    ui.replace(box, h('div', { class: 'stack' },
      h('div', { class: 'card stack' },
        h('h2', null, doc.name, ' ', ui.sampleBadge(doc.name)),
        h('p', null, ui.badge(doc.specialization, 'info'), ' ', doc.qualification || ''),
        doc.experienceYears !== null && doc.experienceYears !== undefined ? h('p', { class: 'muted' }, t('doctor.years', { years: doc.experienceYears })) : null,
        RHP.components.availabilityBlock(doc.availability),
        h('div', { class: 'row' }, ui.telLink(doc.phone || c.phone))),
      ui.alert('info', t('doctor.disclaimer')),
      h('div', { class: 'card stack' }, h('h2', null, t('doctor.timings')), timetable(),
        doc.lastUpdatedAt ? h('p', { class: 'muted' }, t('doctor.lastUpdated', { time: ui.relativeTime(doc.lastUpdatedAt) })) : null),
      h('div', { class: 'card stack' },
        h('h2', null, c.name, ' ', ui.sampleBadge(c.name)),
        h('p', null, ui.badge(t('centre.type.' + c.type), 'info')),
        h('p', { class: 'muted' }, [c.address, c.taluk, c.district].filter(Boolean).join(', ')),
        doc.distanceKm !== undefined && doc.distanceKm !== null ? h('p', null, h('strong', null, ui.formatDistance(doc.distanceKm))) : null,
        h('p', { class: 'muted' }, t('common.coordinates', { lat: Number(c.latitude).toFixed(5), lng: Number(c.longitude).toFixed(5) })),
        h('div', { class: 'row' }, ui.telLink(c.phone),
          h('a', { class: 'btn secondary small', href: RHP.geo.directionsUrl({ lat: c.latitude, lng: c.longitude }, loc), target: '_blank', rel: 'noopener' }, '\uD83E\uDDED ' + t('common.directions')))),
      mapDiv));
    map = new RHP.RuralMap(mapDiv, { lat: Number(c.latitude), lng: Number(c.longitude), zoom: 15, label: c.name });
    map.setMarkers([{ lat: Number(c.latitude), lng: Number(c.longitude), icon: '\uD83C\uDFE5', label: c.name, popup: c.name }]);
    if (loc) map.setUser(loc.lat, loc.lng);
  }
  window.I18n.onChange(render);
});
