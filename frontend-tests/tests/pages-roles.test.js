const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const FRONT = path.join(__dirname, '..', '..', 'frontend');
const { audit } = require('./helpers/a11y');
const { openPage, fakeSynth, FakeRecognition, USER, roleUser } = require('./helpers/harness');

const GEO = { lat: 13.6264, lng: 74.693 };
const CENTRE = { id: 5, name: 'Sample Taluk Hospital Kundapura', type: 'HOSPITAL', address: 'Hospital Road', taluk: 'Kundapura', district: 'Udupi', phone: '9000000001', latitude: 13.624, longitude: 74.69 };
const NEXT = { date: '2026-11-18', dayOfWeek: 'WEDNESDAY', startTime: '10:00:00', endTime: '12:00:00', centreId: 5, centreName: CENTRE.name };
const page = (content, extra) => Object.assign({ page: 0, size: 10, totalElements: content.length, totalPages: content.length ? 1 : 0, content }, extra);
const DOCTORS = [
  { id: 1, name: 'Dr. Sample Rao', specialization: 'General Medicine', qualification: 'MBBS', experienceYears: 12, centre: CENTRE, distanceKm: 0.4,
    schedule: [{ centreId: 5, centreName: CENTRE.name, dayOfWeek: 'MONDAY', startTime: '09:00:00', endTime: '13:00:00' }, { centreId: 5, centreName: CENTRE.name, dayOfWeek: 'WEDNESDAY', startTime: '10:00:00', endTime: '12:00:00' }],
    availability: { available: true, source: 'SCHEDULE', until: '2026-11-16T07:30:00Z' }, lastUpdatedAt: new Date().toISOString() },
  { id: 2, name: 'Dr. Sample Naik', specialization: 'General Medicine', centre: CENTRE, distanceKm: 31.2, schedule: [],
    availability: { available: false, source: 'MANUAL_OVERRIDE', until: '2026-11-18T05:00:00Z', nextSlot: NEXT } },
  { id: 3, name: 'Dr. Sample Pai', specialization: 'ENT', centre: CENTRE, schedule: [], availability: { available: false, source: 'NO_SCHEDULE' } }
];

// ---------------- doctors ----------------
test('doctor search: availability from the API is shown honestly, filters and location are sent', async () => {
  const p = await openPage('doctors.html', { geo: GEO, api: (r) => r.path === '/doctors/search' ? { status: 200, body: page(DOCTORS) } : { status: 200, body: [] } });
  const first = p.calls.filter((c) => c.path === '/doctors/search')[0];
  assert.deepStrictEqual([first.query.page, first.query.lat], ['0', '13.6264'], 'location used because a location exists');
  const cards = p.$$('#results article');
  assert.strictEqual(cards.length, 3);
  assert.ok(cards[0].querySelector('.badge.ok') && /Available now/.test(cards[0].textContent) && /Until 1:00/i.test(cards[0].textContent), 'until time shown in IST');
  assert.ok(/0\.4 km away/.test(cards[0].textContent) && /From the weekly timetable/.test(cards[0].textContent));
  assert.ok(/Not available now/.test(cards[1].textContent) && /Next: Wednesday, 10:00/.test(cards[1].textContent) && /Set by the clinic/.test(cards[1].textContent));
  assert.ok(/has not given timings/.test(cards[2].textContent) && cards[2].querySelector('.badge.warn'), 'no schedule is a warning, never "available"');
  assert.ok(cards[0].querySelector('.badge.sample'));
  assert.ok(p.$('#results .alert.info'), 'timings disclaimer shown');
  audit(p.doc, 'doctor results');
  p.$('#available-now').checked = true; p.$('#name').value = 'rao'; p.submit(p.$('#search-form')); await p.settle();
  const q = p.calls.filter((c) => c.path === '/doctors/search').pop().query;
  assert.deepStrictEqual([q.availableNow, q.name, q.radiusKm], ['true', 'rao', '10']);
  p.$('#use-location').checked = false; p.change(p.$('#use-location'), ''); p.$('#use-location').checked = false;
  p.submit(p.$('#search-form')); await p.settle();
  assert.strictEqual(p.calls.filter((c) => c.path === '/doctors/search').pop().query.lat, undefined, 'location not sent when unticked');
  p.close();
});

