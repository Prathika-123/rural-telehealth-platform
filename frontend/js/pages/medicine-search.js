RHP.boot({ page: 'medicine' }, function () {
  var ui = RHP.ui, h = ui.h, t = window.I18n.t, voice = RHP.voice;
  var results = document.getElementById('results');
  var lastQuery = '', lastData = null, lastLoc = null, map = null;

  var qField = ui.field({ id: 'q', name: 'q', labelKey: 'medicine.label', placeholderKey: 'medicine.placeholder', list: 'med-suggest',
    autocomplete: 'off', required: true, rules: [ui.rules.required] });
  ui.replace(document.getElementById('q-field'), qField.el);
  RHP.components.medicineAutocomplete(qField.input, document.getElementById('med-suggest'));

  var panel = RHP.components.locationPanel(document.getElementById('location-panel'), {
    withRadius: true,
    onChange: function () { if (lastQuery) search(0); },
    onRadius: function () { if (lastQuery) search(0); }
  });

  ui.replace(document.getElementById('mic-slot'), RHP.components.micButton({ input: qField.input, onFinal: function () { search(0); } }));

  document.getElementById('search-form').addEventListener('submit', function (e) { e.preventDefault(); search(0); });

  function search(page) {
    if (!ui.validateFields([qField])) return;
    var loc = panel.getLocation();
    if (!loc) { panel.needLocation(); return; }
    lastQuery = qField.value();
    lastLoc = loc;
    ui.replace(results, ui.spinner());
    try { window.history.replaceState(null, '', '?q=' + encodeURIComponent(lastQuery)); } catch (e) { /* ignore */ }
    RHP.api.get('/medicines/search', { q: lastQuery, lat: loc.lat, lng: loc.lng, radiusKm: panel.getRadius(), page: page, size: 10 })
      .then(function (data) { lastData = data; render(); }, function (err) { lastData = null; ui.showError(results, err); });
  }

  function spokenLine(r) {
    return t('voice.resultLine', { name: r.pharmacyName, distance: r.distanceKm.toFixed(1), status: t('stock.' + r.stockStatus) });
  }

  function speak(text) {
    voice.canSpeak().then(function (ok) { if (ok) voice.speak(text); else ui.toast(t('voice.noVoice'), 'error'); });
  }

  function card(r) {
    var med = r.medicine;
    return h('article', { class: 'card stack' },
      h('div', { class: 'row between' },
        h('h3', null, h('a', { href: 'pharmacy-details.html?id=' + r.pharmacyId }, r.pharmacyName), ' ', ui.sampleBadge(r.pharmacyName)),
        ui.stockBadge(r.stockStatus)),
      h('p', { class: 'muted' }, [r.address, r.taluk, r.district].filter(Boolean).join(', ')),
      h('p', null, h('strong', null, ui.formatDistance(r.distanceKm)), r.price !== null && r.price !== undefined ? ' \u00B7 ' + t('medicine.price') + ': ' + ui.formatPrice(r.price) : ''),
      h('p', null, med.brandName + ' (' + med.genericName + ' ' + med.strength + ', ' + med.dosageForm + ') ',
        med.prescriptionRequired ? ui.badge(t('medicine.prescription'), 'info') : null),
      h('p', { class: 'muted' }, t('medicine.updated', { time: ui.relativeTime(r.lastUpdatedAt) }), ' ',
        r.stale ? ui.badge(t('medicine.stale', { days: lastData.staleAfterDays }), 'warn') : null),
      h('div', { class: 'row' },
        ui.telLink(r.phone),
        h('a', { class: 'btn secondary small', href: RHP.geo.directionsUrl({ lat: r.latitude, lng: r.longitude }, lastLoc), target: '_blank', rel: 'noopener' }, Icons ? Icons.wrap(Icons.directions) : '\uD83E\uDDED', ' ', t('common.directions')),
        voice.ttsSupported() ? h('button', { class: 'btn secondary small', type: 'button', onClick: function () { speak(spokenLine(r)); } }, Icons ? Icons.wrap(Icons.readAloud) : '\uD83D\uDD0A', ' ', t('voice.readAloud')) : null));
  }

  function render() {
    if (!lastData) return;
    if (map) { map.destroy(); map = null; }
    var data = lastData, list = data.results.content;
    var Icons = RHP.Icons;
    var parts = [ui.alert('info', t('medicine.disclaimer'))];
    if (data.status !== 'RESULTS') {
      parts.push(ui.alert('warn', t('search.' + data.status, { radius: data.radiusKm })));
      ui.replace(results, parts);
      return;
    }
    var mapDiv = h('div');
    parts.push(h('p', { class: 'muted' }, t('medicine.resultCount', { count: data.results.totalElements })));
    if (voice.ttsSupported()) {
      parts.push(h('p', null, h('button', { class: 'btn secondary small', type: 'button', onClick: function () {
        speak(list.slice(0, 3).map(spokenLine).join('. ')); } }, Icons ? Icons.wrap(Icons.readAloud) : '\uD83D\uDD0A', ' ', t('voice.readResults')),
        ' ', h('button', { class: 'btn secondary small', type: 'button', onClick: voice.stopSpeaking }, t('voice.stopReading'))));
    }
    parts.push(mapDiv);
    parts.push(h('div', { class: 'stack mt-4' }, list.map(card)));
    parts.push(ui.pager({ page: data.results.page, totalPages: data.results.totalPages, onChange: search }));
    ui.replace(results, parts);
    var Icons = RHP.Icons;
    map = new RHP.RuralMap(mapDiv, { label: t('nav.findMedicine'), lat: lastLoc.lat, lng: lastLoc.lng, zoom: 13 });
    map.setUser(lastLoc.lat, lastLoc.lng);
    map.setMarkers(list.map(function (r) {
      return { lat: Number(r.latitude), lng: Number(r.longitude), icon: Icons ? Icons.wrap(Icons.medicine) : '\uD83D\uDC8A', label: r.pharmacyName,
        popup: r.pharmacyName + ' \u00B7 ' + ui.formatDistance(r.distanceKm) };
    }));
    map.fitToMarkers();
  }

  window.I18n.onChange(render);

  // arriving from the voice page or a shared link: ?q=...
  var q = new URLSearchParams(window.location.search).get('q');
  if (q) {
    qField.input.value = q;
    if (panel.getLocation()) search(0); else panel.needLocation();
  }
});
