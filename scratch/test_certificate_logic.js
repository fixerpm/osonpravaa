/**
 * Comprehensive Automated Verification for OSON PRAVA Certificate & Scoring System
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
      classList: {
        add: (...classes) => {},
        remove: (...classes) => {},
        contains: (cls) => false
      },
      querySelectorAll: () => [],
      querySelector: () => null,
      setAttribute: () => {},
      disabled: false
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

// Global context
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

// Load modules
const baseDir = path.join(__dirname, '..');
const uiDummy = `
window.OSON_UI = {
  openModal: (id) => { window._lastOpenedModal = id; },
  closeModal: (id) => { window._lastClosedModal = id; },
  showToast: (msg, type) => { window._lastToast = { msg, type }; },
  updateHeroReadiness: () => {}
};
`;
vm.runInContext(uiDummy, context);

const storageCode = fs.readFileSync(path.join(baseDir, 'js', 'storage.js'), 'utf8');
vm.runInContext(storageCode, context);

const authCode = fs.readFileSync(path.join(baseDir, 'js', 'auth.js'), 'utf8');
vm.runInContext(authCode, context);

const certCode = fs.readFileSync(path.join(baseDir, 'js', 'certificate.js'), 'utf8');
vm.runInContext(certCode, context);

console.log('--- STARTING VERIFICATION TESTS ---');

function assert(condition, message) {
  if (!condition) {
    console.error('❌ FAIL:', message);
    process.exit(1);
  } else {
    console.log('✅ PASS:', message);
  }
}

// TEST 1: Grading Logic
const calcGrade = context.window.OSON_CERTIFICATE.calculateGrade;
assert(calcGrade(100, true) === "A’LO (PASS)", "100% is A’LO (PASS)");
assert(calcGrade(95, true) === "A’LO (PASS)", "95% is A’LO (PASS)");
assert(calcGrade(90, true) === "YAXSHI (PASS)", "90% is YAXSHI (PASS)");
assert(calcGrade(85, true) === "YAXSHI (PASS)", "85% is YAXSHI (PASS)");
assert(calcGrade(75, true) === "QONIQARLI (PASS)", "75% passed is QONIQARLI (PASS)");
assert(calcGrade(75, false) === "QONIQARLI (FAIL)", "75% failed is QONIQARLI (FAIL)");
assert(calcGrade(50, false) === "QONIQARSIZ (FAIL)", "50% failed is QONIQARSIZ (FAIL)");
assert(calcGrade(0, false) === "QONIQARSIZ (FAIL)", "0% failed is QONIQARSIZ (FAIL)");

// TEST 2: Guest Visitor without Account
context.window.OSON_STORAGE.clearAllData();
context.window.OSON_CERTIFICATE.openCertificate();
const guestHtml = getOrCreateElement('certificate-content').innerHTML;
assert(guestHtml.includes("Sertifikat olish uchun tizimga kiring"), "Guest opens certificate -> shows login prompt");
assert(!guestHtml.includes("19 / 20") && !guestHtml.includes("95%"), "Guest does NOT see fake 19/20");

// TEST 3: Fresh User Registration (CASE 1 in user prompt)
const regRes = context.window.OSON_AUTH.register('Dilshod Aliyev', 'dilshod@test.uz', 'pass123', 'pass123');
assert(regRes.success === true, "User Dilshod registered successfully");
const userDilshod = context.window.OSON_AUTH.getUser();
assert(userDilshod && userDilshod.name === 'Dilshod Aliyev', "User Dilshod is active session");

// Check certificate before taking test
assert(context.window.OSON_CERTIFICATE.getStoredCertificate() === null, "New user has NO stored certificate");
context.window.OSON_CERTIFICATE.openCertificate();
const newAccHtml = getOrCreateElement('certificate-content').innerHTML;
assert(newAccHtml.includes("Sizda hali rasmiy sertifikat mavjud emas"), "New account sees empty state message");
assert(!newAccHtml.includes("19 / 20") && !newAccHtml.includes("95%"), "New account does NOT see fake 19/20");
assert(!newAccHtml.includes("A’LO (PASS)"), "New account does NOT see fake A’LO (PASS)");

// TEST 4: Perfect Exam (20/20 = 100%) (CASE 2 in user prompt)
const cert20 = context.window.OSON_CERTIFICATE.createOrUpdateCertificate({
  score: 20,
  total: 20,
  percentage: 100,
  passed: true
});
assert(cert20 !== null, "Certificate created for 20/20");
assert(cert20.score === 20 && cert20.total === 20, "Score is 20/20");
assert(cert20.percentage === 100, "Percentage is 100%");
assert(cert20.grade === "A’LO (PASS)", "Grade is A’LO (PASS)");
assert(cert20.certificateId.startsWith("OP-202"), "Certificate ID format is OP-YYYY-XXXXXX: " + cert20.certificateId);

context.window.OSON_CERTIFICATE.openCertificate();
const cert20Html = getOrCreateElement('certificate-content').innerHTML;
assert(cert20Html.includes("Dilshod Aliyev"), "Certificate contains Dilshod Aliyev name");
assert(cert20Html.includes("20 / 20"), "Certificate contains 20 / 20");
assert(cert20Html.includes("100%"), "Certificate contains 100%");
assert(cert20Html.includes("A’LO (PASS)"), "Certificate contains A’LO (PASS)");
assert(cert20Html.includes(cert20.certificateId), "Certificate displays exact certificate ID: " + cert20.certificateId);

// TEST 5: User takes 19/20 = 95% (CASE 3 in user prompt)
const cert19 = context.window.OSON_CERTIFICATE.createOrUpdateCertificate({
  score: 19,
  total: 20,
  percentage: 95,
  passed: true
});
assert(cert19.score === 19 && cert19.total === 20, "Score is 19/20");
assert(cert19.percentage === 95, "Percentage is 95%");
assert(cert19.grade === "A’LO (PASS)", "Grade is A’LO (PASS)");
assert(cert19.certificateId === cert20.certificateId, "User's unique certificate ID is preserved on re-examination");

context.window.OSON_CERTIFICATE.openCertificate();
const cert19Html = getOrCreateElement('certificate-content').innerHTML;
assert(cert19Html.includes("19 / 20"), "Certificate displays updated 19 / 20");
assert(cert19Html.includes("95%"), "Certificate displays 95%");

// TEST 6: User takes 18/20 = 90% (CASE 4 in user prompt)
const cert18 = context.window.OSON_CERTIFICATE.createOrUpdateCertificate({
  score: 18,
  total: 20,
  percentage: 90,
  passed: true
});
assert(cert18.score === 18 && cert18.total === 20, "Score is 18/20");
assert(cert18.percentage === 90, "Percentage is 90%");
assert(cert18.grade === "YAXSHI (PASS)", "Grade for 90% is YAXSHI (PASS)");

context.window.OSON_CERTIFICATE.openCertificate();
const cert18Html = getOrCreateElement('certificate-content').innerHTML;
assert(cert18Html.includes("18 / 20"), "Certificate displays 18 / 20");
assert(cert18Html.includes("90%"), "Certificate displays 90%");
assert(cert18Html.includes("YAXSHI (PASS)"), "Certificate displays YAXSHI (PASS)");

// TEST 7: Failing score (15/20 = 75%) (CASE 4 & 5 in user prompt)
const certFail = context.window.OSON_CERTIFICATE.createOrUpdateCertificate({
  score: 15,
  total: 20,
  percentage: 75,
  passed: false
});
assert(certFail === null, "Failed exam (15/20) does NOT produce a certificate");

// TEST 8: Multi-User Isolation (CASE 6 in user prompt)
// Logout User A (Dilshod Aliyev)
context.window.OSON_AUTH.logout();
assert(context.window.OSON_AUTH.getUser() === null, "Dilshod logged out");

// Register User B (Malika Karimova)
const regB = context.window.OSON_AUTH.register('Malika Karimova', 'malika@test.uz', 'pass456', 'pass456');
assert(regB.success === true, "User Malika registered");
const userMalika = context.window.OSON_AUTH.getUser();
assert(userMalika && userMalika.name === 'Malika Karimova', "Malika is now active user");

// Malika opens certificate -> MUST NOT see Dilshod's certificate!
assert(context.window.OSON_CERTIFICATE.getStoredCertificate() === null, "Malika has NO certificate");
context.window.OSON_CERTIFICATE.openCertificate();
const malikaHtml = getOrCreateElement('certificate-content').innerHTML;
assert(malikaHtml.includes("Sizda hali rasmiy sertifikat mavjud emas"), "Malika sees empty state");
assert(!malikaHtml.includes("Dilshod Aliyev"), "Malika does NOT see Dilshod Aliyev");
assert(!malikaHtml.includes("18 / 20"), "Malika does NOT see Dilshod's 18/20 score");

// Malika passes exam with 20/20
const certMalika = context.window.OSON_CERTIFICATE.createOrUpdateCertificate({
  score: 20,
  total: 20,
  percentage: 100,
  passed: true
});
assert(certMalika.userName === "Malika Karimova", "Malika's certificate has her name");
assert(certMalika.certificateId !== cert18.certificateId, "Malika's certificate ID is unique from Dilshod's");

context.window.OSON_CERTIFICATE.openCertificate();
const malikaCertHtml = getOrCreateElement('certificate-content').innerHTML;
assert(malikaCertHtml.includes("Malika Karimova"), "Malika's certificate shows Malika Karimova");
assert(!malikaCertHtml.includes("Dilshod Aliyev"), "No cross-user contamination");

// Logout Malika, log back in as Dilshod
context.window.OSON_AUTH.logout();
const loginDilshod = context.window.OSON_AUTH.login('dilshod@test.uz', 'pass123');
assert(loginDilshod.success === true, "Dilshod logged back in");
const restoredDilshodCert = context.window.OSON_CERTIFICATE.getStoredCertificate();
assert(restoredDilshodCert !== null, "Dilshod's certificate is intact");
assert(restoredDilshodCert.userName === "Dilshod Aliyev", "Dilshod's certificate belongs to Dilshod Aliyev");
assert(restoredDilshodCert.score === 18, "Dilshod's score is still 18 / 20");
assert(restoredDilshodCert.certificateId === cert18.certificateId, "Dilshod's certificate ID is still preserved");

console.log('--- ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