test('doctor search: ?centreId filters, can be cleared, and an empty result is explained', async () => {
  let empty = false;
  const p = await openPage('doctors.html', { query: '?centreId=5', api: (r) => r.path === '/doctors/search' ? { status: 200, body: page(empty ? [] : DOCTORS) } : { status: 200, body: [] } });
  assert.strictEqual(p.calls.filter((c) => c.path === '/doctors/search')[0].query.centreId, '5');
  assert.ok(/one centre/i.test(p.text('#centre-filter')));
  empty = true; p.click(p.$('#centre-filter button')); await p.settle();
  assert.strictEqual(p.calls.filter((c) => c.path === '/doctors/search').pop().query.centreId, undefined);
  assert.match(p.text('#results .alert.warn'), /No doctors found/);
  p.close();
});

test('doctor details: weekly timetable by day with centre, availability, directions', async () => {
  const p = await openPage('doctor-details.html', { query: '?id=1', geo: GEO, api: (r) => r.path === '/doctors/1' ? { status: 200, body: DOCTORS[0] } : undefined });
  assert.strictEqual(p.calls[p.calls.length - 1].query.lat, '13.6264');
  assert.match(p.text('#details h2'), /Dr\. Sample Rao/); assert.strictEqual(p.$$('h1').length, 1);
  const rows = p.$$('#details table tr').map((r) => r.textContent);
  assert.strictEqual(rows.length, 2); assert.ok(/Monday/.test(rows[0]) && /9:00/.test(rows[0]) && /1:00/.test(rows[0]) && /Taluk Hospital/.test(rows[0])); assert.ok(/Wednesday/.test(rows[1]));
  assert.ok(/Available now/.test(p.text('#details')) && /Timetable updated/.test(p.text('#details')));
  assert.match(p.$('#details a[target="_blank"]').href, /openstreetmap\.org\/directions/);
  assert.ok(/9000000001/.test(p.$('#details a[href^="tel:"]').textContent));
  assert.ok(p.$('#details .map-marker'));
  p.close();
  const missing = await openPage('doctor-details.html', { query: '?id=99', api: () => ({ status: 404, body: { code: 'DOCTOR_NOT_FOUND', message: 'Doctor not found.' } }) });
  assert.match(missing.text('#details .alert.error'), /Doctor not found/); missing.close();
});

// ---------------- centres ----------------
test('centre locator: cards, type filter, emergency badge, coordinates, links, map; needs a location', async () => {
  const content = [Object.assign({ distanceKm: 0.3, emergencyAvailable: true, services: ['Emergency', 'Laboratory'] }, CENTRE),
    { id: 6, name: 'Gangolli CHC', type: 'CHC', address: 'Gangolli', district: 'Udupi', phone: null, latitude: 13.638, longitude: 74.67, distanceKm: 3.1, emergencyAvailable: false, services: [] }];
  const p = await openPage('centres.html', { geo: GEO, query: '?type=CLINIC', api: (r) => r.path === '/centres/nearby' ? { status: 200, body: page(content) } : { status: 200, body: [] } });
  assert.strictEqual(p.calls.filter((c) => c.path === '/centres/nearby')[0].query.type, 'CLINIC', 'type from the URL (voice page) is applied');
  const pressed = p.$$('#type-chips .chip[aria-pressed="true"]').map((c) => c.textContent); assert.deepStrictEqual(pressed, ['Clinic']);
  const cards = p.$$('#results article');
  assert.ok(/Emergency care available/.test(cards[0].textContent) && /Laboratory/.test(cards[0].textContent) && /13\.62400/.test(cards[0].textContent) && /0\.3 km away/.test(cards[0].textContent));
  assert.ok(cards[0].querySelector('a[href="doctors.html?centreId=5"]') && !cards[1].querySelector('a[href^="tel:"]'));
  audit(p.doc, 'centre results');
  assert.strictEqual(p.$$('#results .map-marker:not(.me)').length, 2);
  p.click(p.$$('#type-chips .chip').find((c) => c.textContent === 'Hospital')); await p.settle();
  assert.strictEqual(p.calls.filter((c) => c.path === '/centres/nearby').pop().query.type, 'HOSPITAL');
  p.close();
  const noLoc = await openPage('centres.html', { api: () => ({ status: 200, body: page([]) }) });
  assert.match(noLoc.text('#results .alert.info'), /Set your location/); assert.strictEqual(noLoc.calls.filter((c) => c.path === '/centres/nearby').length, 0);
  noLoc.close();
});

