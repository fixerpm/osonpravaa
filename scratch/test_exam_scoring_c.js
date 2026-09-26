const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
    clipboard: { writeText: async () => true }
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

// Load real data.js
const dataJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
vm.runInContext(dataJs, context);

// Mock UI & sound
vm.runInContext(`
window.OSON_UI = {
  openModal: (id) => {},
  closeModal: (id) => {},
  showToast: (m, t) => {},
  triggerConfetti: () => {},
  updateHeroReadiness: () => {}
};
window.OSON_SOUND = {
  playSuccess: () => {},
  playWrong: () => {}
};
window.OSON_STORAGE = {
  saveTestResult: (record) => { window._lastResult = record; }
};
window.OSON_CERTIFICATE = {
  createOrUpdateCertificate: (data) => ({ ...data, certId: 'CERT-123' })
};
`, context);

// Load real exam.js
const examJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'exam.js'), 'utf8');
vm.runInContext(examJs, context);

console.log('--- TEST A: Answer all 20 with C (index 2) ---');
context.window.OSON_EXAM.startExam();
for (let i = 0; i < 20; i++) {
  context.window.OSON_EXAM.selectOption(2); // C
  if (i < 19) context.window.OSON_EXAM.next();
}
context.window.OSON_EXAM.finishExam();
console.log('Result with all C:', context.window._lastResult);
if (context.window._lastResult.score !== 20 || !context.window._lastResult.passed) {
  throw new Error('Expected 20/20 and passed === true when choosing all C');
}

console.log('--- TEST B: Answer all 20 with A (index 0) ---');
context.window.OSON_EXAM.startExam();
for (let i = 0; i < 20; i++) {
  context.window.OSON_EXAM.selectOption(0); // A
  if (i < 19) context.window.OSON_EXAM.next();
}
context.window.OSON_EXAM.finishExam();
console.log('Result with all A:', context.window._lastResult);
if (context.window._lastResult.score !== 0 || context.window._lastResult.passed) {
  throw new Error('Expected 0/20 and passed === false when choosing all A');
}

console.log('--- TEST C: Answer all 20 with B (index 1) ---');
context.window.OSON_EXAM.startExam();
for (let i = 0; i < 20; i++) {
  context.window.OSON_EXAM.selectOption(1); // B
  if (i < 19) context.window.OSON_EXAM.next();
}
context.window.OSON_EXAM.finishExam();
console.log('Result with all B:', context.window._lastResult);
if (context.window._lastResult.score !== 0 || context.window._lastResult.passed) {
  throw new Error('Expected 0/20 and passed === false when choosing all B');
}

console.log('--- TEST D: Answer all 20 with D (index 3) ---');
context.window.OSON_EXAM.startExam();
for (let i = 0; i < 20; i++) {
  context.window.OSON_EXAM.selectOption(3); // D
  if (i < 19) context.window.OSON_EXAM.next();
}
context.window.OSON_EXAM.finishExam();
console.log('Result with all D:', context.window._lastResult);
if (context.window._lastResult.score !== 0 || context.window._lastResult.passed) {
  throw new Error('Expected 0/20 and passed === false when choosing all D');
}

console.log('--- TEST E: Answer 18 C, 1 A, 1 B ---');
context.window.OSON_EXAM.startExam();
for (let i = 0; i < 20; i++) {
  if (i === 0) context.window.OSON_EXAM.selectOption(0); // A
  else if (i === 1) context.window.OSON_EXAM.selectOption(1); // B
  else context.window.OSON_EXAM.selectOption(2); // C
  if (i < 19) context.window.OSON_EXAM.next();
}
context.window.OSON_EXAM.finishExam();
console.log('Result with 18 C:', context.window._lastResult);
if (context.window._lastResult.score !== 18 || !context.window._lastResult.passed) {
  throw new Error('Expected 18/20 and passed === true');
}

console.log('--- TEST F: Answer 17 C, 3 D ---');
context.window.OSON_EXAM.startExam();
for (let i = 0; i < 20; i++) {
  if (i < 3) context.window.OSON_EXAM.selectOption(3); // D
  else context.window.OSON_EXAM.selectOption(2); // C
  if (i < 19) context.window.OSON_EXAM.next();
}
context.window.OSON_EXAM.finishExam();
console.log('Result with 17 C:', context.window._lastResult);
if (context.window._lastResult.score !== 17 || context.window._lastResult.passed) {
  throw new Error('Expected 17/20 and passed === false');
}

console.log('\n========================================');
console.log('ALL EXAM SCORING TESTS PASSED PERFECTLY!');
console.log('========================================');
