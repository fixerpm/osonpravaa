/**
 * Integration Test for Exam Simulator & Certificate Flow
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const baseDir = path.join(__dirname, '..');

// Setup environment
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
      classList: {
        _classes: new Set(),
        add: function(...classes) { classes.forEach(c => this._classes.add(c)); },
        remove: function(...classes) { classes.forEach(c => this._classes.delete(c)); },
        contains: function(c) { return this._classes.has(c); }
      },
      querySelectorAll: () => [],
      querySelector: () => null,
      setAttribute: () => {},
      disabled: false,
      parentElement: {
        classList: {
          add: () => {},
          remove: () => {}
        }
      }
    };
  }
  return domElements[id];
}

const mockWindow = {
  localStorage: localStorageMock,
  location: { hash: '' },
  matchMedia: () => ({ matches: false }),
  document: {
    getElementById: (id) => getOrCreateElement(id),
    querySelectorAll: () => [],
    addEventListener: () => {}
  },
  navigator: {
    clipboard: {
      writeText: async (text) => true
    }
  }
};
mockWindow.window = mockWindow;

const context = vm.createContext({
  window: mockWindow,
  document: mockWindow.document,
  localStorage: localStorageMock,
  navigator: mockWindow.navigator,
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval
});

// Load mocks and data
vm.runInContext(`
window.OSON_UI = {
  openModal: (id) => { window._modal = id; },
  closeModal: (id) => { window._modal = null; },
  showToast: (m, t) => {},
  triggerConfetti: () => {},
  updateHeroReadiness: () => {}
};
window.OSON_SOUND = {
  playSuccess: () => {},
  playWrong: () => {}
};
`, context);

// Mock questions in OSON_DATA
const questions = [];
for (let i = 1; i <= 25; i++) {
  questions.push({
    id: i,
    question: "Savol #" + i,
    options: ["Variant A", "Variant B", "Variant C"],
    correctIndex: 0,
    explanation: "Izoh #" + i
  });
}

vm.runInContext(`window.OSON_DATA = { questions: ${JSON.stringify(questions)} };`, context);

// Load files
['storage.js', 'auth.js', 'certificate.js', 'exam.js'].forEach(file => {
  const code = fs.readFileSync(path.join(baseDir, 'js', file), 'utf8');
  vm.runInContext(code, context);
});

console.log('--- STARTING EXAM INTEGRATION TESTS ---');

function assert(condition, message) {
  if (!condition) {
    console.error('❌ FAIL:', message);
    process.exit(1);
  } else {
    console.log('✅ PASS:', message);
  }
}

// 1. Register candidate "Jasur Bek"
context.window.OSON_AUTH.register("Jasur Bek", "jasur@test.uz", "pass123", "pass123");
assert(context.window.OSON_AUTH.getUser().name === "Jasur Bek", "Jasur Bek registered");

// 2. Start Exam
context.window.OSON_EXAM.startExam();

// Answer all 20 questions correctly
for (let i = 0; i < 20; i++) {
  context.window.OSON_EXAM.jumpTo(i);
  context.window.OSON_EXAM.selectOption(0); // correctIndex is 0
}

// Finish exam
context.window.OSON_EXAM.finishExam();

const certBtn = getOrCreateElement('exam-claim-cert-btn');
assert(!certBtn.classList.contains('hidden'), "Claim Certificate button is visible after 20/20 pass");

// Click certificate button
certBtn.onclick();
const certModalHtml = getOrCreateElement('certificate-content').innerHTML;
assert(certModalHtml.includes("Jasur Bek"), "Certificate has Jasur Bek name");
assert(certModalHtml.includes("20 / 20"), "Certificate has 20 / 20");
assert(certModalHtml.includes("100%"), "Certificate has 100%");
assert(certModalHtml.includes("A’LO (PASS)"), "Certificate has A’LO (PASS)");

// Verify saved record in storage
const savedCert = context.window.OSON_STORAGE.getCertificate();
assert(savedCert !== null, "Certificate is stored in user-scoped storage");
assert(savedCert.score === 20, "Stored score is 20");
assert(savedCert.percentage === 100, "Stored percentage is 100");

// 3. Test Fail Case: restart exam and answer only 10 questions correctly
context.window.OSON_EXAM.startExam();
for (let i = 0; i < 10; i++) {
  context.window.OSON_EXAM.jumpTo(i);
  context.window.OSON_EXAM.selectOption(0); // 10 correct
}
for (let i = 10; i < 20; i++) {
  context.window.OSON_EXAM.jumpTo(i);
  context.window.OSON_EXAM.selectOption(1); // 10 wrong
}
context.window.OSON_EXAM.finishExam();
assert(certBtn.classList.contains('hidden'), "Claim Certificate button is HIDDEN after failed 10/20 exam");

console.log('--- ALL EXAM INTEGRATION TESTS PASSED! ---');
