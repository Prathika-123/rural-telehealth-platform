/* Reusable page parts: location panel (device location, or pick on a map), microphone button, medicine autocomplete. */
(function () {
  'use strict';
  var RHP = (window.RHP = window.RHP || {});
  var C = (RHP.components = {});
  var Icons = RHP.Icons;

  function t(k, p) { return window.I18n.t(k, p); }

  /** The five main actions, shared by the landing page and the dashboard. */
  C.mainTiles = function () {
    return [
      { iconFn: 'medicine', key: 'nav.findMedicine', desc: 'tile.medicine.desc', href: 'medicine-search.html' },
      { iconFn: 'doctor', key: 'nav.findDoctor', desc: 'tile.doctor.desc', href: 'doctors.html' },
      { iconFn: 'centre', key: 'nav.nearbyCentres', desc: 'tile.centres.desc', href: 'centres.html' },
      { iconFn: 'healthInfo', key: 'nav.healthInfo', desc: 'tile.info.desc', href: 'symptoms.html' },
      { iconFn: 'voiceSearch', key: 'nav.voiceSearch', desc: 'tile.voice.desc', href: 'voice.html' }
    ];
  };
  C.renderTiles = function (container) {
    var h = RHP.ui.h;
    RHP.ui.replace(container, C.mainTiles().map(function (x) {
      var iconEl = Icons && Icons[x.iconFn] ? Icons.wrap(Icons[x.iconFn]) : h('span', { class: 'icon', 'aria-hidden': 'true' }, '');
      return h('a', { class: 'card tile', href: x.href },
        iconEl,
        h('span', { class: 'title', 'data-i18n': x.key }, t(x.key)),
        h('span', { class: 'muted', 'data-i18n': x.desc }, t(x.desc)));
    }));
  };

  /**
   * Location panel. opts: {withRadius, radius, onChange(loc), onRadius(km)}.
   * Returns {getLocation(), getRadius(), setLocation(lat,lng,source), openMap()}.
   * A person who denies permission, or has no GPS, can always choose a place on the map instead.
   */
  C.locationPanel = function (container, opts) {
    opts = opts || {};
    var h = RHP.ui.h, geo = RHP.geo;
    var radius = opts.radius || 10;
    var loc = opts.initial || (opts.noStore ? null : geo.get());
    var map = null;
    function store(lat, lng, source) { return opts.noStore ? { lat: Number(lat), lng: Number(lng), source: source } : geo.set(lat, lng, source); }

    var status = h('p', { role: 'status' });
    var errorBox = h('div');
    var useBtn = h('button', { class: 'btn', type: 'button', onClick: detect });
    var mapBtn = h('button', { class: 'btn secondary', type: 'button', onClick: function () { toggleMap(); } });
    var radiusSel = null;
    var radiusLabel = h('label', { for: 'radius-select' });
    if (opts.withRadius) {
      radiusSel = h('select', { id: 'radius-select', class: 'w-auto min-w-[11rem]' });
      [5, 10, 25, 50].forEach(function (km) { radiusSel.appendChild(h('option', { value: km, selected: km === radius }, '')); });
      radiusSel.addEventListener('change', function () { radius = Number(radiusSel.value); if (opts.onRadius) opts.onRadius(radius); });
    }
    var mapDiv = h('div');
    var hint = h('p', { class: 'map-hint' });
    var mapBox = h('div', { class: 'hidden' }, mapDiv, hint);

    RHP.ui.replace(container, h('div', { class: 'card stack' }, status, errorBox,
      h('div', { class: 'row' }, useBtn, mapBtn, opts.withRadius ? h('div', { class: 'row' }, radiusLabel, radiusSel) : null), mapBox));

    function mapOpen() { return !mapBox.classList.contains('hidden'); }

    function texts() {
      var Icons = RHP.Icons;
      useBtn.innerHTML = '';
      useBtn.appendChild(Icons ? Icons.wrap(Icons.mapPin) : document.createTextNode('\uD83D\uDCCD'));
      useBtn.appendChild(document.createTextNode(' ' + t('location.useMine')));
      mapBtn.innerHTML = '';
      mapBtn.appendChild(Icons ? Icons.wrap(Icons.map) : document.createTextNode('\uD83D\uDDFA\uFE0F'));
      mapBtn.appendChild(document.createTextNode(' ' + (mapOpen() ? t('location.hideMap') : t('location.pickOnMap'))));
      hint.textContent = t('location.mapHint');
      status.textContent = !loc ? t('location.notSet') : loc.source === 'gps' ? t('location.statusGps') : t('location.statusManual');
      status.className = loc ? '' : 'muted';
      if (radiusSel) {
        radiusLabel.textContent = t('location.radiusLabel');
        Array.prototype.forEach.call(radiusSel.options, function (o) { o.textContent = t('location.radius', { radius: o.value }); });
      }
    }

    function setLocation(lat, lng, source) {
      loc = store(lat, lng, source);
      RHP.ui.clear(errorBox);
      if (map) { map.setPick(loc.lat, loc.lng); map.setView(loc.lat, loc.lng); }
      texts();
      if (opts.onChange) opts.onChange(loc);
    }

    function toggleMap(forceOpen) {
      var open = forceOpen === undefined ? !mapOpen() : forceOpen;
      mapBox.classList.toggle('hidden', !open);
      if (open && !map) {
        var c = loc || (window.RHP_CONFIG && window.RHP_CONFIG.defaultCenter) || { lat: 13.6264, lng: 74.693 };
        map = new RHP.RuralMap(mapDiv, { lat: c.lat, lng: c.lng, zoom: loc ? 14 : 11, label: t('location.pickOnMap'),
          onClick: function (lat, lng) { setLocation(lat, lng, 'manual'); } });
        if (loc) map.setPick(loc.lat, loc.lng);
      } else if (open && map) { map.render(); }
      texts();
    }

    function detect() {
      RHP.ui.setBusy(useBtn, true);
      RHP.ui.replace(status, t('location.detecting'));
      geo.detect().then(function (p) { setLocation(p.lat, p.lng, 'gps'); },
        function (err) {
          texts();
          RHP.ui.replace(errorBox, RHP.ui.alert('warn', t(geo.errorKey(err.code))));
          toggleMap(true);   // fallback: choose a place on the map
        }).then(function () { RHP.ui.setBusy(useBtn, false); });
    }

    texts();
    window.I18n.onChange(texts);
    if (!loc && !opts.noStore) { geo.autoIfGranted().then(function (p) { if (p && !loc) setLocation(p.lat, p.lng, 'gps'); }); }

    return {
      getLocation: function () { return loc; },
      getRadius: function () { return radius; },
      setLocation: setLocation,
      openMap: function () { toggleMap(true); },
      /** Shows a prompt (and opens the map) when a search needs a location but there is none. */
      needLocation: function () {
        RHP.ui.replace(errorBox, RHP.ui.alert('warn', t('error.LOCATION_REQUIRED')));
        toggleMap(true);
      }
    };
  };

  /** A microphone button that fills `opts.input` and calls opts.onFinal(text). Shows a plain note if unsupported. */
  C.micButton = function (opts) {
    var h = RHP.ui.h, voice = RHP.voice, Icons = RHP.Icons;
    if (!voice.recognitionSupported()) {
      return h('span', { class: 'muted map-hint', 'data-i18n': 'voice.unsupported' }, t('voice.unsupported'));
    }
    var status = h('span', { class: 'muted', role: 'status', 'aria-live': 'polite' });
    var listening = null;
    var micIcon = Icons ? Icons.wrap(Icons.mic) : '\uD83C\uDFA4';
    var btn = h('button', { class: 'btn mic', type: 'button', 'aria-pressed': 'false', 'data-i18n-aria-label': 'voice.tap',
      'data-i18n-title': 'voice.tap', 'aria-label': t('voice.tap'), title: t('voice.tap') }, micIcon);

    function reset() {
      btn.classList.remove('listening');
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML = '';
      btn.appendChild(Icons ? Icons.wrap(Icons.mic) : document.createTextNode('\uD83C\uDFA4'));
      listening = null;
    }

    btn.addEventListener('click', function () {
      if (listening) { listening.stop(); return; }
      status.textContent = '';
      listening = voice.listen({
        onStart: function () {
          btn.classList.add('listening');
          btn.setAttribute('aria-pressed', 'true');
          status.textContent = t('voice.listening');
          btn.innerHTML = '';
          btn.appendChild(Icons ? Icons.wrap(Icons.micListening) : document.createTextNode('\uD83C\uDFA4'));
        },
        onInterim: function (text) { if (opts.input) opts.input.value = text; status.textContent = t('voice.heard', { text: text }); },
        onResult: function (text) { if (opts.input) opts.input.value = text; status.textContent = t('voice.heard', { text: text }); if (opts.onFinal) opts.onFinal(text); },
        onError: function (code) { var k = voice.errorKey(code); status.textContent = k ? t(k) : ''; },
        onEnd: function () { if (status.textContent === t('voice.listening')) status.textContent = t('voice.noSpeech'); reset(); }
      });
      if (!listening) { status.textContent = t('voice.noMic'); reset(); }
    });
    return h('span', { class: 'row' }, btn, status);
  };

  /** Availability as the API computed it: badge, until/next slot, and where the information comes from. */
  C.availabilityBlock = function (av) {
    var ui = RHP.ui, h = ui.h;
    var kind = av.available ? 'ok' : av.source === 'NO_SCHEDULE' ? 'warn' : '';
    var line = [ui.badge(av.available ? t('doctor.availableNow') : t('doctor.notAvailable'), kind)];
    if (av.available && av.until) line.push(' ' + t('doctor.until', { time: ui.formatClock(av.until) }));
    if (!av.available && av.nextSlot) {
      line.push(' ' + t('doctor.nextSlot', { day: t('day.' + av.nextSlot.dayOfWeek), start: ui.formatTime(av.nextSlot.startTime) }));
    }
    return h('div', null, h('div', null, line),
      h('div', { class: 'muted text-xs' }, t('doctor.source.' + av.source)));
  };

  /** Fills a <datalist> with matching medicines as the user types ("Paracetamol 500mg" style values). */
  C.medicineAutocomplete = function (input, datalist) {
    var run = RHP.ui.debounce(function () {
      var q = input.value.trim();
      if (q.length < 2) return;
      RHP.api.get('/medicines/suggest', { q: q }).then(function (list) {
        RHP.ui.clear(datalist);
        list.forEach(function (m) {
          datalist.appendChild(RHP.ui.h('option', { value: m.genericName + ' ' + m.strength, label: m.brandName + ' (' + m.dosageForm + ')' }));
        });
      }, function () { /* suggestions are optional */ });
    }, 250);
    input.addEventListener('input', run);
  };
})();