// ---------------- symptoms (real content files) ----------------
const RES = path.join(__dirname, '..', '..', 'backend', 'src', 'main', 'resources', 'symptoms');
const content = (l) => JSON.parse(fs.readFileSync(path.join(RES, `symptoms-${l}.json`), 'utf8'));
const symptomApi = (r) => {
  const c = content(['en', 'kn', 'hi'].includes(r.query.lang) ? r.query.lang : 'en');
  const head = { language: c.language, reviewStatus: c.reviewStatus, disclaimer: c.disclaimer };
  if (r.path === '/symptoms/emergency') return { status: 200, body: Object.assign({}, head, { emergency: c.emergency }) };
  if (r.path === '/symptoms') return { status: 200, body: Object.assign({}, head, { symptoms: c.symptoms.map((s) => ({ id: s.id, name: s.name, emergency: s.emergency })) }) };
  const s = c.symptoms.find((x) => '/symptoms/' + x.id === r.path);
  return s ? { status: 200, body: Object.assign({}, head, { symptom: s, emergencyGuidance: c.emergency }) } : { status: 404, body: { code: 'SYMPTOM_NOT_FOUND', message: 'x' } };
};

test('health information: emergency numbers, unreviewed warning, detail sections, language refetch', async () => {
  const p = await openPage('symptoms.html', { api: symptomApi });
  assert.deepStrictEqual(p.$$('#emergency a[href^="tel:"]').map((a) => a.getAttribute('href')), ['tel:112', 'tel:108']);
  assert.ok(p.$('#emergency .emergency-box h2').textContent.includes('Emergency'));
  assert.ok(/not an?.*diagnosis|not a diagnosis/i.test(p.text('#notice')) && /not yet been reviewed by a medical professional/.test(p.text('#notice')), 'disclaimer + review warning');
  assert.strictEqual(p.$$('#symptom-list .chip').length, 8);
  p.click(p.$$('#symptom-list .chip').find((c) => c.textContent === 'Fever')); await p.settle();
  const detail = p.$('#detail article');
  assert.deepStrictEqual([...detail.querySelectorAll('h3')].map((h) => h.textContent), ['What you can do at home', 'See a doctor if', 'Get emergency help if']);
  assert.ok(detail.querySelector('.emergency-box') && detail.querySelector('a[href="centres.html"]'));
  audit(p.doc, 'symptom detail');
  assert.ok(!/paracetamol|ibuprofen|tablet|dose/i.test(detail.textContent), 'no medicine advice on the page');
  p.change(p.$('.lang-select'), 'kn'); await p.settle();
  const langs = p.calls.filter((c) => c.path.startsWith('/symptoms')).map((c) => c.query.lang);
  assert.ok(langs.includes('kn'), 'content is refetched in Kannada: ' + langs);
  assert.ok(/[\u0C80-\u0CFF]/.test(p.text('#detail h2')) && /[\u0C80-\u0CFF]/.test(p.text('#emergency h2')), 'detail and emergency box are Kannada');
  p.close();
  const sel = await openPage('symptoms.html', { query: '?id=chest-pain', api: symptomApi });
  assert.ok(sel.$('#detail .badge.danger'), 'urgent symptoms are flagged'); sel.close();
});

test('read aloud only speaks when the device has a voice for the language', async () => {
  const spoken = [];
  const p = await openPage('symptoms.html', { api: symptomApi, setup: (w) => fakeSynth(w, ['en-US'], spoken) });
  const read = p.$$('#emergency button').find((b) => /Read aloud/.test(b.textContent));
  p.click(read); await p.settle();
  assert.ok(spoken.length === 1 && spoken[0].startsWith('Emergency: act immediately'), 'English read aloud works');
  p.change(p.$('.lang-select'), 'kn'); await p.settle();
  p.click(p.$$('#emergency button').find((b) => /\uD83D\uDD0A/.test(b.textContent))); await p.settle();
  assert.strictEqual(spoken.length, 1, 'nothing spoken in Kannada without a Kannada voice');
  const knNoVoice = JSON.parse(fs.readFileSync(path.join(FRONT, 'js/i18n/kn.json'), 'utf8'))['voice.noVoice'];
  assert.strictEqual(p.text('.toasts'), knNoVoice, 'the explanation is shown in the user\'s language');
  p.close();
  const none = await openPage('symptoms.html', { api: symptomApi });   // no speech synthesis at all
  assert.ok(!none.$$('#emergency button').some((b) => /Read aloud|\uD83D\uDD0A/.test(b.textContent)), 'no fake read-aloud button'); none.close();
});

