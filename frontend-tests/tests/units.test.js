const test = require('node:test');
const assert = require('node:assert');
const { openPage, fakeJwt } = require('./helpers/harness');

async function libs(opts) { return openPage('index.html', Object.assign({ api: () => ({ status: 200, body: [] }) }, opts)); }

// ---------------- map maths ----------------
test('map projection round-trips and matches known tile numbers', async () => {
  const p = await libs();
  const M = p.window.RHP.MapMath;
  for (const [lat, lng, z] of [[13.6264, 74.693, 12], [0, 0, 3], [-33.9, 151.2, 17], [60, -120, 8]]) {
    const w = M.project(lat, lng, z), back = M.unproject(w.x, w.y, z);
    assert.ok(Math.abs(back.lat - lat) < 1e-6 && Math.abs(back.lng - lng) < 1e-6, `round trip ${lat},${lng}`);
  }
  // independent check with the standard "slippy map" tile formulas (different code from the implementation)
  const n = 2 ** 12, lat = 13.6264, lng = 74.693, rad = lat * Math.PI / 180;
  const wantX = Math.floor((lng + 180) / 360 * n), wantY = Math.floor((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2 * n);
  const w = M.project(lat, lng, 12);
  assert.strictEqual(Math.floor(w.x / 256), wantX); assert.strictEqual(Math.floor(w.y / 256), wantY);
  assert.strictEqual(wantX, 2897); assert.strictEqual(wantY, 1891);   // Kundapura area, zoom 12
  // the equator/prime meridian is the exact centre of the world
  const c = M.project(0, 0, 4); assert.ok(Math.abs(c.x - 2048) < 1e-6 && Math.abs(c.y - 2048) < 1e-6);
  p.close();
});

test('tileRange covers the viewport and fitZoom fits all points', async () => {
  const p = await libs();
  const M = p.window.RHP.MapMath;
  const center = M.project(13.6, 74.7, 12), r = M.tileRange(center, 600, 360, 12);
  assert.ok(r.x1 - r.x0 >= 2 && r.x1 - r.x0 <= 3 && r.y1 - r.y0 >= 1 && r.y1 - r.y0 <= 2);
  assert.ok(r.originX <= center.x && r.originY <= center.y);
  const pts = [{ lat: 13.6, lng: 74.6 }, { lat: 13.7, lng: 74.8 }];
  const z = M.fitZoom(pts, 600, 360, 50);
  const a = M.project(pts[0].lat, pts[0].lng, z), b = M.project(pts[1].lat, pts[1].lng, z);
  assert.ok(Math.abs(a.x - b.x) <= 500 && Math.abs(a.y - b.y) <= 260, 'points fit inside the padded viewport');
  const a2 = M.project(pts[0].lat, pts[0].lng, z + 1), b2 = M.project(pts[1].lat, pts[1].lng, z + 1);
  assert.ok(Math.abs(a2.x - b2.x) > 500 || Math.abs(a2.y - b2.y) > 260, 'z+1 would not fit, so z is the highest that fits');
  p.close();
});

test('RuralMap draws tiles with OSM attribution, markers, popups and zoom', async () => {
  const p = await libs();
  const { RHP } = p.window, div = p.doc.createElement('div');
  div.style.width = '600px'; p.doc.body.appendChild(div);
  const map = new RHP.RuralMap(div, { lat: 13.6264, lng: 74.693, zoom: 12 });
  assert.ok(div.querySelectorAll('.map-layer img').length >= 4, 'tiles rendered');
  assert.match(div.querySelector('img').src, /^https:\/\/tile\.openstreetmap\.org\/12\/\d+\/\d+\.png$/);
  assert.match(div.querySelector('.map-attrib a').textContent, /OpenStreetMap/);
  map.setMarkers([{ lat: 13.6264, lng: 74.693, icon: 'X', label: 'Here', popup: 'Hello <b>x</b>' }]);
  map.setUser(13.6264, 74.693);
  assert.strictEqual(div.querySelectorAll('.map-marker').length, 2);
  p.click(div.querySelector('.map-marker:not(.me)'));
  assert.strictEqual(div.querySelector('.map-popup').textContent, 'Hello <b>x</b>', 'popup text is not parsed as HTML');
  map.zoomBy(1); assert.strictEqual(map.getZoom(), 13);
  map.zoomBy(-20); assert.strictEqual(map.getZoom(), p.window.RHP.MapMath.MIN_Z);
  map.setView(13.0, 74.0, 10);
  const c = map.getCenter(); assert.ok(Math.abs(c.lat - 13.0) < 1e-6 && Math.abs(c.lng - 74.0) < 1e-6);
  map.destroy(); assert.strictEqual(div.children.length, 0);
  p.close();
});

// ---------------- voice helpers ----------------
test('facility type is understood from English, Kannada and Hindi speech', async () => {
  const p = await libs(); const v = p.window.RHP.voice;
  const cases = [['nearest hospital', 'HOSPITAL'], ['ಆಸ್ಪತ್ರೆ', 'HOSPITAL'], ['अस्पताल', 'HOSPITAL'], ['clinic please', 'CLINIC'], ['ಕ್ಲಿನಿಕ್', 'CLINIC'],
    ['क्लिनिक', 'CLINIC'], ['primary health centre', 'PHC'], ['PHC', 'PHC'], ['community health centre', 'CHC'], ['सामुदायिक स्वास्थ्य केंद्र', 'CHC'], ['something else', null], ['', null]];
  for (const [text, want] of cases) assert.strictEqual(v.facilityTypeFromText(text), want, text);
  p.close();
});

test('transcripts are cleaned and recognition errors map to messages', async () => {
  const p = await libs(); const v = p.window.RHP.voice;
  assert.strictEqual(v.cleanTranscript('  Paracetamol   500mg. '), 'Paracetamol 500mg');
  assert.strictEqual(v.cleanTranscript('ಜ್ವರ।'), 'ಜ್ವರ');
  assert.strictEqual(v.errorKey('not-allowed'), 'voice.micDenied');
  assert.strictEqual(v.errorKey('language-not-supported'), 'voice.langUnsupported');
  assert.strictEqual(v.errorKey('audio-capture'), 'voice.noMic');
  assert.strictEqual(v.errorKey('aborted'), '');
  assert.strictEqual(v.errorKey('no-speech'), 'voice.noSpeech');
  assert.strictEqual(v.recognitionSupported(), false, 'no pretending when the browser lacks support');
  p.close();
});

// ---------------- api + auth ----------------
test('api: query building, auth header, error codes and network failures', async () => {
  const seen = [];
  const p = await libs({ user: { id: 1, name: 'A', email: 'a@x', role: 'USER', language: 'en' },
    api: (req) => { seen.push(req); return req.path === '/boom' ? { status: 409, body: { code: 'EMAIL_ALREADY_REGISTERED', message: 'dup' } } : { status: 200, body: { ok: true } }; } });
  const { RHP } = p.window;
  assert.strictEqual(RHP.api.qs({ a: 1, b: '', c: null, d: 'x y', e: undefined }), '?a=1&d=x%20y');
  assert.strictEqual(RHP.api.qs({}), '');
  await RHP.api.get('/x', { q: 'Para 500', page: 0 });
  const last = seen[seen.length - 1];
  assert.strictEqual(last.query.q, 'Para 500'); assert.match(last.headers.Authorization, /^Bearer /);
  await RHP.api.post('/auth/login', { email: 'a' }, { auth: false });
  assert.strictEqual(seen[seen.length - 1].headers.Authorization, undefined, 'login never sends a token');
  await assert.rejects(() => RHP.api.get('/boom'), (e) => e.code === 'EMAIL_ALREADY_REGISTERED' && e.status === 409);
  p.window.fetch = () => Promise.reject(new Error('offline'));
  await assert.rejects(() => RHP.api.get('/x'), (e) => e.code === 'NETWORK_ERROR' && e.status === 0);
  p.close();
});

test('auth: open redirects are blocked, expired tokens are ignored, role helpers work', async () => {
  const p = await libs({ user: { id: 1, name: 'A', email: 'a@x', role: 'PHARMACY', language: 'en' } });
  const a = p.window.RHP.auth;
  for (const bad of ['http://evil.com', '//evil.com', 'javascript:alert(1)', '../x.html', '/etc/passwd', 'a.html\nSet-Cookie', null]) {
    assert.strictEqual(a.safeNext(bad, 'home.html'), 'home.html', String(bad));
  }
  assert.strictEqual(a.safeNext('inventory.html', 'x'), 'inventory.html');
  assert.strictEqual(a.safeNext('medicine-search.html?q=para%20500', 'x'), 'medicine-search.html?q=para%20500');
  assert.strictEqual(a.isLoggedIn(), true); assert.strictEqual(a.hasRole(['PHARMACY']), true); assert.strictEqual(a.hasRole(['ADMIN']), false);
  assert.strictEqual(a.homeFor('HEALTHCARE_PROVIDER'), 'provider-dashboard.html');
  assert.strictEqual(a.tokenExpired(fakeJwt({ exp: 1 })), true); assert.strictEqual(a.tokenExpired('garbage'), true);
  p.window.localStorage.setItem('rhp.token', fakeJwt({ exp: 1 }));
  assert.strictEqual(a.isLoggedIn(), false, 'an expired token means logged out');
  p.close();
});

// ---------------- ui helpers ----------------
test('ui: safe element building, sample badges, validation and formatting', async () => {
  const p = await libs(); const { ui } = p.window.RHP;
  const el = ui.h('p', { class: 'x' }, '<img src=x onerror=alert(1)>', ui.h('b', null, 'ok'));
  assert.strictEqual(el.querySelector('img'), null, 'markup in text stays text'); assert.strictEqual(el.className, 'x');
  assert.ok(ui.isSample('Sample Sunrise Medicals') && ui.isSample('Dr. Sample Rao') && !ui.isSample('Sunrise Medicals') && !ui.isSample('Samplers Ltd'));
  const r = ui.rules;
  assert.notStrictEqual(r.password('short1'), ''); assert.notStrictEqual(r.password('allletters'), ''); assert.strictEqual(r.password('Strong123'), '');
  assert.notStrictEqual(r.email('a@b'), ''); assert.strictEqual(r.email('a@b.co'), '');
  assert.strictEqual(r.phoneOptional(''), ''); assert.strictEqual(r.phoneOptional('9876543210'), ''); assert.notStrictEqual(r.phoneOptional('123'), '');
  assert.strictEqual(r.nonNegInt('0'), ''); assert.notStrictEqual(r.nonNegInt('-1'), ''); assert.notStrictEqual(r.nonNegInt('1.5'), '');
  assert.strictEqual(r.priceOptional(''), ''); assert.strictEqual(r.priceOptional('25.50'), ''); assert.notStrictEqual(r.priceOptional('25.555'), '');
  assert.strictEqual(r.lat('91'), r.lat('91')); assert.notStrictEqual(r.lat('91'), ''); assert.strictEqual(r.lat('13.6'), ''); assert.notStrictEqual(r.lng('181'), '');
  assert.strictEqual(ui.formatTime('09:00:00').replace(/\s/g, ' ').toLowerCase().includes('9:00'), true);
  assert.strictEqual(ui.formatPrice(25), '\u20B925.00'); assert.strictEqual(ui.formatPrice(null), '');
  assert.strictEqual(ui.formatDistance(2.345), '2.3 km away');
  assert.match(ui.relativeTime(new Date(Date.now() - 3 * 86400000).toISOString()), /3 days ago/);
  p.close();
});

test('geo: stores location only in the tab session, builds map links, reports errors', async () => {
  const p = await libs({ geolocation: { getCurrentPosition: (ok, err) => err({ code: 1 }) } });
  const g = p.window.RHP.geo;
  assert.strictEqual(g.get(), null);
  g.set(13.6, 74.7, 'manual');
  assert.deepStrictEqual(JSON.parse(p.window.sessionStorage.getItem('rhp.loc')), { lat: 13.6, lng: 74.7, source: 'manual' });
  assert.strictEqual(p.window.localStorage.getItem('rhp.loc'), null, 'never in long-lived storage');
  await assert.rejects(g.detect(), (e) => e.code === 'denied');
  assert.strictEqual(g.errorKey('denied'), 'location.denied'); assert.strictEqual(g.errorKey('timeout'), 'location.unavailable');
  assert.strictEqual(g.directionsUrl({ lat: 1, lng: 2 }, { lat: 3, lng: 4 }), 'https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=3,4;1,2');
  assert.match(g.mapUrl(13.6, 74.7), /mlat=13\.6&mlon=74\.7/);
  p.close();
});
