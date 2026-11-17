/*
 * A small slippy map in plain JavaScript (no Leaflet). It draws OpenStreetMap tiles as <img> elements and supports
 * drag to pan, +/- buttons, mouse wheel and keyboard zoom, markers with popups, and click-to-pick a location.
 * The coordinate maths (RHP.MapMath) is pure and unit tested. Pinch-to-zoom is not implemented; use the + / - buttons.
 */
(function () {
  'use strict';
  var RHP = (window.RHP = window.RHP || {});
  var TILE = 256, MIN_Z = 3, MAX_Z = 18;

  // ---------- pure maths (Web Mercator) ----------
  function worldSize(z) { return TILE * Math.pow(2, z); }
  function project(lat, lng, z) {
    var s = worldSize(z);
    var sin = Math.min(Math.max(Math.sin(lat * Math.PI / 180), -0.9999), 0.9999);
    return { x: (lng + 180) / 360 * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s };
  }
  function unproject(x, y, z) {
    var s = worldSize(z), n = Math.PI - 2 * Math.PI * y / s;
    return { lat: 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lng: x / s * 360 - 180 };
  }
  function wrapX(x, z) { var n = Math.pow(2, z); return ((x % n) + n) % n; }
  /** Which tiles cover a width x height viewport centred on `center` (world pixels) at zoom z. */
  function tileRange(center, w, h, z) {
    var left = center.x - w / 2, top = center.y - h / 2, maxTile = Math.pow(2, z) - 1;
    return { x0: Math.floor(left / TILE), x1: Math.floor((left + w) / TILE),
             y0: Math.max(0, Math.floor(top / TILE)), y1: Math.min(maxTile, Math.floor((top + h) / TILE)),
             originX: left, originY: top };
  }
  /** Highest zoom at which all points fit inside w x h with `pad` pixels of margin. */
  function fitZoom(points, w, h, pad) {
    for (var z = MAX_Z; z >= MIN_Z; z--) {
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (var i = 0; i < points.length; i++) {
        var p = project(points[i].lat, points[i].lng, z);
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
      if (maxX - minX <= w - 2 * pad && maxY - minY <= h - 2 * pad) return z;
    }
    return MIN_Z;
  }
  RHP.MapMath = { TILE: TILE, MIN_Z: MIN_Z, MAX_Z: MAX_Z, project: project, unproject: unproject, tileRange: tileRange, fitZoom: fitZoom, wrapX: wrapX };

  // ---------- the map ----------
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

  /**
   * new RuralMap(container, {lat, lng, zoom, onClick(lat,lng), labels:{zoomIn, zoomOut, attribution}})
   * container gets class "map". Methods: setView, setMarkers, setUser, setPick, fitToMarkers, zoomBy, destroy.
   */
  function RuralMap(container, opts) {
    opts = opts || {};
    var cfg = window.RHP_CONFIG || {};
    var self = this;
    this.container = container;
    this.onClick = opts.onClick || null;
    this.tileUrl = cfg.tileUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    this.zoom = opts.zoom || 13;
    var c = cfg.defaultCenter || { lat: 13.6264, lng: 74.693 };
    this.center = project(opts.lat !== undefined ? opts.lat : c.lat, opts.lng !== undefined ? opts.lng : c.lng, this.zoom);
    this.markers = [];
    this.user = null;
    this.pick = null;
    this.tiles = {};
    this.popup = null;
    this.raf = 0;

    container.classList.add('map');
    container.setAttribute('tabindex', '0');
    container.setAttribute('role', 'application');
    if (opts.label) container.setAttribute('aria-label', opts.label);
    this.layer = el('div', 'map-layer');
    this.markerLayer = el('div', 'map-layer');
    var controls = el('div', 'map-controls');
    var zin = el('button', null, '+'); zin.type = 'button'; zin.setAttribute('aria-label', (opts.labels && opts.labels.zoomIn) || 'Zoom in');
    var zout = el('button', null, '\u2212'); zout.type = 'button'; zout.setAttribute('aria-label', (opts.labels && opts.labels.zoomOut) || 'Zoom out');
    zin.addEventListener('click', function () { self.zoomBy(1); });
    zout.addEventListener('click', function () { self.zoomBy(-1); });
    ['pointerdown', 'mousedown', 'touchstart'].forEach(function (ev) {
      controls.addEventListener(ev, function (e) { e.stopPropagation(); });
    });
    controls.appendChild(zin); controls.appendChild(zout);
    var attrib = el('div', 'map-attrib');
    var a = el('a', null, '\u00A9 OpenStreetMap contributors');
    a.href = 'https://www.openstreetmap.org/copyright'; a.target = '_blank'; a.rel = 'noopener';
    attrib.appendChild(a);
    container.appendChild(this.layer); container.appendChild(this.markerLayer);
    container.appendChild(controls); container.appendChild(attrib);

    // ----- drag / click -----
    var drag = null;
    this._down = function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, cx: self.center.x, cy: self.center.y, moved: false };
      if (container.setPointerCapture && e.pointerId !== undefined) { try { container.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } }
    };
    this._move = function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 5) { drag.moved = true; container.classList.add('dragging'); }
      if (drag.moved) { self.center = { x: drag.cx - dx, y: self._clampY(drag.cy - dy) }; self._schedule(); }
    };
    this._up = function (e) {
      if (!drag) return;
      var wasClick = !drag.moved;
      drag = null;
      container.classList.remove('dragging');
      if (wasClick) {
        self._closePopup();
        if (self.onClick) {
          var r = container.getBoundingClientRect();
          var p = tileRange(self.center, container.clientWidth || 600, container.clientHeight || 360, self.zoom);   // same size fallback as render()
          var ll = unproject(p.originX + (e.clientX - r.left), p.originY + (e.clientY - r.top), self.zoom);
          self.onClick(ll.lat, ll.lng);
        }
      }
    };
    this._wheel = function (e) { e.preventDefault(); if (!self._wheelLock) { self._wheelLock = true; self.zoomBy(e.deltaY < 0 ? 1 : -1); setTimeout(function () { self._wheelLock = false; }, 250); } };
    this._key = function (e) {
      var step = 80;
      if (e.key === '+' || e.key === '=') self.zoomBy(1);
      else if (e.key === '-') self.zoomBy(-1);
      else if (e.key === 'ArrowLeft') self.center.x -= step;
      else if (e.key === 'ArrowRight') self.center.x += step;
      else if (e.key === 'ArrowUp') self.center.y = self._clampY(self.center.y - step);
      else if (e.key === 'ArrowDown') self.center.y = self._clampY(self.center.y + step);
      else return;
      e.preventDefault(); self._schedule();
    };
    container.addEventListener('pointerdown', this._down);
    container.addEventListener('pointermove', this._move);
    container.addEventListener('pointerup', this._up);
    container.addEventListener('pointercancel', function () { drag = null; container.classList.remove('dragging'); });
    container.addEventListener('wheel', this._wheel, { passive: false });
    container.addEventListener('keydown', this._key);
    this._resize = function () { self._schedule(); };
    window.addEventListener('resize', this._resize);
    this.render();
  }

  RuralMap.prototype._clampY = function (y) { var s = worldSize(this.zoom); return Math.min(Math.max(y, 0), s); };
  RuralMap.prototype._schedule = function () {
    var self = this;
    if (this.raf) return;
    var run = function () { self.raf = 0; self.render(); };
    this.raf = (window.requestAnimationFrame || function (f) { return setTimeout(f, 16); })(run);
  };
  RuralMap.prototype.getCenter = function () { return unproject(this.center.x, this.center.y, this.zoom); };
  RuralMap.prototype.getZoom = function () { return this.zoom; };

  RuralMap.prototype.setView = function (lat, lng, zoom) {
    if (zoom) this.zoom = Math.min(MAX_Z, Math.max(MIN_Z, zoom));
    this.center = project(lat, lng, this.zoom);
    this.render();
  };
  RuralMap.prototype.zoomBy = function (d) {
    var z = Math.min(MAX_Z, Math.max(MIN_Z, this.zoom + d));
    if (z === this.zoom) return;
    var ll = this.getCenter();
    this.zoom = z;
    this.center = project(ll.lat, ll.lng, z);
    this._closePopup();
    this.render();
  };

  /** markers: [{lat, lng, icon, label, popup (string or Node), onClick}] */
  RuralMap.prototype.setMarkers = function (list) { this.markers = list || []; this.render(); };
  RuralMap.prototype.setUser = function (lat, lng) { this.user = lat === null || lat === undefined ? null : { lat: lat, lng: lng }; this.render(); };
  RuralMap.prototype.setPick = function (lat, lng) { this.pick = lat === null || lat === undefined ? null : { lat: lat, lng: lng }; this.render(); };

  RuralMap.prototype.fitToMarkers = function () {
    var pts = this.markers.slice();
    if (this.user) pts.push(this.user);
    if (!pts.length) return;
    var w = this.container.clientWidth || 600, h = this.container.clientHeight || 360;
    var z = pts.length === 1 ? 15 : Math.min(15, fitZoom(pts, w, h, 50));
    var minLat = Math.min.apply(null, pts.map(function (p) { return p.lat; })), maxLat = Math.max.apply(null, pts.map(function (p) { return p.lat; }));
    var minLng = Math.min.apply(null, pts.map(function (p) { return p.lng; })), maxLng = Math.max.apply(null, pts.map(function (p) { return p.lng; }));
    this.setView((minLat + maxLat) / 2, (minLng + maxLng) / 2, z);
  };

  RuralMap.prototype._closePopup = function () { if (this.popup && this.popup.parentNode) this.popup.parentNode.removeChild(this.popup); this.popup = null; };
  RuralMap.prototype._openPopup = function (m, x, y) {
    this._closePopup();
    if (!m.popup) return;
    var p = el('div', 'map-popup');
    if (m.popup.nodeType) p.appendChild(m.popup); else p.textContent = m.popup;
    p.style.left = x + 'px'; p.style.top = y + 'px';
    ['pointerdown', 'mousedown'].forEach(function (ev) { p.addEventListener(ev, function (e) { e.stopPropagation(); }); });
    this.markerLayer.appendChild(p);
    this.popup = p;
  };

  RuralMap.prototype.render = function () {
    var w = this.container.clientWidth || 600, h = this.container.clientHeight || 360, z = this.zoom;
    var r = tileRange(this.center, w, h, z), needed = {}, self = this;
    for (var tx = r.x0; tx <= r.x1; tx++) {
      for (var ty = r.y0; ty <= r.y1; ty++) {
        var key = z + '/' + tx + '/' + ty, img = this.tiles[key];
        if (!img) {
          img = document.createElement('img');
          img.alt = ''; img.draggable = false;
          img.addEventListener('error', function () { this.style.visibility = 'hidden'; });
          img.src = this.tileUrl.replace('{z}', z).replace('{x}', wrapX(tx, z)).replace('{y}', ty);
          this.tiles[key] = img;
          this.layer.appendChild(img);
        }
        img.style.left = Math.round(tx * TILE - r.originX) + 'px';
        img.style.top = Math.round(ty * TILE - r.originY) + 'px';
        needed[key] = true;
      }
    }
    Object.keys(this.tiles).forEach(function (k) {
      if (!needed[k]) { var im = self.tiles[k]; if (im.parentNode) im.parentNode.removeChild(im); delete self.tiles[k]; }
    });

    // markers are rebuilt each render (there are few); the open popup is re-anchored if its marker is still there
    var old = Array.prototype.slice.call(this.markerLayer.querySelectorAll('.map-marker'));
    old.forEach(function (n) { n.parentNode.removeChild(n); });
    var all = this.markers.map(function (m) { return { m: m, cls: '' }; });
    if (this.user) all.push({ m: { lat: this.user.lat, lng: this.user.lng, icon: '\uD83D\uDD35', label: 'You' }, cls: ' me' });
    if (this.pick) all.push({ m: { lat: this.pick.lat, lng: this.pick.lng, icon: '\uD83D\uDCCC', label: 'Chosen place' }, cls: '' });
    all.forEach(function (item) {
      var m = item.m, p = project(m.lat, m.lng, z);
      var x = Math.round(p.x - r.originX), y = Math.round(p.y - r.originY);
      if (x < -40 || y < -40 || x > w + 40 || y > h + 40) return;
      var b = el('button', 'map-marker' + item.cls, m.icon || '\uD83D\uDCCD');
      b.type = 'button'; b.style.left = x + 'px'; b.style.top = y + 'px';
      if (m.label) { b.title = m.label; b.setAttribute('aria-label', m.label); }
      ['pointerdown', 'mousedown', 'touchstart'].forEach(function (ev) { b.addEventListener(ev, function (e) { e.stopPropagation(); }); });
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        self._openPopup(m, x, y);
        if (m.onClick) m.onClick(m);
      });
      self.markerLayer.appendChild(b);
    });
  };

  RuralMap.prototype.destroy = function () {
    window.removeEventListener('resize', this._resize);
    this.container.removeEventListener('pointerdown', this._down);
    this.container.removeEventListener('pointermove', this._move);
    this.container.removeEventListener('pointerup', this._up);
    this.container.removeEventListener('wheel', this._wheel);
    this.container.removeEventListener('keydown', this._key);
    while (this.container.firstChild) this.container.removeChild(this.container.firstChild);
  };

  RHP.RuralMap = RuralMap;
})();
