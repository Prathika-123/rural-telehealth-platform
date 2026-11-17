/*
 * The user's location. Coordinates are kept only in sessionStorage (cleared when the tab closes),
 * are sent to the server per request only, and are never saved to the user's profile.
 */
(function () {
  'use strict';
  var RHP = (window.RHP = window.RHP || {});
  var KEY = 'rhp.loc';
  var memory = null;

  function session() { try { return window.sessionStorage; } catch (e) { return null; } }

  var geo = (RHP.geo = {
    get: function () {
      if (memory) return memory;
      var s = session();
      try { var v = s && JSON.parse(s.getItem(KEY)); if (v && isFinite(v.lat) && isFinite(v.lng)) { memory = v; return v; } } catch (e) { /* ignore */ }
      return null;
    },
    set: function (lat, lng, source) {
      memory = { lat: Number(lat), lng: Number(lng), source: source || 'manual' };
      var s = session();
      if (s) { try { s.setItem(KEY, JSON.stringify(memory)); } catch (e) { /* ignore */ } }
      return memory;
    },
    clear: function () { memory = null; var s = session(); if (s) s.removeItem(KEY); },

    /** Asks the browser for the position. Rejects with {code: 'denied' | 'unavailable' | 'timeout' | 'unsupported'}. */
    detect: function () {
      return new Promise(function (resolve, reject) {
        if (!navigator.geolocation) { reject({ code: 'unsupported' }); return; }
        navigator.geolocation.getCurrentPosition(
          function (pos) { resolve(geo.set(pos.coords.latitude, pos.coords.longitude, 'gps')); },
          function (err) { reject({ code: err && err.code === 1 ? 'denied' : err && err.code === 3 ? 'timeout' : 'unavailable' }); },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
      });
    },
    errorKey: function (code) { return code === 'denied' ? 'location.denied' : 'location.unavailable'; },

    /** If the user already granted permission earlier, fetch the position without prompting again. */
    autoIfGranted: function () {
      if (geo.get()) return Promise.resolve(geo.get());
      if (!navigator.permissions || !navigator.permissions.query) return Promise.resolve(null);
      return navigator.permissions.query({ name: 'geolocation' }).then(function (p) {
        return p.state === 'granted' ? geo.detect().catch(function () { return null; }) : null;
      }, function () { return null; });
    },

    directionsUrl: function (dest, from) {
      var start = from ? from.lat + ',' + from.lng : '';
      return 'https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=' + start + ';' + dest.lat + ',' + dest.lng;
    },
    mapUrl: function (lat, lng) {
      return 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lng + '#map=16/' + lat + '/' + lng;
    }
  });
})();
