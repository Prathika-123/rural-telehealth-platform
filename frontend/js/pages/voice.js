RHP.boot({ page: 'voice' }, function () {
  var ui = RHP.ui, h = ui.h, t = window.I18n.t, voice = RHP.voice;
  var mode = 'medicine';

  var textField = ui.field({ id: 'voice-text', name: 'text', labelKey: 'voice.typeInstead', autocomplete: 'off' });
  ui.replace(document.getElementById('text-field'), textField.el);

  var chips = document.getElementById('mode-chips'), example = document.getElementById('example');
  function renderMode() {
    ui.replace(chips, ['medicine', 'facility'].map(function (m) {
      return h('button', { class: 'chip', type: 'button', 'aria-pressed': String(m === mode), onClick: function () { mode = m; renderMode(); } },
        t(m === 'medicine' ? 'voice.modeMedicine' : 'voice.modeFacility'));
    }));
    example.textContent = t(mode === 'medicine' ? 'voice.exampleMedicine' : 'voice.exampleFacility');
  }
  renderMode();
  window.I18n.onChange(renderMode);

  function go() {
    var text = voice.cleanTranscript(textField.input.value);
    if (!text) { textField.setError(t('validation.required')); textField.input.focus(); return; }
    textField.setError('');
    if (mode === 'medicine') {
      RHP.nav.go('medicine-search.html?q=' + encodeURIComponent(text));
    } else {
      var type = voice.facilityTypeFromText(text);
      RHP.nav.go('centres.html' + (type ? '?type=' + type : ''));
    }
  }
  document.getElementById('go-btn').addEventListener('click', go);
  textField.input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  // After a spoken phrase the words appear in the box; the person confirms with the Search button (speech is not always exact).
  ui.replace(document.getElementById('mic-slot'), RHP.components.micButton({ input: textField.input, onFinal: function () { document.getElementById('go-btn').focus(); } }));

  var note = document.getElementById('tts-note');
  document.getElementById('stop-speaking').addEventListener('click', voice.stopSpeaking);
  document.getElementById('speak-emergency').addEventListener('click', function () {
    voice.canSpeak().then(function (ok) {
      if (!ok) { ui.replace(note, ui.alert('warn', t('voice.noVoice'))); return; }
      ui.clear(note);
      RHP.api.get('/symptoms/emergency', { lang: window.I18n.getLanguage() }).then(function (r) {
        var e = r.emergency;
        voice.speak([e.title, e.intro].concat(e.signs, e.actions).join('. '));
      }, function (err) { ui.showError(note, err); });
    });
  });
  if (!voice.ttsSupported()) ui.replace(note, ui.alert('warn', t('voice.noVoice')));
});
