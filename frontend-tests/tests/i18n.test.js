// Run with:  node --test frontend/tests/i18n.test.js      (Node 18+)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const FRONT = path.join(__dirname, '..', '..', 'frontend');

const I18n = require(path.join(FRONT, 'js', 'i18n.js'));
const { normalizeLang, format, translate, chooseInitial, errorMessage } = I18n._internals;

const i18nDir = path.join(FRONT, 'js', 'i18n');
const load = (l) => JSON.parse(fs.readFileSync(path.join(i18nDir, l + '.json'), 'utf8'));
const files = { en: load('en'), kn: load('kn'), hi: load('hi') };
const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort().join(',');

test('all languages have exactly the same keys', () => {
  const en = Object.keys(files.en).sort();
  for (const l of ['kn', 'hi']) {
    assert.deepStrictEqual(Object.keys(files[l]).sort(), en, l + ' keys differ from en');
  }
});

test('no empty values and placeholders match English', () => {
  for (const l of ['en', 'kn', 'hi']) {
    for (const [k, v] of Object.entries(files[l])) {
      assert.ok(typeof v === 'string' && v.trim().length > 0, `${l}:${k} is empty`);
      assert.strictEqual(placeholders(v), placeholders(files.en[k]), `${l}:${k} placeholders differ`);
    }
  }
});

test('Kannada and Hindi values really use their own scripts', () => {
  const kn = /[\u0C80-\u0CFF]/, hi = /[\u0900-\u097F]/;
  let knHits = 0, hiHits = 0;
  for (const k of Object.keys(files.en)) { if (kn.test(files.kn[k])) knHits++; if (hi.test(files.hi[k])) hiHits++; }
  assert.ok(knHits > Object.keys(files.en).length * 0.95, 'Kannada file looks untranslated');
  assert.ok(hiHits > Object.keys(files.en).length * 0.95, 'Hindi file looks untranslated');
});

test('every error code the backend can return has a translation', () => {
  const root = path.join(__dirname, '..', '..', 'backend', 'src', 'main', 'java');
  const codes = new Set();
  (function walk(dir) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) { walk(p); continue; }
      if (!f.name.endsWith('.java')) continue;
      const src = fs.readFileSync(p, 'utf8');
      const patterns = [
        /new \w*Exception\("([A-Z][A-Z_]+)"/g,                       // new BadRequestException("CODE", ...)
        /build\(HttpStatus\.\w+, "([A-Z][A-Z_]+)"/g,                 // GlobalExceptionHandler
        /writeError\(res, mapper, \d+, "([A-Z][A-Z_]+)"/g            // SecurityConfig
      ];
      for (const re of patterns) { let m; while ((m = re.exec(src))) codes.add(m[1]); }
    }
  })(root);
  assert.ok(codes.size >= 35, 'expected to find the backend error codes, found ' + codes.size);
  const missing = [...codes].filter((c) => !('error.' + c in files.en));
  assert.deepStrictEqual(missing, [], 'untranslated error codes: ' + missing.join(', '));
});

test('every symptom-page and doctor-page enum value used by the API has a label', () => {
  for (const d of ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']) assert.ok('day.' + d in files.en);
  for (const s of ['IN_STOCK','LOW_STOCK','OUT_OF_STOCK','UNAVAILABLE']) assert.ok('stock.' + s in files.en);
  for (const s of ['MANUAL_OVERRIDE','SCHEDULE','NO_SCHEDULE']) assert.ok('doctor.source.' + s in files.en);
  for (const s of ['NO_PHARMACY_NEARBY','MEDICINE_NOT_FOUND']) assert.ok('search.' + s in files.en);
  for (const s of ['HOSPITAL','PHC','CHC','CLINIC']) assert.ok('centre.type.' + s in files.en);
  for (const s of ['USER','PHARMACY','HEALTHCARE_PROVIDER','ADMIN']) assert.ok('role.' + s in files.en);
  for (const s of ['PENDING','VERIFIED','REJECTED']) assert.ok('status.' + s in files.en);
});

test('normalizeLang', () => {
  assert.strictEqual(normalizeLang('kn-IN'), 'kn');
  assert.strictEqual(normalizeLang('HI'), 'hi');
  assert.strictEqual(normalizeLang('fr'), null);
  assert.strictEqual(normalizeLang(null), null);
});

test('format keeps unknown placeholders visible and fills known ones', () => {
  assert.strictEqual(format('{distance} km away', { distance: 2.5 }), '2.5 km away');
  assert.strictEqual(format('Page {page} of {total}', { page: 1 }), 'Page 1 of {total}');
  assert.strictEqual(format('{n} items', { n: 0 }), '0 items');
});

test('translate falls back to English, then to the key', () => {
  assert.strictEqual(translate({ a: 'ಎ' }, { a: 'A', b: 'B' }, 'a'), 'ಎ');
  assert.strictEqual(translate({ a: 'ಎ' }, { a: 'A', b: 'B' }, 'b'), 'B');
  assert.strictEqual(translate({}, {}, 'missing.key'), 'missing.key');
});

test('chooseInitial: stored language wins, then browser, then English', () => {
  assert.strictEqual(chooseInitial('hi', ['kn-IN']), 'hi');
  assert.strictEqual(chooseInitial(null, ['fr-FR', 'kn-IN', 'en']), 'kn');
  assert.strictEqual(chooseInitial('xx', ['de']), 'en');
  assert.strictEqual(chooseInitial(null, undefined), 'en');
});

test('errorMessage translates known codes and uses the server text for unknown ones', () => {
  assert.strictEqual(errorMessage(files.hi, files.en, 'INVALID_CREDENTIALS', 'x'), files.hi['error.INVALID_CREDENTIALS']);
  assert.strictEqual(errorMessage(files.hi, files.en, 'SOMETHING_NEW', 'Server text'), 'Server text');
  assert.strictEqual(errorMessage(files.hi, files.en, 'SOMETHING_NEW'), files.hi['error.INTERNAL_ERROR']);
});