// ---------------- voice page ----------------
test('voice page: spoken text is confirmed with Search; facility words choose the type; fallbacks are honest', async () => {
  const p = await openPage('voice.html', { speech: true, api: symptomApi });
  p.$('#voice-text').value = ''; p.click(p.$('#go-btn')); assert.ok(p.$('#voice-text-err').textContent, 'empty text is refused');
  p.click(p.$('#mic-slot button.mic')); await p.tick(10); FakeRecognition.last.emitResult('Paracetamol 500mg.'); p.click(p.$('#mic-slot button.mic')); await p.tick(10);
  assert.strictEqual(p.$('#voice-text').value, 'Paracetamol 500mg'); assert.strictEqual(p.navs.length, 0, 'does not navigate on its own');
  p.click(p.$('#go-btn')); assert.deepStrictEqual(p.navs.pop(), ['go', 'medicine-search.html?q=Paracetamol%20500mg']);
  p.click(p.$$('#mode-chips .chip').find((c) => c.textContent === 'Health centre'));
  assert.match(p.text('#example'), /hospital/);
  p.$('#voice-text').value = 'nearest hospital'; p.click(p.$('#go-btn')); assert.deepStrictEqual(p.navs.pop(), ['go', 'centres.html?type=HOSPITAL']);
  p.$('#voice-text').value = 'somewhere'; p.click(p.$('#go-btn')); assert.deepStrictEqual(p.navs.pop(), ['go', 'centres.html']);
  p.close();
  const none = await openPage('voice.html', { api: symptomApi });
  assert.strictEqual(none.$('#mic-slot button'), null); assert.match(none.text('#mic-slot'), /not supported/);
  assert.match(none.text('#tts-note'), /no voice/i);
  none.click(none.$$('#mode-chips .chip').find((c) => c.textContent === 'Health centre'));
  none.$('#voice-text').value = 'clinic'; none.click(none.$('#go-btn')); assert.deepStrictEqual(none.navs.pop(), ['go', 'centres.html?type=CLINIC'], 'typing still works');
  none.close();
});

// ---------------- profile ----------------
test('profile: saves name, phone and language; language change applies immediately', async () => {
  const p = await openPage('profile.html', { user: USER, api: (r) => {
    if (r.path === '/users/me' && r.method === 'GET') return { status: 200, body: USER };
    if (r.path === '/users/me' && r.method === 'PUT') return { status: 200, body: Object.assign({}, USER, r.body) };
  } });
  assert.strictEqual(p.$('#name').value, 'Asha');
  p.$('#phone').value = 'abc'; p.submit(p.$('#profile-form')); assert.ok(p.$('#phone-err').textContent);
  p.$('#phone').value = '9876543210'; p.$('#language').value = 'hi'; p.submit(p.$('#profile-form')); await p.settle();
  assert.deepStrictEqual(p.calls.filter((c) => c.method === 'PUT').pop().body, { name: 'Asha', phone: '9876543210', language: 'hi' });
  assert.strictEqual(JSON.parse(p.window.localStorage.getItem('rhp.user')).language, 'hi');
  assert.ok(/[\u0900-\u097F]/.test(p.text('h1')), 'page is now Hindi');
  p.close();
});

// ---------------- pharmacy owner ----------------
const INV = (o) => Object.assign({ id: 1, medicine: { id: 1, brandName: 'Calpol 500', genericName: 'Paracetamol', strength: '500mg', dosageForm: 'Tablet', prescriptionRequired: false },
  quantity: 20, price: 18, available: true, stockStatus: 'IN_STOCK', lastUpdatedAt: new Date().toISOString(), stale: false }, o);
