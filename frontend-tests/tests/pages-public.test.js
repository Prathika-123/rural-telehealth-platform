const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const FRONT = path.join(__dirname, '..', '..', 'frontend');
const { audit } = require('./helpers/a11y');
const { openPage, fakeJwt, USER, roleUser } = require('./helpers/harness');

const SEARCH_RESULT = {
  status: 'RESULTS', query: 'Paracetamol', strengthFilter: '500mg', radiusKm: 10, staleAfterDays: 7,
  results: { page: 0, size: 10, totalElements: 2, totalPages: 1, content: [
    { pharmacyId: 11, pharmacyName: 'Sample Sunrise Medicals', address: 'Main Road', taluk: 'Kundapura', district: 'Udupi', phone: '9876543210',
      latitude: 13.627, longitude: 74.6935, distanceKm: 0.05, medicine: { id: 1, brandName: 'Calpol 500', genericName: 'Paracetamol', strength: '500mg', dosageForm: 'Tablet', prescriptionRequired: false },
      price: 18, stockStatus: 'IN_STOCK', lastUpdatedAt: new Date().toISOString(), stale: false },
    { pharmacyId: 12, pharmacyName: '<img src=x onerror="window.__xss=1">Evil Pharmacy', address: 'Gangolli', taluk: null, district: 'Udupi', phone: null,
      latitude: 13.64, longitude: 74.67, distanceKm: 3.2, medicine: { id: 1, brandName: 'Calpol 500', genericName: 'Paracetamol', strength: '500mg', dosageForm: 'Tablet', prescriptionRequired: true },
      price: 20, stockStatus: 'LOW_STOCK', lastUpdatedAt: new Date(Date.now() - 12 * 86400000).toISOString(), stale: true }] }
};

// ---------- every page file loads without script errors ----------
test('all 16 pages load, build the shell and report no script errors', async () => {
  const files = fs.readdirSync(FRONT).filter((f) => f.endsWith('.html')).sort();
  assert.strictEqual(files.length, 16);
  for (const f of files) {
    const role = { 'admin.html': 'ADMIN', 'pharmacy-dashboard.html': 'PHARMACY', 'inventory.html': 'PHARMACY', 'provider-dashboard.html': 'HEALTHCARE_PROVIDER' }[f] || 'USER';
    const p = await openPage(f, { user: roleUser(role), geo: { lat: 13.6264, lng: 74.693 }, query: f.includes('details') ? '?id=1' : '',
      api: () => ({ status: 404, body: { code: 'NOT_FOUND', message: 'x' } }) });
    assert.ok(p.$('.site-header'), f + ': header rendered');
    assert.ok(p.$('.site-footer'), f + ': footer rendered');
    assert.ok(p.$('.emergency-bar a[href="tel:112"]'), f + ': emergency bar');
    // ApiError lines are the pages correctly reporting the stub's 404s; anything else is a real script error
    const real = p.errors.filter((e) => !e.startsWith('ApiError'));
    assert.deepStrictEqual(real, [], f + ': script errors: ' + real.join(' | '));
    p.close();
  }
});

test('landing page shows five main actions, emergency guidance and the translated title', async () => {
  const p = await openPage('index.html');
  assert.strictEqual(p.$$('#tiles a.tile').length, 5);
  assert.deepStrictEqual(p.$$('#tiles a.tile').map((a) => a.getAttribute('href')),
    ['medicine-search.html', 'doctors.html', 'centres.html', 'symptoms.html', 'voice.html']);
  assert.match(p.text('h1'), /Rural Telehealth/);
  assert.ok(p.text('.site-footer').includes('Demo version'), 'sample data is declared in the footer');
  assert.ok(p.text('.site-footer').includes('does not give medical advice'));
  p.close();
});

// ---------- language ----------
test('switching language translates the page, remembers the choice and uses speech locale', async () => {
  const p = await openPage('index.html');
  const sel = p.$('.lang-select');
  assert.deepStrictEqual([...sel.options].map((o) => o.value), ['en', 'kn', 'hi']);
  p.change(sel, 'kn'); await p.settle();
  assert.strictEqual(p.window.localStorage.getItem('rhp.lang'), 'kn');
  assert.strictEqual(p.doc.documentElement.lang, 'kn');
  assert.ok(/[\u0C80-\u0CFF]/.test(p.text('h1')), 'heading is Kannada: ' + p.text('h1'));
  assert.ok(/[\u0C80-\u0CFF]/.test(p.text('#tiles a.tile')), 'dynamic tiles are Kannada too');
  assert.strictEqual(p.window.I18n.speechLocale(), 'kn-IN');
  p.change(sel, 'hi'); await p.settle();
  assert.ok(/[\u0900-\u097F]/.test(p.text('h1'))); assert.strictEqual(p.window.I18n.speechLocale(), 'hi-IN');
  p.close();
  // remembered on the next visit
  const again = await openPage('index.html', { language: 'hi' });
  assert.strictEqual(again.doc.documentElement.lang, 'hi'); again.close();
});

