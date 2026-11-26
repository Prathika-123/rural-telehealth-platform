RHP.boot({ page: 'symptoms' }, function () {
  var ui = RHP.ui, h = ui.h, t = window.I18n.t, voice = RHP.voice;
  var emergencyBox = document.getElementById('emergency'), notice = document.getElementById('notice');
  var listBox = document.getElementById('symptom-list'), detailBox = document.getElementById('detail');
  var selected = new URLSearchParams(window.location.search).get('id') || '';
  var emergency = null, list = null, detail = null;

  function lang() { return window.I18n.getLanguage(); }

  function speak(text) {
    voice.canSpeak().then(function (ok) { if (ok) voice.speak(text); else ui.toast(t('voice.noVoice'), 'error'); });
  }
  function bullets(items) { return h('ul', null, items.map(function (x) { return h('li', null, x); })); }

  function renderEmergency() {
    if (!emergency) return;
    var e = emergency.emergency;
    var Icons = RHP.Icons;
    ui.replace(emergencyBox, h('section', { class: 'emergency-box stack', 'aria-labelledby': 'em-title' },
      h('h2', { id: 'em-title' }, Icons ? Icons.wrap(Icons.warning) : '\u26A0', ' ', e.title), h('p', null, e.intro), bullets(e.signs), bullets(e.actions),
      h('div', { class: 'row' }, e.numbers.map(function (n) {
        return h('a', { class: 'btn danger', href: 'tel:' + n.number }, Icons ? Icons.wrap(Icons.phone) : '\uD83D\uDCDE', ' ', n.number, ' \u00B7 ', n.label);
      }), voice.ttsSupported() ? h('button', { class: 'btn secondary', type: 'button', onClick: function () {
        speak([e.title, e.intro].concat(e.signs, e.actions).join('. ')); } }, Icons ? Icons.wrap(Icons.readAloud) : '\uD83D\uDD0A', ' ', t('voice.readAloud')) : null)));
    var warn = [ui.alert('info', emergency.disclaimer)];
    if (emergency.reviewStatus !== 'REVIEWED') warn.push(ui.alert('warn', t('symptoms.notReviewed')));
    ui.replace(notice, warn);
  }

  function renderList() {
    if (!list) return;
    var Icons = RHP.Icons;
    ui.replace(listBox, list.symptoms.map(function (s) {
      return h('button', { class: 'chip', type: 'button', 'aria-pressed': String(s.id === selected), onClick: function () { select(s.id); } },
        var icon = s.emergency ? (Icons ? Icons.wrap(Icons.warning) : '\u26A0') : null;
      return h('button', { class: 'chip', type: 'button', 'aria-pressed': String(s.id === selected), onClick: function () { select(s.id); } },
        icon,
        ' ',
        s.name);
    }));
    }));
  }

  function renderDetail() {
    if (!detail) { ui.clear(detailBox); return; }
    var s = detail.symptom;
    var Icons = RHP.Icons;
    function section(titleKey, items, kind) {
      return h('div', { class: kind === 'danger' ? 'emergency-box' : '' }, h('h3', null, t(titleKey)), bullets(items));
    }
    ui.replace(detailBox, h('article', { class: 'card stack' },
      h('h2', null, s.name, ' ', s.emergency ? ui.badge(t('symptoms.urgent'), 'danger') : null),
      h('p', null, s.about),
      section('symptoms.selfCare', s.selfCare), section('symptoms.seeDoctorIf', s.seeDoctorIf), section('symptoms.emergencyIf', s.emergencyIf, 'danger'),
      h('div', { class: 'row' },
        h('a', { class: 'btn', href: 'centres.html' }, Icons ? Icons.wrap(Icons.centre) : '\uD83C\uDFE5', ' ', t('symptoms.findCare')),
        voice.ttsSupported() ? h('button', { class: 'btn secondary', type: 'button', onClick: function () {
          speak([s.name, s.about, t('symptoms.seeDoctorIf')].concat(s.seeDoctorIf, [t('symptoms.emergencyIf')], s.emergencyIf).join('. ')); } },
          Icons ? Icons.wrap(Icons.readAloud) : '\uD83D\uDD0A', ' ', t('voice.readAloud')) : null,
        h('button', { class: 'btn secondary', type: 'button', onClick: voice.stopSpeaking }, t('voice.stopReading')))));
  }

  function select(id) {
    selected = id;
    renderList();
    ui.replace(detailBox, ui.spinner());
    RHP.api.get('/symptoms/' + encodeURIComponent(id), { lang: lang() }).then(function (d) { detail = d; renderDetail(); },
      function (err) { detail = null; ui.showError(detailBox, err); });
  }

  function loadAll() {
    RHP.api.get('/symptoms/emergency', { lang: lang() }).then(function (e) { emergency = e; renderEmergency(); }, function (err) { ui.showError(emergencyBox, err); });
    RHP.api.get('/symptoms', { lang: lang() }).then(function (l) { list = l; renderList(); }, function (err) { ui.showError(listBox, err); });
    if (selected) select(selected);
  }

  window.I18n.onChange(loadAll);   // the text comes from the server in the chosen language
  loadAll();
});
