const assert = require('node:assert');

function accessibleName(doc, el) {
  if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
  if (el.id && doc.querySelector(`label[for="${el.id}"]`)) return doc.querySelector(`label[for="${el.id}"]`).textContent.trim();
  const wrap = el.closest('label'); if (wrap) return wrap.textContent.trim();
  return (el.textContent || '').trim() || el.getAttribute('title') || '';
}

/** Checks the DOM as it is right now: named controls, valid aria-describedby, unique ids, alt text, tabindex. */
function audit(doc, where) {
  for (const el of doc.querySelectorAll('input:not([type=hidden]), select, textarea, button, a[href]')) {
    assert.ok(accessibleName(doc, el), `${where}: unnamed <${el.tagName.toLowerCase()}> ${el.outerHTML.slice(0, 100)}`);
  }
  for (const el of doc.querySelectorAll('[tabindex]')) assert.ok(Number(el.getAttribute('tabindex')) <= 0, where + ': positive tabindex');
  for (const img of doc.querySelectorAll('img')) assert.ok(img.hasAttribute('alt'), where + ': img without alt');
  for (const i of doc.querySelectorAll('[aria-describedby]')) {
    for (const id of i.getAttribute('aria-describedby').split(' ')) assert.ok(doc.getElementById(id), `${where}: aria-describedby -> missing #${id}`);
  }
  const ids = [...doc.querySelectorAll('[id]')].map((e) => e.id);
  assert.strictEqual(new Set(ids).size, ids.length, `${where}: duplicate ids ${ids.filter((x, i) => ids.indexOf(x) !== i)}`);
  for (const d of doc.querySelectorAll('dialog')) assert.ok(d.getAttribute('aria-label'), where + ': dialog without a name');
  for (const t of doc.querySelectorAll('[role=tab]')) assert.ok(t.hasAttribute('aria-selected'), where + ': tab without aria-selected');
  for (const b of doc.querySelectorAll('[aria-pressed]')) assert.ok(['true', 'false'].includes(b.getAttribute('aria-pressed')), where + ': bad aria-pressed');
}
module.exports = { audit, accessibleName };