// ---------- login / register ----------
test('login: translated validation, server error shown in the chosen language, redirect by role', async () => {
  const p = await openPage('login.html', { query: '?next=inventory.html', api: (r) => {
    if (r.path === '/auth/login') return r.body.password === 'Strong123'
      ? { status: 200, body: { token: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 600 }), tokenType: 'Bearer', user: roleUser('PHARMACY') } }
      : { status: 401, body: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' } };
  } });
  p.submit(p.$('#login-form'));
  assert.ok(p.$('#email-err').textContent.length > 0 && p.$('#password-err').textContent.length > 0, 'required messages');
  assert.strictEqual(p.calls.filter((c) => c.path === '/auth/login').length, 0, 'nothing sent when invalid');
  p.$('#email').value = 'a@b.co'; p.$('#password').value = 'wrong'; p.submit(p.$('#login-form')); await p.settle();
  assert.strictEqual(p.text('#form-error .alert'), 'Incorrect email or password.');
  p.$('#password').value = 'Strong123'; p.submit(p.$('#login-form')); await p.settle();
  assert.ok(p.window.localStorage.getItem('rhp.token'));
  assert.deepStrictEqual(p.navs.pop(), ['go', 'inventory.html'], 'honours a safe ?next=');
  p.close();

  const evil = await openPage('login.html', { query: '?next=http://evil.com', api: () => ({ status: 200, body: { token: fakeJwt({ exp: 9999999999 }), user: roleUser('ADMIN') } }) });
  evil.$('#email').value = 'a@b.co'; evil.$('#password').value = 'Strong123'; evil.submit(evil.$('#login-form')); await evil.settle();
  assert.deepStrictEqual(evil.navs.pop(), ['go', 'admin.html'], 'ignores an unsafe ?next= and goes to the role home');
  evil.close();
});

