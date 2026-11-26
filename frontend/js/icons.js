/* Rural Telehealth Platform: Inline SVG Icon System */
/* Lightweight, no dependencies, ES5 compatible */

(function () {
  'use strict';
  var RHP = (window.RHP = window.RHP || {});
  var Icons = (RHP.Icons = {});

  var NS = 'http://www.w3.org/2000/svg';

  function svg(attrs, children) {
    var el = document.createElementNS(NS, 'svg');
    Object.keys(attrs || {}).forEach(function (k) {
      el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c && c.nodeType) el.appendChild(c);
      else if (c) el.appendChild(document.createTextNode(String(c)));
    });
    return el;
  }

  function path(d, attrs) {
    var el = document.createElementNS(NS, 'path');
    el.setAttribute('d', d);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  function circle(cx, cy, r, attrs) {
    var el = document.createElementNS(NS, 'circle');
    el.setAttribute('cx', cx); el.setAttribute('cy', cy); el.setAttribute('r', r);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  function rect(x, y, w, h, attrs) {
    var el = document.createElementNS(NS, 'rect');
    el.setAttribute('x', x); el.setAttribute('y', y); el.setAttribute('width', w); el.setAttribute('height', h);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  function line(x1, y1, x2, y2, attrs) {
    var el = document.createElementNS(NS, 'line');
    el.setAttribute('x1', x1); el.setAttribute('y1', y1); el.setAttribute('x2', x2); el.setAttribute('y2', y2);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  function polyline(points, attrs) {
    var el = document.createElementNS(NS, 'polyline');
    el.setAttribute('points', points);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  function polygon(points, attrs) {
    var el = document.createElementNS(NS, 'polygon');
    el.setAttribute('points', points);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  function createIcon(viewBox, children, extraAttrs) {
    var attrs = { viewBox: viewBox, width: '1em', height: '1em', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' };
    Object.keys(extraAttrs || {}).forEach(function (k) { attrs[k] = extraAttrs[k]; });
    return svg(attrs, children);
  }

  // 24x24 viewBox icons
  Icons.pill = function () { return createIcon('0 0 24 24', [
    rect(3, 5, 18, 14, { rx: 7 }),
    line(12, 5, 12, 19)
  ]); };

  Icons.stethoscope = function () { return createIcon('0 0 24 24', [
    path('M12 2a4 4 0 0 0-4 4v4'),
    path('M12 2a4 4 0 0 1 4 4v4'),
    path('M8 10v8a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-8'),
    circle(12, 18, 4)
  ]); };

  Icons.building = function () { return createIcon('0 0 24 24', [
    rect(3, 3, 18, 18, { rx: 2 }),
    path('M9 9h6v6H9z'),
    path('M9 17h6'),
    path('M12 3v3'),
    path('M12 18v3')
  ]); };

  Icons.bookOpen = function () { return createIcon('0 0 24 24', [
    path('M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z'),
    path('M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z')
  ]); };

  Icons.mic = function () { return createIcon('0 0 24 24', [
    path('M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z'),
    path('M19 10v2a7 7 0 0 1-14 0v-2'),
    line(12, 19, 12, 22)
  ]); };

  Icons.micListening = function () { return createIcon('0 0 24 24', [
    path('M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z', { fill: 'currentColor', stroke: 'none' }),
    path('M19 10v2a7 7 0 0 1-14 0v-2'),
    line(12, 19, 12, 22)
  ]); };

  Icons.mapPin = function () { return createIcon('0 0 24 24', [
    path('M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'),
    circle(12, 10, 3)
  ]); };

  Icons.mapPinUser = function () { return createIcon('0 0 24 24', [
    path('M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'),
    circle(12, 10, 3),
    circle(12, 16, 4)
  ]); };

  Icons.navigation = function () { return createIcon('0 0 24 24', [
    polygon('3 11 22 2 22 20'),
    circle(12, 12, 4)
  ]); };

  Icons.chevronDown = function () { return createIcon('0 0 24 24', [
    polyline('6 9 12 15 18 9')
  ]); };

  Icons.chevronUp = function () { return createIcon('0 0 24 24', [
    polyline('18 15 12 9 6 15')
  ]); };

  Icons.chevronLeft = function () { return createIcon('0 0 24 24', [
    polyline('15 18 9 12 15 6')
  ]); };

  Icons.chevronRight = function () { return createIcon('0 0 24 24', [
    polyline('9 18 15 12 9 6')
  ]); };

  Icons.plus = function () { return createIcon('0 0 24 24', [
    line(12, 5, 12, 19),
    line(5, 12, 19, 12)
  ]); };

  Icons.minus = function () { return createIcon('0 0 24 24', [
    line(5, 12, 19, 12)
  ]); };

  Icons.x = function () { return createIcon('0 0 24 24', [
    line(18, 6, 6, 18),
    line(6, 6, 18, 18)
  ]); };

  Icons.check = function () { return createIcon('0 0 24 24', [
    polyline('20 6 9 17 4 12')
  ]); };

  Icons.alertTriangle = function () { return createIcon('0 0 24 24', [
    path('M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'),
    line(12, 9, 12, 13),
    line(12, 17, 12.01, 17)
  ]); };

  Icons.info = function () { return createIcon('0 0 24 24', [
    circle(12, 12, 10),
    line(12, 16, 12, 12),
    line(12, 8, 12.01, 8)
  ]); };

  Icons.checkCircle = function () { return createIcon('0 0 24 24', [
    path('M22 11.08V12a10 10 0 1 1-5.93-9.14'),
    polyline('22 4 12 14.01 9 11.01')
  ]); };

  Icons.alertCircle = function () { return createIcon('0 0 24 24', [
    circle(12, 12, 10),
    line(12, 8, 12, 12),
    line(12, 16, 12.01, 16)
  ]); };

  Icons.phone = function () { return createIcon('0 0 24 24', [
    path('M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z')
  ]); };

  Icons.edit = function () { return createIcon('0 0 24 24', [
    path('M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'),
    path('M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z')
  ]); };

  Icons.trash = function () { return createIcon('0 0 24 24', [
    polyline('3 6 5 6 21 6'),
    path('M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2')
  ]); };

  Icons.search = function () { return createIcon('0 0 24 24', [
    circle(11, 11, 8),
    line(21, 21, 16.65, 16.65)
  ]); };

  Icons.filter = function () { return createIcon('0 0 24 24', [
    polygon('22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3')
  ]); };

  Icons.menu = function () { return createIcon('0 0 24 24', [
    line(3, 12, 21, 12),
    line(3, 6, 21, 6),
    line(3, 18, 21, 18)
  ]); };

  Icons.home = function () { return createIcon('0 0 24 24', [
    path('M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'),
    polyline('9 22 9 12 15 12 15 22')
  ]); };

  Icons.user = function () { return createIcon('0 0 24 24', [
    path('M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'),
    circle(12, 7, 4)
  ]); };

  Icons.logOut = function () { return createIcon('0 0 24 24', [
    path('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'),
    polyline('16 17 21 12 16 7'),
    line(21, 12, 9, 12)
  ]); };

  Icons.settings = function () { return createIcon('0 0 24 24', [
    circle(12, 12, 3),
    path('M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z')
  ]); };

  Icons.globe = function () { return createIcon('0 0 24 24', [
    circle(12, 12, 10),
    line(2, 12, 22, 12),
    path('M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z')
  ]); };

  Icons.volume2 = function () { return createIcon('0 0 24 24', [
    polygon('11 5 6 9 2 9 2 15 6 15 11 19 11 5'),
    path('M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07')
  ]); };

  Icons.volumeX = function () { return createIcon('0 0 24 24', [
    polygon('11 5 6 9 2 9 2 15 6 15 11 19 11 5'),
    line(23, 9, 17, 15),
    line(17, 9, 23, 15)
  ]); };

  Icons.clock = function () { return createIcon('0 0 24 24', [
    circle(12, 12, 10),
    polyline('12 6 12 12 16 14')
  ]); };

  Icons.calendar = function () { return createIcon('0 0 24 24', [
    rect(3, 4, 18, 18, { rx: 2, ry: 2 }),
    line(16, 2, 16, 6),
    line(8, 2, 8, 6),
    line(3, 10, 21, 10)
  ]); };

  Icons.map = function () { return createIcon('0 0 24 24', [
    polygon('3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21'),
    line(9, 3, 9, 18),
    line(15, 6, 15, 21)
  ]); };

  Icons.arrowUp = function () { return createIcon('0 0 24 24', [
    line(18, 15, 12, 9),
    line(6, 15, 12, 9)
  ]); };

  Icons.arrowDown = function () { return createIcon('0 0 24 24', [
    line(6, 9, 12, 15),
    line(18, 9, 12, 15)
  ]); };

  // Additional icons
  Icons.phone = function () { return createIcon('0 0 24 24', [
    path('M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z')
  ]); };

  Icons.compass = function () { return createIcon('0 0 24 24', [
    polygon('3 11 22 2 22 20'),
    circle(12, 12, 4)
  ]); };

  Icons.package = function () { return createIcon('0 0 24 24', [
    path('M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'),
    polyline('3.27 6.96 12 12.01 20.73 6.96'),
    line(12, 22.08, 12, 12)
  ]); };

  Icons.refreshCw = function () { return createIcon('0 0 24 24', [
    polyline('1 4 1 10 7 10'),
    path('M3.51 15a9 9 0 1 0 2.13-9.36L1 10')
  ]); };

  Icons.volume2 = function () { return createIcon('0 0 24 24', [
    polygon('11 5 6 9 2 9 2 15 6 15 11 19 11 5'),
    path('M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07')
  ]); };

  // Aliases for semantic naming
  Icons.medicine = Icons.pill;
  Icons.doctor = Icons.stethoscope;
  Icons.centre = Icons.building;
  Icons.healthInfo = Icons.bookOpen;
  Icons.voiceSearch = Icons.mic;
  Icons.emergency = Icons.alertTriangle;
  Icons.location = Icons.mapPin;
  Icons.directions = Icons.compass;
  Icons.warning = Icons.alertTriangle;
  Icons.phone = Icons.phone;
  Icons.inventory = Icons.package;
  Icons.schedule = Icons.refreshCw;
  Icons.readAloud = Icons.volume2;

  // Helper: create a span wrapper with the icon
  Icons.wrap = function (iconFn, className) {
    var span = document.createElement('span');
    span.className = className || 'icon';
    span.setAttribute('aria-hidden', 'true');
    span.appendChild(iconFn());
    return span;
  };

})();