RHP.boot({ page: 'pharmacy', roles: ['PHARMACY'] }, function () {
  var ui = RHP.ui, h = ui.h, t = window.I18n.t;
  var box = document.getElementById('content');
  var pharmacy = null, summary = null;

  /** Registration and edit share one form. `existing` is null when registering. */
  function pharmacyForm(existing, onSaved) {
    var e = existing || {};
    var f = {
      name: ui.field({ id: 'p-name', name: 'name', labelKey: 'pharmacy.name', value: e.name || '', maxlength: 150, required: true, rules: [ui.rules.required] }),
      license: ui.field({ id: 'p-license', name: 'licenseNumber', labelKey: 'pharmacy.license', value: e.licenseNumber || '', maxlength: 60, required: true, rules: [ui.rules.required] }),
      address: ui.field({ id: 'p-address', name: 'address', labelKey: 'common.address', value: e.address || '', maxlength: 300, required: true, rules: [ui.rules.required] }),
      taluk: ui.field({ id: 'p-taluk', name: 'taluk', labelKey: 'common.taluk', value: e.taluk || '' }),
      district: ui.field({ id: 'p-district', name: 'district', labelKey: 'common.district', value: e.district || '' }),
      phone: ui.field({ id: 'p-phone', name: 'phone', labelKey: 'common.phone', value: e.phone || '', type: 'tel', inputmode: 'tel', rules: [ui.rules.phoneOptional] }),
      lat: ui.field({ id: 'p-lat', name: 'latitude', labelKey: 'common.latitude', value: e.latitude !== undefined ? e.latitude : '', inputmode: 'decimal', required: true, rules: [ui.rules.lat] }),
      lng: ui.field({ id: 'p-lng', name: 'longitude', labelKey: 'common.longitude', value: e.longitude !== undefined ? e.longitude : '', inputmode: 'decimal', required: true, rules: [ui.rules.lng] })
    };
    var list = [f.name, f.license, f.address, f.taluk, f.district, f.phone, f.lat, f.lng];
    var pickerBox = h('div');
    var errBox = h('div');
    var btn = h('button', { class: 'btn', type: 'submit' }, t('common.save'));
    var form = h('form', { novalidate: true, class: 'stack' }, errBox,
      existing ? ui.alert('warn', t('pharmacy.reverifyWarning')) : null,
      f.name.el, f.license.el, f.address.el, f.taluk.el, f.district.el, f.phone.el,
      h('p', { class: 'muted' }, t('pharmacy.pickLocation')), pickerBox,
      h('div', { class: 'grid' }, f.lat.el, f.lng.el), btn);
    RHP.components.locationPanel(pickerBox, { noStore: true,
      initial: e.latitude !== undefined ? { lat: Number(e.latitude), lng: Number(e.longitude), source: 'manual' } : null,
      onChange: function (loc) { f.lat.input.value = loc.lat.toFixed(6); f.lng.input.value = loc.lng.toFixed(6); } });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      ui.clear(errBox);
      if (!ui.validateFields(list)) return;
      ui.setBusy(btn, true);
      var body = { name: f.name.value(), licenseNumber: f.license.value(), address: f.address.value(), taluk: f.taluk.value() || null,
        district: f.district.value() || null, phone: f.phone.value() || null, latitude: Number(f.lat.value()), longitude: Number(f.lng.value()) };
      (existing ? RHP.api.put('/pharmacies/me', body) : RHP.api.post('/pharmacies/register', body)).then(function (saved) {
        ui.toast(t('common.saved'));
        onSaved(saved);
      }, function (err) {
        if (!ui.applyServerFieldErrors(list, err.fieldErrors)) ui.showError(errBox, err);
        ui.setBusy(btn, false);
      });
    });
    return form;
  }

  function computeSummary() {
    var s = { total: 0, low: 0, out: 0, unavailable: 0, stale: 0, partial: false };
    function page(n) {
      return RHP.api.get('/pharmacies/me/inventory', { page: n, size: 50 }).then(function (d) {
        d.content.forEach(function (i) {
          s.total++;
          if (i.stockStatus === 'LOW_STOCK') s.low++;
          if (i.stockStatus === 'OUT_OF_STOCK') s.out++;
          if (i.stockStatus === 'UNAVAILABLE') s.unavailable++;
          if (i.stale) s.stale++;
        });
        if (n + 1 < d.totalPages) { if (n + 1 >= 5) { s.partial = true; return s; } return page(n + 1); }
        return s;
      });
    }
    return page(0);
  }

  function stat(label, value, kind) {
    return h('div', { class: 'card stat' }, h('div', { class: 'num' }, String(value)), h('div', { class: kind === 'warn' && value > 0 ? 'badge warn' : 'muted' }, label));
  }

  function render() {
    if (!pharmacy) { ui.replace(box, h('div', { class: 'card stack' }, h('h2', null, t('pharmacy.registerTitle')), ui.alert('info', t('pharmacy.registerIntro')),
      pharmacyForm(null, function (saved) { pharmacy = saved; summary = { total: 0, low: 0, out: 0, unavailable: 0, stale: 0 }; render(); }))); return; }
    var notice = { PENDING: ui.alert('warn', t('pharmacy.pendingNotice')), REJECTED: ui.alert('error', t('pharmacy.rejectedNotice')),
      VERIFIED: ui.alert('ok', t('pharmacy.verifiedNotice')) }[pharmacy.verificationStatus];
    ui.replace(box, h('div', { class: 'stack' },
      h('div', { class: 'card stack' }, h('div', { class: 'row between' }, h('h2', null, pharmacy.name, ' ', ui.sampleBadge(pharmacy.name)), ui.statusBadge(pharmacy.verificationStatus)),
        h('p', { class: 'muted' }, [pharmacy.address, pharmacy.taluk, pharmacy.district].filter(Boolean).join(', ')), notice),
      summary ? h('div', { class: 'grid' }, stat(t('pharmacy.statTotal'), summary.total), stat(t('stock.LOW_STOCK'), summary.low, 'warn'),
        stat(t('stock.OUT_OF_STOCK'), summary.out, 'warn'), stat(t('pharmacy.statStale'), summary.stale, 'warn')) : ui.spinner(),
      h('div', { class: 'row' }, h('a', { class: 'btn', href: 'inventory.html' }, '\uD83D\uDCE6 ' + t('inventory.title'))),
      ui.alert('info', t('pharmacy.staleReminder')),
      h('details', { class: 'card' }, h('summary', null, t('pharmacy.editDetails')),
        h('div', { style: 'margin-top:1rem' }, pharmacyForm(pharmacy, function (saved) { pharmacy = saved; render(); })))));
  }

  window.I18n.onChange(render);
  return RHP.api.get('/pharmacies/me').then(function (p) { pharmacy = p; render(); return computeSummary(); })
    .then(function (s) { summary = s; render(); }, function (err) {
      if (err.code === 'PHARMACY_NOT_REGISTERED') { pharmacy = null; render(); return; }
      throw err;
    });
});
