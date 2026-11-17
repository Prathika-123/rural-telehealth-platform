// Automated accessibility basics for every page. This is a floor, not a full audit:
// it cannot judge colour contrast, screen-reader wording or real keyboard flow.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const FRONT = path.join(__dirname, '..', '..', 'frontend');
const { openPage, roleUser } = require('./helpers/harness');
const { audit } = require('./helpers/a11y');

const ROLE = { 'admin.html': 'ADMIN', 'pharmacy-dashboard.html': 'PHARMACY', 'inventory.html': 'PHARMACY', 'provider-dashboard.html': 'HEALTHCARE_PROVIDER' };

test('every page: language, one h1, landmarks, skip link target, named controls, no positive tabindex', async () => {
  const files = fs.readdirSync(FRONT).filter((f) => f.endsWith('.html')).sort();
  for (const lang of ['en', 'kn']) {
    for (const f of files) {
      const p = await openPage(f, { user: roleUser(ROLE[f] || 'USER'), language: lang, geo: { lat: 13.6, lng: 74.7 }, query: f.includes('details') ? '?id=1' : '',
        api: () => ({ status: 404, body: { code: 'NOT_FOUND', message: 'x' } }) });   // error state: the shell and static forms
      const d = p.doc, where = `${f} [${lang}]`;
      assert.strictEqual(d.documentElement.lang, lang, where + ': <html lang>');
      assert.ok(d.title && d.title.length > 1, where + ': has a title');
      assert.strictEqual(d.querySelectorAll('h1').length, 1, where + ': exactly one h1');
      assert.ok(d.querySelector('main#main') && d.querySelector('header') && d.querySelector('footer') && d.querySelector('nav[aria-label]'), where + ': landmarks');
      assert.ok(d.querySelector(d.querySelector('.skip-link').getAttribute('href')), where + ': skip link target exists');
      audit(d, where);
      p.close();
    }
  }
});

test('forms announce errors: error text regions are live and invalid fields are flagged', async () => {
  const p = await openPage('register.html');
  p.submit(p.$('#register-form'));
  assert.strictEqual(p.$('#name-err').getAttribute('role'), 'alert');
  assert.strictEqual(p.$('#name').getAttribute('aria-invalid'), 'true');
  assert.strictEqual(p.doc.activeElement, p.$('#name'), 'focus moves to the first invalid field');
  p.$('#name').value = 'Asha'; p.submit(p.$('#register-form'));
  assert.strictEqual(p.$('#name').getAttribute('aria-invalid'), null, 'flag cleared once fixed');
  p.close();
});
