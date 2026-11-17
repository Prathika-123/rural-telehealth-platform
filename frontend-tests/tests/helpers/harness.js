/*
 * Loads a real page (HTML + its real <script> files + real translation files) into jsdom,
 * with only the backend API and a few browser features (speech, geolocation) stubbed.
 */
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..', '..', 'frontend');   // the app itself lives in ../frontend

function fakeJwt(payload) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return b({ alg: 'none' }) + '.' + b(payload) + '.sig';
}

class FakeRecognition {
  constructor() { FakeRecognition.last = this; }
  start() { this.started = true; setTimeout(() => this.onstart && this.onstart(), 0); }
  stop() { setTimeout(() => this.onend && this.onend(), 0); }
  emitResult(text) { this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] }); }
  emitError(code) { this.onerror && this.onerror({ error: code }); }
}

/**
 * opts: query ('?id=1'), api(req) -> {status, body} | Promise, user, geo {lat,lng}, language,
 *       speech (true = install a fake SpeechRecognition), geolocation (fake navigator.geolocation)
 */
async function openPage(file, opts = {}) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const calls = [], navs = [], errors = [];
  let pending = 0;
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message));
  vc.on('error', (...a) => errors.push(a.join(' ')));

  const dom = new JSDOM(html, {
    url: 'http://localhost:8080/' + file + (opts.query || ''),
    runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(window) {
      window.RHP = { nav: { go: (u) => navs.push(['go', u]), replace: (u) => navs.push(['replace', u]) } };
      if (opts.user) {
        window.localStorage.setItem('rhp.token', fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }));
        window.localStorage.setItem('rhp.user', JSON.stringify(opts.user));
      }
      if (opts.language) window.localStorage.setItem('rhp.lang', opts.language);
      if (opts.geo) window.sessionStorage.setItem('rhp.loc', JSON.stringify({ lat: opts.geo.lat, lng: opts.geo.lng, source: 'gps' }));
      if (opts.speech) window.webkitSpeechRecognition = FakeRecognition;
      if (opts.geolocation) Object.defineProperty(window.navigator, 'geolocation', { value: opts.geolocation, configurable: true });
      if (opts.setup) opts.setup(window);
      window.fetch = (url, init = {}) => {
        pending++;
        return Promise.resolve().then(async () => {
          try {
            const u = new URL(url, 'http://localhost:8080/');
            if (u.pathname.startsWith('/js/i18n/')) {
              const body = JSON.parse(fs.readFileSync(path.join(ROOT, u.pathname), 'utf8'));
              return { ok: true, status: 200, json: async () => body };
            }
            const req = { method: init.method || 'GET', path: u.pathname.replace('/api/v1', ''),
              query: Object.fromEntries(u.searchParams), body: init.body ? JSON.parse(init.body) : undefined, headers: init.headers || {} };
            calls.push(req);
            const res = (opts.api && (await opts.api(req))) || { status: 404, body: { code: 'NOT_FOUND', message: 'no stub' } };
            return { ok: res.status < 400, status: res.status, json: async () => (res.body === undefined ? null : res.body) };
          } finally { pending--; }
        });
      };
    }
  });
  const { window } = dom;

  // run the page's own scripts, in order
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  for (const s of scripts) window.eval(fs.readFileSync(path.join(ROOT, s), 'utf8'));

  const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
  async function settle() {
    let quiet = 0;
    for (let i = 0; i < 200 && quiet < 4; i++) { await tick(); quiet = pending === 0 ? quiet + 1 : 0; }
  }
  await settle();

  const doc = window.document;
  return {
    window, doc, calls, navs, errors, settle, tick,
    $: (sel, root) => (root || doc).querySelector(sel),
    $$: (sel, root) => [...(root || doc).querySelectorAll(sel)],
    text: (sel) => { const e = doc.querySelector(sel); return e ? e.textContent.trim() : null; },
    click: (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })),
    type: (el, value) => { el.value = value; el.dispatchEvent(new window.Event('input', { bubbles: true })); },
    submit: (form) => form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })),
    change: (el, value) => { el.value = value; el.dispatchEvent(new window.Event('change', { bubbles: true })); },
    close: () => window.close()
  };
}

const USER = { id: 1, name: 'Asha', email: 'asha@example.com', role: 'USER', language: 'en', enabled: true };
const roleUser = (role) => Object.assign({}, USER, { role, name: role });

/** A fake speechSynthesis with the given voice languages; records what was spoken. */
function fakeSynth(window, langs, spoken) {
  window.speechSynthesis = { getVoices: () => langs.map((l) => ({ lang: l, name: l })), cancel() {}, speak(u) { spoken.push(u.text); u.onend && u.onend(); }, addEventListener() {} };
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
}

module.exports = { fakeSynth, openPage, fakeJwt, FakeRecognition, USER, roleUser };