const PHARMACY = { id: 11, name: 'Sample Sunrise Medicals', licenseNumber: 'L1', address: 'Main Road', taluk: 'Kundapura', district: 'Udupi', latitude: 13.627, longitude: 74.6935, verificationStatus: 'PENDING' };

test('pharmacy dashboard: unregistered owners see the form, registration is validated and sent', async () => {
  let registered = false;
  const p = await openPage('pharmacy-dashboard.html', { user: roleUser('PHARMACY'), api: (r) => {
    if (r.path === '/pharmacies/me' && r.method === 'GET') return registered ? { status: 200, body: PHARMACY } : { status: 404, body: { code: 'PHARMACY_NOT_REGISTERED', message: 'x' } };
    if (r.path === '/pharmacies/register') { registered = true; return { status: 201, body: PHARMACY }; }
    if (r.path === '/pharmacies/me/inventory') return { status: 200, body: page([]) };
  } });
  assert.match(p.text('#content h2'), /Register your pharmacy/);
  audit(p.doc, 'pharmacy registration form');
  p.submit(p.$('#content form'));
  assert.ok(['p-name', 'p-license', 'p-address', 'p-lat', 'p-lng'].every((id) => p.$('#' + id + '-err').textContent), 'required fields flagged');
  p.$('#p-name').value = 'Sample Sunrise Medicals'; p.$('#p-license').value = 'L1'; p.$('#p-address').value = 'Main Road'; p.$('#p-lat').value = '99'; p.$('#p-lng').value = '74.6';
  p.submit(p.$('#content form')); assert.ok(p.$('#p-lat-err').textContent, 'latitude out of range');
  p.$('#p-lat').value = '13.627'; p.submit(p.$('#content form')); await p.settle();
  const body = p.calls.find((c) => c.path === '/pharmacies/register').body;
  assert.deepStrictEqual([body.latitude, body.longitude, body.phone, body.taluk], [13.627, 74.6, null, null], 'numbers, and empty optionals as null');
  assert.match(p.text('#content'), /Waiting for administrator approval/); assert.ok(p.$('#content .badge.warn'));
  p.close();
});

test('pharmacy dashboard: stock summary counts low, out and stale items', async () => {
  const p = await openPage('pharmacy-dashboard.html', { user: roleUser('PHARMACY'), api: (r) => {
    if (r.path === '/pharmacies/me') return { status: 200, body: Object.assign({}, PHARMACY, { verificationStatus: 'VERIFIED' }) };
    if (r.path === '/pharmacies/me/inventory') return { status: 200, body: page([INV({ id: 1 }), INV({ id: 2, quantity: 3, stockStatus: 'LOW_STOCK' }), INV({ id: 3, quantity: 0, stockStatus: 'OUT_OF_STOCK', stale: true })]) };
  } });
  const nums = p.$$('#content .stat .num').map((e) => e.textContent);
  assert.deepStrictEqual(nums, ['3', '1', '1', '1']);
  assert.match(p.text('#content'), /Approved and visible/); assert.ok(p.$('#content a[href="inventory.html"]'));
  p.close();
});

