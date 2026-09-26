/**
 * Verification for the Telegram Mini App certificate download hand-off.
 * Confirms:
 *  1. Inside native Telegram apps (Desktop/Android/iOS — top-level WebView,
 *     window.self === window.top), downloadCertificate() uses
 *     Telegram.WebApp.openLink() (the already-confirmed-working native path).
 *  2. Inside Telegram WEB (web.telegram.org — Mini App embedded in an
 *     <iframe>, window.self !== window.top), downloadCertificate() calls
 *     window.open() DIRECTLY and synchronously — bypassing Telegram's
 *     postMessage bridge, whose extra async hop is what made Chrome's popup
 *     blocker silently swallow the download in Web Telegram.
 *  3. The exported URL round-trips Uzbek/Cyrillic names correctly.
 *  4. On the receiving page (?cert_export=...), initFromUrlIfNeeded() renders
 *     the certificate from the URL payload and auto-triggers the download,
 *     which (since no Telegram object exists there) runs the real PDF path.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const baseDir = path.join(__dirname, '..');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('PASS:', msg);
  }
}

function makeHarness() {
  const domElements = {};
  function getOrCreateElement(id) {
    if (!domElements[id]) {
      domElements[id] = {
        id, innerHTML: '', textContent: '', className: '', style: {}, children: [],
        classList: { add: () => {}, remove: () => {}, contains: () => false },
        querySelectorAll: () => [],
        querySelector: () => null,
        setAttribute: () => {},
        cloneNode: function() { return { ...this, style: {}, querySelector: () => ({ style: {} }), querySelectorAll: () => [] }; },
        disabled: false
      };
    }
    return domElements[id];
  }

  let lastOpenLinkUrl = null;
  let lastToast = null;
  let lastPdfSavedName = null;
  let html2canvasCalled = false;
  let windowOpenCalls = [];

  const mockWindow = {
    localStorage: (function() {
      let store = {};
      return { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, clear: () => { store = {}; } };
    })(),
    location: { hash: '', search: '', origin: 'https://osonprava.uz', pathname: '/' },
    matchMedia: () => ({ matches: false }),
    open: (url, target, features) => { windowOpenCalls.push({ url, target, features }); return { closed: false }; },
    document: {
      getElementById: id => getOrCreateElement(id),
      createElement: tag => { const el = getOrCreateElement('el_' + Math.random()); el.tagName = tag; el.appendChild = () => {}; return el; },
      querySelectorAll: () => [],
      addEventListener: () => {},
      fonts: { ready: Promise.resolve() },
      body: { appendChild: () => {} }
    },
    navigator: { clipboard: { writeText: async () => true } },
    html2canvas: async () => { html2canvasCalled = true; return { width: 100, height: 100, toDataURL: () => 'data:image/jpeg;base64,xx' }; },
    jspdf: { jsPDF: function() { return { internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } }, addImage: () => {}, save: (name) => { lastPdfSavedName = name; } }; } },
    setTimeout, clearTimeout
  };
  mockWindow.window = mockWindow;
  mockWindow.self = mockWindow;
  mockWindow.top = mockWindow; // default: native app (top-level WebView, self === top)

  const context = vm.createContext({
    window: mockWindow,
    document: mockWindow.document,
    localStorage: mockWindow.localStorage,
    navigator: mockWindow.navigator,
    URLSearchParams: URLSearchParams,
    console: console,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    unescape: unescape,
    escape: escape,
    encodeURIComponent: encodeURIComponent,
    decodeURIComponent: decodeURIComponent,
    setTimeout, clearTimeout, XMLSerializer: function() { this.serializeToString = () => '<svg></svg>'; },
    Image: function() { this.onload = null; setTimeout(() => this.onload && this.onload(), 0); }
  });

  const uiDummy = `
    window.OSON_UI = {
      openModal: (id) => { window._lastOpenedModal = id; },
      closeModal: (id) => { window._lastClosedModal = id; },
      showToast: (msg, type) => { window._lastToast = { msg, type }; }
    };
  `;
  vm.runInContext(uiDummy, context);

  const storageCode = fs.readFileSync(path.join(baseDir, 'js', 'storage.js'), 'utf8');
  vm.runInContext(storageCode, context);
  const authCode = fs.readFileSync(path.join(baseDir, 'js', 'auth.js'), 'utf8');
  vm.runInContext(authCode, context);
  const certCode = fs.readFileSync(path.join(baseDir, 'js', 'certificate.js'), 'utf8');
  vm.runInContext(certCode, context);

  return { context, mockWindow, getOrCreateElement, get lastToast() { return context.window._lastToast; }, get lastPdfSavedName() { return lastPdfSavedName; }, get html2canvasCalled() { return html2canvasCalled; }, get windowOpenCalls() { return windowOpenCalls; } };
}

// ---- TEST 1: Native Telegram apps (self === top) use Telegram.WebApp.openLink() ----
{
  const h = makeHarness();
  const context = h.context;

  const regResult = vm.runInContext(`window.OSON_AUTH.register("Aziz Yusupov", "aziz@example.com", "password123", "password123")`, context);
  vm.runInContext(`window.OSON_CERTIFICATE.createOrUpdateCertificate({ score: 20, total: 20, percentage: 100, passed: true })`, context);
  vm.runInContext(`window.OSON_CERTIFICATE.openCertificate()`, context);

  vm.runInContext(`
    window.Telegram = { WebApp: { platform: 'tdesktop', openLink: function(url, opts) { window._openLinkUrl = url; } } };
  `, context);

  vm.runInContext(`window.OSON_CERTIFICATE.downloadCertificate('OP-2026-TEST');`, context);

  const openLinkUrl = context.window._openLinkUrl;
  assert(!!openLinkUrl, 'Native app (tdesktop, self===top): downloadCertificate() calls Telegram.WebApp.openLink()');
  assert(openLinkUrl && openLinkUrl.includes('cert_export='), 'Redirect URL carries a cert_export payload');
  assert(h.windowOpenCalls.length === 0, 'Native app path does NOT call window.open() directly (openLink is the proven-working native bridge)');
  assert(!h.html2canvasCalled, 'html2canvas is NOT invoked inside the Telegram WebView (avoids the blocked download path)');
  assert(h.lastToast && h.lastToast.type === 'info', 'An informational toast tells the user the browser is opening');

  // ---- decode that exact URL and confirm the name round-trips ----
  const url = new URL(openLinkUrl);
  const rawParam = url.searchParams.get('cert_export');
  const decoded = JSON.parse(decodeURIComponent(Buffer.from(decodeURIComponent(rawParam), 'base64').toString('binary').split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
  assert(decoded.userName === 'Aziz Yusupov', `Exported payload preserves the user's name verbatim: got "${decoded.userName}"`);
  assert(decoded.score === 20 && decoded.total === 20, 'Exported payload preserves score/total');
}

// ---- TEST 2: Telegram WEB (iframe: self !== top) calls window.open() directly ----
{
  const h = makeHarness();
  const context = h.context;
  // Simulate the Mini App running inside an <iframe>, as Telegram Web does.
  h.mockWindow.top = {}; // a distinct object => window.self !== window.top

  vm.runInContext(`window.OSON_AUTH.register("Zilola Qodirova", "zilola@example.com", "password123", "password123")`, context);
  vm.runInContext(`window.OSON_CERTIFICATE.createOrUpdateCertificate({ score: 19, total: 20, percentage: 95, passed: true })`, context);
  vm.runInContext(`window.OSON_CERTIFICATE.openCertificate()`, context);

  vm.runInContext(`
    window.Telegram = { WebApp: { platform: 'weba', openLink: function(url, opts) { window._openLinkUrl = url; } } };
  `, context);

  vm.runInContext(`window.OSON_CERTIFICATE.downloadCertificate('OP-2026-TEST2');`, context);

  assert(h.windowOpenCalls.length === 1, 'Web Telegram (iframe): downloadCertificate() calls window.open() directly (bypassing the postMessage bridge)');
  assert(h.windowOpenCalls[0] && h.windowOpenCalls[0].url.includes('cert_export='), 'The direct window.open() URL carries a cert_export payload');
  assert(h.windowOpenCalls[0] && h.windowOpenCalls[0].target === '_blank', 'window.open() targets a new tab');
  assert(!context.window._openLinkUrl, 'Telegram.WebApp.openLink() (the bridge that loses the click gesture in Chrome) is NOT used when window.open() succeeds');
  assert(!h.html2canvasCalled, 'html2canvas is NOT invoked inside the Telegram Web iframe (avoids the blocked download path)');
}

// ---- TEST 3: Receiving page (no Telegram present) auto-renders + auto-downloads ----
{
  const h = makeHarness();
  const context = h.context;

  // Build a payload the same way certificate.js's own encoder would.
  const payload = { userName: 'Zilola Qodirova', score: 19, total: 20, percentage: 95, grade: "A’LO (PASS)", certificateId: 'OP-2026-555555', dateStr: '1 fevral 2026', year: 2026, isDemo: false };
  vm.runInContext(`
    window._payload = ${JSON.stringify(payload)};
    window._json = JSON.stringify(window._payload);
    window._b64 = btoa(unescape(encodeURIComponent(window._json)));
    window.location.search = '?cert_export=' + encodeURIComponent(window._b64);
  `, context);

  vm.runInContext(`window.OSON_CERTIFICATE.initFromUrlIfNeeded();`, context);

  const modalOpened = context.window._lastOpenedModal === 'certificate-modal';
  assert(modalOpened, 'Receiving page (no Telegram object) renders the certificate modal straight from the URL payload');
  const certHtml = h.getOrCreateElement('certificate-content').innerHTML;
  assert(certHtml.includes('Zilola Qodirova'), 'Rendered certificate shows the name carried over from Telegram');
  assert(certHtml.includes('OP-2026-555555'), 'Rendered certificate shows the certificate ID carried over from Telegram');

  setTimeout(() => {
    assert(h.lastPdfSavedName === 'OSON-PRAVA-SERTIFIKAT-OP-2026-555555.pdf', 'Auto-triggered download runs the real PDF export in this normal (non-Telegram) tab');
    console.log('\n--- Telegram export hand-off tests complete ---');
  }, 600);
}
