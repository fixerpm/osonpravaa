/**
 * Comprehensive Automated Verification for OSON PRAVA Certificate Download Feature
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const baseDir = path.join(__dirname, '..');

// 1. Mock Browser Environment
const localStorageMock = (function() {
  let store = {};
  return {
    getItem: (key) => store[key] !== undefined ? store[key] : null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
    _dump: () => ({ ...store })
  };
})();

const domElements = {};
function getOrCreateElement(id) {
  if (!domElements[id]) {
    domElements[id] = {
      id,
      innerHTML: '',
      textContent: '',
      className: '',
      style: {},
      children: [],
      classList: {
        add: (...classes) => {},
        remove: (...classes) => {},
        contains: (cls) => false
      },
      querySelectorAll: (sel) => {
        const matches = [];
        if (sel === 'svg') {
          // Return dummy SVG elements if in printable-certificate
          return [
            {
              getAttribute: (attr) => attr === 'class' ? 'official-seal-svg' : null,
              getBoundingClientRect: () => ({ width: 144, height: 144 }),
              cloneNode: () => ({
                setAttribute: () => {},
                getAttribute: () => null
              }),
              parentNode: {
                replaceChild: (newChild, oldChild) => {}
              }
            },
            {
              getAttribute: (attr) => attr === 'class' ? 'qr-code-svg' : null,
              getBoundingClientRect: () => ({ width: 56, height: 56 }),
              cloneNode: () => ({
                setAttribute: () => {},
                getAttribute: () => null
              }),
              parentNode: {
                replaceChild: (newChild, oldChild) => {}
              }
            }
          ];
        }
        return [];
      },
      querySelector: (sel) => null,
      setAttribute: () => {},
      cloneNode: function(deep) {
        const cloned = { ...this };
        cloned.style = { ...this.style };
        cloned.querySelector = () => ({ style: {} });
        cloned.querySelectorAll = this.querySelectorAll;
        return cloned;
      },
      disabled: false
    };
  }
  return domElements[id];
}

let lastToast = null;
let lastPdfSavedName = null;

const mockWindow = {
  localStorage: localStorageMock,
  location: { hash: '' },
  matchMedia: () => ({ matches: false }),
  document: {
    getElementById: (id) => getOrCreateElement(id),
    createElement: (tag) => {
      const el = getOrCreateElement('el_' + Math.random());
      el.tagName = tag.toUpperCase();
      el.appendChild = (child) => el.children.push(child);
      el.removeChild = (child) => {
        el.children = el.children.filter(c => c !== child);
      };
      el.parentNode = {
        removeChild: (child) => {}
      };
      if (tag === 'canvas') {
        el.getContext = () => ({
          drawImage: () => {},
          imageSmoothingEnabled: true,
          imageSmoothingQuality: 'high'
        });
        el.toDataURL = () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      }
      return el;
    },
    body: {
      appendChild: () => {},
      removeChild: () => {}
    },
    querySelectorAll: () => [],
    addEventListener: () => {},
    fonts: {
      ready: Promise.resolve()
    }
  },
  navigator: {
    clipboard: {
      writeText: async (text) => true
    }
  },
  html2canvas: async (elem, opts) => {
    return {
      width: 1920,
      height: 1200,
      toDataURL: (type, quality) => 'data:image/jpeg;base64,/9j/fakeJpegData...'
    };
  },
  jspdf: {
    jsPDF: function(opts) {
      return {
        internal: {
          pageSize: {
            getWidth: () => 297,
            getHeight: () => 210
          }
        },
        addImage: function(data, fmt, x, y, w, h) {
          this._addedImage = { data, fmt, x, y, w, h };
        },
        save: function(filename) {
          lastPdfSavedName = filename;
        }
      };
    }
  },
  XMLSerializer: function() {
    return {
      serializeToString: (node) => '<svg></svg>'
    };
  },
  Image: function() {
    const img = {
      crossOrigin: '',
      src: '',
      onload: null,
      onerror: null
    };
    setTimeout(() => {
      if (typeof img.onload === 'function') img.onload();
    }, 5);
    return img;
  },
  btoa: (str) => Buffer.from(str).toString('base64'),
  unescape: (str) => str,
  encodeURIComponent: (str) => encodeURIComponent(str)
};

mockWindow.window = mockWindow;

const context = vm.createContext({
  window: mockWindow,
  document: mockWindow.document,
  localStorage: localStorageMock,
  navigator: mockWindow.navigator,
  html2canvas: mockWindow.html2canvas,
  jspdf: mockWindow.jspdf,
  XMLSerializer: mockWindow.XMLSerializer,
  Image: mockWindow.Image,
  btoa: mockWindow.btoa,
  unescape: mockWindow.unescape,
  encodeURIComponent: mockWindow.encodeURIComponent,
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  Promise: Promise
});

// UI Mock
const uiMock = `
window.OSON_UI = {
  openModal: (id) => { window._lastOpenedModal = id; },
  closeModal: (id) => { window._lastClosedModal = id; },
  showToast: (msg, type) => {
    window._lastToast = { msg, type };
  }
};
`;
vm.runInContext(uiMock, context);

// Load Storage, Auth, Certificate
const storageCode = fs.readFileSync(path.join(baseDir, 'js', 'storage.js'), 'utf8');
vm.runInContext(storageCode, context);

const authCode = fs.readFileSync(path.join(baseDir, 'js', 'auth.js'), 'utf8');
vm.runInContext(authCode, context);

const certCode = fs.readFileSync(path.join(baseDir, 'js', 'certificate.js'), 'utf8');
vm.runInContext(certCode, context);

function assert(condition, message) {
  if (!condition) {
    console.error('❌ FAIL:', message);
    process.exit(1);
  } else {
    console.log('✅ PASS:', message);
  }
}

console.log('--- STARTING CERTIFICATE DOWNLOAD REQUIREMENTS VERIFICATION ---');

(async () => {
  // 1. Setup genuine registered and passed user
  context.window.OSON_STORAGE.clearAllData();
  const reg = context.window.OSON_AUTH.register('Oybek Xodjayev', 'oybek@test.uz', 'pass123', 'pass123');
  assert(reg.success, "User Oybek registered");

  const cert = context.window.OSON_CERTIFICATE.createOrUpdateCertificate({
    score: 19,
    total: 20,
    percentage: 95,
    passed: true
  });
  assert(cert !== null, "Genuine certificate created");
  assert(cert.certificateId.startsWith("OP-202"), "Certificate ID format OP-YYYY-XXXXXX: " + cert.certificateId);

  // 2. Open Certificate Modal
  context.window.OSON_CERTIFICATE.openCertificate();
  const content = getOrCreateElement('certificate-content').innerHTML;

  // 3. UI Requirements
  assert(content.includes('id="printable-certificate"'), "Certificate has id='printable-certificate'");
  assert(content.includes('Oybek Xodjayev'), "Certificate displays user name");
  assert(content.includes('19 / 20'), "Certificate displays 19 / 20 score");
  assert(content.includes('95%'), "Certificate displays 95%");
  assert(content.includes("A’LO (PASS)"), "Certificate displays grade A’LO (PASS)");
  assert(content.includes(cert.certificateId), "Certificate displays genuine ID");
  assert(content.includes('MUVAFFAQIYAT SERTIFIKATI'), "Certificate contains title MUVAFFAQIYAT SERTIFIKATI");
  assert(content.includes('official-seal-stamp'), "Certificate contains official seal stamp");
  assert(content.includes('Haqiqiyligini tekshirish uchun QR-kodni skanerlang'), "Certificate contains QR code verification description");

  // 4. Modal action buttons checks:
  // "Ulashish" button MUST NOT be present in action buttons
  assert(!content.includes('<span>Ulashish</span>'), "“Ulashish” button is removed from certificate modal");
  // "Chop etish / PDF saqlash" button MUST NOT be present
  assert(!content.includes('Chop etish / PDF saqlash'), "“Chop etish / PDF saqlash” button is removed");
  assert(!content.includes('window.print()'), "window.print() is NOT used in modal buttons");

  // New download button check
  assert(content.includes('fa-download'), "Download button has icon fa-solid fa-download");
  assert(content.includes('Sertifikatni yuklab olish'), "Download button has text 'Sertifikatni yuklab olish'");
  assert(content.includes(`window.OSON_CERTIFICATE.downloadCertificate('${cert.certificateId}')`), "Download button has correct onclick handler");

  // 5. Test downloadCertificate execution
  assert(typeof context.window.OSON_CERTIFICATE.downloadCertificate === 'function', "downloadCertificate function is exported");

  // Create printable-certificate element in DOM for downloadCertificate
  const printableCert = getOrCreateElement('printable-certificate');
  printableCert.innerHTML = content;

  // Trigger download
  await context.window.OSON_CERTIFICATE.downloadCertificate(cert.certificateId);

  // 6. PDF File Name verification:
  const expectedFileName = `OSON-PRAVA-SERTIFIKAT-${cert.certificateId}.pdf`;
  assert(lastPdfSavedName === expectedFileName, `PDF was saved with dynamic filename: ${lastPdfSavedName} (expected: ${expectedFileName})`);

  // 7. Success Toast verification
  assert(context.window._lastToast && context.window._lastToast.msg === 'Sertifikat muvaffaqiyatli yuklab olindi ✓', "Success toast was displayed: 'Sertifikat muvaffaqiyatli yuklab olindi ✓'");
  assert(context.window._lastToast.type === 'success', "Toast type is 'success'");

  // 8. Test error handling
  // Temporarily force an error
  const origHtml2Canvas = context.window.html2canvas;
  context.window.html2canvas = async () => { throw new Error("Simulated canvas render fail"); };

  await context.window.OSON_CERTIFICATE.downloadCertificate(cert.certificateId);
  assert(context.window._lastToast && context.window._lastToast.msg === 'Sertifikatni yuklab olishda xatolik yuz berdi. Qayta urinib ko‘ring.', "Error toast was displayed on failure: 'Sertifikatni yuklab olishda xatolik yuz berdi. Qayta urinib ko‘ring.'");
  assert(context.window._lastToast.type === 'error', "Error toast type is 'error'");

  // Restore html2canvas
  context.window.html2canvas = origHtml2Canvas;

  // 9. Verify shareCertificate function still exists and works
  assert(typeof context.window.OSON_CERTIFICATE.shareCertificate === 'function', "shareCertificate function is still preserved");
  context.window.OSON_CERTIFICATE.shareCertificate(cert.certificateId);
  assert(context.window._lastToast && context.window._lastToast.msg.includes(cert.certificateId), "shareCertificate works as intended");

  console.log('--- ALL CERTIFICATE DOWNLOAD VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
})();