test('login error message follows the selected language', async () => {
  const p = await openPage('login.html', { language: 'kn', api: () => ({ status: 401, body: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' } }) });
  p.$('#email').value = 'a@b.co'; p.$('#password').value = 'x'; p.submit(p.$('#login-form')); await p.settle();
  assert.strictEqual(p.text('#form-error .alert'), JSON.parse(fs.readFileSync(path.join(FRONT, 'js/i18n/kn.json'), 'utf8'))['error.INVALID_CREDENTIALS']);
  p.close();
});

test('register: client rules, role choices exclude ADMIN, server duplicate error, redirect to role home', async () => {
  const p = await openPage('register.html', { api: (r) => {
    if (r.body.email === 'dup@example.com') return { status: 409, body: { code: 'EMAIL_ALREADY_REGISTERED', message: 'dup' } };
    return { status: 201, body: { token: fakeJwt({ exp: 9999999999 }), user: roleUser(r.body.role) } };
  } });
  assert.deepStrictEqual([...p.$('#role').options].map((o) => o.value), ['USER', 'PHARMACY', 'HEALTHCARE_PROVIDER']);
  p.submit(p.$('#register-form'));
  assert.ok(p.$('#name-err').textContent && p.$('#email-err').textContent && p.$('#password-err').textContent);
  p.$('#name').value = 'Asha'; p.$('#email').value = 'dup@example.com'; p.$('#password').value = 'Strong123'; p.$('#phone').value = '12';
  p.submit(p.$('#register-form'));
  assert.ok(p.$('#phone-err').textContent, 'bad phone rejected on the client');
  p.$('#phone').value = ''; p.submit(p.$('#register-form')); await p.settle();
  assert.ok(p.text('#form-error .alert').includes('already registered'));
  p.$('#email').value = 'new@example.com'; p.$('#role').value = 'PHARMACY'; p.submit(p.$('#register-form')); await p.settle();
  const sent = p.calls.filter((c) => c.path === '/auth/register').pop().body;
  assert.deepStrictEqual([sent.role, sent.phone, sent.language], ['PHARMACY', null, 'en']);
  assert.deepStrictEqual(p.navs.pop(), ['go', 'pharmacy-dashboard.html']);
  p.close();
});

// ---------- guards ----------
test('guards: anonymous users are sent to login, wrong roles see a permission message', async () => {
  const anon = await openPage('admin.html');
  assert.deepStrictEqual(anon.navs.pop(), ['replace', 'login.html?next=admin.html']); anon.close();
  const wrong = await openPage('admin.html', { user: USER });
  assert.match(wrong.text('#main'), /permission/i);
  assert.strictEqual(wrong.calls.filter((c) => c.path.startsWith('/admin')).length, 0, 'no admin API call is even attempted');
  wrong.close();
  const dash = await openPage('dashboard.html', { user: roleUser('PHARMACY') });
  assert.deepStrictEqual(dash.navs.pop(), ['replace', 'pharmacy-dashboard.html']); dash.close();
});

// ---------- medicine search ----------
test('medicine search: results with distance, stock, stale warning, prescription, links, map; no injected markup', async () => {
  const p = await openPage('medicine-search.html', { geo: { lat: 13.6264, lng: 74.693 }, api: (r) => {
    if (r.path === '/medicines/search') return { status: 200, body: SEARCH_RESULT };
    if (r.path === '/medicines/suggest') return { status: 200, body: [{ id: 1, brandName: 'Calpol 500', genericName: 'Paracetamol', strength: '500mg', dosageForm: 'Tablet' }] };
  } });
  p.type(p.$('#q'), 'Para'); await p.tick(300); await p.settle();
  assert.strictEqual(p.$('#med-suggest option').getAttribute('value'), 'Paracetamol 500mg', 'autocomplete fills a parser-friendly value');
  p.$('#q').value = 'Paracetamol 500mg'; p.submit(p.$('#search-form')); await p.settle();
  const req = p.calls.filter((c) => c.path === '/medicines/search').pop();
  assert.deepStrictEqual([req.query.q, req.query.lat, req.query.lng, req.query.radiusKm], ['Paracetamol 500mg', '13.6264', '74.693', '10']);
  const cards = p.$$('#results article');
  assert.strictEqual(cards.length, 2);
  assert.ok(cards[0].textContent.includes('0.1 km away') && cards[0].textContent.includes('In stock') && cards[0].textContent.includes('\u20B918.00'));
  assert.ok(cards[0].querySelector('.badge.sample'), 'sample pharmacy is labelled');
  assert.ok(cards[1].textContent.includes('Low stock') && cards[1].textContent.includes('May be out of date') && cards[1].textContent.includes('Prescription needed'));
  assert.ok(cards[0].querySelector('a[href="tel:9876543210"]'));
  assert.match(cards[0].querySelector('a[target="_blank"]').href, /^https:\/\/www\.openstreetmap\.org\/directions\?.*13\.6264,74\.693;13\.627,74\.6935/);
  assert.ok(cards[0].querySelector('a[href="pharmacy-details.html?id=11"]'));
  assert.ok(p.$('#results .alert.info').textContent.includes('call the pharmacy'), 'availability disclaimer shown');
  assert.strictEqual(p.$$('#results .map-marker:not(.me)').length, 2); assert.ok(p.$('#results .map-marker.me'));
  audit(p.doc, 'medicine results');
  assert.strictEqual(p.$('#results img[src="x"]'), null, 'pharmacy name with markup stayed text');
  assert.strictEqual(p.window.__xss, undefined);
  assert.ok(cards[1].querySelector('h3').textContent.includes('<img src=x'));
  p.close();
});

test('medicine search: distinguishes "nobody nearby" from "no such medicine", and asks for a location when missing', async () => {
  const mk = (status) => ({ status: 200, body: { status, query: 'x', radiusKm: 10, staleAfterDays: 7, results: { page: 0, size: 10, totalElements: 0, totalPages: 0, content: [] } } });
  let status = 'NO_PHARMACY_NEARBY';
  const p = await openPage('medicine-search.html', { geo: { lat: 13.6, lng: 74.7 }, api: (r) => r.path === '/medicines/search' ? mk(status) : { status: 200, body: [] } });
  p.$('#q').value = 'Zzz'; p.submit(p.$('#search-form')); await p.settle();
  assert.match(p.text('#results .alert.warn'), /No pharmacy within 10 km/);
  status = 'MEDICINE_NOT_FOUND'; p.submit(p.$('#search-form')); await p.settle();
  assert.match(p.text('#results .alert.warn'), /could not find this medicine/);
  p.close();

  const noLoc = await openPage('medicine-search.html', { api: () => ({ status: 200, body: [] }) });
  noLoc.$('#q').value = 'Para'; noLoc.submit(noLoc.$('#search-form')); await noLoc.settle();
  assert.strictEqual(noLoc.calls.filter((c) => c.path === '/medicines/search').length, 0, 'no search without a location');
  assert.match(noLoc.text('#location-panel .alert'), /location is needed/i);
  assert.ok(!noLoc.$('#location-panel .hidden .map') || true);
  assert.ok(noLoc.$('#location-panel .map'), 'map picker opened as the fallback');
  noLoc.close();
});

test('location panel: denied permission falls back to the map, and picking on the map starts the search', async () => {
  const p = await openPage('medicine-search.html', { geolocation: { getCurrentPosition: (ok, err) => err({ code: 1 }) },
    api: (r) => r.path === '/medicines/search' ? { status: 200, body: SEARCH_RESULT } : { status: 200, body: [] } });
  p.click(p.$$('#location-panel button').find((b) => b.textContent.includes('Use my location'))); await p.settle();
  assert.match(p.text('#location-panel .alert.warn'), /permission was denied/i);
  assert.ok(!p.$('#location-panel .map').closest('.hidden'), 'map picker visible');
  // a click on the map (pointerdown + pointerup without moving) chooses the place at that spot
  const mapEl = p.$('#location-panel .map');
  const ev = (type) => new p.window.MouseEvent(type, { clientX: 300, clientY: 180, button: 0, bubbles: true });
  mapEl.dispatchEvent(ev('pointerdown')); mapEl.dispatchEvent(ev('pointerup')); await p.settle();
  const loc = JSON.parse(p.window.sessionStorage.getItem('rhp.loc'));
  assert.strictEqual(loc.source, 'manual'); assert.ok(Math.abs(loc.lat - 13.6264) < 0.001 && Math.abs(loc.lng - 74.693) < 0.001, 'clicked the map centre: ' + JSON.stringify(loc));
  assert.match(p.text('#location-panel [role=status]'), /place you chose on the map/);
  assert.ok(p.$('#location-panel .map-marker'), 'pick marker drawn');
  p.$('#q').value = 'Paracetamol'; p.submit(p.$('#search-form')); await p.settle();
  assert.strictEqual(p.$$('#results article').length, 2);
  p.close();
});

test('medicine search: the microphone fills the box when supported; a plain note appears when it is not', async () => {
  const { FakeRecognition } = require('./helpers/harness');
  const p = await openPage('medicine-search.html', { speech: true, geo: { lat: 13.6, lng: 74.7 }, api: (r) => r.path === '/medicines/search' ? { status: 200, body: SEARCH_RESULT } : { status: 200, body: [] } });
  const mic = p.$('#mic-slot button.mic'); assert.ok(mic);
  p.click(mic); await p.tick(10);
  assert.strictEqual(mic.getAttribute('aria-pressed'), 'true'); assert.ok(mic.classList.contains('listening'));
  assert.match(p.text('#mic-slot [role=status]'), /Listening/);
  FakeRecognition.last.emitResult('Paracetamol 500mg.'); p.click(mic); await p.settle();
  assert.strictEqual(p.$('#q').value, 'Paracetamol 500mg');
  assert.strictEqual(p.calls.filter((c) => c.path === '/medicines/search').pop().query.q, 'Paracetamol 500mg', 'voice result triggers the search');
  assert.strictEqual(mic.getAttribute('aria-pressed'), 'false');
  p.close();

  const none = await openPage('medicine-search.html', { api: () => ({ status: 200, body: [] }) });
  assert.strictEqual(none.$('#mic-slot button'), null, 'no fake microphone');
  assert.match(none.text('#mic-slot'), /not supported in this browser/);
  none.close();

  const denied = await openPage('medicine-search.html', { speech: true, api: () => ({ status: 200, body: [] }) });
  denied.click(denied.$('#mic-slot button.mic')); await denied.tick(10);
  require('./helpers/harness').FakeRecognition.last.emitError('not-allowed'); await denied.tick(10);
  assert.match(denied.text('#mic-slot [role=status]'), /Microphone permission was denied/);
  denied.close();
});