test('inventory: list, still-correct, edit validation, unavailable, delete confirmation, add via catalogue search', async () => {
  const rows = [INV({ id: 1 }), INV({ id: 2, stale: true, quantity: 4, stockStatus: 'LOW_STOCK', medicine: { id: 2, brandName: 'Dolo 650', genericName: 'Paracetamol', strength: '650mg', dosageForm: 'Tablet' } })];
  const p = await openPage('inventory.html', { user: roleUser('PHARMACY'), api: (r) => {
    if (r.path === '/pharmacies/me/inventory' && r.method === 'GET') return { status: 200, body: page(rows) };
    if (r.path === '/medicines/suggest') return { status: 200, body: r.query.q === 'zzz' ? [] : [{ id: 9, brandName: 'Cetzine', genericName: 'Cetirizine', strength: '10mg', dosageForm: 'Tablet' }] };
    return { status: 200, body: INV({}) };
  } });
  assert.strictEqual(p.$$('#content tbody tr').length, 2); assert.ok(/May be out of date/.test(p.$$('#content tbody tr')[1].textContent));
  audit(p.doc, 'inventory table');
  const btn = (row, re) => p.$$('button', p.$$('#content tbody tr')[row]).find((b) => re.test(b.textContent));
  p.click(btn(0, /Still correct/)); await p.settle();
  assert.deepStrictEqual(p.calls.find((c) => c.method === 'PUT').body, { quantity: 20, price: 18, available: true }, 'confirms with the same numbers, which refreshes the timestamp');
  p.click(btn(0, /Edit/));
  audit(p.doc, 'inventory edit dialog');
  p.$('#e-qty').value = '-3'; p.submit(p.$('dialog form')); assert.ok(p.$('#e-qty-err').textContent, 'negative stock refused on the client');
  assert.strictEqual(p.calls.filter((c) => c.method === 'PUT').length, 1);
  p.$('#e-qty').value = '7'; p.$('#e-price').value = '19.5'; p.$('#e-avail').checked = false; p.submit(p.$('dialog form')); await p.settle();
  assert.deepStrictEqual(p.calls.filter((c) => c.method === 'PUT').pop().body, { quantity: 7, price: 19.5, available: false });
  assert.strictEqual(p.$('dialog'), null, 'dialog closed after saving');
  p.click(btn(0, /Mark unavailable/)); await p.settle();
  assert.ok(p.calls.some((c) => c.method === 'PATCH' && c.path === '/pharmacies/me/inventory/1/unavailable'));
  p.click(btn(1, /Delete/)); await p.tick(); assert.ok(p.$('dialog'), 'asks before deleting');
  assert.ok(!p.calls.some((c) => c.method === 'DELETE'));
  p.click(p.$$('dialog button').find((b) => /Cancel/.test(b.textContent))); await p.tick(); assert.ok(!p.calls.some((c) => c.method === 'DELETE'), 'cancel deletes nothing');
  p.click(btn(1, /Delete/)); await p.tick(); p.click(p.$$('dialog button').find((b) => /Delete/.test(b.textContent))); await p.settle();
  assert.ok(p.calls.some((c) => c.method === 'DELETE' && c.path === '/pharmacies/me/inventory/2'));
  // add
  p.click(p.$('#add-btn'));
  p.submit(p.$('dialog form')); assert.ok(/choose a medicine/i.test(p.text('dialog')), 'must pick from the catalogue first');
  p.type(p.$('#a-search'), 'zzz'); await p.tick(300); await p.settle(); assert.match(p.text('dialog'), /Not in the catalogue/);
  p.type(p.$('#a-search'), 'Cet'); await p.tick(300); await p.settle();
  p.click(p.$$('dialog .chip')[0]); assert.match(p.text('dialog'), /Chosen: Cetzine/);
  p.$('#a-qty').value = '25'; p.$('#a-price').value = ''; p.submit(p.$('dialog form')); await p.settle();
  assert.deepStrictEqual(p.calls.find((c) => c.method === 'POST').body, { medicineId: 9, quantity: 25, price: null, available: true });
  p.close();
});

