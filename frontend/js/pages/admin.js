RHP.boot({ page: 'admin', roles: ['ADMIN'] }, function () {
  var ui = RHP.ui, h = ui.h, t = window.I18n.t;
  var box = document.getElementById('content'), tabsBox = document.getElementById('tabs');
  var TABS = ['overview', 'users', 'pharmacies', 'centres', 'medicines'];
  var tab = 'overview';
  var state = { userRole: '', pharmacyStatus: 'PENDING', centreStatus: 'PENDING', medicineQ: '' };

  function renderTabs() {
    ui.replace(tabsBox, TABS.map(function (k) {
      return h('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': String(tab === k), onClick: function () { tab = k; renderTabs(); show(0); } }, t('admin.tab.' + k));
    }));
  }
  function show(page) {
    ui.replace(box, ui.spinner());
    var fn = { overview: overview, users: users, pharmacies: pharmacies, centres: centres, medicines: medicines }[tab];
    return fn(page || 0).catch(function (err) { ui.showError(box, err); });
  }
  function table(headKeys, rows) {
    return h('div', { class: 'table-wrap' }, h('table', null, h('thead', null, h('tr', null, headKeys.map(function (k) { return h('th', null, t(k)); }))), h('tbody', null, rows)));
  }
  function filter(labelKey, id, value, options, onChange) {
    var sel = h('select', { id: id, class: 'w-auto' }, options.map(function (o) { return h('option', { value: o.value, selected: o.value === value }, o.label); }));
    sel.addEventListener('change', function () { onChange(sel.value); });
    return h('div', { class: 'row' }, h('label', { for: id }, t(labelKey)), sel);
  }
  function stat(label, value) { return h('div', { class: 'card stat' }, h('div', { class: 'num' }, String(value)), h('div', { class: 'muted' }, label)); }
  function act(promise) { return promise.then(function () { return show(0); }, function (er) { ui.toast(ui.errorText(er), 'error'); }); }

  // ---------- overview: platform statistics + inventory activity ----------
  function overview(page) {
    return Promise.all([RHP.api.get('/admin/stats'), RHP.api.get('/admin/inventory-activity', { page: page, size: 15 })]).then(function (r) {
      var s = r[0], a = r[1];
      var roleStats = Object.keys(s.usersByRole).map(function (k) { return stat(t('role.' + k), s.usersByRole[k]); });
      var rows = a.content.map(function (x) {
        return h('tr', null, h('td', null, x.pharmacyName), h('td', null, x.medicineName), h('td', null, String(x.quantity)),
          h('td', null, x.available ? t('common.yes') : t('common.no')), h('td', null, ui.formatDateTime(x.lastUpdatedAt), ' ', x.stale ? ui.badge(t('medicine.staleShort'), 'warn') : null));
      });
      ui.replace(box, h('div', { class: 'stack' },
        h('div', { class: 'grid' }, stat(t('admin.statUsers'), s.totalUsers), roleStats),
        h('div', { class: 'grid' }, stat(t('admin.statPharmaciesPending'), s.pharmaciesByStatus.PENDING), stat(t('admin.statPharmaciesVerified'), s.pharmaciesByStatus.VERIFIED),
          stat(t('admin.statCentresPending'), s.centresByStatus.PENDING), stat(t('admin.statCentresVerified'), s.centresByStatus.VERIFIED),
          stat(t('admin.statDoctors'), s.doctors), stat(t('admin.statMedicines'), s.medicines),
          stat(t('admin.statInventory'), s.inventoryItems), stat(t('admin.statStale', { days: s.staleAfterDays }), s.staleInventoryItems)),
        h('h2', null, t('admin.activity')),
        rows.length ? table(['pharmacy.title', 'pharmacy.colMedicine', 'inventory.quantity', 'inventory.availableCheck', 'pharmacy.colUpdated'], rows) : ui.alert('info', t('common.noResults')),
        ui.pager({ page: a.page, totalPages: a.totalPages, onChange: function (p) { show(p); } })));
    });
  }

  // ---------- users (also covers healthcare providers via the role filter) ----------
  function users(page) {
    return RHP.api.get('/admin/users', { role: state.userRole, page: page, size: 10 }).then(function (d) {
      var me = RHP.auth.getUser();
      var rows = d.content.map(function (u) {
        return h('tr', null, h('td', null, u.name), h('td', null, u.email), h('td', null, t('role.' + u.role)),
          h('td', null, u.enabled ? ui.badge(t('admin.enabled'), 'ok') : ui.badge(t('admin.disabled'), 'danger')), h('td', null, ui.formatDate(u.createdAt.slice(0, 10))),
          h('td', null, u.id === me.id ? '' : h('button', { class: 'btn secondary small', type: 'button',
            onClick: function () { act(RHP.api.patch('/admin/users/' + u.id + '/enabled', { enabled: !u.enabled })); } }, t(u.enabled ? 'admin.disable' : 'admin.enable'))));
      });
      ui.replace(box, h('div', { class: 'stack' },
        filter('admin.filterRole', 'f-role', state.userRole, [{ value: '', label: t('centre.all') }].concat(['USER', 'PHARMACY', 'HEALTHCARE_PROVIDER', 'ADMIN'].map(function (r) { return { value: r, label: t('role.' + r) }; })),
          function (v) { state.userRole = v; show(0); }),
        table(['auth.name', 'auth.email', 'auth.role', 'admin.accountStatus', 'admin.created', 'common.actions'], rows),
        ui.pager({ page: d.page, totalPages: d.totalPages, onChange: function (p) { show(p); } })));
    });
  }

  var STATUS_OPTIONS = function () { return [{ value: '', label: t('centre.all') }].concat(['PENDING', 'VERIFIED', 'REJECTED'].map(function (s) { return { value: s, label: t('status.' + s) }; })); };
  function verifyButtons(base, id, current) {
    return h('div', { class: 'row' },
      current !== 'VERIFIED' ? h('button', { class: 'btn small', type: 'button', onClick: function () { act(RHP.api.patch(base + '/' + id + '/verify', { status: 'VERIFIED' })); } }, t('admin.verify')) : null,
      current !== 'REJECTED' ? h('button', { class: 'btn danger small', type: 'button', onClick: function () { act(RHP.api.patch(base + '/' + id + '/verify', { status: 'REJECTED' })); } }, t('admin.reject')) : null);
  }

  // ---------- pharmacy verification ----------
  function pharmacies(page) {
    return RHP.api.get('/admin/pharmacies', { status: state.pharmacyStatus, page: page, size: 10 }).then(function (d) {
      var rows = d.content.map(function (p) {
        return h('tr', null, h('td', null, p.name, ' ', ui.sampleBadge(p.name)), h('td', null, p.licenseNumber),
          h('td', null, p.ownerName, h('div', { class: 'muted' }, p.ownerEmail)), h('td', null, [p.address, p.district].filter(Boolean).join(', ')),
          h('td', null, ui.statusBadge(p.verificationStatus)), h('td', null, verifyButtons('/admin/pharmacies', p.id, p.verificationStatus)));
      });
      ui.replace(box, h('div', { class: 'stack' },
        filter('admin.filterStatus', 'f-status', state.pharmacyStatus, STATUS_OPTIONS(), function (v) { state.pharmacyStatus = v; show(0); }),
        rows.length ? table(['pharmacy.name', 'pharmacy.license', 'admin.owner', 'common.address', 'admin.accountStatus', 'common.actions'], rows) : ui.alert('info', t('common.noResults')),
        ui.pager({ page: d.page, totalPages: d.totalPages, onChange: function (p) { show(p); } })));
    });
  }

  // ---------- centre verification ----------
  function centres(page) {
    return RHP.api.get('/admin/centres', { status: state.centreStatus, page: page, size: 10 }).then(function (d) {
      var rows = d.content.map(function (c) {
        return h('tr', null, h('td', null, c.name, ' ', ui.sampleBadge(c.name)), h('td', null, t('centre.type.' + c.type)),
          h('td', null, c.managerName || '-', h('div', { class: 'muted' }, c.managerEmail || '')), h('td', null, [c.address, c.district].filter(Boolean).join(', ')),
          h('td', null, ui.statusBadge(c.verificationStatus)), h('td', null, verifyButtons('/admin/centres', c.id, c.verificationStatus)));
      });
      ui.replace(box, h('div', { class: 'stack' },
        filter('admin.filterStatus', 'f-status', state.centreStatus, STATUS_OPTIONS(), function (v) { state.centreStatus = v; show(0); }),
        rows.length ? table(['centre.name', 'centre.filterType', 'admin.manager', 'common.address', 'admin.accountStatus', 'common.actions'], rows) : ui.alert('info', t('common.noResults')),
        ui.pager({ page: d.page, totalPages: d.totalPages, onChange: function (p) { show(p); } })));
    });
  }

  // ---------- medicine catalogue ----------
  function medicineDialog(m) {
    var e = m || {};
    var f = {
      brand: ui.field({ id: 'm-brand', name: 'brandName', labelKey: 'admin.brandName', value: e.brandName || '', maxlength: 120, required: true, rules: [ui.rules.required] }),
      generic: ui.field({ id: 'm-generic', name: 'genericName', labelKey: 'admin.genericName', value: e.genericName || '', maxlength: 120, required: true, rules: [ui.rules.required] }),
      strength: ui.field({ id: 'm-strength', name: 'strength', labelKey: 'medicine.strength', value: e.strength || '', maxlength: 40, required: true, rules: [ui.rules.required] }),
      form: ui.field({ id: 'm-form', name: 'dosageForm', labelKey: 'admin.dosageForm', value: e.dosageForm || '', maxlength: 40, required: true, rules: [ui.rules.required] })
    };
    var list = [f.brand, f.generic, f.strength, f.form], rx = h('input', { type: 'checkbox', id: 'm-rx', checked: !!e.prescriptionRequired }), err = h('div'), dlg;
    var form = h('form', { novalidate: true, class: 'stack' }, err, f.brand.el, f.generic.el, f.strength.el, f.form.el,
      h('label', { class: 'check', for: 'm-rx' }, rx, t('medicine.prescription')),
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'submit' }, t('common.save')), h('button', { class: 'btn secondary', type: 'button', onClick: function () { dlg.close(); } }, t('common.cancel'))));
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      ui.clear(err);
      if (!ui.validateFields(list)) return;
      var body = { brandName: f.brand.value(), genericName: f.generic.value(), strength: f.strength.value(), dosageForm: f.form.value(), prescriptionRequired: rx.checked };
      (m ? RHP.api.put('/admin/medicines/' + m.id, body) : RHP.api.post('/admin/medicines', body)).then(function () { dlg.close(); ui.toast(t('common.saved')); show(0); },
        function (er) { if (!ui.applyServerFieldErrors(list, er.fieldErrors)) ui.showError(err, er); });
    });
    dlg = ui.dialog(m ? m.brandName : t('admin.addMedicine'), form);
  }

  function medicines(page) {
    return RHP.api.get('/admin/medicines', { q: state.medicineQ, page: page, size: 10 }).then(function (d) {
      var q = h('input', { type: 'search', value: state.medicineQ, 'aria-label': t('common.search'), class: 'max-w-[20rem]' });
      var rows = d.content.map(function (m) {
        return h('tr', null, h('td', null, m.brandName), h('td', null, m.genericName), h('td', null, m.strength), h('td', null, m.dosageForm),
          h('td', null, m.prescriptionRequired ? t('common.yes') : t('common.no')),
          h('td', null, h('div', { class: 'row' }, h('button', { class: 'btn secondary small', type: 'button', onClick: function () { medicineDialog(m); } }, t('common.edit')),
            h('button', { class: 'btn danger small', type: 'button', onClick: function () {
              ui.confirm(t('admin.confirmDeleteMedicine', { name: m.brandName }), t('common.delete')).then(function (yes) { if (yes) act(RHP.api.del('/admin/medicines/' + m.id)); }); } }, t('common.delete')))));
      });
      var searchForm = h('form', { class: 'row', onSubmit: function (ev) { ev.preventDefault(); state.medicineQ = q.value.trim(); show(0); } }, q, h('button', { class: 'btn secondary', type: 'submit' }, t('common.search')),
        h('button', { class: 'btn', type: 'button', onClick: function () { medicineDialog(null); } }, '+ ' + t('admin.addMedicine')));
      ui.replace(box, h('div', { class: 'stack' }, searchForm,
        rows.length ? table(['admin.brandName', 'admin.genericName', 'medicine.strength', 'admin.dosageForm', 'medicine.prescription', 'common.actions'], rows) : ui.alert('info', t('common.noResults')),
        ui.pager({ page: d.page, totalPages: d.totalPages, onChange: function (p) { show(p); } })));
    });
  }

  window.I18n.onChange(function () { renderTabs(); show(0); });
  renderTabs();
  return show(0);
});
