RHP.boot({ page: 'pharmacy', roles: ['PHARMACY'] }, function () {
  var ui = RHP.ui, h = ui.h, t = window.I18n.t;
  var box = document.getElementById('content');
  var data = null, currentPage = 0;

  function load(page) {
    currentPage = page;
    ui.replace(box, ui.spinner());
    return RHP.api.get('/pharmacies/me/inventory', { page: page, size: 20 }).then(function (d) { data = d; render(); }, function (err) {
      if (err.code === 'PHARMACY_NOT_REGISTERED') {
        ui.replace(box, ui.alert('warn', t('error.PHARMACY_NOT_REGISTERED')), h('a', { class: 'btn', href: 'pharmacy-dashboard.html' }, t('pharmacy.registerTitle')));
        document.getElementById('add-btn').classList.add('hidden');
      } else ui.showError(box, err);
    });
  }

  function priceOf(v) { return v === '' ? null : Number(v); }

  /** Edit one row. Saving (even with the same numbers) refreshes "last updated". */
  function editDialog(item) {
    var qty = ui.field({ id: 'e-qty', name: 'quantity', labelKey: 'inventory.quantity', value: item.quantity, inputmode: 'numeric', required: true, rules: [ui.rules.nonNegInt] });
    var price = ui.field({ id: 'e-price', name: 'price', labelKey: 'medicine.price', value: item.price === null ? '' : item.price, inputmode: 'decimal', rules: [ui.rules.priceOptional] });
    var avail = h('input', { type: 'checkbox', id: 'e-avail', checked: item.available });
    var err = h('div');
    var dlg;
    var form = h('form', { novalidate: true, class: 'stack' }, err, qty.el, price.el,
      h('label', { class: 'check', for: 'e-avail' }, avail, t('inventory.availableCheck')),
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'submit' }, t('common.save')),
        h('button', { class: 'btn secondary', type: 'button', onClick: function () { dlg.close(); } }, t('common.cancel'))));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!ui.validateFields([qty, price])) return;
      RHP.api.put('/pharmacies/me/inventory/' + item.id, { quantity: Number(qty.value()), price: priceOf(price.value()), available: avail.checked })
        .then(function () { dlg.close(); ui.toast(t('common.saved')); load(currentPage); },
          function (er) { if (!ui.applyServerFieldErrors([qty, price], er.fieldErrors)) ui.showError(err, er); });
    });
    dlg = ui.dialog(item.medicine.brandName + ' ' + item.medicine.strength, form);
  }

  /** Add a medicine: search the catalogue, pick one, then enter quantity and price. */
  function addDialog() {
    var chosen = null;
    var search = ui.field({ id: 'a-search', name: 'q', labelKey: 'inventory.searchMedicine', autocomplete: 'off' });
    var suggestions = h('div', { class: 'chips', 'aria-live': 'polite' });
    var chosenBox = h('p', { class: 'muted' });
    var qty = ui.field({ id: 'a-qty', name: 'quantity', labelKey: 'inventory.quantity', value: '', inputmode: 'numeric', required: true, rules: [ui.rules.nonNegInt] });
    var price = ui.field({ id: 'a-price', name: 'price', labelKey: 'medicine.price', value: '', inputmode: 'decimal', rules: [ui.rules.priceOptional] });
    var err = h('div');
    var dlg;
    function choose(m) {
      chosen = m;
      chosenBox.textContent = t('inventory.chosen') + ': ' + m.brandName + ' (' + m.genericName + ' ' + m.strength + ', ' + m.dosageForm + ')';
      ui.clear(suggestions);
    }
    search.input.addEventListener('input', ui.debounce(function () {
      var q = search.value();
      if (q.length < 2) { ui.clear(suggestions); return; }
      RHP.api.get('/medicines/suggest', { q: q }).then(function (list) {
        ui.replace(suggestions, list.length ? list.map(function (m) {
          return h('button', { class: 'chip', type: 'button', onClick: function () { choose(m); } }, m.brandName + ' \u2014 ' + m.genericName + ' ' + m.strength + ' ' + m.dosageForm);
        }) : h('span', { class: 'muted' }, t('inventory.notInCatalogue')));
      }, function () { /* optional */ });
    }, 250));
    var form = h('form', { novalidate: true, class: 'stack' }, err, search.el, suggestions, chosenBox, qty.el, price.el,
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'submit' }, t('common.save')),
        h('button', { class: 'btn secondary', type: 'button', onClick: function () { dlg.close(); } }, t('common.cancel'))));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      ui.clear(err);
      if (!chosen) { ui.replace(err, ui.alert('warn', t('inventory.chooseFirst'))); return; }
      if (!ui.validateFields([qty, price])) return;
      RHP.api.post('/pharmacies/me/inventory', { medicineId: chosen.id, quantity: Number(qty.value()), price: priceOf(price.value()), available: true })
        .then(function () { dlg.close(); ui.toast(t('common.saved')); load(0); },
          function (er) { if (!ui.applyServerFieldErrors([qty, price], er.fieldErrors)) ui.showError(err, er); });
    });
    dlg = ui.dialog(t('inventory.add'), form);
  }

  function confirmFresh(item) {
    RHP.api.put('/pharmacies/me/inventory/' + item.id, { quantity: item.quantity, price: item.price, available: item.available })
      .then(function () { ui.toast(t('inventory.confirmed')); load(currentPage); }, function (er) { ui.toast(ui.errorText(er), 'error'); });
  }
  function markUnavailable(item) {
    RHP.api.patch('/pharmacies/me/inventory/' + item.id + '/unavailable').then(function () { load(currentPage); }, function (er) { ui.toast(ui.errorText(er), 'error'); });
  }
  function remove(item) {
    ui.confirm(t('inventory.confirmDelete', { name: item.medicine.brandName }), t('common.delete')).then(function (yes) {
      if (!yes) return;
      RHP.api.del('/pharmacies/me/inventory/' + item.id).then(function () { load(currentPage); }, function (er) { ui.toast(ui.errorText(er), 'error'); });
    });
  }

  function render() {
    if (!data) return;
    if (!data.content.length) { ui.replace(box, ui.alert('info', t('inventory.empty'))); return; }
    var rows = data.content.map(function (i) {
      return h('tr', null,
        h('td', null, h('strong', null, i.medicine.brandName), h('div', { class: 'muted' }, i.medicine.genericName + ' ' + i.medicine.strength + ', ' + i.medicine.dosageForm)),
        h('td', null, String(i.quantity)), h('td', null, ui.formatPrice(i.price)),
        h('td', null, ui.stockBadge(i.stockStatus)),
        h('td', null, ui.relativeTime(i.lastUpdatedAt), ' ', i.stale ? ui.badge(t('medicine.staleShort'), 'warn') : null),
        h('td', null, h('div', { class: 'row' },
          h('button', { class: 'btn small', type: 'button', onClick: function () { confirmFresh(i); } }, '\u2714 ' + t('inventory.confirmFresh')),
          h('button', { class: 'btn secondary small', type: 'button', onClick: function () { editDialog(i); } }, t('common.edit')),
          i.available ? h('button', { class: 'btn secondary small', type: 'button', onClick: function () { markUnavailable(i); } }, t('inventory.markUnavailable')) : null,
          h('button', { class: 'btn danger small', type: 'button', onClick: function () { remove(i); } }, t('common.delete')))));
    });
    ui.replace(box, h('div', { class: 'table-wrap' }, h('table', null,
      h('thead', null, h('tr', null, ['pharmacy.colMedicine', 'inventory.quantity', 'medicine.price', 'pharmacy.colStock', 'pharmacy.colUpdated', 'common.actions'].map(function (k) { return h('th', null, t(k)); }))),
      h('tbody', null, rows))), ui.pager({ page: data.page, totalPages: data.totalPages, onChange: load }));
  }

  document.getElementById('add-btn').addEventListener('click', addDialog);
  window.I18n.onChange(render);
  return load(0);
});