// ---------------- healthcare provider ----------------
test('provider dashboard: add centre, manage doctor timetable and temporary availability', async () => {
  const MY = Object.assign({ verificationStatus: 'PENDING', services: [], emergencyAvailable: false }, CENTRE);
  const doc = Object.assign({}, DOCTORS[1], { centre: Object.assign({ verificationStatus: 'VERIFIED' }, CENTRE), schedule: [{ centreId: 5, centreName: CENTRE.name, dayOfWeek: 'MONDAY', startTime: '09:00:00', endTime: '13:00:00' }] });
  const p = await openPage('provider-dashboard.html', { user: roleUser('HEALTHCARE_PROVIDER'), api: (r) => {
    if (r.path === '/centres/mine') return { status: 200, body: [MY] };
    if (r.path === '/centres/services') return { status: 200, body: [{ id: 1, name: 'Emergency' }, { id: 2, name: 'Laboratory' }] };
    if (r.path === '/doctors/mine') return { status: 200, body: page([doc]) };
    return { status: 200, body: {} };
  } });
  assert.match(p.text('#content'), /Waiting for administrator approval/); assert.ok(p.$('#content .badge.warn'));
  p.click(p.$$('#content button').find((b) => /Add health centre/.test(b.textContent)));
  p.submit(p.$('dialog form')); assert.ok(p.$('#c-name-err').textContent);
  p.$('#c-name').value = 'New Clinic'; p.$('#c-address').value = 'Road'; p.$('#c-lat').value = '13.6'; p.$('#c-lng').value = '74.7';
  p.$$('dialog input[type=checkbox]').find((c) => c.value === '2').checked = true; p.$('#c-emergency').checked = true; p.submit(p.$('dialog form')); await p.settle();
  assert.deepStrictEqual(p.calls.find((c) => c.method === 'POST' && c.path === '/centres').body,
    { name: 'New Clinic', type: 'CLINIC', address: 'Road', taluk: null, district: null, phone: null, latitude: 13.6, longitude: 74.7, emergencyAvailable: true, serviceIds: [2] });

  p.click(p.$$('#tabs .tab')[1]); await p.settle();
  assert.match(p.text('#content article'), /Dr\. Sample Naik/);
  const dbtn = (re) => p.$$('#content article button').find((b) => re.test(b.textContent));
  p.click(dbtn(/Consultation timings/)); assert.strictEqual(p.$$('dialog .card').length, 1, 'existing slot listed');
  audit(p.doc, 'timetable dialog');
  p.click(p.$$('dialog button').find((b) => /Add time slot/.test(b.textContent)));
  const sel = p.$$('dialog .card'); assert.strictEqual(sel.length, 2);
  p.change(sel[1].querySelectorAll('select')[1], 'FRIDAY'); p.change(sel[1].querySelectorAll('input')[0], '14:00'); p.change(sel[1].querySelectorAll('input')[1], '17:00');
  p.click(p.$$('dialog button').find((b) => b.textContent === 'Save')); await p.settle();
  assert.deepStrictEqual(p.calls.find((c) => c.method === 'PUT' && c.path === '/doctors/2/schedules').body.slots,
    [{ centreId: 5, dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '13:00' }, { centreId: 5, dayOfWeek: 'FRIDAY', startTime: '14:00', endTime: '17:00' }]);

  p.click(dbtn(/Temporary availability/));
  p.change(p.$('#o-status'), 'UNAVAILABLE'); p.submit(p.$('dialog form')); await p.settle();
  const patch = p.calls.find((c) => c.method === 'PATCH' && c.path === '/doctors/2/availability').body;
  assert.strictEqual(patch.status, 'UNAVAILABLE'); assert.match(patch.expiresAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/, 'an ISO UTC expiry is always sent');
  assert.ok(new Date(patch.expiresAt) > new Date());
  p.close();
  const none = await openPage('provider-dashboard.html', { user: roleUser('HEALTHCARE_PROVIDER'), api: (r) => ({ status: 200, body: r.path === '/centres/mine' || r.path === '/centres/services' ? [] : page([]) }) });
  none.click(none.$$('#tabs .tab')[1]); await none.settle(); assert.match(none.text('#content'), /Add a health centre first/); none.close();
});

