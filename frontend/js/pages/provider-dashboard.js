RHP.boot({ page: 'provider', roles: ['HEALTHCARE_PROVIDER'] }, function () {
  var ui = RHP.ui, h = ui.h, t = window.I18n.t;
  var box = document.getElementById('content'), tabsBox = document.getElementById('tabs');
  var DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  var TYPES = ['HOSPITAL', 'PHC', 'CHC', 'CLINIC'];
  var tab = 'centres', centres = [], services = [], doctors = null;

  function renderTabs() {
    ui.replace(tabsBox, ['centres', 'doctors'].map(function (k) {
      return h('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': String(tab === k), onClick: function () { tab = k; renderTabs(); show(); } },
        t(k === 'centres' ? 'provider.tabCentres' : 'provider.tabDoctors'));
    }));
  }

  function show() { return tab === 'centres' ? renderCentres() : loadDoctors(0); }
  function loadCentres() {
    return Promise.all([RHP.api.get('/centres/mine'), RHP.api.get('/centres/services')]).then(function (r) { centres = r[0]; services = r[1]; });
  }

  // ======================= centres =======================
  function centreDialog(existing) {
    var e = existing || {};
    var f = {
      name: ui.field({ id: 'c-name', name: 'name', labelKey: 'centre.name', value: e.name || '', maxlength: 150, required: true, rules: [ui.rules.required] }),
      type: ui.field({ id: 'c-type', name: 'type', labelKey: 'centre.filterType', type: 'select', value: e.type || 'CLINIC',
        options: TYPES.map(function (x) { return { value: x, labelKey: 'centre.type.' + x }; }) }),
      address: ui.field({ id: 'c-address', name: 'address', labelKey: 'common.address', value: e.address || '', maxlength: 300, required: true, rules: [ui.rules.required] }),
      taluk: ui.field({ id: 'c-taluk', name: 'taluk', labelKey: 'common.taluk', value: e.taluk || '' }),
      district: ui.field({ id: 'c-district', name: 'district', labelKey: 'common.district', value: e.district || '' }),
      phone: ui.field({ id: 'c-phone', name: 'phone', labelKey: 'common.phone', value: e.phone || '', type: 'tel', inputmode: 'tel', rules: [ui.rules.phoneOptional] }),
      lat: ui.field({ id: 'c-lat', name: 'latitude', labelKey: 'common.latitude', value: e.latitude !== undefined ? e.latitude : '', inputmode: 'decimal', required: true, rules: [ui.rules.lat] }),
      lng: ui.field({ id: 'c-lng', name: 'longitude', labelKey: 'common.longitude', value: e.longitude !== undefined ? e.longitude : '', inputmode: 'decimal', required: true, rules: [ui.rules.lng] })
    };
    var list = [f.name, f.type, f.address, f.taluk, f.district, f.phone, f.lat, f.lng];
    var emergency = h('input', { type: 'checkbox', id: 'c-emergency', checked: !!e.emergencyAvailable });
    var chosen = (e.services || []);
    var serviceBoxes = services.map(function (s) {
      var cb = h('input', { type: 'checkbox', value: s.id, checked: chosen.indexOf(s.name) >= 0 });
      return { cb: cb, el: h('label', { class: 'check' }, cb, s.name) };
    });
    var picker = h('div'), err = h('div'), dlg;
    var form = h('form', { novalidate: true, class: 'stack' }, err,
      existing ? ui.alert('warn', t('centre.reverifyWarning')) : null,
      f.name.el, f.type.el, f.address.el, f.taluk.el, f.district.el, f.phone.el,
      h('p', { class: 'muted' }, t('pharmacy.pickLocation')), picker, h('div', { class: 'grid' }, f.lat.el, f.lng.el),
      h('label', { class: 'check', for: 'c-emergency' }, emergency, t('centre.emergency')),
      h('div', null, h('strong', null, t('centre.services')), serviceBoxes.map(function (s) { return s.el; })),
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'submit' }, t('common.save')),
        h('button', { class: 'btn secondary', type: 'button', onClick: function () { dlg.close(); } }, t('common.cancel'))));
    RHP.components.locationPanel(picker, { noStore: true, initial: e.latitude !== undefined ? { lat: Number(e.latitude), lng: Number(e.longitude), source: 'manual' } : null,
      onChange: function (loc) { f.lat.input.value = loc.lat.toFixed(6); f.lng.input.value = loc.lng.toFixed(6); } });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      ui.clear(err);
      if (!ui.validateFields(list)) return;
      var body = { name: f.name.value(), type: f.type.value(), address: f.address.value(), taluk: f.taluk.value() || null, district: f.district.value() || null,
        phone: f.phone.value() || null, latitude: Number(f.lat.value()), longitude: Number(f.lng.value()), emergencyAvailable: emergency.checked,
        serviceIds: serviceBoxes.filter(function (s) { return s.cb.checked; }).map(function (s) { return Number(s.cb.value); }) };
      (existing ? RHP.api.put('/centres/' + existing.id, body) : RHP.api.post('/centres', body)).then(function () {
        dlg.close(); ui.toast(t('common.saved')); return loadCentres().then(renderCentres);
      }, function (er) { if (!ui.applyServerFieldErrors(list, er.fieldErrors)) ui.showError(err, er); });
    });
    dlg = ui.dialog(existing ? existing.name : t('provider.addCentre'), form);
  }

  function renderCentres() {
    var notices = { PENDING: 'pharmacy.pendingNotice', REJECTED: 'pharmacy.rejectedNotice' };
    ui.replace(box, h('div', { class: 'stack' },
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onClick: function () { centreDialog(null); } }, '+ ' + t('provider.addCentre'))),
      centres.length ? centres.map(function (c) {
        return h('article', { class: 'card stack' },
          h('div', { class: 'row between' }, h('h3', null, c.name, ' ', ui.sampleBadge(c.name)), h('span', null, ui.badge(t('centre.type.' + c.type), 'info'), ' ', ui.statusBadge(c.verificationStatus))),
          h('p', { class: 'muted' }, [c.address, c.taluk, c.district].filter(Boolean).join(', ')),
          notices[c.verificationStatus] ? ui.alert(c.verificationStatus === 'REJECTED' ? 'error' : 'warn', t(notices[c.verificationStatus])) : null,
          h('div', { class: 'row' }, h('button', { class: 'btn secondary small', type: 'button', onClick: function () { centreDialog(c); } }, t('common.edit'))));
      }) : ui.alert('info', t('provider.noCentres'))));
  }

  // ======================= doctors =======================
  function loadDoctors(page) {
    ui.replace(box, ui.spinner());
    return RHP.api.get('/doctors/mine', { page: page, size: 20 }).then(function (d) { doctors = d; renderDoctors(); }, function (err) { ui.showError(box, err); });
  }

  function centreOptions() { return centres.map(function (c) { return { value: c.id, label: c.name }; }); }

  function doctorDialog(existing) {
    var e = existing || {};
    var f = {
      name: ui.field({ id: 'd-name', name: 'name', labelKey: 'auth.name', value: e.name || '', maxlength: 120, required: true, rules: [ui.rules.required] }),
      spec: ui.field({ id: 'd-spec', name: 'specialization', labelKey: 'doctor.specialization', value: e.specialization || '', maxlength: 100, required: true, rules: [ui.rules.required] }),
      qual: ui.field({ id: 'd-qual', name: 'qualification', labelKey: 'doctor.qualification', value: e.qualification || '', maxlength: 150 }),
      phone: ui.field({ id: 'd-phone', name: 'phone', labelKey: 'common.phone', value: e.phone || '', type: 'tel', inputmode: 'tel', rules: [ui.rules.phoneOptional] }),
      years: ui.field({ id: 'd-years', name: 'experienceYears', labelKey: 'doctor.experience', value: e.experienceYears !== undefined && e.experienceYears !== null ? e.experienceYears : '', inputmode: 'numeric' }),
      centre: ui.field({ id: 'd-centre', name: 'centreId', labelKey: 'doctor.centre', type: 'select', value: e.centre ? e.centre.id : '', options: centreOptions() })
    };
    var list = [f.name, f.spec, f.qual, f.phone, f.years, f.centre], err = h('div'), dlg;
    var form = h('form', { novalidate: true, class: 'stack' }, err, f.name.el, f.spec.el, f.qual.el, f.phone.el, f.years.el, f.centre.el,
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'submit' }, t('common.save')),
        h('button', { class: 'btn secondary', type: 'button', onClick: function () { dlg.close(); } }, t('common.cancel'))));
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      ui.clear(err);
      if (!ui.validateFields(list)) return;
      var body = { name: f.name.value(), specialization: f.spec.value(), qualification: f.qual.value() || null, phone: f.phone.value() || null,
        experienceYears: f.years.value() === '' ? null : Number(f.years.value()), centreId: Number(f.centre.value()) };
      (existing ? RHP.api.put('/doctors/' + existing.id, body) : RHP.api.post('/doctors', body)).then(function () {
        dlg.close(); ui.toast(t('common.saved')); loadDoctors(doctors ? doctors.page : 0);
      }, function (er) { if (!ui.applyServerFieldErrors(list, er.fieldErrors)) ui.showError(err, er); });
    });
    dlg = ui.dialog(existing ? existing.name : t('provider.addDoctor'), form);
  }

  /** Weekly timetable editor: one row per consulting slot. Saving replaces the whole timetable. */
  function scheduleDialog(doc) {
    var rows = doc.schedule.map(function (s) { return { centreId: s.centreId, day: s.dayOfWeek, start: String(s.startTime).slice(0, 5), end: String(s.endTime).slice(0, 5) }; });
    var list = h('div', { class: 'stack' }), err = h('div'), dlg;
    function drawRows() {
      ui.replace(list, rows.length ? rows.map(function (r, idx) {
        var centreSel = h('select', { 'aria-label': t('doctor.centre') }, centreOptions().map(function (o) { return h('option', { value: o.value, selected: String(o.value) === String(r.centreId) }, o.label); }));
        var daySel = h('select', { 'aria-label': t('provider.day') }, DAYS.map(function (d) { return h('option', { value: d, selected: d === r.day }, t('day.' + d)); }));
        var start = h('input', { type: 'time', value: r.start, 'aria-label': t('provider.from') });
        var end = h('input', { type: 'time', value: r.end, 'aria-label': t('provider.to') });
        centreSel.addEventListener('change', function () { r.centreId = Number(centreSel.value); });
        daySel.addEventListener('change', function () { r.day = daySel.value; });
        start.addEventListener('change', function () { r.start = start.value; });
        end.addEventListener('change', function () { r.end = end.value; });
        return h('div', { class: 'card stack' }, centreSel, daySel, h('div', { class: 'grid' }, start, end),
          h('button', { class: 'btn danger small', type: 'button', onClick: function () { rows.splice(idx, 1); drawRows(); } }, t('common.delete')));
      }) : h('p', { class: 'muted' }, t('provider.noSlots')));
    }
    drawRows();
    var form = h('div', { class: 'stack' }, err, ui.alert('info', t('provider.timetableHelp')), list,
      h('button', { class: 'btn secondary', type: 'button', onClick: function () {
        rows.push({ centreId: doc.centre.id, day: 'MONDAY', start: '09:00', end: '13:00' }); drawRows(); } }, '+ ' + t('provider.addSlot')),
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onClick: function () {
        ui.clear(err);
        RHP.api.put('/doctors/' + doc.id + '/schedules', { slots: rows.map(function (r) { return { centreId: Number(r.centreId), dayOfWeek: r.day, startTime: r.start, endTime: r.end }; }) })
          .then(function () { dlg.close(); ui.toast(t('common.saved')); loadDoctors(doctors.page); }, function (er) { ui.showError(err, er); });
      } }, t('common.save')), h('button', { class: 'btn secondary', type: 'button', onClick: function () { dlg.close(); } }, t('common.cancel'))));
    dlg = ui.dialog(t('doctor.timings') + ': ' + doc.name, form);
  }

  /** Temporary override: "on leave until ..." / "extra clinic until ...". Always has an expiry (max 7 days). */
  function availabilityDialog(doc) {
    function localInput(date) { var p = function (n) { return String(n).padStart(2, '0'); }; return date.getFullYear() + '-' + p(date.getMonth() + 1) + '-' + p(date.getDate()) + 'T' + p(date.getHours()) + ':' + p(date.getMinutes()); }
    var status = ui.field({ id: 'o-status', name: 'status', labelKey: 'provider.overrideStatus', type: 'select', value: 'NONE', options: [
      { value: 'NONE', labelKey: 'provider.statusNone' }, { value: 'UNAVAILABLE', labelKey: 'provider.statusUnavailable' }, { value: 'AVAILABLE', labelKey: 'provider.statusAvailable' }] });
    var until = ui.field({ id: 'o-until', name: 'expiresAt', labelKey: 'provider.overrideUntil', type: 'datetime-local', value: localInput(new Date(Date.now() + 4 * 3600 * 1000)), hintKey: 'provider.overrideHint' });
    var err = h('div'), dlg;
    var form = h('form', { novalidate: true, class: 'stack' }, err, RHP.components.availabilityBlock(doc.availability), status.el, until.el,
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'submit' }, t('common.save')),
        h('button', { class: 'btn secondary', type: 'button', onClick: function () { dlg.close(); } }, t('common.cancel'))));
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      ui.clear(err);
      var body = { status: status.value() };
      if (body.status !== 'NONE') body.expiresAt = new Date(until.value()).toISOString();
      RHP.api.patch('/doctors/' + doc.id + '/availability', body).then(function () { dlg.close(); ui.toast(t('common.saved')); loadDoctors(doctors.page); },
        function (er) { ui.showError(err, er); });
    });
    dlg = ui.dialog(doc.name, form);
  }

  function removeDoctor(doc) {
    ui.confirm(t('provider.confirmDeleteDoctor', { name: doc.name }), t('common.delete')).then(function (yes) {
      if (yes) RHP.api.del('/doctors/' + doc.id).then(function () { loadDoctors(0); }, function (er) { ui.toast(ui.errorText(er), 'error'); });
    });
  }

  function renderDoctors() {
    if (!centres.length) { ui.replace(box, ui.alert('warn', t('provider.needCentreFirst'))); return; }
    ui.replace(box, h('div', { class: 'stack' },
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onClick: function () { doctorDialog(null); } }, '+ ' + t('provider.addDoctor'))),
      doctors.content.length ? doctors.content.map(function (d) {
        return h('article', { class: 'card stack' },
          h('div', { class: 'row between' }, h('h3', null, d.name, ' ', ui.sampleBadge(d.name)), ui.badge(d.specialization, 'info')),
          h('p', { class: 'muted' }, d.centre.name + (d.centre.verificationStatus !== 'VERIFIED' ? ' \u00B7 ' + t('status.' + d.centre.verificationStatus) : '')),
          RHP.components.availabilityBlock(d.availability),
          var Icons = RHP.Icons;
            h('div', { class: 'row' },
              h('button', { class: 'btn secondary small', type: 'button', onClick: function () { doctorDialog(d); } }, t('common.edit')),
              h('button', { class: 'btn secondary small', type: 'button', onClick: function () { scheduleDialog(d); } }, Icons ? Icons.wrap(Icons.schedule) : '\uD83D\uDDD3', ' ', t('doctor.timings')),
              h('button', { class: 'btn secondary small', type: 'button', onClick: function () { availabilityDialog(d); } }, t('provider.setAvailability')),
              h('button', { class: 'btn danger small', type: 'button', onClick: function () { removeDoctor(d); } }, t('common.delete'))));
      }) : ui.alert('info', t('provider.noDoctors')),
      ui.pager({ page: doctors.page, totalPages: doctors.totalPages, onChange: loadDoctors })));
  }

  window.I18n.onChange(function () { renderTabs(); if (tab === 'centres') renderCentres(); else if (doctors) renderDoctors(); });
  renderTabs();
  return loadCentres().then(show);
});