// ---------------- admin ----------------
test('admin: statistics, user enable/disable (not self), verification, medicine catalogue, translated tabs', async () => {
  const me = roleUser('ADMIN'); me.id = 1;
  const stats = { totalUsers: 9, usersByRole: { USER: 4, PHARMACY: 2, HEALTHCARE_PROVIDER: 2, ADMIN: 1 }, pharmaciesByStatus: { PENDING: 3, VERIFIED: 5, REJECTED: 0 }, centresByStatus: { PENDING: 1, VERIFIED: 4, REJECTED: 0 }, doctors: 6, medicines: 8, inventoryItems: 40, staleInventoryItems: 7, staleAfterDays: 7 };
  const p = await openPage('admin.html', { user: me, api: (r) => {
    if (r.path === '/admin/stats') return { status: 200, body: stats };
    if (r.path === '/admin/inventory-activity') return { status: 200, body: page([{ inventoryId: 1, pharmacyId: 1, pharmacyName: 'Sunrise', medicineName: 'Calpol (Paracetamol 500mg)', quantity: 5, available: true, lastUpdatedAt: new Date().toISOString(), stale: true }]) };
    if (r.path === '/admin/users') return { status: 200, body: page([{ id: 1, name: 'Admin', email: 'admin@x', role: 'ADMIN', enabled: true, createdAt: '2026-01-01T00:00:00Z' }, { id: 2, name: 'Bob', email: 'bob@x', role: 'USER', enabled: true, createdAt: '2026-01-02T00:00:00Z' }]) };
    if (r.path === '/admin/pharmacies') return { status: 200, body: page([Object.assign({ ownerName: 'Owner', ownerEmail: 'o@x' }, PHARMACY)]) };
    if (r.path === '/admin/medicines') return { status: 200, body: page([{ id: 1, brandName: 'Calpol 500', genericName: 'Paracetamol', strength: '500mg', dosageForm: 'Tablet', prescriptionRequired: false }]) };
    return { status: 200, body: {} };
  } });
  assert.deepStrictEqual(p.$$('#content .stat .num').slice(0, 2).map((e) => e.textContent), ['9', '4']);
  assert.ok(/Not updated for 7\+ days/.test(p.text('#content')) && p.$('#content table .badge.warn'), 'activity table with stale flag');
  audit(p.doc, 'admin overview');
  p.click(p.$$('#tabs .tab')[1]); await p.settle();
  const rows = p.$$('#content tbody tr'); assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].querySelectorAll('button').length, 0, 'an admin cannot disable their own account');
  audit(p.doc, 'admin users');
  p.click(rows[1].querySelector('button')); await p.settle();
  assert.deepStrictEqual(p.calls.find((c) => c.method === 'PATCH').body, { enabled: false });
  p.click(p.$$('#tabs .tab')[2]); await p.settle();
  assert.strictEqual(p.calls.filter((c) => c.path === '/admin/pharmacies').pop().query.status, 'PENDING', 'defaults to the approval queue');
  assert.ok(/Owner/.test(p.text('#content tbody')));
  p.click(p.$$('#content tbody button').find((b) => /Verify/.test(b.textContent))); await p.settle();
  assert.deepStrictEqual(p.calls.filter((c) => c.method === 'PATCH').pop().body, { status: 'VERIFIED' });
  p.click(p.$$('#tabs .tab')[4]); await p.settle();
  p.click(p.$$('#content button').find((b) => /Add medicine/.test(b.textContent)));
  p.submit(p.$('dialog form')); assert.ok(p.$('#m-brand-err').textContent);
  p.$('#m-brand').value = 'B'; p.$('#m-generic').value = 'G'; p.$('#m-strength').value = '5mg'; p.$('#m-form').value = 'Tablet'; p.$('#m-rx').checked = true; p.submit(p.$('dialog form')); await p.settle();
  assert.deepStrictEqual(p.calls.find((c) => c.method === 'POST').body, { brandName: 'B', genericName: 'G', strength: '5mg', dosageForm: 'Tablet', prescriptionRequired: true });
  p.change(p.$('.lang-select'), 'hi'); await p.settle();
  assert.ok(/[\u0900-\u097F]/.test(p.text('#tabs .tab')), 'tabs are translated');
  p.close();
});

test('pharmacy details: stock table with stale flag, directions and a map', async () => {
  const stock = page([{ medicine: INV({}).medicine, price: 18, stockStatus: 'IN_STOCK', lastUpdatedAt: new Date().toISOString(), stale: false },
    { medicine: INV({}).medicine, price: 20, stockStatus: 'LOW_STOCK', lastUpdatedAt: new Date(Date.now() - 9 * 86400000).toISOString(), stale: true }]);
  const p = await openPage('pharmacy-details.html', { query: '?id=11', api: (r) => r.path === '/pharmacies/11' ? { status: 200, body: PHARMACY } : r.path === '/pharmacies/11/medicines' ? { status: 200, body: stock } : undefined });
  assert.match(p.text('#details h2'), /Sample Sunrise Medicals/); assert.ok(p.$('#details h2 .badge.sample')); assert.strictEqual(p.$$('h1').length, 1);
  assert.strictEqual(p.$$('#details tbody tr').length, 2); assert.ok(/May be out of date/.test(p.$$('#details tbody tr')[1].textContent));
  assert.ok(p.$('#details .map-marker') && /Latitude 13\.62700/.test(p.text('#details')) && p.$('#details a[target="_blank"]'));
  p.close();
  const gone = await openPage('pharmacy-details.html', { query: '?id=404', api: () => ({ status: 404, body: { code: 'PHARMACY_NOT_FOUND', message: 'x' } }) });
  assert.match(gone.text('#details .alert.error'), /Pharmacy not found/); gone.close();
});
